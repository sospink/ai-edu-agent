import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useTranslation } from 'react-i18next';

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
  isActive?: boolean;       // 当前 tab 是否激活（用于恢复焦点和尺寸）
  sessionPolicy?: 'reuse' | 'restart'; // exec 模式会话策略
  connectNonce?: number;    // 手动触发重连
  restartToken?: number;    // 仅本次连接使用 restart 的触发令牌
}

const WebTerminal: React.FC<WebTerminalProps> = ({ 
  sessionId, 
  initialCommand, 
  terminalId = 'default', 
  disableMouse = false,
  mode = 'ssh',
  command = '/bin/bash',
  isActive = true,
  sessionPolicy = 'reuse',
  connectNonce = 0,
  restartToken = 0,
}) => {
  const { t, i18n } = useTranslation('lab');
  const INIT_GRACE_MS = 30000;
  const INIT_RETRY_INTERVAL_MS = 2000;
  const transportEnv = ((import.meta.env as any).VITE_TERMINAL_TRANSPORT || '').toLowerCase();
  const USE_RAW_TRANSPORT =
    transportEnv === 'raw' ? true : transportEnv === 'json' ? false : import.meta.env.DEV;
  const ENABLE_KEY_FALLBACK = true;
  const ENABLE_BINARY_INPUT = true; // 快速回滚开关：如需回退可临时置为 false
  const TERMINAL_DEBUG = (import.meta.env as any).VITE_TERMINAL_DEBUG === '1';
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dataListenerRef = useRef<{ dispose: () => void } | null>(null);
  const keyListenerRef = useRef<{ dispose: () => void } | null>(null);
  const binaryListenerRef = useRef<{ dispose: () => void } | null>(null);
  const resizeListenerRef = useRef<{ dispose: () => void } | null>(null);
  const domKeyFallbackCleanupRef = useRef<(() => void) | null>(null);
  const consumedRestartTokenRef = useRef<number>(restartToken);
  const lastInputRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });
  const decoderRef = useRef<TextDecoder>(new TextDecoder('utf-8'));
  const wsConnectedRef = useRef<boolean>(false);
  const initStartRef = useRef<number>(Date.now());
  const initRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRetryCountRef = useRef<number>(0);
  const initRetryScheduledRef = useRef<boolean>(false);
  const dataEventCountRef = useRef<number>(0);
  const binaryEventCountRef = useRef<number>(0);
  const [initRetryCount, setInitRetryCount] = useState<number>(0);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const mountedRef = useRef<boolean>(false);
  const currentLocale = i18n.resolvedLanguage || i18n.language;
  
  // 生成唯一连接 key
  const connectionKey = `${sessionId}-${terminalId}-${mode}-${connectNonce}-${currentLocale}`;

  const logInputStats = (kind: 'data' | 'binary', bytes: number) => {
    if (!TERMINAL_DEBUG) return;
    if (kind === 'data') {
      dataEventCountRef.current += 1;
      if (dataEventCountRef.current % 50 === 0) {
        console.log(`[WebTerminal] ${connectionKey} onData count=${dataEventCountRef.current} lastBytes=${bytes}`);
      }
      return;
    }
    binaryEventCountRef.current += 1;
    if (binaryEventCountRef.current % 20 === 0) {
      console.log(
        `[WebTerminal] ${connectionKey} onBinary count=${binaryEventCountRef.current} lastBytes=${bytes}`
      );
    }
  };

  const binaryToBase64 = (binaryData: string): string => {
    let normalized = '';
    for (let i = 0; i < binaryData.length; i++) {
      normalized += String.fromCharCode(binaryData.charCodeAt(i) & 0xff);
    }
    return btoa(normalized);
  };

  const binaryToUint8Array = (binaryData: string): Uint8Array => {
    const arr = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      arr[i] = binaryData.charCodeAt(i) & 0xff;
    }
    return arr;
  };

  const syncRemoteSize = (ws: WebSocket) => {
    const dims = fitAddon.current?.proposeDimensions();
    if (dims && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
    }
  };

  const refreshAndFocus = (ws?: WebSocket | null) => {
    if (!terminalInstance.current || !fitAddon.current) return;
    fitAddon.current.fit();
    terminalInstance.current.refresh(0, terminalInstance.current.rows - 1);
    terminalInstance.current.focus();
    if (ws) {
      syncRemoteSize(ws);
    }
  };

  const isBlockedMouseSequence = (data: string) => {
    if (!disableMouse) return false;
    if (data.startsWith('\x1b[<')) {
      const match = data.match(/^\x1b\[<(\d+);/);
      if (match) {
        const buttonCode = parseInt(match[1], 10);
        return buttonCode < 64 || buttonCode > 67;
      }
    }
    return data.startsWith('\x1b[M');
  };

  const sendInput = (ws: WebSocket, data: string) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (!data) return;
    if (USE_RAW_TRANSPORT) {
      ws.send(data);
    } else {
      ws.send(JSON.stringify({ type: 'input', data }));
    }
  };

  const mapDomKeyToInput = (event: KeyboardEvent): string | null => {
    if (event.key === 'Process') return null;

    const keyMap: Record<string, string> = {
      Enter: '\r',
      Backspace: '\x7f',
      Tab: '\t',
      Escape: '\x1b',
      ArrowUp: '\x1b[A',
      ArrowDown: '\x1b[B',
      ArrowRight: '\x1b[C',
      ArrowLeft: '\x1b[D',
      Home: '\x1b[H',
      End: '\x1b[F',
      Delete: '\x1b[3~',
      PageUp: '\x1b[5~',
      PageDown: '\x1b[6~',
    };

    if (keyMap[event.key]) {
      return keyMap[event.key];
    }

    if (event.key.length === 1) {
      const ch = event.key;
      if (event.ctrlKey && !event.altKey && !event.metaKey) {
        const upper = ch.toUpperCase();
        const code = upper.charCodeAt(0);
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(code - 64);
        }
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        return `\x1b${ch}`;
      }
      return ch;
    }

    return null;
  };

  const isInitGracePeriod = () => Date.now() - initStartRef.current < INIT_GRACE_MS;

  const shouldRetryDuringInit = (message: string) => {
    if (mode !== 'ssh') return false;
    return /ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ECONNRESET|网络错误|连接失败/i.test(message);
  };

  const scheduleInitRetry = (message: string): boolean => {
    if (!shouldRetryDuringInit(message) || !isInitGracePeriod()) {
      return false;
    }
    if (initRetryScheduledRef.current) {
      return true;
    }

    initRetryScheduledRef.current = true;
    pendingConnections.delete(connectionKey);
    wsRef.current?.close();
    wsRef.current = null;

    const nextRetry = initRetryCountRef.current + 1;
    initRetryCountRef.current = nextRetry;
    setInitRetryCount(nextRetry);
    setStatus('connecting');
    setErrorMessage(t('terminalWaiting', { count: nextRetry }));

    if (initRetryTimerRef.current) {
      clearTimeout(initRetryTimerRef.current);
    }
    initRetryTimerRef.current = setTimeout(() => {
      initRetryScheduledRef.current = false;
      if (mountedRef.current) {
        connect();
      }
    }, INIT_RETRY_INTERVAL_MS);

    return true;
  };

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
    wsConnectedRef.current = false;
    console.log('[WebTerminal] Starting connection for', connectionKey);

    setStatus('connecting');
    if (initRetryCountRef.current === 0) {
      setErrorMessage('');
    }

    const initTerminal = () => {
      if (!terminalRef.current || !mountedRef.current) {
        pendingConnections.delete(connectionKey);
        return;
      }
      
      if (!terminalInstance.current) {
        const term = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", monospace',
          convertEol: false,
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
      setErrorMessage(t('terminalLoginRequired'));
      pendingConnections.delete(connectionKey);
      return;
    }

    const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || API_BASE_URL;
    const resolvedApiUrl = rawApiBaseUrl.startsWith('http')
      ? new URL(rawApiBaseUrl)
      : new URL(rawApiBaseUrl, window.location.origin);
    const wsProtocol = resolvedApiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = resolvedApiUrl.host;
    const numericSessionId = typeof sessionId === 'string' ? parseInt(sessionId) : sessionId;
    const shouldRestartOnce = mode === 'exec' && restartToken !== consumedRestartTokenRef.current;
    if (shouldRestartOnce) {
      consumedRestartTokenRef.current = restartToken;
    }
    const effectiveSessionPolicy: 'reuse' | 'restart' =
      shouldRestartOnce ? 'restart' : sessionPolicy;
    
    // 构建 WebSocket URL，包含 mode 和 command 参数
    let wsUrl = `${wsProtocol}//${wsHost}/ws/terminal?token=${token}&sessionId=${numericSessionId}&terminalId=${terminalId}&mode=${mode}`;
    wsUrl += `&transport=${USE_RAW_TRANSPORT ? 'raw' : 'json'}`;
    wsUrl += `&locale=${encodeURIComponent(currentLocale)}`;
    if (mode === 'exec') {
      wsUrl += `&command=${encodeURIComponent(command)}`;
      wsUrl += `&sessionPolicy=${encodeURIComponent(effectiveSessionPolicy)}`;
    } else if (initialCommand) {
      wsUrl += `&initialCommand=${encodeURIComponent(initialCommand)}`;
    }

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const output = decoderRef.current.decode(new Uint8Array(event.data), { stream: true });
        terminalInstance.current?.write(output);
        return;
      }
      if (event.data instanceof Blob) {
        event.data
          .arrayBuffer()
          .then((buf) => {
            if (!mountedRef.current) return;
            const output = decoderRef.current.decode(new Uint8Array(buf), { stream: true });
            terminalInstance.current?.write(output);
          })
          .catch(() => {});
        return;
      }

      try {
        const rawText = String(event.data);
        const msg = JSON.parse(rawText);

        if (msg.type === 'connected') {
          wsConnectedRef.current = true;
          initRetryCountRef.current = 0;
          setInitRetryCount(0);
          setStatus('connected');
          
          setTimeout(() => {
            if (terminalInstance.current && fitAddon.current) {
              if (isActive) {
                refreshAndFocus(ws);
              } else {
                fitAddon.current.fit();
                syncRemoteSize(ws);
              }
              terminalInstance.current.writeln(`\x1b[32m✓ ${t('terminalConnected')}\x1b[0m\r\n`);
            }
          }, 100);
        } else if (msg.type === 'output') {
          terminalInstance.current?.write(msg.data);
        } else if (msg.type === 'error') {
          const message = String(msg.message || t('terminalConnectionFailed'));
          if (scheduleInitRetry(message)) {
            return;
          }
          setStatus('error');
          setErrorMessage(message);
          terminalInstance.current?.writeln(`\x1b[31m✗ ${t('terminalErrorPrefix')}: ${message}\x1b[0m`);
        } else if (msg.type === 'output') {
          terminalInstance.current?.write(msg.data || '');
        }
      } catch {
        terminalInstance.current?.write(String(event.data));
      }
    };

    ws.onclose = () => {
      // 连接关闭时移除 pending 状态
      pendingConnections.delete(connectionKey);
      if (!wsConnectedRef.current) {
        if (scheduleInitRetry(t('terminalSshNotReady'))) {
          return;
        }
        setStatus('error');
        setErrorMessage(t('terminalSshFailed'));
        return;
      }
      if (wsConnectedRef.current) {
        setStatus('disconnected');
        terminalInstance.current?.writeln(`\r\n\x1b[33m⚠ ${t('terminalDisconnected')}\x1b[0m`);
      }
    };

    ws.onerror = () => {
      // 连接错误时移除 pending 状态
      pendingConnections.delete(connectionKey);
      if (scheduleInitRetry(t('terminalWebSocketFailed'))) {
        return;
      }
      setStatus('error');
      setErrorMessage(t('terminalWebSocketFailed'));
    };

    dataListenerRef.current?.dispose();
    keyListenerRef.current?.dispose();
    binaryListenerRef.current?.dispose();
    resizeListenerRef.current?.dispose();
    domKeyFallbackCleanupRef.current?.();
    domKeyFallbackCleanupRef.current = null;

    dataListenerRef.current = terminalInstance.current?.onData((data) => {
      if (isBlockedMouseSequence(data)) {
        return;
      }
      const now = Date.now();
      if (ENABLE_KEY_FALLBACK) {
        const delta = now - lastInputRef.current.at;
        if (delta < 12 && lastInputRef.current.value === data) {
          return;
        }
      }
      if (ws.readyState === WebSocket.OPEN) {
        lastInputRef.current = { value: data, at: now };
        sendInput(ws, data);
        logInputStats('data', data.length);
      }
    }) || null;

    if (ENABLE_KEY_FALLBACK) {
      keyListenerRef.current = terminalInstance.current?.onKey(({ key, domEvent }) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (!key || key === 'Process') return;

        const now = Date.now();
        const delta = now - lastInputRef.current.at;
        if (delta < 12 && lastInputRef.current.value === key) {
          return;
        }

        if (domEvent.key === 'Tab') {
          domEvent.preventDefault();
        }

        sendInput(ws, key);
        lastInputRef.current = { value: key, at: now };
        logInputStats('data', key.length);
      }) || null;
    }

    binaryListenerRef.current = terminalInstance.current?.onBinary((binaryData) => {
      if (!ENABLE_BINARY_INPUT || isBlockedMouseSequence(binaryData)) {
        return;
      }
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }
      try {
        if (USE_RAW_TRANSPORT) {
          ws.send(binaryToUint8Array(binaryData));
        } else {
          const base64Data = binaryToBase64(binaryData);
          ws.send(JSON.stringify({ type: 'input_binary_base64', data: base64Data }));
        }
        logInputStats('binary', binaryData.length);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[WebTerminal] Failed to encode binary input:', error);
        }
      }
    }) || null;

    resizeListenerRef.current = terminalInstance.current?.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN && cols > 0 && rows > 0) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      }) || null;

    const domKeyFallbackHandler = (event: KeyboardEvent) => {
      if (!mountedRef.current || !isActive) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        const className = target.className || '';
        const isXtermHelperTextarea =
          tag === 'textarea' &&
          typeof className === 'string' &&
          className.includes('xterm-helper-textarea');
        if ((tag === 'input' || tag === 'textarea' || target.isContentEditable) && !isXtermHelperTextarea) {
          return;
        }
      }

      const sequence = mapDomKeyToInput(event);
      if (!sequence) return;

      const beforeAt = lastInputRef.current.at;
      window.setTimeout(() => {
        if (!mountedRef.current || ws.readyState !== WebSocket.OPEN) return;
        if (lastInputRef.current.at !== beforeAt) return;

        sendInput(ws, sequence);
        lastInputRef.current = { value: sequence, at: Date.now() };
        logInputStats('data', sequence.length);
      }, 0);
    };

    document.addEventListener('keydown', domKeyFallbackHandler, true);
    domKeyFallbackCleanupRef.current = () => {
      document.removeEventListener('keydown', domKeyFallbackHandler, true);
    };
  };

  useEffect(() => {
    // 标记组件已挂载
    mountedRef.current = true;
    initStartRef.current = Date.now();
    initRetryCountRef.current = 0;
    setInitRetryCount(0);
    initRetryScheduledRef.current = false;
    if (initRetryTimerRef.current) {
      clearTimeout(initRetryTimerRef.current);
      initRetryTimerRef.current = null;
    }
    
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
          refreshAndFocus(wsRef.current);
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
            refreshAndFocus();
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
      keyListenerRef.current?.dispose();
      binaryListenerRef.current?.dispose();
      resizeListenerRef.current?.dispose();
      domKeyFallbackCleanupRef.current?.();
      domKeyFallbackCleanupRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
      wsConnectedRef.current = false;
      if (initRetryTimerRef.current) {
        clearTimeout(initRetryTimerRef.current);
        initRetryTimerRef.current = null;
      }
      initRetryScheduledRef.current = false;
      terminalInstance.current?.dispose();
      terminalInstance.current = null;
      // 注意：不在这里删除 pendingConnections，让 onclose 处理
    };
  }, [sessionId, terminalId, mode, command, initialCommand, connectionKey, sessionPolicy, restartToken]);

  useEffect(() => {
    if (!isActive || status !== 'connected') return;
    const timer = window.setTimeout(() => {
      if (!mountedRef.current) return;
      try {
        refreshAndFocus(wsRef.current);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[WebTerminal] Active tab refresh failed:', error);
        }
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isActive, status]);

  const handleReconnect = () => {
    // 清理旧连接
    wsRef.current?.close();
    wsRef.current = null;
    wsConnectedRef.current = false;
    pendingConnections.delete(connectionKey);
    initStartRef.current = Date.now();
    initRetryCountRef.current = 0;
    setInitRetryCount(0);
    initRetryScheduledRef.current = false;
    if (initRetryTimerRef.current) {
      clearTimeout(initRetryTimerRef.current);
      initRetryTimerRef.current = null;
    }
    
    // 重新连接
    setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, 100);
  };

  return (
    <div
      className="w-full h-full bg-[#0c0c0c] relative overflow-hidden"
      style={{ minHeight: '400px' }}
      onMouseDown={() => {
        refreshAndFocus(wsRef.current);
      }}
    >
      <div
        ref={terminalRef}
        className="absolute inset-0"
        style={{ padding: '8px' }}
      />

      {status === 'connecting' && (
        <div className="absolute inset-0 bg-[#0c0c0c] flex flex-col items-center justify-center z-10">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
          <p className="text-slate-400 text-sm">{errorMessage || t('terminalConnecting')}</p>
          {mode === 'ssh' && initRetryCount > 0 && (
            <p className="text-slate-500 text-xs mt-2">{t('terminalInitHint')}</p>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 bg-[#0c0c0c] flex flex-col items-center justify-center z-10">
          <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
          <p className="text-red-400 text-sm mb-4">{errorMessage || t('connectionFailed')}</p>
          <button
            onClick={handleReconnect}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('reconnect')}
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
            {t('reconnect')}
          </button>
        </div>
      )}
    </div>
  );
};

export default WebTerminal;
