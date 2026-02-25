import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// 模块级别的连接追踪，防止 StrictMode 双连接
// 使用 Set 记录正在连接的 key，连接完成后移除
const pendingConnections = new Set<string>();

interface WebTerminalProps {
  sessionId: number;
  sshPort: number;
  initialCommand?: string;  // SSH 模式下连接成功后自动执行的命令
  terminalId?: string;      // 终端唯一标识，用于区分多个终端
  disableMouse?: boolean;   // 禁用鼠标事件（用于 opencode 等 TUI 应用）
  mode?: 'ssh' | 'exec';    // 连接模式：ssh（默认）或 exec（Docker exec）
  command?: string;         // exec 模式下执行的命令
}

const WebTerminal: React.FC<WebTerminalProps> = ({ 
  sessionId, 
  initialCommand, 
  terminalId = 'default', 
  disableMouse = false,
  mode = 'ssh',
  command = '/bin/bash'
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dataListenerRef = useRef<{ dispose: () => void } | null>(null);
  const resizeListenerRef = useRef<{ dispose: () => void } | null>(null);
  const initialCommandSentRef = useRef<boolean>(false);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const mountedRef = useRef<boolean>(false);
  
  // 生成唯一连接 key
  const connectionKey = `${sessionId}-${terminalId}-${mode}`;

  const connect = () => {
    // 检查是否已有连接正在进行
    if (pendingConnections.has(connectionKey)) {
      console.log('[WebTerminal] Connection pending for', connectionKey);
      return;
    }
    
    // 检查是否已有 WebSocket 连接
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      console.log('[WebTerminal] WebSocket already exists for', connectionKey);
      return;
    }
    
    if (!terminalRef.current || !mountedRef.current) {
      return;
    }
    
    // 标记连接正在进行
    pendingConnections.add(connectionKey);
    console.log('[WebTerminal] Starting connection for', connectionKey);

    setStatus('connecting');
    setErrorMessage('');

    const initTerminal = () => {
      if (!terminalRef.current || !mountedRef.current) {
        pendingConnections.delete(connectionKey);
        return;
      }
      
      if (!terminalInstance.current) {
        const term = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
          convertEol: true,
          theme: {
            background: '#0c0c0c',
            foreground: '#d4d4d4',
            cursor: '#d4d4d4',
            cursorAccent: '#0c0c0c',
            selectionBackground: '#264f78',
          },
          allowProposedApi: true,
        });

        fitAddon.current = new FitAddon();
        term.loadAddon(fitAddon.current);
        term.open(terminalRef.current);
        
        setTimeout(() => {
          fitAddon.current?.fit();
        }, 50);

        terminalInstance.current = term;
      } else {
        terminalInstance.current.clear();
      }

      connectWebSocket();
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(initTerminal);
    });
  };

  const connectWebSocket = () => {
    // 再次检查是否已卸载
    if (!mountedRef.current) {
      pendingConnections.delete(connectionKey);
      return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      setStatus('error');
      setErrorMessage('未登录，请先登录');
      pendingConnections.delete(connectionKey);
      return;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 生产环境使用当前页面的 host（Nginx 会代理 /ws/），开发环境使用 localhost:4000
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    let wsHost: string;
    if (apiBaseUrl.startsWith('/') || apiBaseUrl === '') {
      // 相对路径（生产环境），使用当前页面的 host
      wsHost = window.location.host;
    } else {
      // 绝对路径（开发环境），提取 host
      wsHost = apiBaseUrl.replace(/^https?:\/\//, '').replace('/api', '') || 'localhost:4000';
    }
    const numericSessionId = typeof sessionId === 'string' ? parseInt(sessionId) : sessionId;
    
    // 构建 WebSocket URL，包含 mode 和 command 参数
    let wsUrl = `${wsProtocol}//${wsHost}/ws/terminal?token=${token}&sessionId=${numericSessionId}&terminalId=${terminalId}&mode=${mode}`;
    if (mode === 'exec') {
      wsUrl += `&command=${encodeURIComponent(command)}`;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'connected') {
          setStatus('connected');
          
          setTimeout(() => {
            if (terminalInstance.current && fitAddon.current) {
              fitAddon.current.fit();
              terminalInstance.current.focus();
              terminalInstance.current.writeln('\x1b[32m✓ 终端已连接\x1b[0m\r\n');
              
              const dims = fitAddon.current.proposeDimensions();
              if (dims && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
              }

              // SSH 模式下，如果有初始命令，等待 shell 准备好后发送
              if (mode === 'ssh' && initialCommand && !initialCommandSentRef.current) {
                initialCommandSentRef.current = true;
                setTimeout(() => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ 
                      type: 'input', 
                      data: initialCommand + '\n' 
                    }));
                  }
                }, 1500);
              }
            }
          }, 100);
        } else if (msg.type === 'output') {
          terminalInstance.current?.write(msg.data);
        } else if (msg.type === 'error') {
          setStatus('error');
          setErrorMessage(msg.message);
          terminalInstance.current?.writeln(`\x1b[31m✗ 错误: ${msg.message}\x1b[0m`);
        }
      } catch {
        terminalInstance.current?.write(event.data);
      }
    };

    ws.onclose = () => {
      // 连接关闭时移除 pending 状态
      pendingConnections.delete(connectionKey);
      if (status === 'connected') {
        setStatus('disconnected');
        terminalInstance.current?.writeln('\r\n\x1b[33m⚠ 连接已断开\x1b[0m');
      }
    };

    ws.onerror = () => {
      // 连接错误时移除 pending 状态
      pendingConnections.delete(connectionKey);
      setStatus('error');
      setErrorMessage('WebSocket 连接失败');
    };

    dataListenerRef.current?.dispose();
    resizeListenerRef.current?.dispose();

    dataListenerRef.current = terminalInstance.current?.onData((data) => {
      // 如果禁用鼠标，只过滤鼠标点击/移动事件，保留滚轮事件
      // 鼠标事件格式：ESC [ < Cb ; Cx ; Cy M/m
      // Cb: 按钮码，64-67 是滚轮事件，0-3 是点击事件
      if (disableMouse && data.startsWith('\x1b[<')) {
        // 解析按钮码
        const match = data.match(/^\x1b\[<(\d+);/);
        if (match) {
          const buttonCode = parseInt(match[1]);
          // 64-67 是滚轮事件（上下左右滚动），允许通过
          // 0-3, 32-35 等是点击/移动事件，过滤掉
          if (buttonCode < 64 || buttonCode > 67) {
            return; // 过滤非滚轮的鼠标事件
          }
        }
      }
      // 过滤旧式鼠标事件 ESC [ M（不支持滚轮区分，全部过滤）
      if (disableMouse && data.startsWith('\x1b[M')) {
        return;
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    }) || null;

    resizeListenerRef.current = terminalInstance.current?.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    }) || null;
  };

  useEffect(() => {
    // 标记组件已挂载
    mountedRef.current = true;
    
    // 使用较长延迟，确保 StrictMode 的快速卸载/重新挂载完成
    // StrictMode 会在几毫秒内完成卸载和重新挂载
    const connectTimer = setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, 200);

    const handleResize = () => {
      fitAddon.current?.fit();
    };

    window.addEventListener('resize', handleResize);

    // 使用 ResizeObserver 监听容器大小变化（tab 切换时触发）
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver((entries) => {
      // 防抖处理，避免频繁触发
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!mountedRef.current || !fitAddon.current || !terminalInstance.current) return;
        
        // 检查容器是否可见（宽高大于 0）
        const entry = entries[0];
        if (!entry) return;
        
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) {
          // 容器不可见，跳过
          return;
        }
        
        try {
          // 强制刷新终端
          fitAddon.current.fit();
          
          // 刷新终端显示（解决点阵问题）
          terminalInstance.current.refresh(0, terminalInstance.current.rows - 1);
          
          // 同步新尺寸到远程
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const dims = fitAddon.current.proposeDimensions();
            if (dims) {
              wsRef.current.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
            }
          }
        } catch (e) {
          console.warn('[WebTerminal] Resize error:', e);
        }
      }, 150);
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // 监听页面可见性变化（用户切换标签页或最小化窗口）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mountedRef.current && terminalInstance.current && fitAddon.current) {
        // 页面重新可见时，延迟刷新终端
        setTimeout(() => {
          if (!mountedRef.current || !terminalInstance.current || !fitAddon.current) return;
          try {
            fitAddon.current.fit();
            terminalInstance.current.refresh(0, terminalInstance.current.rows - 1);
          } catch (e) {
            console.warn('[WebTerminal] Visibility change refresh error:', e);
          }
        }, 100);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // 标记组件已卸载
      mountedRef.current = false;
      clearTimeout(connectTimer);
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver.disconnect();
      dataListenerRef.current?.dispose();
      resizeListenerRef.current?.dispose();
      wsRef.current?.close();
      wsRef.current = null;
      terminalInstance.current?.dispose();
      terminalInstance.current = null;
      initialCommandSentRef.current = false;
      // 注意：不在这里删除 pendingConnections，让 onclose 处理
    };
  }, [sessionId, terminalId, mode, command, connectionKey]);

  const handleReconnect = () => {
    // 清理旧连接
    wsRef.current?.close();
    wsRef.current = null;
    pendingConnections.delete(connectionKey);
    initialCommandSentRef.current = false;
    
    // 重新连接
    setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, 100);
  };

  return (
    <div className="w-full h-full bg-[#0c0c0c] relative overflow-hidden" style={{ minHeight: '400px' }}>
      <div
        ref={terminalRef}
        className="absolute inset-0"
        style={{ padding: '8px' }}
      />

      {status === 'connecting' && (
        <div className="absolute inset-0 bg-[#0c0c0c] flex flex-col items-center justify-center z-10">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
          <p className="text-slate-400 text-sm">正在连接终端...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 bg-[#0c0c0c] flex flex-col items-center justify-center z-10">
          <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
          <p className="text-red-400 text-sm mb-4">{errorMessage || '连接失败'}</p>
          <button
            onClick={handleReconnect}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重新连接
          </button>
        </div>
      )}

      {status === 'disconnected' && (
        <div className="absolute bottom-4 right-4 z-10">
          <button
            onClick={handleReconnect}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            重新连接
          </button>
        </div>
      )}
    </div>
  );
};

export default WebTerminal;
