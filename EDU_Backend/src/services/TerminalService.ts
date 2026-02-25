import { WebSocket, WebSocketServer } from 'ws';
import { Client as SSHClient } from 'ssh2';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { LabService } from './LabService';
import { docker } from '../utils/docker';
import { Duplex } from 'stream';

const DOCKER_HOST_IP = process.env.DOCKER_HOST || '192.168.20.3';
const SSH_PASSWORD = 'opencode';

interface TerminalConnection {
  ws: WebSocket;
  ssh?: SSHClient;
  stream: any;
  execStream?: Duplex;
}

const connections = new Map<string, TerminalConnection>();

export function setupTerminalWebSocket(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws/terminal',
  });

  wss.on('connection', async (ws, req) => {
    console.log('[Terminal] New WebSocket connection');

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const sessionId = url.searchParams.get('sessionId');
    const terminalId = url.searchParams.get('terminalId') || 'default';
    const mode = url.searchParams.get('mode') || 'ssh'; // 'ssh' 或 'exec'
    const command = url.searchParams.get('command') || '/bin/bash'; // exec 模式下执行的命令

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
      await handleDockerExec(ws, session.containerId, command, connectionId);
    } else {
      // SSH 模式 - 通过 SSH 连接
      await handleSSHConnection(ws, session.sshPort, connectionId, userId);
    }
  });

  console.log('[Terminal] WebSocket server initialized on /ws/terminal');
}

// Docker exec 模式处理
async function handleDockerExec(ws: WebSocket, containerId: string, command: string, connectionId: string) {
  try {
    const container = docker.getContainer(containerId);
    
    // 使用 tmux 来保持会话，这样刷新页面后可以恢复
    // tmux session 名称基于命令，确保同一命令使用同一会话
    const sessionName = `kiro_${command.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // 构建 tmux 命令：如果会话存在则 attach，否则创建新会话
    // 使用 remain-on-exit 选项，这样命令退出后窗口不会关闭
    // 如果命令失败，用户可以看到错误信息并手动执行命令
    const tmuxCmd = `tmux has-session -t ${sessionName} 2>/dev/null && tmux attach-session -t ${sessionName} || tmux new-session -s ${sessionName} -d '${command}; exec bash' \\; attach-session -t ${sessionName}`;
    
    // 创建 exec 实例
    const exec = await container.exec({
      Cmd: ['/bin/bash', '-c', tmuxCmd],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Env: ['TERM=xterm-256color'],
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
      const output = data.toString('utf-8');
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data: output }));
      }
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
    ws.on('message', async (message: Buffer) => {
      try {
        const msg = JSON.parse(message.toString());
        
        if (msg.type === 'input') {
          execStream.write(msg.data);
        } else if (msg.type === 'resize') {
          // Docker exec resize - 使用 tmux 的 resize 命令更可靠
          try {
            // 先尝试 Docker exec resize
            await exec.resize({ h: msg.rows, w: msg.cols });
          } catch (e) {
            // 如果失败，通过 tmux 发送 resize 信号
            // tmux 会自动处理窗口大小变化
          }
        }
      } catch {
        execStream.write(message.toString());
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
async function handleSSHConnection(ws: WebSocket, sshPort: number, connectionId: string, userId: number) {
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
    
    ssh.shell({ term: 'xterm-256color', cols: 120, rows: 30 }, (err, stream) => {
      if (err) {
        clearInterval(pingInterval);
        ws.send(JSON.stringify({ type: 'error', message: 'SSH shell 创建失败' }));
        ws.close();
        return;
      }

      connections.set(connectionId, { ws, ssh, stream });
      ws.send(JSON.stringify({ type: 'connected' }));

      stream.on('data', (data: Buffer) => {
        const output = data.toString('utf-8');
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data: output }));
        }
      });

      stream.stderr?.on('data', (data: Buffer) => {
        const output = data.toString('utf-8');
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data: output }));
        }
      });

      stream.on('close', () => {
        clearInterval(pingInterval);
        ws.close();
      });

      ws.on('message', (message: Buffer) => {
        try {
          const msg = JSON.parse(message.toString());
          
          if (msg.type === 'input') {
            stream.write(msg.data);
          } else if (msg.type === 'resize') {
            stream.setWindow(msg.rows, msg.cols, 0, 0);
          }
        } catch {
          stream.write(message.toString());
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
