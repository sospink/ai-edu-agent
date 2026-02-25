import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Upload, FileText, File, Trash2, 
  GripVertical, Loader2, Download, Eye,
  FileType, Brain, Bot
} from 'lucide-react';
import { materialApi, type LessonMaterial } from '@/services/course';
import { Toast } from '@/components/common/Toast';
import { ConfirmDialog, useConfirmDialog } from '@/components/common/ConfirmDialog';
import { AgentManualEditor } from './AgentManualEditor';
import { getStaticUrl } from '@/config';

interface LessonMaterialsModalProps {
  isOpen: boolean;
  lessonId: number;
  lessonTitle: string;
  lessonType?: number;  // 1=实验, 2=挑战, 3=测验, 4=文本
  onClose: () => void;
}

// 资料类型图标和样式
const getMaterialTypeInfo = (type: number) => {
  switch (type) {
    case 1: // Markdown
      return { icon: FileText, label: 'Markdown', color: 'text-blue-500', bg: 'bg-blue-50' };
    case 2: // PDF
      return { icon: FileType, label: 'PDF', color: 'text-red-500', bg: 'bg-red-50' };
    case 3: // 思维导图
      return { icon: Brain, label: '思维导图', color: 'text-purple-500', bg: 'bg-purple-50' };
    default:
      return { icon: File, label: '文件', color: 'text-slate-500', bg: 'bg-slate-50' };
  }
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const LessonMaterialsModal: React.FC<LessonMaterialsModalProps> = ({
  isOpen,
  lessonId,
  lessonTitle,
  lessonType = 4,  // 默认为文本课时
  onClose,
}) => {
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  // 实验和挑战课时默认显示 Agent 手册 Tab
  const [activeTab, setActiveTab] = useState<'materials' | 'agent'>(lessonType === 1 || lessonType === 2 ? 'agent' : 'materials');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmDialog = useConfirmDialog();

  // 当 lessonType 变化时重置 activeTab
  useEffect(() => {
    setActiveTab(lessonType === 1 || lessonType === 2 ? 'agent' : 'materials');
  }, [lessonType]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  }, []);

  // 加载资料列表
  const loadMaterials = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    try {
      const response = await materialApi.getList(lessonId);
      if (response.success && response.data) {
        setMaterials(response.data);
      } else {
        showToast(response.error || '加载资料失败', 'error');
      }
    } catch (error) {
      console.error('加载资料失败:', error);
      showToast('加载资料失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [lessonId, showToast]);

  useEffect(() => {
    if (isOpen && lessonId) {
      loadMaterials();
    }
  }, [isOpen, lessonId, loadMaterials]);

  // 处理文件上传
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const response = await materialApi.upload(lessonId, file);
        if (response.success) {
          showToast(`${file.name} 上传成功`, 'success');
        } else {
          showToast(response.error || `${file.name} 上传失败`, 'error');
        }
      }
      await loadMaterials();
    } catch (error) {
      console.error('上传失败:', error);
      showToast('上传失败', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 删除资料
  const handleDelete = (material: LessonMaterial) => {
    confirmDialog.showConfirm({
      title: '删除学习资料',
      message: `确定要删除 "${material.title}" 吗？此操作不可恢复。`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const response = await materialApi.delete(material.id);
          if (response.success) {
            showToast('删除成功', 'success');
            await loadMaterials();
          } else {
            showToast(response.error || '删除失败', 'error');
          }
        } catch (error) {
          console.error('删除失败:', error);
          showToast('删除失败', 'error');
        }
      },
    });
  };

  // 更新资料标题
  const handleUpdateTitle = async (material: LessonMaterial, newTitle: string) => {
    if (newTitle === material.title) return;
    try {
      const response = await materialApi.update(material.id, { title: newTitle });
      if (response.success) {
        setMaterials(prev => prev.map(m => 
          m.id === material.id ? { ...m, title: newTitle } : m
        ));
      } else {
        showToast(response.error || '更新失败', 'error');
      }
    } catch (error) {
      console.error('更新失败:', error);
      showToast('更新失败', 'error');
    }
  };

  // 获取文件预览/下载链接 (静态文件不走 /api 路径)
  const getFileUrl = (fileUrl: string) => {
    return getStaticUrl(fileUrl);
  };

  if (!isOpen) return null;

  // 使用 Portal 渲染到 body，避免父容器 overflow/transform 影响定位
  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              style={{ zIndex: 9998 }}
              onClick={onClose}
            />

            {/* 弹窗内容 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 9999 }}
            >
              <div className="w-[90vw] max-w-[700px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">课时配置</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{lessonTitle}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs - 文本课时显示两个 Tab，实验/挑战课时只显示 Agent 手册 */}
              <div className="px-6 pt-4 border-b border-slate-100 flex gap-4">
                {lessonType === 4 && (
                  <button
                    onClick={() => setActiveTab('materials')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'materials'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <FileText className="w-4 h-4 inline-block mr-1.5" />
                    学习资料
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('agent')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'agent'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Bot className="w-4 h-4 inline-block mr-1.5" />
                  Agent 手册
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'materials' ? (
                  <>
                {/* 上传区域 */}
                <div className="mb-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".md,.markdown,.pdf,.xmind,.mm"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full py-8 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <span className="text-sm font-medium text-slate-600">上传中...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">点击或拖拽文件到此处上传</span>
                        <span className="text-xs text-slate-400">支持 Markdown (.md)、PDF、思维导图 (.xmind, .mm)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 资料列表 */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : materials.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">暂无学习资料</p>
                    <p className="text-sm mt-1">上传文件开始配置</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {materials.map((material) => {
                      const typeInfo = getMaterialTypeInfo(material.type);
                      const TypeIcon = typeInfo.icon;
                      
                      return (
                        <div
                          key={material.id}
                          className="group flex items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                        >
                          <GripVertical className="w-4 h-4 text-slate-300 cursor-grab shrink-0" />
                          
                          <div className={`w-10 h-10 rounded-lg ${typeInfo.bg} flex items-center justify-center shrink-0`}>
                            <TypeIcon className={`w-5 h-5 ${typeInfo.color}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              defaultValue={material.title}
                              onBlur={(e) => handleUpdateTitle(material, e.target.value)}
                              className="w-full bg-transparent font-medium text-slate-700 focus:outline-none focus:bg-white focus:px-2 focus:py-1 focus:rounded focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                              <span>{typeInfo.label}</span>
                              <span>•</span>
                              <span>{formatFileSize(material.fileSize)}</span>
                              <span>•</span>
                              <span className="truncate">{material.fileName}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={getFileUrl(material.fileUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg hover:bg-white text-slate-400 hover:text-blue-500 transition-colors"
                              title="预览"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                            <a
                              href={getFileUrl(material.fileUrl)}
                              download={material.fileName}
                              className="p-2 rounded-lg hover:bg-white text-slate-400 hover:text-emerald-500 transition-colors"
                              title="下载"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleDelete(material)}
                              className="p-2 rounded-lg hover:bg-white text-slate-400 hover:text-rose-500 transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                  </>
                ) : (
                  /* Agent 手册 Tab */
                  <AgentManualEditor
                    sourceType={1}
                    sourceId={lessonId}
                    sourceName={lessonTitle}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
                >
                  完成
                </button>
              </div>
              </div>
            </motion.div>
          </>
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

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText="删除"
        onConfirm={confirmDialog.handleConfirm}
        onCancel={confirmDialog.hideConfirm}
      />
    </>,
    document.body
  );
};

export default LessonMaterialsModal;
