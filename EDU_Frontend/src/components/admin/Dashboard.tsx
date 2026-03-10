import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Cpu, HardDrive, Box, Play, Square, RotateCcw,
  Trash2, Eye, Terminal, RefreshCw, CheckCircle2, XCircle,
  PauseCircle, Clock, Layers, MemoryStick, X, AlertTriangle,
  TrendingUp, TrendingDown, Network
} from 'lucide-react';
import { dockerService, type DockerInfo, type Container, type DockerImage, type ContainerStats } from '@/services/docker';
import { Toast } from '@/components/common/Toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

// 图表路径生成工具
const createPath = (data: number[], width: number, height: number) => {
  if (data.length === 0) return "";
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  });
  return `M ${points.join(" L ")}`;
};

const createAreaPath = (data: number[], width: number, height: number) => {
  const linePath = createPath(data, width, height);
  return `${linePath} L ${width},${height} L 0,${height} Z`;
};

// 格式化字节
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

// 格式化时间戳
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN');
};

// 状态徽章组件
const StatusBadge: React.FC<{ state: string; large?: boolean }> = ({ state, large = false }) => {
  const config: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
    running: { bg: 'bg-success-50 border-success-200', text: 'text-success-600', icon: CheckCircle2, label: 'RUNNING' },
    exited: { bg: 'bg-default-100 border-default-200', text: 'text-default-500', icon: XCircle, label: 'STOPPED' },
    paused: { bg: 'bg-warning-50 border-warning-200', text: 'text-warning-600', icon: PauseCircle, label: 'PAUSED' },
    created: { bg: 'bg-primary-50 border-primary-200', text: 'text-primary-600', icon: Clock, label: 'CREATED' },
  };
  const { bg, text, label } = config[state] || config.exited;

  if (large) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${bg} ${text}`}>
        <span className={`w-2 h-2 rounded-full ${state === 'running' ? 'bg-success-500' : state === 'paused' ? 'bg-warning-500' : 'bg-default-400'}`}></span>
        {label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${state === 'running' ? 'bg-success-500' : state === 'paused' ? 'bg-warning-500' : 'bg-default-400'}`}></span>
      {state}
    </span>
  );
};

// 容器卡片组件
interface ContainerCardProps {
  container: Container;
  onViewDetail: () => void;
  onViewLogs: () => void;
  onAction: (action: 'start' | 'stop' | 'restart' | 'remove') => void;
  actionLoading: string | null;
}

const ContainerCard: React.FC<ContainerCardProps> = ({ container, onViewDetail, onViewLogs, onAction, actionLoading }) => {
  const [stats, setStats] = useState<ContainerStats | null>(null);

  useEffect(() => {
    if (container.state === 'running') {
      dockerService.getContainerStats(container.id).then(res => {
        if (res.success && res.data) {
          setStats(res.data);
        }
      });
    }
  }, [container.id, container.state]);

  const cpuPercent = stats ? parseFloat(stats.cpu.percent) : 0;
  const memPercent = stats ? parseFloat(stats.memory.percent) : 0;
  const memUsage = stats ? formatBytes(stats.memory.usage) : '0 B';

  const portMapping = container.ports.find(p => p.publicPort);

  return (
    <div className="bg-white rounded-xl border border-default-200 p-3 hover:shadow-lg hover:shadow-primary-500/10 hover:border-primary-200 transition-all duration-300">
      {/* 头部：图标、名称、状态 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            container.state === 'running' ? 'bg-primary-100' : 'bg-default-100'
          }`}>
            <Box className={`w-4 h-4 ${
              container.state === 'running' ? 'text-primary-600' : 'text-default-500'
            }`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-xs text-foreground truncate">{container.names[0]}</h3>
            <p className="text-[10px] text-default-400 font-mono truncate">{container.image}</p>
          </div>
        </div>
        <StatusBadge state={container.state} large />
      </div>

      {/* 资源使用情况 - 仅运行中容器显示 */}
      {container.state === 'running' && (
        <div className="flex gap-2 mb-2">
          <div className="flex-1 bg-default-50 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] uppercase text-default-400 font-medium">CPU</span>
              <span className="text-xs font-bold text-foreground">{cpuPercent.toFixed(0)}%</span>
            </div>
            <div className="h-1 bg-default-200 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(cpuPercent, 100)}%` }} />
            </div>
          </div>
          <div className="flex-1 bg-default-50 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] uppercase text-default-400 font-medium">MEM</span>
              <span className="text-xs font-bold text-foreground">{memUsage}</span>
            </div>
            <div className="h-1 bg-default-200 rounded-full overflow-hidden">
              <div className="h-full bg-warning-500 rounded-full" style={{ width: `${Math.min(memPercent, 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* 已停止容器显示简单信息 */}
      {container.state !== 'running' && (
        <div className="bg-default-50 rounded-lg px-2 py-1.5 mb-2">
          <div className="text-[10px] text-default-500 truncate">{container.status}</div>
        </div>
      )}

      {/* 底部：端口和操作按钮 */}
      <div className="flex items-center justify-between pt-2 border-t border-default-100">
        <div className="flex items-center gap-1 text-default-500">
          <Network className="w-3 h-3" />
          {portMapping ? (
            <span className="text-[10px] font-mono">{portMapping.publicPort}:{portMapping.privatePort}</span>
          ) : (
            <span className="text-[10px] text-default-400">无端口</span>
          )}
        </div>
        <div className="flex items-center">
          <button onClick={onViewDetail} className="p-1 rounded hover:bg-default-100 text-default-400 hover:text-foreground" title="详情">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={onViewLogs} className="p-1 rounded hover:bg-default-100 text-default-400 hover:text-foreground" title="日志">
            <Terminal className="w-3.5 h-3.5" />
          </button>
          {container.state === 'running' ? (
            <>
              <button
                onClick={() => onAction('restart')}
                disabled={actionLoading === `restart-${container.id}`}
                className="p-1 rounded hover:bg-warning-50 text-default-400 hover:text-warning-600 disabled:opacity-50"
                title="重启"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${actionLoading === `restart-${container.id}` ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => onAction('stop')}
                disabled={actionLoading === `stop-${container.id}`}
                className="p-1 rounded hover:bg-danger-50 text-default-400 hover:text-danger-600 disabled:opacity-50"
                title="停止"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onAction('start')}
                disabled={actionLoading === `start-${container.id}`}
                className="p-1 rounded hover:bg-success-50 text-default-400 hover:text-success-600 disabled:opacity-50"
                title="启动"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAction('remove')}
                disabled={actionLoading === `remove-${container.id}`}
                className="p-1 rounded hover:bg-danger-50 text-default-400 hover:text-danger-600 disabled:opacity-50"
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// 指标卡片组件（恢复之前的样式）
interface MetricCardProps {
  title: string;
  value: string | number;
  change: string;
  icon: React.ElementType;
  colorClass: string;
  data: number[];
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, icon: Icon, colorClass, data }) => {
  const isPositive = change.startsWith('+');
  const sparklinePath = createPath(data || [0, 0], 100, 40);
  const areaPath = createAreaPath(data || [0, 0], 100, 40);

  return (
    <div className="relative bg-white rounded-2xl border border-default-200 shadow-sm p-6 overflow-hidden group hover:-translate-y-1 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300">
      <div className="absolute bottom-0 left-0 right-0 h-16 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
          <path d={areaPath} fill="currentColor" className={isPositive ? "text-primary-500" : "text-danger-500"} />
        </svg>
      </div>
      <div className="relative z-10 flex justify-between items-start mb-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClass} bg-opacity-10 transition-transform duration-300 group-hover:scale-105`}>
          <Icon className="w-6 h-6" />
        </div>
        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${isPositive ? 'bg-success-50 text-success-600 border-success-100' : 'bg-danger-50 text-danger-600 border-danger-100'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change}
        </span>
      </div>
      <div className="relative z-10">
        <h3 className="text-default-500 text-sm font-medium mb-1 tracking-wide">{title}</h3>
        <div className="text-3xl font-bold text-foreground tracking-tight">{value}</div>
      </div>
      <div className="absolute bottom-6 right-6 w-20 h-10 opacity-30">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <path d={sparklinePath} fill="none" stroke="currentColor" strokeWidth="3" className="text-default-400" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  );
};


// 容器日志弹窗
interface LogModalProps {
  container: Container | null;
  onClose: () => void;
}

const LogModal: React.FC<LogModalProps> = ({ container, onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (container) {
      setLoading(true);
      dockerService.getContainerLogs(container.id, 200).then(res => {
        if (res.success && res.data) {
          setLogs(res.data.logs);
        }
        setLoading(false);
      });
    }
  }, [container]);

  if (!container) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-default-200">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-default-500" />
            <span className="font-semibold">容器日志 - {container.names[0]}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-default-100 transition-colors">
            <X className="w-5 h-5 text-default-500" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-gray-900 font-mono text-sm">
          {loading ? (
            <div className="text-gray-400">加载中...</div>
          ) : logs.length === 0 ? (
            <div className="text-gray-400">暂无日志</div>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="text-gray-300 whitespace-pre-wrap break-all leading-relaxed">
                {line}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};

// 容器详情弹窗
interface DetailModalProps {
  container: Container | null;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ container, onClose }) => {
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (container && container.state === 'running') {
      setLoading(true);
      dockerService.getContainerStats(container.id).then(res => {
        if (res.success && res.data) {
          setStats(res.data);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [container]);

  if (!container) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-default-200">
          <div className="flex items-center gap-3">
            <Box className="w-5 h-5 text-primary-500" />
            <span className="font-semibold">容器详情 - {container.names[0]}</span>
            <StatusBadge state={container.state} />
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-default-100 transition-colors">
            <X className="w-5 h-5 text-default-500" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-default-400 mb-1">容器 ID</div>
              <div className="font-mono text-sm">{container.id}</div>
            </div>
            <div>
              <div className="text-xs text-default-400 mb-1">镜像</div>
              <div className="text-sm truncate">{container.image}</div>
            </div>
            <div>
              <div className="text-xs text-default-400 mb-1">创建时间</div>
              <div className="text-sm">{formatTime(container.created)}</div>
            </div>
            <div>
              <div className="text-xs text-default-400 mb-1">状态</div>
              <div className="text-sm">{container.status}</div>
            </div>
          </div>

          {container.ports.length > 0 && (
            <div>
              <div className="text-xs text-default-400 mb-2">端口映射</div>
              <div className="flex flex-wrap gap-2">
                {container.ports.map((p, i) => (
                  <span key={i} className="px-2 py-1 bg-default-100 rounded text-xs font-mono">
                    {p.publicPort ? `${p.ip || '0.0.0.0'}:${p.publicPort}→${p.privatePort}/${p.type}` : `${p.privatePort}/${p.type}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {container.state === 'running' && (
            <div>
              <div className="text-xs text-default-400 mb-3">资源使用</div>
              {loading ? (
                <div className="text-sm text-default-400">加载中...</div>
              ) : stats ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-default-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="w-4 h-4 text-primary-500" />
                      <span className="text-sm font-medium">CPU</span>
                    </div>
                    <div className="text-2xl font-bold text-primary-600">{stats.cpu.percent}%</div>
                    <div className="text-xs text-default-400">{stats.cpu.cores} 核心</div>
                  </div>
                  <div className="bg-default-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MemoryStick className="w-4 h-4 text-secondary-500" />
                      <span className="text-sm font-medium">内存</span>
                    </div>
                    <div className="text-2xl font-bold text-secondary-600">{stats.memory.percent}%</div>
                    <div className="text-xs text-default-400">{formatBytes(stats.memory.usage)} / {formatBytes(stats.memory.limit)}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-default-400">无法获取统计信息</div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};


// 主仪表盘组件
const Dashboard: React.FC = () => {
  const [dockerInfo, setDockerInfo] = useState<DockerInfo | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [logContainer, setLogContainer] = useState<Container | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 确认弹窗状态
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    onConfirm: () => {},
  });

  const showConfirm = (options: { title: string; message: string; type?: 'danger' | 'warning' | 'info'; onConfirm: () => void }) => {
    setConfirmDialog({
      isOpen: true,
      title: options.title,
      message: options.message,
      type: options.type || 'danger',
      onConfirm: options.onConfirm,
    });
  };

  const hideConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  // 模拟趋势数据
  const sparkData1 = [40, 30, 45, 60, 55, 70, 65, 80];
  const sparkData2 = [60, 65, 60, 75, 80, 85, 80, 87];
  const sparkData3 = [20, 40, 30, 50, 40, 60, 50, 70];
  const sparkData4 = [98, 99, 98, 99, 99, 99, 99, 100];

  // 加载数据
  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [infoRes, containersRes, imagesRes] = await Promise.all([
        dockerService.getInfo(),
        dockerService.listContainers(true),
        dockerService.listImages(),
      ]);

      if (infoRes.success && infoRes.data) setDockerInfo(infoRes.data);
      if (containersRes.success && containersRes.data) setContainers(containersRes.data);
      if (imagesRes.success && imagesRes.data) setImages(imagesRes.data);

      if (!infoRes.success) {
        setError(infoRes.error || '无法连接到 Docker 服务');
      } else {
        setError(null);
      }
    } catch (err) {
      setError('加载数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // 容器操作
  const handleContainerAction = async (action: 'start' | 'stop' | 'restart' | 'remove', container: Container) => {
    // 删除操作需要确认
    if (action === 'remove') {
      showConfirm({
        title: '删除容器',
        message: `确定要删除容器 "${container.names[0]}" 吗？此操作不可恢复。`,
        type: 'danger',
        onConfirm: () => executeContainerAction('remove', container),
      });
      return;
    }
    
    await executeContainerAction(action, container);
  };

  // 执行容器操作
  const executeContainerAction = async (action: 'start' | 'stop' | 'restart' | 'remove', container: Container) => {
    setActionLoading(`${action}-${container.id}`);
    try {
      let res;
      switch (action) {
        case 'start':
          res = await dockerService.startContainer(container.id);
          break;
        case 'stop':
          res = await dockerService.stopContainer(container.id);
          break;
        case 'restart':
          res = await dockerService.restartContainer(container.id);
          break;
        case 'remove':
          res = await dockerService.removeContainer(container.id, container.state === 'running');
          break;
      }

      if (res?.success) {
        setToast({ message: res.data?.message || '操作成功', type: 'success' });
        loadData();
      } else {
        setToast({ message: res?.error || '操作失败', type: 'error' });
      }
    } catch (err) {
      setToast({ message: '操作失败', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // 批量清理 CREATED 容器
  const executeCleanupCreatedContainers = async () => {
    const createdContainers = containers.filter((container) => container.state === 'created');
    if (createdContainers.length === 0) {
      setToast({ message: '当前没有 CREATED 容器', type: 'success' });
      return;
    }

    setActionLoading('cleanup-created');
    try {
      const results = await Promise.allSettled(
        createdContainers.map((container) => dockerService.removeContainer(container.id, false))
      );

      let successCount = 0;
      let failCount = 0;
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount += 1;
        } else {
          failCount += 1;
        }
      });

      if (failCount === 0) {
        setToast({ message: `已清理 ${successCount} 个 CREATED 容器`, type: 'success' });
      } else {
        setToast({
          message: `已清理 ${successCount} 个，${failCount} 个删除失败`,
          type: 'error',
        });
      }

      loadData();
    } catch (err) {
      setToast({ message: '批量清理失败', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanupCreatedContainers = () => {
    const createdCount = containers.filter((container) => container.state === 'created').length;
    if (createdCount === 0) {
      setToast({ message: '当前没有 CREATED 容器', type: 'success' });
      return;
    }

    showConfirm({
      title: '批量清理 CREATED 容器',
      message: `检测到 ${createdCount} 个 CREATED 容器，是否批量删除？`,
      type: 'warning',
      onConfirm: () => {
        void executeCleanupCreatedContainers();
      },
    });
  };

  // 删除镜像
  const handleRemoveImage = (image: DockerImage) => {
    showConfirm({
      title: '删除镜像',
      message: `确定要删除镜像 "${image.repoTags[0]}" 吗？此操作不可恢复。`,
      type: 'danger',
      onConfirm: () => executeRemoveImage(image),
    });
  };

  // 执行删除镜像
  const executeRemoveImage = async (image: DockerImage) => {
    setActionLoading(`remove-image-${image.id}`);
    try {
      const res = await dockerService.removeImage(image.id, false);
      if (res.success) {
        setToast({ message: '镜像已删除', type: 'success' });
        loadData();
      } else {
        setToast({ message: res.error || '删除失败', type: 'error' });
      }
    } catch (err) {
      setToast({ message: '删除失败', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
          <span className="text-default-500">连接 Docker 服务...</span>
        </div>
      </div>
    );
  }

  if (error && !dockerInfo) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-danger-50 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-danger-500" />
          </div>
          <div className="text-lg font-medium text-danger-600">Docker 连接失败</div>
          <div className="text-sm text-default-500 max-w-md">{error}</div>
          <button
            onClick={() => { setLoading(true); loadData(); }}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            重试连接
          </button>
        </div>
      </div>
    );
  }

  const runningContainers = containers.filter(c => c.state === 'running').length;
  const stoppedContainers = containers.filter(c => c.state === 'exited').length;
  const createdContainers = containers.filter(c => c.state === 'created').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Server className="w-7 h-7 text-primary-500" />
            Docker 数据中心
          </h1>
          <p className="text-sm text-default-500 mt-1">
            {dockerInfo?.name} · {dockerInfo?.operatingSystem} · Docker {dockerInfo?.serverVersion}
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-default-200 rounded-xl text-sm font-medium hover:bg-default-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* 统计卡片 - 恢复之前的样式 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="运行中容器"
          value={runningContainers}
          change={`+${runningContainers}`}
          icon={Box}
          colorClass="bg-success-500 text-success-600"
          data={sparkData1}
        />
        <MetricCard
          title="已停止容器"
          value={stoppedContainers}
          change={stoppedContainers > 0 ? `-${stoppedContainers}` : '+0'}
          icon={Square}
          colorClass="bg-default-500 text-default-600"
          data={sparkData2}
        />
        <MetricCard
          title="镜像数量"
          value={images.length}
          change={`+${images.length}`}
          icon={Layers}
          colorClass="bg-primary-500 text-primary-600"
          data={sparkData3}
        />
        <MetricCard
          title="CPU 核心"
          value={dockerInfo?.cpus || 0}
          change="+100%"
          icon={Cpu}
          colorClass="bg-secondary-500 text-secondary-600"
          data={sparkData4}
        />
      </div>


      {/* 容器列表和镜像列表 - 左右两栏布局 */}
      <div className="flex gap-6 items-start">
        {/* 左侧：容器卡片列表 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4 h-10">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Box className="w-5 h-5 text-primary-500" />
              容器列表
              <span className="text-xs text-default-400 font-normal ml-2">
                {containers.length} 个容器
              </span>
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-success-600">
                  <span className="w-2 h-2 rounded-full bg-success-500"></span>
                  {runningContainers} 运行中
                </span>
                <span className="flex items-center gap-1.5 text-default-500">
                  <span className="w-2 h-2 rounded-full bg-default-400"></span>
                  {stoppedContainers} 已停止
                </span>
                <span className="flex items-center gap-1.5 text-primary-600">
                  <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                  {createdContainers} CREATED
                </span>
              </div>
              {createdContainers > 0 && (
                <button
                  onClick={handleCleanupCreatedContainers}
                  disabled={actionLoading === 'cleanup-created'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-danger-200 text-danger-600 bg-danger-50 hover:bg-danger-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="批量删除 CREATED 容器"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {actionLoading === 'cleanup-created' ? '清理中...' : '清理 CREATED'}
                </button>
              )}
            </div>
          </div>

          {containers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-default-200 p-12 text-center text-default-400">
              暂无容器
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {containers.map(container => (
                <ContainerCard
                  key={container.id}
                  container={container}
                  onViewDetail={() => setSelectedContainer(container)}
                  onViewLogs={() => setLogContainer(container)}
                  onAction={(action) => handleContainerAction(action, container)}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          )}
        </div>

        {/* 右侧：镜像列表 */}
        <div className="w-72 flex-shrink-0">
          <div className="flex items-center justify-between mb-4 h-10">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary-500" />
              镜像列表
            </h2>
            <span className="text-xs text-default-400">
              {images.length} 个
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-default-200 overflow-hidden max-h-[500px] flex flex-col">
            <div className="flex-1 overflow-y-auto divide-y divide-default-100">
              {images.length === 0 ? (
                <div className="p-8 text-center text-default-400">暂无镜像</div>
              ) : (
                images.map(image => (
                  <div key={image.id} className="p-2.5 hover:bg-default-50/50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <HardDrive className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs text-foreground truncate">{image.repoTags[0]}</div>
                        <div className="text-[11px] text-default-400">{formatBytes(image.size)}</div>
                      </div>
                      <button
                        onClick={() => handleRemoveImage(image)}
                        disabled={actionLoading === `remove-image-${image.id}`}
                        className="p-1.5 rounded-lg hover:bg-danger-50 text-default-400 hover:text-danger-600 transition-colors disabled:opacity-50 flex-shrink-0"
                        title="删除镜像"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 弹窗 */}
      <AnimatePresence>
        {selectedContainer && (
          <DetailModal container={selectedContainer} onClose={() => setSelectedContainer(null)} />
        )}
        {logContainer && (
          <LogModal container={logContainer} onClose={() => setLogContainer(null)} />
        )}
      </AnimatePresence>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* 确认弹窗 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText="确定删除"
        cancelText="取消"
        onConfirm={() => {
          confirmDialog.onConfirm();
          hideConfirm();
        }}
        onCancel={hideConfirm}
      />
    </motion.div>
  );
};

export default Dashboard;
