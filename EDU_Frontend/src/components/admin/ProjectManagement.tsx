import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Plus,
  FileText,
  Settings,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Layers,
  Users,
  Archive,
  CheckCircle2,
  FileEdit,
  ArrowLeft,
  Save,
  X,
  GripVertical,
  Clock,
  Loader2,
  Image as ImageIcon,
  Tag as TagIcon,
  Target,
  BookOpen,
  Monitor,
  Box,
  Bot,
} from 'lucide-react';
import { Select, SelectItem } from '@heroui/react';
import ReactMarkdown from 'react-markdown';
import {
  projectApi,
  unitApi,
  tagApi,
  uploadApi,
  type Project,
  type ProjectUnit,
  type Tag,
  type CreateProjectDTO,
  type CreateUnitDTO,
} from '@/services/project';
import { labApi, type DockerImage } from '@/services/lab';
import { ToastContainer, useToast } from '@/components/common/Toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import UnitAgentModal from './UnitAgentModal';
import { getImageUrl } from '@/config';

// ==================== 类型定义 ====================

interface ProjectFormData {
  id: number | null;
  title: string;
  slug: string;
  subtitle: string;
  coverUrl: string;
  difficulty: number;
  status: number;
  description: string;
  learningGoals: string[];
  prerequisites: string[];
  tagIds: number[];
  units: ProjectUnit[];
  envImage: string;
  ideImage: string;
}

// ==================== 辅助函数 ====================

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString('zh-CN');
};

// ==================== 项目编辑器组件 ====================

interface ProjectEditorProps {
  project: ProjectFormData;
  allTags: Tag[];
  onSave: (data: ProjectFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  onToast: (message: string, type: 'success' | 'error') => void;
  onTagsChange: () => void;
  onShowConfirm: (options: { title: string; message: string; type?: 'danger' | 'warning' | 'info'; onConfirm: () => void }) => void;
}

const ProjectEditor: React.FC<ProjectEditorProps> = ({ project, allTags, onSave, onCancel, loading, onToast, onTagsChange, onShowConfirm }) => {
  const [formData, setFormData] = useState<ProjectFormData>(project);
  const [activeTab, setActiveTab] = useState<'basics' | 'syllabus' | 'settings'>('basics');
  const [uploading, setUploading] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [newPrereq, setNewPrereq] = useState('');
  const [showDescPreview, setShowDescPreview] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [tagLoading, setTagLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Docker 镜像列表
  const [dockerImages, setDockerImages] = useState<DockerImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  
  // Agent 手册 Modal 状态
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<{ id: number; title: string } | null>(null);

  // 加载 Docker 镜像列表
  useEffect(() => {
    const fetchImages = async () => {
      setLoadingImages(true);
      try {
        const response = await labApi.getImages();
        if (response.success && response.data) {
          setDockerImages(response.data);
        }
      } catch (err) {
        console.error('加载镜像列表失败:', err);
      } finally {
        setLoadingImages(false);
      }
    };
    fetchImages();
  }, []);

  const handleChange = (field: keyof ProjectFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // 创建新标签
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      onToast('请输入标签名称', 'error');
      return;
    }
    setTagLoading(true);
    try {
      const result = await tagApi.create(newTagName.trim(), newTagColor);
      if (result.success) {
        onToast('标签创建成功', 'success');
        setNewTagName('');
        setNewTagColor('#3B82F6');
        onTagsChange();
      } else {
        onToast(result.error || '创建失败', 'error');
      }
    } catch {
      onToast('创建失败', 'error');
    } finally {
      setTagLoading(false);
    }
  };

  // 删除标签
  const handleDeleteTag = async (tagId: number) => {
    onShowConfirm({
      title: '删除标签',
      message: '确定要删除该标签吗？删除后将从所有项目中移除。',
      type: 'danger',
      onConfirm: async () => {
        setTagLoading(true);
        try {
          const result = await tagApi.delete(tagId);
          if (result.success) {
            onToast('标签删除成功', 'success');
            // 从当前选中的标签中移除
            if (formData.tagIds.includes(tagId)) {
              handleChange('tagIds', formData.tagIds.filter(id => id !== tagId));
            }
            onTagsChange();
          } else {
            onToast(result.error || '删除失败', 'error');
          }
        } catch {
          onToast('删除失败', 'error');
        } finally {
          setTagLoading(false);
        }
      },
    });
  };

  // 图片上传
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadApi.uploadImage(file);
      if (result.success && result.data) {
        handleChange('coverUrl', result.data.url);
        onToast('图片上传成功', 'success');
      } else {
        onToast(result.error || '上传失败', 'error');
      }
    } catch {
      onToast('上传失败', 'error');
    } finally {
      setUploading(false);
    }
  };

  // 学习目标管理
  const addGoal = () => {
    if (newGoal.trim()) {
      handleChange('learningGoals', [...formData.learningGoals, newGoal.trim()]);
      setNewGoal('');
    }
  };

  const removeGoal = (index: number) => {
    handleChange(
      'learningGoals',
      formData.learningGoals.filter((_, i) => i !== index)
    );
  };

  // 前置知识管理
  const addPrereq = () => {
    if (newPrereq.trim()) {
      handleChange('prerequisites', [...formData.prerequisites, newPrereq.trim()]);
      setNewPrereq('');
    }
  };

  const removePrereq = (index: number) => {
    handleChange(
      'prerequisites',
      formData.prerequisites.filter((_, i) => i !== index)
    );
  };

  // 标签选择
  const toggleTag = (tagId: number) => {
    const newTagIds = formData.tagIds.includes(tagId)
      ? formData.tagIds.filter((id) => id !== tagId)
      : [...formData.tagIds, tagId];
    handleChange('tagIds', newTagIds);
  };

  // 单元管理
  const handleAddUnit = () => {
    const newUnit: ProjectUnit = {
      id: -Date.now(), // 临时负数ID表示新建
      projectId: formData.id || 0,
      title: '新单元',
      description: '',
      type: 1,
      modeGroup: 1,
      envId: '',
      timeLimit: 45,
      points: 0,
      sortOrder: formData.units.length,
      isHidden: 0,
    };
    handleChange('units', [...formData.units, newUnit]);
  };

  const handleUpdateUnit = (index: number, field: keyof ProjectUnit, value: unknown) => {
    const newUnits = [...formData.units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    handleChange('units', newUnits);
  };

  const handleDeleteUnit = (index: number) => {
    handleChange(
      'units',
      formData.units.filter((_, i) => i !== index)
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full"
    >
      {/* Header */}
      <div className="h-20 px-8 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              {formData.id ? '编辑项目' : '新建项目'}
              {formData.status === 0 && (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">
                  草稿
                </span>
              )}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存更改
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-slate-100 p-2 shadow-sm">
              {[
                { id: 'basics', label: '基础信息', icon: FileText },
                { id: 'syllabus', label: '教学大纲', icon: Layers },
                { id: 'settings', label: '高级设置', icon: Settings },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Status Card */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">发布状态</h3>
              <div className="space-y-3">
                {[
                  { value: 1, label: '已发布', desc: '学生可见，可进行学习' },
                  { value: 0, label: '草稿箱', desc: '仅管理员可见' },
                  { value: 2, label: '已下架', desc: '暂停学习，保留数据' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      formData.status === opt.value
                        ? 'bg-blue-50 border-blue-200'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      checked={formData.status === opt.value}
                      onChange={() => handleChange('status', opt.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-800">{opt.label}</div>
                      <div className="text-xs text-slate-500">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">
            {activeTab === 'basics' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Basic Info */}
                <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">项目名称 *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleChange('title', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="例如：Vue.js 基础实战"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Slug (URL) *</label>
                      <div className="flex items-center">
                        <span className="px-3 py-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-500 text-sm font-mono">
                          /project/
                        </span>
                        <input
                          type="text"
                          value={formData.slug}
                          onChange={(e) => handleChange('slug', e.target.value)}
                          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-r-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="vue-basics"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">难度等级</label>
                      <Select
                        selectedKeys={[String(formData.difficulty)]}
                        onSelectionChange={(keys) => {
                          const value = Array.from(keys)[0];
                          if (value) handleChange('difficulty', Number(value));
                        }}
                        className="w-full"
                        size="md"
                        variant="bordered"
                        classNames={{
                          base: 'w-full',
                          trigger: 'bg-slate-50 border-slate-200 rounded-xl h-12 data-[hover=true]:bg-slate-100',
                          value: 'text-sm font-medium text-slate-700',
                          selectorIcon: 'right-3 left-auto',
                          popoverContent: 'bg-white border border-slate-200 shadow-lg rounded-xl',
                          listbox: 'bg-white',
                        }}
                      >
                        <SelectItem key="1">初级 (Beginner)</SelectItem>
                        <SelectItem key="2">中级 (Intermediate)</SelectItem>
                        <SelectItem key="3">高级 (Advanced)</SelectItem>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">一句话简介</label>
                    <input
                      type="text"
                      value={formData.subtitle}
                      onChange={(e) => handleChange('subtitle', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="简要描述项目的核心价值..."
                    />
                  </div>

                  {/* Cover Image */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">项目封面</label>
                    <div className="flex gap-6 items-start">
                      <div
                        className="w-40 h-24 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 cursor-pointer hover:border-blue-300 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {formData.coverUrl ? (
                          <img
                            src={getImageUrl(formData.coverUrl)}
                            alt="Cover"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                            {uploading ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                              <>
                                <ImageIcon className="w-6 h-6 mb-1" />
                                <span className="text-xs">点击上传</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={formData.coverUrl}
                          onChange={(e) => handleChange('coverUrl', e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 focus:outline-none focus:border-blue-500"
                          placeholder="或输入图片URL..."
                        />
                        <p className="text-xs text-slate-400">建议尺寸: 800x450px, 支持 JPG/PNG/WebP</p>
                      </div>
                    </div>
                  </div>

                  {/* Description - Markdown Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-700">项目详细介绍 (支持 Markdown)</label>
                      <button
                        type="button"
                        onClick={() => setShowDescPreview(!showDescPreview)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {showDescPreview ? '编辑' : '预览'}
                      </button>
                    </div>
                    {showDescPreview ? (
                      <div className="w-full min-h-[180px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm prose prose-sm prose-slate max-w-none overflow-auto">
                        {formData.description ? (
                          <ReactMarkdown>{formData.description}</ReactMarkdown>
                        ) : (
                          <p className="text-slate-400">暂无内容</p>
                        )}
                      </div>
                    ) : (
                      <textarea
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        rows={8}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                        placeholder="支持 Markdown 格式，例如：&#10;&#10;## 项目背景&#10;&#10;这是一个关于...的项目。&#10;&#10;### 主要特点&#10;&#10;- 特点一&#10;- 特点二"
                      />
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TagIcon className="w-4 h-4 text-slate-400" />
                      <h3 className="text-sm font-bold text-slate-700">项目标签</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTagManager(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      管理标签
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          formData.tagIds.includes(tag.id)
                            ? 'text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        style={
                          formData.tagIds.includes(tag.id)
                            ? { backgroundColor: tag.styleColor }
                            : {}
                        }
                      >
                        {tag.name}
                      </button>
                    ))}
                    {allTags.length === 0 && (
                      <p className="text-sm text-slate-400">暂无标签，点击"管理标签"创建</p>
                    )}
                  </div>

                  {/* Tag Manager Modal */}
                  <AnimatePresence>
                    {showTagManager && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                        onClick={() => setShowTagManager(false)}
                      >
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.95, opacity: 0 }}
                          className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800">标签管理</h3>
                            <button
                              onClick={() => setShowTagManager(false)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Create New Tag */}
                          <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                            <h4 className="text-sm font-bold text-slate-700 mb-3">创建新标签</h4>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                placeholder="标签名称"
                                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                              />
                              <div className="relative">
                                <input
                                  type="color"
                                  value={newTagColor}
                                  onChange={(e) => setNewTagColor(e.target.value)}
                                  className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                  title="选择颜色"
                                />
                              </div>
                              <button
                                onClick={handleCreateTag}
                                disabled={tagLoading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                              >
                                {tagLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '创建'}
                              </button>
                            </div>
                          </div>

                          {/* Existing Tags */}
                          <div>
                            <h4 className="text-sm font-bold text-slate-700 mb-3">现有标签</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {allTags.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">暂无标签</p>
                              ) : (
                                allTags.map((tag) => (
                                  <div
                                    key={tag.id}
                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ backgroundColor: tag.styleColor }}
                                      />
                                      <span className="text-sm font-medium text-slate-700">{tag.name}</span>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteTag(tag.id)}
                                      disabled={tagLoading}
                                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Learning Goals */}
                <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-700">学习目标</h3>
                  </div>
                  <div className="space-y-3">
                    {formData.learningGoals.map((goal, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="flex-1 px-3 py-2 bg-slate-50 rounded-lg text-sm">{goal}</span>
                        <button
                          onClick={() => removeGoal(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGoal}
                        onChange={(e) => setNewGoal(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        placeholder="添加学习目标..."
                      />
                      <button
                        onClick={addGoal}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>

                {/* Prerequisites */}
                <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-700">前置知识</h3>
                  </div>
                  <div className="space-y-3">
                    {formData.prerequisites.map((prereq, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="flex-1 px-3 py-2 bg-slate-50 rounded-lg text-sm">{prereq}</span>
                        <button
                          onClick={() => removePrereq(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPrereq}
                        onChange={(e) => setNewPrereq(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addPrereq()}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        placeholder="添加前置知识..."
                      />
                      <button
                        onClick={addPrereq}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'syllabus' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800">课程单元</h3>
                    <button
                      onClick={handleAddUnit}
                      className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition-colors border border-slate-200 flex items-center gap-2"
                    >
                      <Plus className="w-3 h-3" />
                      添加单元
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.units.length === 0 && (
                      <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-300">
                          <Layers className="w-6 h-6" />
                        </div>
                        <p className="text-slate-400 text-sm">暂无课程单元，点击上方按钮添加。</p>
                      </div>
                    )}
                    {formData.units.map((unit, index) => (
                      <div
                        key={unit.id}
                        className="group flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-blue-200 transition-all"
                      >
                        <div className="cursor-grab text-slate-300 hover:text-slate-500">
                          <GripVertical className="w-4 h-4" />
                        </div>

                        <div className="w-10">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${
                              unit.type === 2
                                ? 'bg-amber-50 border-amber-100 text-amber-600'
                                : 'bg-blue-50 border-blue-100 text-blue-600'
                            }`}
                          >
                            {index + 1}
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-12 gap-3">
                          <div className="col-span-5">
                            <input
                              type="text"
                              value={unit.title}
                              onChange={(e) => handleUpdateUnit(index, 'title', e.target.value)}
                              className="w-full px-3 py-1.5 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none text-sm font-bold text-slate-700"
                              placeholder="单元标题"
                            />
                          </div>
                          <div className="col-span-3">
                            <Select
                              selectedKeys={[String(unit.type)]}
                              onSelectionChange={(keys) => {
                                const value = Array.from(keys)[0];
                                if (value) handleUpdateUnit(index, 'type', Number(value));
                              }}
                              size="sm"
                              variant="bordered"
                              classNames={{
                                base: 'w-full',
                                trigger: 'bg-slate-50 border-slate-200 rounded-lg min-h-8 h-8 data-[hover=true]:bg-slate-100',
                                value: 'text-xs font-medium text-slate-600',
                                selectorIcon: 'right-2 left-auto',
                                popoverContent: 'bg-white border border-slate-200 shadow-lg rounded-lg',
                                listbox: 'bg-white',
                              }}
                            >
                              <SelectItem key="1">实验 (Lab)</SelectItem>
                              <SelectItem key="2">挑战 (Challenge)</SelectItem>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Select
                              selectedKeys={[String(unit.modeGroup)]}
                              onSelectionChange={(keys) => {
                                const value = Array.from(keys)[0];
                                if (value) handleUpdateUnit(index, 'modeGroup', Number(value));
                              }}
                              size="sm"
                              variant="bordered"
                              classNames={{
                                base: 'w-full',
                                trigger: 'bg-slate-50 border-slate-200 rounded-lg min-h-8 h-8 data-[hover=true]:bg-slate-100',
                                value: 'text-xs font-medium text-slate-600',
                                selectorIcon: 'right-2 left-auto',
                                popoverContent: 'bg-white border border-slate-200 shadow-lg rounded-lg',
                                listbox: 'bg-white',
                              }}
                            >
                              <SelectItem key="1">引导模式</SelectItem>
                              <SelectItem key="2">挑战模式</SelectItem>
                            </Select>
                          </div>
                          <div className="col-span-2 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <input
                              type="number"
                              value={unit.timeLimit}
                              onChange={(e) => handleUpdateUnit(index, 'timeLimit', Number(e.target.value))}
                              className="w-12 px-1 py-1.5 bg-slate-50 rounded-lg text-xs font-medium text-slate-600 border-none focus:ring-0 text-center"
                            />
                            <span className="text-xs text-slate-400">分</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Agent 手册配置按钮 - 仅已保存的单元显示 */}
                          {unit.id > 0 && (
                            <button
                              onClick={() => {
                                setSelectedUnit({ id: unit.id, title: unit.title });
                                setAgentModalOpen(true);
                              }}
                              className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="配置 Agent 手册"
                            >
                              <Bot className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUnit(index)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Lab Environment Config */}
                <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Monitor className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-bold text-slate-800">实验环境配置</h3>
                  </div>
                  <div className="space-y-5">
                    {/* Ubuntu 桌面镜像 */}
                    <div>
                      <label className="text-sm font-bold text-slate-700 mb-2 block">Ubuntu 桌面镜像</label>
                      <div className="flex items-center gap-3">
                        <Monitor className="w-5 h-5 text-slate-400 shrink-0" />
                        <div className="flex-1 relative">
                          <select
                            value={formData.envImage}
                            onChange={e => handleChange('envImage', e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                            disabled={loadingImages}
                          >
                            <option value="">-- 选择镜像 --</option>
                            {dockerImages.map(img => (
                              <option key={img.id} value={img.name}>
                                {img.name} ({(img.size / 1024 / 1024 / 1024).toFixed(2)} GB)
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">提供 Ubuntu 桌面环境 (noVNC)</p>
                    </div>
                    
                    {/* WebIDE 镜像 */}
                    <div>
                      <label className="text-sm font-bold text-slate-700 mb-2 block">WebIDE 镜像</label>
                      <div className="flex items-center gap-3">
                        <Box className="w-5 h-5 text-slate-400 shrink-0" />
                        <div className="flex-1 relative">
                          <select
                            value={formData.ideImage}
                            onChange={e => handleChange('ideImage', e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                            disabled={loadingImages}
                          >
                            <option value="">-- 选择镜像 --</option>
                            {dockerImages.map(img => (
                              <option key={img.id} value={img.name}>
                                {img.name} ({(img.size / 1024 / 1024 / 1024).toFixed(2)} GB)
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        {loadingImages && <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">提供在线代码编辑器环境</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
      
      {/* Agent 手册配置弹窗 */}
      {selectedUnit && (
        <UnitAgentModal
          isOpen={agentModalOpen}
          unitId={selectedUnit.id}
          unitTitle={selectedUnit.title}
          onClose={() => {
            setAgentModalOpen(false);
            setSelectedUnit(null);
          }}
        />
      )}
    </motion.div>
  );
};


// ==================== 项目列表组件 ====================

interface ProjectListProps {
  projects: Project[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onEdit: (project: Project) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
  onPageChange: (page: number) => void;
  onSearch: (keyword: string) => void;
  onStatusFilter: (status: number | undefined) => void;
  onShowConfirm: (options: { title: string; message: string; type?: 'danger' | 'warning' | 'info'; onConfirm: () => void }) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  total,
  page,
  pageSize,
  loading,
  onEdit,
  onCreate,
  onDelete,
  onPageChange,
  onSearch,
  onStatusFilter,
  onShowConfirm,
}) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  const getDifficultyBadge = (diff: number) => {
    const config = {
      1: { label: '初级', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
      2: { label: '中级', color: 'bg-blue-50 text-blue-600 border-blue-100' },
      3: { label: '高级', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    };
    const c = config[diff as keyof typeof config] || config[1];
    return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${c.color}`}>{c.label}</span>;
  };

  const getStatusBadge = (status: number) => {
    const config = {
      0: { label: '草稿', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: FileEdit },
      1: { label: '已发布', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 },
      2: { label: '已下架', color: 'bg-rose-50 text-rose-600 border-rose-100', icon: Archive },
    };
    const c = config[status as keyof typeof config] || config[0];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${c.color}`}>
        <c.icon className="w-3 h-3" />
        {c.label}
      </span>
    );
  };

  const handleSearch = () => {
    onSearch(searchKeyword);
  };

  const handleStatusChange = (status: number | undefined) => {
    setStatusFilter(status);
    onStatusFilter(status);
    setShowStatusMenu(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[700px]"
    >
      {/* Header */}
      <div className="p-8 pb-4 border-b border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
              项目管理
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                {total} 个项目
              </span>
            </h2>
            <p className="text-slate-500 text-sm mt-1">管理实训项目内容、大纲结构及发布状态。</p>
          </div>
          <button
            onClick={onCreate}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95 group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            <span>新建项目</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入项目名称、Slug..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all hover:bg-white hover:shadow-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700"
          >
            搜索
          </button>
          <div className="h-6 w-px bg-slate-200 mx-1"></div>
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-full text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <Filter className="w-4 h-4" />
              <span>{statusFilter === undefined ? '全部状态' : statusFilter === 0 ? '草稿' : statusFilter === 1 ? '已发布' : '已下架'}</span>
            </button>
            {showStatusMenu && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-20 min-w-[120px]">
                {[
                  { value: undefined, label: '全部状态' },
                  { value: 0, label: '草稿' },
                  { value: 1, label: '已发布' },
                  { value: 2, label: '已下架' },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => handleStatusChange(opt.value)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 ${
                      statusFilter === opt.value ? 'text-blue-600 font-medium' : 'text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}
        <table className="w-full text-left border-collapse">
          <thead className="bg-white sticky top-0 z-10 shadow-[0_1px_0_rgba(241,245,249,1)]">
            <tr>
              <th className="pl-8 pr-4 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider w-[35%]">
                项目信息
              </th>
              <th className="px-4 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider">难度</th>
              <th className="px-4 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider">状态</th>
              <th className="px-4 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider">数据统计</th>
              <th className="px-4 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider">最后更新</th>
              <th className="pl-4 pr-8 py-5 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {projects.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="py-20 text-center text-slate-400">
                  暂无项目数据
                </td>
              </tr>
            )}
            {projects.map((p) => (
              <tr key={p.id} className="group hover:bg-slate-50/80 transition-colors">
                <td className="pl-8 pr-4 py-5">
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-10 rounded-lg overflow-hidden shrink-0 shadow-sm border border-slate-100 group-hover:scale-105 transition-transform duration-300 bg-slate-100">
                      {p.coverUrl ? (
                        <img
                          src={getImageUrl(p.coverUrl)}
                          alt={p.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">{p.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          /{p.slug}
                        </span>
                        {p.tags?.slice(0, 2).map((t) => (
                          <span
                            key={t.id}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${t.styleColor}20`, color: t.styleColor }}
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-5">{getDifficultyBadge(p.difficulty)}</td>
                <td className="px-4 py-5">{getStatusBadge(p.status)}</td>
                <td className="px-4 py-5">
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600" title="单元数">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold">{(p.labsCount || 0) + (p.challengesCount || 0)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600" title="学习人数">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold">{(p.studentsCount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-5">
                  <div className="text-xs text-slate-500">{formatDate(p.updatedAt)}</div>
                </td>
                <td className="pl-4 pr-8 py-5 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(p)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="编辑"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        onShowConfirm({
                          title: '删除项目',
                          message: '确定要删除该项目吗？此操作不可恢复，项目下的所有单元都将被删除。',
                          type: 'danger',
                          onConfirm: () => onDelete(p.id),
                        });
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-white">
        <span className="text-xs font-medium text-slate-400">
          显示 <span className="text-slate-900 font-bold">{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}</span> / 共{' '}
          <span className="text-slate-900 font-bold">{total}</span> 个项目
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold ${
                page === p
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'border border-slate-200 text-slate-400 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};


// ==================== 主组件 ====================

const ProjectManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentProject, setCurrentProject] = useState<ProjectFormData | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const { toast, success, error, hideToast } = useToast();
  
  // 确认对话框状态
  const [confirmState, setConfirmState] = useState<{
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
    setConfirmState({
      isOpen: true,
      title: options.title,
      message: options.message,
      type: options.type || 'danger',
      onConfirm: options.onConfirm,
    });
  };
  
  const hideConfirm = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };
  
  const handleConfirm = () => {
    confirmState.onConfirm();
    hideConfirm();
  };

  // 加载项目列表
  const loadProjects = async () => {
    setLoading(true);
    try {
      const result = await projectApi.getList({
        page,
        pageSize,
        keyword: searchKeyword || undefined,
        status: statusFilter,
      });
      if (result.success && result.data) {
        setProjects(result.data.list);
        setTotal(result.data.total);
      }
    } catch (error) {
      console.error('加载项目列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载标签列表
  const loadTags = async () => {
    try {
      const result = await tagApi.getAll();
      if (result.success && result.data) {
        setAllTags(result.data);
      }
    } catch (error) {
      console.error('加载标签列表失败:', error);
    }
  };

  useEffect(() => {
    loadProjects();
    loadTags();
  }, [page, searchKeyword, statusFilter]);

  // 创建新项目
  const handleCreate = () => {
    setCurrentProject({
      id: null,
      title: '',
      slug: '',
      subtitle: '',
      coverUrl: '',
      difficulty: 1,
      status: 0,
      description: '',
      learningGoals: [],
      prerequisites: [],
      tagIds: [],
      units: [],
      envImage: '',
      ideImage: '',
    });
    setView('editor');
  };

  // 编辑项目
  const handleEdit = async (project: Project) => {
    setLoading(true);
    try {
      // 获取完整项目信息（包含单元）
      const result = await projectApi.getById(project.id);
      if (result.success && result.data) {
        const p = result.data;
        setCurrentProject({
          id: p.id,
          title: p.title,
          slug: p.slug,
          subtitle: p.subtitle,
          coverUrl: p.coverUrl,
          difficulty: p.difficulty,
          status: p.status,
          description: p.description || '',
          learningGoals: p.learningGoals || [],
          prerequisites: p.prerequisites || [],
          tagIds: p.tags?.map((t) => t.id) || [],
          units: p.units || [],
          envImage: p.envImage || '',
          ideImage: p.ideImage || '',
        });
        setView('editor');
      }
    } catch (error) {
      console.error('加载项目详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 保存项目
  const handleSave = async (data: ProjectFormData) => {
    if (!data.title.trim()) {
      error('请输入项目名称');
      return;
    }
    if (!data.slug.trim()) {
      error('请输入项目 Slug');
      return;
    }

    setSaving(true);
    try {
      const projectData: CreateProjectDTO = {
        title: data.title,
        slug: data.slug,
        subtitle: data.subtitle,
        coverUrl: data.coverUrl,
        difficulty: data.difficulty,
        status: data.status,
        description: data.description,
        learningGoals: data.learningGoals,
        prerequisites: data.prerequisites,
        tagIds: data.tagIds,
        envImage: data.envImage,
        ideImage: data.ideImage,
      };

      let projectId: number;

      if (data.id) {
        // 更新项目
        const result = await projectApi.update(data.id, projectData);
        if (!result.success) {
          error(result.error || '更新失败');
          return;
        }
        projectId = data.id;
      } else {
        // 创建项目
        const result = await projectApi.create(projectData);
        if (!result.success || !result.data) {
          error(result.error || '创建失败');
          return;
        }
        projectId = result.data.id;
      }

      // 处理单元
      // 获取现有单元
      const existingUnitsResult = await unitApi.getList(projectId);
      const existingUnits = existingUnitsResult.success ? existingUnitsResult.data || [] : [];
      const existingUnitIds = existingUnits.map((u) => u.id);

      // 处理每个单元
      for (const unit of data.units) {
        const unitData: CreateUnitDTO = {
          title: unit.title,
          description: unit.description,
          type: unit.type,
          modeGroup: unit.modeGroup,
          envId: unit.envId,
          timeLimit: unit.timeLimit,
          points: unit.points,
          sortOrder: unit.sortOrder,
          isHidden: unit.isHidden,
        };

        if (unit.id < 0) {
          // 新建单元（临时负数ID）
          await unitApi.create(projectId, unitData);
        } else if (existingUnitIds.includes(unit.id)) {
          // 更新现有单元
          await unitApi.update(projectId, unit.id, unitData);
        }
      }

      // 删除被移除的单元
      const currentUnitIds = data.units.filter((u) => u.id > 0).map((u) => u.id);
      for (const existingId of existingUnitIds) {
        if (!currentUnitIds.includes(existingId)) {
          await unitApi.delete(projectId, existingId);
        }
      }

      success('保存成功');
      setView('list');
      setCurrentProject(null);
      loadProjects();
    } catch (err) {
      console.error('保存失败:', err);
      error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除项目
  const handleDelete = async (id: number) => {
    try {
      const result = await projectApi.delete(id);
      if (result.success) {
        success('删除成功');
        loadProjects();
      } else {
        error(result.error || '删除失败');
      }
    } catch (err) {
      console.error('删除失败:', err);
      error('删除失败');
    }
  };

  // 取消编辑
  const handleCancel = () => {
    setView('list');
    setCurrentProject(null);
  };

  // 搜索
  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    setPage(1);
  };

  // 状态筛选
  const handleStatusFilter = (status: number | undefined) => {
    setStatusFilter(status);
    setPage(1);
  };

  // 分页
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <>
      <ToastContainer toast={toast} onClose={hideToast} />
      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <ProjectList
            key="list"
            projects={projects}
            total={total}
            page={page}
            pageSize={pageSize}
            loading={loading}
            onEdit={handleEdit}
            onCreate={handleCreate}
            onDelete={handleDelete}
            onPageChange={handlePageChange}
            onSearch={handleSearch}
            onStatusFilter={handleStatusFilter}
            onShowConfirm={showConfirm}
          />
        ) : (
          <ProjectEditor
            key="editor"
            project={currentProject!}
            allTags={allTags}
            onSave={handleSave}
            onCancel={handleCancel}
            loading={saving}
            onToast={(msg, type) => type === 'success' ? success(msg) : error(msg)}
            onTagsChange={loadTags}
            onShowConfirm={showConfirm}
          />
        )}
      </AnimatePresence>
      
      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        confirmText="删除"
        onConfirm={handleConfirm}
        onCancel={hideConfirm}
      />
    </>
  );
};

export default ProjectManagement;
