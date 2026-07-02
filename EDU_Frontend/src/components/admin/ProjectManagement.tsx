import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
  ShieldCheck,
  Eye,
  Rocket,
} from 'lucide-react';
import { Select, SelectItem } from '@heroui/react';
import ReactMarkdown from 'react-markdown';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';
import {
  type Project,
  type ProjectUnit,
  type Tag,
  type CreateProjectDTO,
  type CreateUnitDTO,
} from '@/services/project';
import {
  teacherProjectApi as projectApi,
  teacherUnitApi as unitApi,
  teacherTagApi as tagApi,
  teacherUploadApi as uploadApi,
} from '@/services/teacherProject';
import { labApi, type DockerImage } from '@/services/lab';
import { teacherPublishingApi, type LabTemplate, type PublishCheckResult } from '@/services/publishing';
import { ToastContainer, useToast } from '@/components/common/Toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import PublishCheckDrawer from '@/components/teacher/PublishCheckDrawer';
import UnitAgentModal from './UnitAgentModal';
import { getImageUrlCandidates, handleImageFallback } from '@/config';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getCurrentLocale } from '@/i18n';
import type { Locale } from '@/i18n/types';

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
  labTemplateId: number;
  translationMissing?: boolean;
}

// ==================== 辅助函数 ====================

const formatDate = (dateStr: string, t: TFunction) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return t('justNow');
  if (hours < 24) return t('hoursAgo', { count: hours });
  if (days < 7) return t('daysAgo', { count: days });
  return date.toLocaleDateString(getCurrentLocale());
};

const labTemplatePortSummary = (template: LabTemplate, t: TFunction) => {
  const ports = Array.isArray(template.exposedPorts) && template.exposedPorts.length > 0
    ? template.exposedPorts
    : (Array.isArray(template.appPorts) ? template.appPorts.map((port) => ({ ...port, type: 'web' })) : []);
  if (ports.length === 0) return '';
  return t('ports', { ports: ports.map((port) => `${port.type === 'novnc' ? 'Desktop' : (port.label || port.name)}:${port.containerPort}`).join('/') });
};

const projectToFormData = (p: Project): ProjectFormData => ({
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
  tagIds: p.tags?.map((tag) => tag.id) || [],
  units: p.units || [],
  envImage: p.envImage || '',
  ideImage: p.ideImage || '',
  labTemplateId: p.labTemplateId || 0,
  translationMissing: p.translationMissing,
});

const projectTranslationPayload = (project: ProjectFormData) => ({
  title: project.title,
  subtitle: project.subtitle,
  description: project.description,
  learningGoals: project.learningGoals,
  prerequisites: project.prerequisites,
  units: project.units
    .filter((unit) => unit.id > 0)
    .map((unit) => ({ id: unit.id, title: unit.title, description: unit.description || '' })),
});

// ==================== 项目编辑器组件 ====================

interface ProjectEditorProps {
  project: ProjectFormData;
  allTags: Tag[];
  onSave: (data: ProjectFormData) => Promise<number | null | void>;
  onCancel: () => void;
  loading: boolean;
  onToast: (message: string, type: 'success' | 'error') => void;
  onTagsChange: () => void;
  onShowConfirm: (options: { title: string; message: string; type?: 'danger' | 'warning' | 'info'; onConfirm: () => void }) => void;
}

const ProjectEditor: React.FC<ProjectEditorProps> = ({ project, allTags, onSave, onCancel, loading, onToast, onTagsChange, onShowConfirm }) => {
  const { t } = useTranslation('projectManagement');
  const [formData, setFormData] = useState<ProjectFormData>(project);
  const [activeTab, setActiveTab] = useState<'basics' | 'syllabus' | 'settings'>('basics');
  const [contentLocale, setContentLocale] = useState<Locale>('en-US');
  const [loadingTranslation, setLoadingTranslation] = useState(false);
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
  const [labTemplates, setLabTemplates] = useState<LabTemplate[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  
  // Agent 手册 Modal 状态
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<{ id: number; title: string } | null>(null);

  useEffect(() => {
    setFormData(project);
  }, [project]);

  useEffect(() => {
    if (!project.id) {
      setFormData(project);
      return;
    }
    const projectId = project.id;
    let cancelled = false;
    const loadTranslation = async () => {
      setLoadingTranslation(true);
      try {
        const result = await projectApi.getContentTranslation(projectId, contentLocale);
        if (!cancelled && result.success && result.data) {
          setFormData(projectToFormData(result.data));
        }
      } catch (err) {
        console.error('加载项目翻译失败:', err);
      } finally {
        if (!cancelled) setLoadingTranslation(false);
      }
    };
    loadTranslation();
    return () => {
      cancelled = true;
    };
  }, [project, contentLocale]);

  // 加载镜像与 Lab 模板列表
  useEffect(() => {
    const fetchImages = async () => {
      setLoadingImages(true);
      try {
        const [imageResponse, templateResponse] = await Promise.all([
          labApi.getImages(),
          teacherPublishingApi.getLabTemplates(),
        ]);
        if (imageResponse.success && imageResponse.data) {
          setDockerImages(imageResponse.data);
        }
        if (templateResponse.success && templateResponse.data) {
          setLabTemplates(templateResponse.data);
        }
      } catch (err) {
        console.error('加载实验环境配置失败:', err);
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
      onToast(t('tagRequired'), 'error');
      return;
    }
    setTagLoading(true);
    try {
      const result = await tagApi.create(newTagName.trim(), newTagColor);
      if (result.success) {
        onToast(t('tagCreated'), 'success');
        setNewTagName('');
        setNewTagColor('#3B82F6');
        onTagsChange();
      } else {
        onToast(result.error || t('createFailed'), 'error');
      }
    } catch {
      onToast(t('createFailed'), 'error');
    } finally {
      setTagLoading(false);
    }
  };

  // 删除标签
  const handleDeleteTag = async (tagId: number) => {
    onShowConfirm({
      title: t('deleteTagTitle'),
      message: t('deleteTagMessage'),
      type: 'danger',
      onConfirm: async () => {
        setTagLoading(true);
        try {
          const result = await tagApi.delete(tagId);
          if (result.success) {
            onToast(t('tagDeleted'), 'success');
            // 从当前选中的标签中移除
            if (formData.tagIds.includes(tagId)) {
              handleChange('tagIds', formData.tagIds.filter(id => id !== tagId));
            }
            onTagsChange();
          } else {
            onToast(result.error || t('deleteFailed'), 'error');
          }
        } catch {
          onToast(t('deleteFailed'), 'error');
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
        onToast(t('imageUploaded'), 'success');
      } else {
        onToast(result.error || t('uploadFailed'), 'error');
      }
    } catch {
      onToast(t('uploadFailed'), 'error');
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
      title: t('newUnit'),
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

  const handleSaveClick = async () => {
    if (formData.id && contentLocale !== 'en-US') {
      const result = await projectApi.saveContentTranslation(formData.id, contentLocale, projectTranslationPayload(formData));
      if (result.success) {
        onToast(t('saved'), 'success');
      } else {
        onToast(result.error || t('saveFailed'), 'error');
      }
      return;
    }

    const wasExistingProject = Boolean(formData.id);
    const savedId = await onSave(formData);
    const projectId = Number(savedId || formData.id || 0);
    if (wasExistingProject && projectId > 0) {
      const result = await projectApi.saveContentTranslation(projectId, 'en-US', projectTranslationPayload(formData));
      if (!result.success) {
        onToast(result.error || t('saveFailed'), 'error');
      }
    }
  };

  const handleCopyFromEnglish = async () => {
    if (!formData.id) return;
    setLoadingTranslation(true);
    try {
      const result = await projectApi.getContentTranslation(formData.id, 'en-US');
      if (result.success && result.data) {
        setFormData({
          ...projectToFormData(result.data),
          translationMissing: false,
        });
        onToast(t('copiedFromEnglish'), 'success');
      } else {
        onToast(result.error || t('saveFailed'), 'error');
      }
    } catch (err) {
      console.error('复制英文项目内容失败:', err);
      onToast(t('saveFailed'), 'error');
    } finally {
      setLoadingTranslation(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="card-surface rounded-3xl overflow-hidden flex flex-col h-full"
    >
      {/* Header */}
      <div className="h-20 px-8 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              {formData.id ? t('editProject') : t('createProject')}
              {formData.status === 0 && (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">
                  {t('statuses.draft')}
                </span>
              )}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {contentLocale !== 'en-US' && formData.id && (
            <button
              type="button"
              onClick={() => void handleCopyFromEnglish()}
              disabled={loading || loadingTranslation}
              className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100 disabled:opacity-50"
            >
              {t('copyFromEnglish')}
            </button>
          )}
          <div className="inline-flex rounded-full bg-slate-100 p-1">
            {(['en-US', 'zh-CN'] as Locale[]).map((locale) => (
              <button
                key={locale}
                type="button"
                onClick={() => setContentLocale(locale)}
                disabled={loading || loadingTranslation}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  contentLocale === locale ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {locale === 'en-US' ? 'English' : '中文'}
              </button>
            ))}
          </div>
          {loadingTranslation && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          <button
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={() => void handleSaveClick()}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('saveChanges')}
          </button>
        </div>
      </div>

      {contentLocale !== 'en-US' && formData.translationMissing && (
        <div className="bg-amber-50 px-8 py-2 text-xs font-medium text-amber-700">
          {t('translationMissingHint')}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Tabs */}
            <div className="card-surface rounded-2xl p-2">
              {[
                { id: 'basics', label: t('tabs.basics'), icon: FileText },
                { id: 'syllabus', label: t('tabs.syllabus'), icon: Layers },
                { id: 'settings', label: t('tabs.settings'), icon: Settings },
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
            <div className="card-surface rounded-2xl p-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{t('publishStatus')}</h3>
              <div className="space-y-3">
                {[
                  { value: 1, label: t('statuses.published'), desc: t('publishedDesc') },
                  { value: 0, label: t('draftBox'), desc: t('draftDesc') },
                  { value: 2, label: t('statuses.archived'), desc: t('archivedDesc') },
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
                <div className="card-surface rounded-2xl p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">{t('name')}</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleChange('title', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder={t('namePlaceholder')}
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
                      <label className="text-sm font-bold text-slate-700">{t('difficulty')}</label>
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
                          popoverContent: 'card-surface rounded-xl',
                          listbox: 'bg-white',
                        }}
                      >
                        <SelectItem key="1">{t('difficulties.beginner')}</SelectItem>
                        <SelectItem key="2">{t('difficulties.intermediate')}</SelectItem>
                        <SelectItem key="3">{t('difficulties.advanced')}</SelectItem>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">{t('subtitle')}</label>
                    <input
                      type="text"
                      value={formData.subtitle}
                      onChange={(e) => handleChange('subtitle', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder={t('subtitlePlaceholder')}
                    />
                  </div>

                  {/* Cover Image */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">{t('cover')}</label>
                    <div className="flex gap-6 items-start">
                      <div
                        className="w-40 h-24 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 cursor-pointer hover:border-blue-300 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {formData.coverUrl ? (
                          <img
                            src={getImageUrlCandidates(formData.coverUrl)[0]}
                            alt={t('coverImage', { ns: 'uiReview' })}
                            className="w-full h-full object-cover"
                            onError={(e) => handleImageFallback(e, getImageUrlCandidates(formData.coverUrl))}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                            {uploading ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                              <>
                                <ImageIcon className="w-6 h-6 mb-1" />
                                <span className="text-xs">{t('upload')}</span>
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
                          placeholder={t('imageUrlPlaceholder')}
                        />
                        <p className="text-xs text-slate-400">{t('imageHelp')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Description - Markdown Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-700">{t('description')}</label>
                      <button
                        type="button"
                        onClick={() => setShowDescPreview(!showDescPreview)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {showDescPreview ? t('edit') : t('preview')}
                      </button>
                    </div>
                    {showDescPreview ? (
                      <div className="w-full min-h-[180px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm prose prose-sm prose-slate max-w-none overflow-auto">
                        {formData.description ? (
                          <ReactMarkdown>{formData.description}</ReactMarkdown>
                        ) : (
                          <p className="text-slate-400">{t('noContent')}</p>
                        )}
                      </div>
                    ) : (
                      <textarea
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        rows={8}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                        placeholder={t('markdownPlaceholder')}
                      />
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="card-surface rounded-2xl p-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TagIcon className="w-4 h-4 text-slate-400" />
                      <h3 className="text-sm font-bold text-slate-700">{t('tags')}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTagManager(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {t('manageTags')}
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
                      <p className="text-sm text-slate-400">{t('noTagsHint')}</p>
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
                            <h3 className="text-lg font-bold text-slate-800">{t('tagManagement')}</h3>
                            <button
                              onClick={() => setShowTagManager(false)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Create New Tag */}
                          <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                            <h4 className="text-sm font-bold text-slate-700 mb-3">{t('createTag')}</h4>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                placeholder={t('tagName')}
                                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                              />
                              <div className="relative">
                                <input
                                  type="color"
                                  value={newTagColor}
                                  onChange={(e) => setNewTagColor(e.target.value)}
                                  className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                  title={t('selectColor')}
                                />
                              </div>
                              <button
                                onClick={handleCreateTag}
                                disabled={tagLoading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                              >
                                {tagLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('create')}
                              </button>
                            </div>
                          </div>

                          {/* Existing Tags */}
                          <div>
                            <h4 className="text-sm font-bold text-slate-700 mb-3">{t('existingTags')}</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {allTags.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">{t('noTags')}</p>
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
                <div className="card-surface rounded-2xl p-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-700">{t('goals')}</h3>
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
                        placeholder={t('goalPlaceholder')}
                      />
                      <button
                        onClick={addGoal}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100"
                      >
                        {t('add')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Prerequisites */}
                <div className="card-surface rounded-2xl p-8">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-700">{t('prerequisites')}</h3>
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
                        placeholder={t('prerequisitePlaceholder')}
                      />
                      <button
                        onClick={addPrereq}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100"
                      >
                        {t('add')}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'syllabus' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="card-surface rounded-2xl p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800">{t('units')}</h3>
                    <button
                      onClick={handleAddUnit}
                      disabled={contentLocale !== 'en-US'}
                      className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition-colors border border-slate-200 flex items-center gap-2"
                    >
                      <Plus className="w-3 h-3" />
                      {t('addUnit')}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.units.length === 0 && (
                      <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-300">
                          <Layers className="w-6 h-6" />
                        </div>
                        <p className="text-slate-400 text-sm">{t('noUnits')}</p>
                      </div>
                    )}
                    {formData.units.map((unit, index) => (
                      <div
                        key={unit.id}
                        className="group card-surface-muted flex items-center gap-4 p-4 rounded-xl hover:shadow-md transition-all"
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
                              placeholder={t('unitTitle')}
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
                                popoverContent: 'card-surface rounded-lg',
                                listbox: 'bg-white',
                              }}
                            >
                              <SelectItem key="1">{t('unitTypes.lab')}</SelectItem>
                              <SelectItem key="2">{t('unitTypes.challenge')}</SelectItem>
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
                                popoverContent: 'card-surface rounded-lg',
                                listbox: 'bg-white',
                              }}
                            >
                              <SelectItem key="1">{t('modes.guided')}</SelectItem>
                              <SelectItem key="2">{t('modes.challenge')}</SelectItem>
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
                            <span className="text-xs text-slate-400">{t('minutes')}</span>
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
                              title={t('configureAgent')}
                            >
                              <Bot className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUnit(index)}
                            disabled={contentLocale !== 'en-US'}
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
                <div className="card-surface rounded-2xl p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <Monitor className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-bold text-slate-800">{t('environment')}</h3>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm font-bold text-slate-700 mb-2 block">{t('labTemplate')}</label>
                      <ToolbarSelect
                        ariaLabel={t('labTemplate')}
                        value={String(formData.labTemplateId || 0)}
                        onChange={(value) => handleChange('labTemplateId', Number(value))}
                        options={[
                          { key: '0', label: t('noTemplate') },
                          ...labTemplates.map(template => ({
                            key: String(template.id),
                            label: `${template.name} · ${template.envImage}${labTemplatePortSummary(template, t)}`,
                          })),
                        ]}
                      />
                      <p className="text-xs text-slate-400 mt-2">{t('templateHelp')}</p>
                    </div>

                    {/* Ubuntu 桌面镜像 */}
                    <div>
                      <label className="text-sm font-bold text-slate-700 mb-2 block">{t('desktopImage')}</label>
                      <div className="flex items-center gap-3">
                        <Monitor className="w-5 h-5 text-slate-400 shrink-0" />
                        <ToolbarSelect
                          ariaLabel={t('desktopImage')}
                          value={formData.envImage}
                          placeholder={t('selectImage')}
                          isDisabled={loadingImages}
                          disallowEmptySelection={false}
                          onChange={(value) => handleChange('envImage', value)}
                          options={dockerImages.map(img => ({
                            key: img.name,
                            label: `${img.name} (${(img.size / 1024 / 1024 / 1024).toFixed(2)} GB)`,
                          }))}
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{t('desktopHelp')}</p>
                    </div>
                    
                    {/* WebIDE 镜像 */}
                    <div>
                      <label className="text-sm font-bold text-slate-700 mb-2 block">{t('webIdeImage')}</label>
                      <div className="flex items-center gap-3">
                        <Box className="w-5 h-5 text-slate-400 shrink-0" />
                        <ToolbarSelect
                          ariaLabel={t('webIdeImage')}
                          value={formData.ideImage}
                          placeholder={t('selectImage')}
                          isDisabled={loadingImages}
                          disallowEmptySelection={false}
                          onChange={(value) => handleChange('ideImage', value)}
                          options={dockerImages.map(img => ({
                            key: img.name,
                            label: `${img.name} (${(img.size / 1024 / 1024 / 1024).toFixed(2)} GB)`,
                          }))}
                          className="flex-1"
                        />
                        {loadingImages && <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{t('webIdeHelp')}</p>
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
  onCheck: (project: Project) => void;
  onPreview: (project: Project) => void;
  onPublish: (project: Project) => void;
  onArchive: (project: Project) => void;
  onDraft: (project: Project) => void;
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
  onCheck,
  onPreview,
  onPublish,
  onArchive,
  onDraft,
  onShowConfirm,
}) => {
  const { t } = useTranslation('projectManagement');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);

  const totalPages = Math.ceil(total / pageSize);

  const getDifficultyBadge = (diff: number) => {
    const config = {
      1: { label: t('difficulties.beginnerShort'), color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
      2: { label: t('difficulties.intermediateShort'), color: 'bg-blue-50 text-blue-600 border-blue-100' },
      3: { label: t('difficulties.advancedShort'), color: 'bg-amber-50 text-amber-600 border-amber-100' },
    };
    const c = config[diff as keyof typeof config] || config[1];
    return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${c.color}`}>{c.label}</span>;
  };

  const getStatusBadge = (status: number) => {
    const config = {
      0: { label: t('statuses.draft'), color: 'bg-slate-100 text-slate-500 border-slate-200', icon: FileEdit },
      1: { label: t('statuses.published'), color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 },
      2: { label: t('statuses.archived'), color: 'bg-rose-50 text-rose-600 border-rose-100', icon: Archive },
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
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-surface rounded-3xl overflow-hidden flex flex-col h-full min-h-[700px]"
    >
      {/* Header */}
      <div className="p-8 pb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
              {t('title')}
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                {t('count', { count: total })}
              </span>
            </h2>
            <p className="text-slate-500 text-sm mt-1">{t('titleDesc')}</p>
          </div>
          <button
            onClick={onCreate}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95 group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            <span>{t('createProject')}</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <ToolbarSearchField
            value={searchKeyword}
            onChange={setSearchKeyword}
            onEnter={handleSearch}
            placeholder={t('searchPlaceholder')}
            className="max-w-md flex-1"
          />
          <button
            onClick={handleSearch}
            className="h-12 rounded-2xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t('search')}
          </button>
          <div className="h-6 w-px bg-slate-200 mx-1"></div>
          <ToolbarSelect
            ariaLabel={t('statusFilter')}
            value={statusFilter === undefined ? 'all' : String(statusFilter)}
            onChange={(value) => handleStatusChange(value === 'all' ? undefined : Number(value))}
            options={[
              { key: 'all', label: t('allStatuses') },
              { key: '0', label: t('statuses.draft') },
              { key: '1', label: t('statuses.published') },
              { key: '2', label: t('statuses.archived') },
            ]}
            className="w-40"
          />
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
          <thead className="bg-slate-50/60 sticky top-0 z-10">
            <tr>
              <th className="pl-8 pr-4 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider w-[35%]">
                {t('projectInfo')}
              </th>
              <th className="px-4 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider">{t('difficulty')}</th>
              <th className="px-4 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider">{t('status')}</th>
              <th className="px-4 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider">{t('statistics')}</th>
              <th className="px-4 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider">{t('updatedAt')}</th>
              <th className="pl-4 pr-8 py-5 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {projects.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="py-20 text-center text-slate-400">
                  {t('empty')}
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
                          src={getImageUrlCandidates(p.coverUrl)[0]}
                          alt={p.title}
                          className="w-full h-full object-cover"
                          onError={(e) => handleImageFallback(e, getImageUrlCandidates(p.coverUrl))}
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
                    <div className="flex items-center gap-1.5 text-slate-600" title={t('unitCount')}>
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold">{(p.labsCount || 0) + (p.challengesCount || 0)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600" title={t('learnerCount')}>
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold">{(p.studentsCount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-5">
                  <div className="text-xs text-slate-500">{formatDate(p.updatedAt, t)}</div>
                </td>
                <td className="pl-4 pr-8 py-5 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onCheck(p)}
                      className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title={t('publishCheck')}
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onPreview(p)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                      title={t('studentPreview')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {p.status === 1 ? (
                      <button
                        onClick={() => onArchive(p)}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title={t('archive')}
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    ) : p.status === 2 ? (
                      <button
                        onClick={() => onDraft(p)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                        title={t('setDraft')}
                      >
                        <FileEdit className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onPublish(p)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title={t('publishAfterCheck')}
                      >
                        <Rocket className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(p)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t('edit')}
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        onShowConfirm({
                          title: t('deleteProjectTitle'),
                          message: t('deleteProjectMessage'),
                          type: 'danger',
                          onConfirm: () => onDelete(p.id),
                        });
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title={t('delete')}
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
      <div className="p-6 flex items-center justify-between bg-white">
        <span className="text-xs font-medium text-slate-400">
          {t('pageSummary', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total), total })}
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
  const { t } = useTranslation('projectManagement');
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
  const [checkDrawerOpen, setCheckDrawerOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<PublishCheckResult | null>(null);
  const [checkTitle, setCheckTitle] = useState(() => t('checkTitle'));
  const [previewProject, setPreviewProject] = useState<Project | null>(null);
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
      labTemplateId: 0,
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
        setCurrentProject(projectToFormData(result.data));
        setView('editor');
      }
    } catch (error) {
      console.error('加载项目详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 保存项目
  const handleSave = async (data: ProjectFormData): Promise<number | null | void> => {
    if (!data.title.trim()) {
      error(t('nameRequired'));
      return null;
    }
    if (!data.slug.trim()) {
      error(t('slugRequired'));
      return null;
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
        labTemplateId: data.labTemplateId,
      };

      let projectId: number;

      if (data.id) {
        // 更新项目
        const result = await projectApi.update(data.id, projectData);
        if (!result.success) {
          error(result.error || t('updateFailed'));
          return null;
        }
        projectId = data.id;
      } else {
        // 创建项目
        const result = await projectApi.create(projectData);
        if (!result.success || !result.data) {
          error(result.error || t('createFailed'));
          return null;
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

      success(t('saved'));
      setView('list');
      setCurrentProject(null);
      loadProjects();
      return projectId;
    } catch (err) {
      console.error('保存失败:', err);
      error(t('saveFailed'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  // 删除项目
  const handleDelete = async (id: number) => {
    try {
      const result = await projectApi.delete(id);
      if (result.success) {
        success(t('deleted'));
        loadProjects();
      } else {
        error(result.error || t('deleteFailed'));
      }
    } catch (err) {
      console.error('删除失败:', err);
      error(t('deleteFailed'));
    }
  };

  const openProjectPreview = (project: Project, result: PublishCheckResult | null = null) => {
    setCheckTitle(t('previewSuffix', { title: project.title }));
    setPreviewProject(project);
    setCheckResult(result);
    setCheckDrawerOpen(true);
  };

  const handlePublishCheck = async (project: Project, withPreview = false): Promise<PublishCheckResult | null> => {
    setChecking(true);
    setCheckTitle(t('checkSuffix', { title: project.title }));
    setPreviewProject(withPreview ? project : null);
    setCheckResult(null);
    setCheckDrawerOpen(true);
    try {
      const response = await teacherPublishingApi.checkProject(project.id);
      if (response.success && response.data) {
        setCheckResult(response.data);
        return response.data;
      }
      error(response.error || t('checkFailed'));
      return null;
    } catch (err) {
      console.error('项目发布检查失败:', err);
      error(t('checkFailed'));
      return null;
    } finally {
      setChecking(false);
    }
  };

  const handlePublishProject = async (project: Project) => {
    const check = await handlePublishCheck(project, true);
    if (!check?.canPublish) return;
    const response = await projectApi.publish(project.id);
    if (response.success) {
      success(t('published'));
      await loadProjects();
      setCheckDrawerOpen(false);
      return;
    }
    const blocked = teacherPublishingApi.extractBlockedCheck(response);
    if (blocked) {
      setCheckResult(blocked);
      setCheckDrawerOpen(true);
    }
    error(response.error || t('publishFailed'));
  };

  const handleArchiveProject = async (project: Project) => {
    const response = await projectApi.archive(project.id);
    if (response.success) {
      success(t('archived'));
      await loadProjects();
    } else {
      error(response.error || t('archiveFailed'));
    }
  };

  const handleDraftProject = async (project: Project) => {
    const response = await projectApi.draft(project.id);
    if (response.success) {
      success(t('drafted'));
      await loadProjects();
    } else {
      error(response.error || t('draftFailed'));
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
            onCheck={(project) => void handlePublishCheck(project)}
            onPreview={(project) => openProjectPreview(project)}
            onPublish={(project) => void handlePublishProject(project)}
            onArchive={(project) => void handleArchiveProject(project)}
            onDraft={(project) => void handleDraftProject(project)}
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
        confirmText={t('delete')}
        onConfirm={handleConfirm}
        onCancel={hideConfirm}
      />
    </>
  );
};

export default ProjectManagement;
