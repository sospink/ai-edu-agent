import { RawData, WebSocket, WebSocketServer } from 'ws';
import { Client as SSHClient } from 'ssh2';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { LabService } from './LabService';
import { docker } from '../utils/docker';
import { Duplex } from 'stream';

const DOCKER_HOST_IP = process.env.DOCKER_HOST || '192.168.20.3';
const SSH_PASSWORD = 'opencode';
const TERMINAL_DEBUG = process.env.TERMINAL_DEBUG === '1';
type SessionPolicy = 'reuse' | 'restart';
type TransportMode = 'json' | 'raw';

interface TerminalConnection {
  ws: WebSocket;
  ssh?: SSHClient;
  stream: any;
  execStream?: Duplex;
}

const connections = new Map<string, TerminalConnection>();

function decodeInputBinaryBase64(rawData: unknown): Buffer {
  if (typeof rawData !== 'string') {
    throw new Error('二进制输入格式无效');
  }

  const encoded = rawData.trim();
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    throw new Error('二进制输入不是有效的 Base64 编码');
  }

  const decoded = Buffer.from(encoded, 'base64');
  if (encoded.length > 0 && decoded.length === 0) {
    throw new Error('二进制输入解码失败');
  }
  return decoded;
}

function logTerminalInput(connectionId: string, mode: 'ssh' | 'exec', inputType: string, bytes: number) {
  if (!TERMINAL_DEBUG) return;
  console.log(`[Terminal][${mode}] ${connectionId} message=${inputType} bytes=${bytes}`);
}

function normalizeSessionPolicy(rawPolicy: string | null): SessionPolicy {
  return rawPolicy === 'restart' ? 'restart' : 'reuse';
}

function normalizeTransportMode(rawMode: string | null): TransportMode {
  return rawMode === 'raw' ? 'raw' : 'json';
}

function toBuffer(rawData: RawData): Buffer {
  if (Buffer.isBuffer(rawData)) return rawData;
  if (Array.isArray(rawData)) return Buffer.concat(rawData);
  return Buffer.from(rawData);
}

function safeParseMessagePayload(message: string): any | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith('{"type":"resize"')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function normalizeTerminalSize(rawRows: unknown, rawCols: unknown): { rows: number; cols: number } | null {
  const rows = Number(rawRows);
  const cols = Number(rawCols);
  if (!Number.isFinite(rows) || !Number.isFinite(cols)) return null;
  if (rows < 2 || cols < 2) return null;
  return { rows: Math.floor(rows), cols: Math.floor(cols) };
}

export function setupTerminalWebSocket(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws/terminal',
  });

  wss.on('connection', async (ws, req) => {
    console.log('[Terminal] New WebSocket connection');
    const maybeSocket = (ws as any)?._socket;
    if (maybeSocket?.setNoDelay) {
      maybeSocket.setNoDelay(true);
    }

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const sessionId = url.searchParams.get('sessionId');
    const terminalId = url.searchParams.get('terminalId') || 'default';
    const mode = url.searchParams.get('mode') || 'ssh'; // 'ssh' 或 'exec'
    const command = url.searchParams.get('command') || '/bin/bash'; // exec 模式下执行的命令
    const sessionPolicy = normalizeSessionPolicy(url.searchParams.get('sessionPolicy'));
    const transportMode = normalizeTransportMode(url.searchParams.get('transport'));
    const initialCommand = (url.searchParams.get('initialCommand') || '').trim(); // ssh 模式首条命令
    const effectiveInitialCommand =
      initialCommand || (terminalId === 'openclaw' ? 'openclaw tui' : '');

    if (!token || !sessionId) {
      ws.send(JSON.stringify({ type: 'error', message: '缺少认证信息' }));
      ws.close();
      return;
    }

    let userId: number;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      userId = parseInt(decoded.userId);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: '认证失败' }));
      ws.close();
      return;
    }

    const session = await LabService.getActiveSession(userId);
    const parsedSessionId = parseInt(sessionId);

    if (!session || Number(session.id) !== parsedSessionId) {
      ws.send(JSON.stringify({ type: 'error', message: '实验会话不存在或已过期' }));
      ws.close();
      return;
    }

    const connectionId = `${userId}-${sessionId}-${terminalId}-${Date.now()}`;

    // 根据模式选择连接方式
    if (mode === 'exec') {
      // Docker exec 模式 - 直接在容器中执行命令
      await handleDockerExec(
        ws,
        session.containerId,
        command,
        connectionId,
        sessionPolicy,
        transportMode,
        terminalId,
      );
    } else {
      // SSH 模式 - 通过 SSH 连接
      await handleSSHConnection(ws, session.sshPort, connectionId, userId, effectiveInitialCommand, transportMode);
    }
  });

  console.log('[Terminal] WebSocket server initialized on /ws/terminal');
}

// Docker exec 模式处理
async function handleDockerExec(
  ws: WebSocket,
  containerId: string,
  command: string,
  connectionId: string,
  sessionPolicy: SessionPolicy,
  transportMode: TransportMode,
  terminalId: string
) {
  try {
    const container = docker.getContainer(containerId);
    
    // 优先使用 tmux 保持会话；若镜像未安装 tmux，则直接执行命令
    const escapedCommand = command.replace(/'/g, `'\\''`);
    const sessionName = `kiro_${command.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const restartSessionCmd =
      sessionPolicy === 'restart'
        ? `tmux kill-session -t ${sessionName} 2>/dev/null || true;`
        : '';
    const runCmd = [
      'if command -v tmux >/dev/null 2>&1; then',
      restartSessionCmd,
      `tmux has-session -t ${sessionName} 2>/dev/null && tmux attach-session -t ${sessionName} || tmux new-session -s ${sessionName} -d '${escapedCommand}; exec bash' \\; attach-session -t ${sessionName};`,
      'else',
      `bash -lc '${escapedCommand}; exec bash';`,
      'fi',
    ].join(' ');
    
    const needsRichColor = terminalId === 'opencode' || terminalId === 'openclaw' || /opencode|openclaw/i.test(command);
    const termValue = needsRichColor ? 'xterm-256color' : 'xterm';

    // 创建 exec 实例
    const exec = await container.exec({
      Cmd: ['/bin/bash', '-lc', runCmd],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      // Keep rich colors for TUI apps, use conservative fallback for regular shell/vim stability.
      Env: [`TERM=${termValue}`, 'COLORTERM=truecolor'],
    });

    // 启动 exec
    const execStream = await exec.start({
      hijack: true,
      stdin: true,
      Tty: true,
    });

    connections.set(connectionId, { ws, stream: execStream, execStream });
    ws.send(JSON.stringify({ type: 'connected' }));

    // 心跳检测
    let isAlive = true;
    const pingInterval = setInterval(() => {
      if (!isAlive) {
        console.log('[Terminal] Connection dead, closing');
        ws.terminate();
        return;
      }
      isAlive = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('pong', () => {
      isAlive = true;
    });

    // 处理输出
    execStream.on('data', (data: Buffer) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (transportMode === 'raw') {
        ws.send(data, { binary: true });
        return;
      }
      const output = data.toString('utf-8');
      ws.send(JSON.stringify({ type: 'output', data: output }));
    });

    execStream.on('end', () => {
      clearInterval(pingInterval);
      ws.close();
    });

    execStream.on('error', (err: Error) => {
      console.error('[Terminal] Exec stream error:', err);
      clearInterval(pingInterval);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
      ws.close();
    });

    // 处理输入
    ws.on('message', async (message: RawData, isBinary: boolean) => {
      try {
        if (transportMode === 'raw') {
          if (isBinary) {
            const chunk = toBuffer(message);
            if (chunk.length > 0) {
              execStream.write(chunk);
              logTerminalInput(connectionId, 'exec', 'input_raw_binary', chunk.length);
            }
            return;
          }

          const rawText = toBuffer(message).toString('utf-8');
          const control = safeParseMessagePayload(rawText);
          if (control?.type === 'resize') {
            const size = normalizeTerminalSize(control.rows, control.cols);
            if (!size) return;
            try {
              await exec.resize({ h: size.rows, w: size.cols });
            } catch {
              // ignore resize error in raw mode
            }
            return;
          }

          if (rawText.length > 0) {
            execStream.write(rawText);
            logTerminalInput(connectionId, 'exec', 'input_raw_text', Buffer.byteLength(rawText));
          }
          return;
        }

        const msg = JSON.parse(toBuffer(message).toString('utf-8'));
        
        if (msg.type === 'input') {
          const inputData = typeof msg.data === 'string' ? msg.data : '';
          execStream.write(inputData);
          logTerminalInput(connectionId, 'exec', 'input', Buffer.byteLength(inputData));
        } else if (msg.type === 'input_binary_base64') {
          try {
            const binaryChunk = decodeInputBinaryBase64(msg.data);
            if (binaryChunk.length > 0) {
              execStream.write(binaryChunk);
            }
            logTerminalInput(connectionId, 'exec', 'input_binary_base64', binaryChunk.length);
          } catch (decodeError: any) {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: `二进制输入解析失败: ${decodeError.message || '未知错误'}`,
              })
            );
          }
        } else if (msg.type === 'resize') {
          const size = normalizeTerminalSize(msg.rows, msg.cols);
          if (!size) return;
          // Docker exec resize - 使用 tmux 的 resize 命令更可靠
          try {
            // 先尝试 Docker exec resize
            await exec.resize({ h: size.rows, w: size.cols });
          } catch (e) {
            // 如果失败，通过 tmux 发送 resize 信号
            // tmux 会自动处理窗口大小变化
          }
        }
      } catch {
        const fallback = toBuffer(message);
        if (fallback.length > 0) {
          execStream.write(fallback);
        }
      }
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      execStream.end();
      connections.delete(connectionId);
    });

    ws.on('error', () => {
      clearInterval(pingInterval);
      execStream.end();
      connections.delete(connectionId);
    });

  } catch (err: any) {
    console.error('[Terminal] Docker exec error:', err);
    ws.send(JSON.stringify({ type: 'error', message: `Docker exec 失败: ${err.message}` }));
    ws.close();
  }
}

// SSH 模式处理
async function handleSSHConnection(
  ws: WebSocket,
  sshPort: number,
  connectionId: string,
  userId: number,
  initialCommand: string,
  transportMode: TransportMode
) {
  const ssh = new SSHClient();

  // 心跳检测
  let isAlive = true;
  const pingInterval = setInterval(() => {
    if (!isAlive) {
      console.log('[Terminal] SSH connection dead, closing');
      ws.terminate();
      return;
    }
    isAlive = false;
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000);

  ws.on('pong', () => {
    isAlive = true;
  });

  ssh.on('ready', () => {
    console.log(`[Terminal] SSH connected for user ${userId}`);
    
    // Use xterm to avoid terminfo mismatch on some production images.
    ssh.shell({ term: 'xterm', cols: 120, rows: 30 }, (err, stream) => {
      if (err) {
        clearInterval(pingInterval);
        ws.send(JSON.stringify({ type: 'error', message: 'SSH shell 创建失败' }));
        ws.close();
        return;
      }

      connections.set(connectionId, { ws, ssh, stream });
      ws.send(JSON.stringify({ type: 'connected' }));

      // 由服务端在 SSH shell 就绪后执行首条命令，避免前端发送时机过早
      if (initialCommand) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            stream.write(`${initialCommand}\n`);
          }
        }, 1500);
      }

      stream.on('data', (data: Buffer) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (transportMode === 'raw') {
          ws.send(data, { binary: true });
          return;
        }
        const output = data.toString('utf-8');
        ws.send(JSON.stringify({ type: 'output', data: output }));
      });

      stream.stderr?.on('data', (data: Buffer) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (transportMode === 'raw') {
          ws.send(data, { binary: true });
          return;
        }
        const output = data.toString('utf-8');
        ws.send(JSON.stringify({ type: 'output', data: output }));
      });

      stream.on('close', () => {
        clearInterval(pingInterval);
        ws.close();
      });

      ws.on('message', (message: RawData, isBinary: boolean) => {
        try {
          if (transportMode === 'raw') {
            if (isBinary) {
              const chunk = toBuffer(message);
              if (chunk.length > 0) {
                stream.write(chunk);
                logTerminalInput(connectionId, 'ssh', 'input_raw_binary', chunk.length);
              }
              return;
            }

            const rawText = toBuffer(message).toString('utf-8');
            const control = safeParseMessagePayload(rawText);
            if (control?.type === 'resize') {
              const size = normalizeTerminalSize(control.rows, control.cols);
              if (!size) return;
              stream.setWindow(size.rows, size.cols, 0, 0);
              return;
            }

            if (rawText.length > 0) {
              stream.write(rawText);
              logTerminalInput(connectionId, 'ssh', 'input_raw_text', Buffer.byteLength(rawText));
            }
            return;
          }

          const msg = JSON.parse(toBuffer(message).toString('utf-8'));
          
          if (msg.type === 'input') {
            const inputData = typeof msg.data === 'string' ? msg.data : '';
            stream.write(inputData);
            logTerminalInput(connectionId, 'ssh', 'input', Buffer.byteLength(inputData));
          } else if (msg.type === 'input_binary_base64') {
            try {
              const binaryChunk = decodeInputBinaryBase64(msg.data);
              if (binaryChunk.length > 0) {
                stream.write(binaryChunk);
              }
              logTerminalInput(connectionId, 'ssh', 'input_binary_base64', binaryChunk.length);
            } catch (decodeError: any) {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  message: `二进制输入解析失败: ${decodeError.message || '未知错误'}`,
                })
              );
            }
          } else if (msg.type === 'resize') {
            const size = normalizeTerminalSize(msg.rows, msg.cols);
            if (!size) return;
            stream.setWindow(size.rows, size.cols, 0, 0);
          }
        } catch {
          const fallback = toBuffer(message);
          if (fallback.length > 0) {
            stream.write(fallback);
          }
        }
      });

      ws.on('close', () => {
        clearInterval(pingInterval);
        stream.end();
        ssh.end();
        connections.delete(connectionId);
      });

      ws.on('error', () => {
        clearInterval(pingInterval);
        stream.end();
        ssh.end();
        connections.delete(connectionId);
      });
    });
  });

  ssh.on('error', (err) => {
    clearInterval(pingInterval);
    ws.send(JSON.stringify({ type: 'error', message: `SSH 连接失败: ${err.message}` }));
    ws.close();
  });

  ssh.connect({
    host: DOCKER_HOST_IP,
    port: sshPort,
    username: 'root',
    password: SSH_PASSWORD,
    readyTimeout: 10000,
    keepaliveInterval: 10000,
    keepaliveCountMax: 3,
  });
}
