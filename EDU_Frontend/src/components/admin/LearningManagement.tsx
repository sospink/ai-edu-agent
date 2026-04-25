import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, Trash2, 
  Layers, FileText, Code2, Terminal, 
  Database, Globe, Shield, Cpu, Save, ArrowLeft, 
  Layout, BookOpen, Clock, Zap, CheckCircle2, 
  GripVertical, Trophy, Loader2, Settings2, Monitor, Box, ChevronDown,
  ShieldCheck, Eye, Rocket, Archive
} from 'lucide-react';
import { Select, SelectItem } from '@heroui/react';
import { type Course } from '@/services/course';
import { teacherCourseApi as courseApi, teacherStageApi as stageApi, teacherLessonApi as lessonApi } from '@/services/teacherCourse';
import { labApi, type DockerImage } from '@/services/lab';
import { teacherPublishingApi, type LabTemplate, type PublishCheckResult } from '@/services/publishing';
import { Toast } from '@/components/common/Toast';
import { ConfirmDialog, useConfirmDialog } from '@/components/common/ConfirmDialog';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';
import PublishCheckDrawer from '@/components/teacher/PublishCheckDrawer';
import LessonMaterialsModal from './LessonMaterialsModal';

// --- Types ---

type LessonTypeValue = 1 | 2 | 3 | 4; // 1-实验, 2-挑战, 3-测验, 4-文本

interface LocalLesson {
  id: number;
  title: string;
  type: LessonTypeValue;
  durationMinutes: number;
  points: number;
  sortOrder: number;
  isNew?: boolean;
}

interface LocalStage {
  id: number;
  title: string;
  description: string;
  levelLabel: string;
  sortOrder: number;
  lessons: LocalLesson[];
  isNew?: boolean;
}

interface LocalCourse {
  id: number | null;
  title: string;
  slug: string;
  description: string;
  iconUrl: string;
  coverColor: string;
  difficulty: number;
  status: number;
  estimatedHours: number;
  totalLessons: number;
  totalSkills: number;
  envImage: string;
  ideImage: string;
  labTemplateId: number;
  stages: LocalStage[];
}

// 颜色映射
const colorMap: Record<string, string> = {
  '#64748b': 'slate',
  '#3b82f6': 'blue',
  '#6366f1': 'indigo',
  '#8b5cf6': 'purple',
  '#f43f5e': 'rose',
  '#f97316': 'orange',
  '#eab308': 'yellow',
  '#10b981': 'emerald',
  '#06b6d4': 'cyan',
};

const colorHexMap: Record<string, string> = {
  'slate': '#64748b',
  'blue': '#3b82f6',
  'indigo': '#6366f1',
  'purple': '#8b5cf6',
  'rose': '#f43f5e',
  'orange': '#f97316',
  'yellow': '#eab308',
  'emerald': '#10b981',
  'cyan': '#06b6d4',
};

const labTemplatePortSummary = (template: LabTemplate) => {
  const ports = Array.isArray(template.exposedPorts) && template.exposedPorts.length > 0
    ? template.exposedPorts
    : (Array.isArray(template.appPorts) ? template.appPorts.map((port) => ({ ...port, type: 'web' })) : []);
  if (ports.length === 0) return '';
  return ` · 端口 ${ports.map((port) => `${port.type === 'novnc' ? 'Desktop' : (port.label || port.name)}:${port.containerPort}`).join('/')}`;
};

const getColorName = (hex: string): string => colorMap[hex] || 'blue';
const getColorHex = (name: string): string => colorHexMap[name] || '#3b82f6';

// 图标映射
const iconMap: Record<string, React.ElementType> = {
  'terminal': Terminal,
  'globe': Globe,
  'code': Code2,
  'database': Database,
  'shield': Shield,
  'cpu': Cpu,
  'layout': Layout,
  'layers': Layers,
  'book': BookOpen,
};

const getIconFromUrl = (url: string): React.ElementType => {
  const iconName = url.replace('/icons/', '').replace('.svg', '').toLowerCase();
  return iconMap[iconName] || BookOpen;
};


// --- Course Editor Component ---

interface CourseEditorProps {
  course: LocalCourse;
  onSave: (course: LocalCourse) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const CourseEditor: React.FC<CourseEditorProps> = ({ course, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState<LocalCourse>(course);
  const [saving, setSaving] = useState(false);
  
  // Docker 镜像列表
  const [dockerImages, setDockerImages] = useState<DockerImage[]>([]);
  const [labTemplates, setLabTemplates] = useState<LabTemplate[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  
  // 资料配置弹窗状态
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<{ id: number; title: string; type: number } | null>(null);

  useEffect(() => {
    setFormData(course);
  }, [course]);

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

  const colors = ['slate', 'blue', 'indigo', 'purple', 'rose', 'orange', 'yellow', 'emerald', 'cyan'];
  const icons = [
    { name: 'terminal', Icon: Terminal },
    { name: 'globe', Icon: Globe },
    { name: 'code', Icon: Code2 },
    { name: 'database', Icon: Database },
    { name: 'shield', Icon: Shield },
    { name: 'cpu', Icon: Cpu },
    { name: 'layout', Icon: Layout },
    { name: 'layers', Icon: Layers },
  ];

  const handleStageUpdate = (stageIndex: number, field: keyof LocalStage, value: string) => {
    const newStages = [...formData.stages];
    const stage = newStages[stageIndex];
    if (field === 'title' || field === 'description' || field === 'levelLabel') {
      stage[field] = value;
    }
    setFormData({ ...formData, stages: newStages });
  };

  const handleAddStage = () => {
    const newStage: LocalStage = {
      id: -Date.now(),
      title: '新阶段',
      description: '',
      levelLabel: 'LEVEL',
      sortOrder: formData.stages.length,
      lessons: [],
      isNew: true,
    };
    setFormData({ ...formData, stages: [...formData.stages, newStage] });
  };

  const handleDeleteStage = (stageIndex: number) => {
    const newStages = formData.stages.filter((_, i) => i !== stageIndex);
    setFormData({ ...formData, stages: newStages });
  };

  const handleAddLesson = (stageIndex: number) => {
    const newStages = [...formData.stages];
    newStages[stageIndex].lessons.push({
      id: -Date.now(),
      title: '新课时',
      type: 1,
      durationMinutes: 15,
      points: 10,
      sortOrder: newStages[stageIndex].lessons.length,
      isNew: true,
    });
    setFormData({ ...formData, stages: newStages });
  };

  const handleLessonUpdate = (stageIndex: number, lessonIndex: number, field: keyof LocalLesson, value: unknown) => {
    const newStages = [...formData.stages];
    const lesson = newStages[stageIndex].lessons[lessonIndex];
    if (field === 'title') {
      lesson.title = value as string;
    } else if (field === 'type') {
      lesson.type = value as LessonTypeValue;
    } else if (field === 'durationMinutes' || field === 'points' || field === 'sortOrder') {
      lesson[field] = value as number;
    }
    setFormData({ ...formData, stages: newStages });
  };

  const handleDeleteLesson = (stageIndex: number, lessonIndex: number) => {
    const newStages = [...formData.stages];
    newStages[stageIndex].lessons = newStages[stageIndex].lessons.filter((_, i) => i !== lessonIndex);
    setFormData({ ...formData, stages: newStages });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const getLessonTypeIcon = (type: LessonTypeValue) => {
    switch (type) {
      case 1: return <Terminal className="w-4 h-4" />;
      case 2: return <Trophy className="w-4 h-4" />;
      case 3: return <CheckCircle2 className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getLessonTypeStyle = (type: LessonTypeValue) => {
    switch (type) {
      case 1: return 'bg-blue-50 text-blue-500';
      case 2: return 'bg-amber-50 text-amber-500';
      case 3: return 'bg-emerald-50 text-emerald-500';
      default: return 'bg-slate-50 text-slate-400';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card-surface-strong rounded-[2rem] overflow-hidden flex flex-col h-[calc(100vh-140px)]"
    >
      {/* Header */}
      <div className="h-20 px-8 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors border border-transparent hover:border-slate-200">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800">
                {formData.id ? '编辑课程' : '创建新课程'}
              </h2>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                formData.status === 1 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                formData.status === 0 ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                'bg-slate-50 text-slate-500 border-slate-100'
              }`}>
                {formData.status === 1 ? '已发布' : formData.status === 0 ? '草稿' : '已下架'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors">
            取消
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存更改
          </button>
        </div>
      </div>


      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-[400px] border-r border-slate-100 bg-slate-50/50 p-6 overflow-y-auto">
          <div className="space-y-8">
            {/* Visual Identity */}
            <section className="card-surface p-6 rounded-2xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">视觉风格</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-2 block">主题色</label>
                  <div className="flex flex-wrap gap-2">
                    {colors.map(c => (
                      <button 
                        key={c}
                        onClick={() => setFormData({...formData, coverColor: getColorHex(c)})}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          getColorName(formData.coverColor) === c ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: getColorHex(c) }}
                      >
                        {getColorName(formData.coverColor) === c && <CheckCircle2 className="w-4 h-4 text-white mx-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-2 block">图标</label>
                  <div className="grid grid-cols-4 gap-2">
                    {icons.map(({ name, Icon }) => (
                      <button 
                        key={name}
                        onClick={() => setFormData({...formData, iconUrl: `/icons/${name}.svg`})}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-center ${
                          formData.iconUrl.includes(name)
                          ? 'bg-slate-900 text-white border-slate-900' 
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Basic Info */}
            <section className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">课程名称</label>
                <input 
                  type="text" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="如: Shell Programming"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">Slug</label>
                <input 
                  type="text" 
                  value={formData.slug} 
                  onChange={e => setFormData({...formData, slug: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-600 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="如: shell-programming"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">简介</label>
                <textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:border-blue-500 transition-all h-24 resize-none"
                  placeholder="课程简介..."
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">难度</label>
                <Select
                  selectedKeys={[String(formData.difficulty)]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0];
                    if (value) setFormData({...formData, difficulty: Number(value)});
                  }}
                  className="w-full"
                  size="md"
                  variant="bordered"
                  classNames={{
                    base: 'w-full',
                    trigger: 'bg-white border-slate-200 rounded-xl h-12 data-[hover=true]:bg-slate-50',
                    value: 'text-sm font-medium text-slate-700',
                    selectorIcon: 'right-3 left-auto',
                    popoverContent: 'card-surface rounded-xl',
                    listbox: 'bg-white',
                  }}
                >
                  <SelectItem key="1">初级 (Beginner)</SelectItem>
                  <SelectItem key="2">中级 (Intermediate)</SelectItem>
                  <SelectItem key="3">高级 (Advanced)</SelectItem>
                </Select>
              </div>
            </section>
            
            {/* Settings */}
            <section className="card-surface p-6 rounded-2xl">
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-bold text-slate-800">发布状态</div>
                  <div className="text-xs text-slate-400 mb-3">控制课程可见性</div>
                </div>
                <Select
                  selectedKeys={[String(formData.status)]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0];
                    if (value !== undefined) setFormData({...formData, status: Number(value)});
                  }}
                  className="w-full"
                  size="sm"
                  variant="bordered"
                  classNames={{
                    base: 'w-full',
                    trigger: 'bg-slate-50 border-slate-200 rounded-lg h-10 data-[hover=true]:bg-slate-100',
                    value: 'text-xs font-bold text-slate-700',
                    selectorIcon: 'right-2 left-auto',
                    popoverContent: 'card-surface rounded-xl',
                    listbox: 'bg-white',
                  }}
                >
                  <SelectItem key="0">草稿</SelectItem>
                  <SelectItem key="1">已发布</SelectItem>
                  <SelectItem key="2">已下架</SelectItem>
                </Select>
              </div>
            </section>

            {/* Lab Environment Config */}
            <section className="card-surface p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Monitor className="w-4 h-4 text-blue-500" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">实验环境</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-1.5 block">Lab 模板</label>
                  <ToolbarSelect
                    ariaLabel="Lab 模板"
                    value={String(formData.labTemplateId || 0)}
                    onChange={(value) => setFormData({...formData, labTemplateId: Number(value)})}
                    options={[
                      { key: '0', label: '不绑定模板，使用下方镜像配置' },
                      ...labTemplates.map(template => ({
                        key: String(template.id),
                        label: `${template.name} · ${template.envImage}${labTemplatePortSummary(template)}`,
                      })),
                    ]}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">发布检查会优先校验启用中的模板；绑定模板后 Lab 创建优先使用模板镜像和资源。</p>
                </div>

                {/* Ubuntu 桌面镜像 */}
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-1.5 block">Ubuntu 桌面镜像</label>
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-slate-400" />
                    <ToolbarSelect
                      ariaLabel="Ubuntu 桌面镜像"
                      value={formData.envImage}
                      placeholder="选择镜像"
                      isDisabled={loadingImages}
                      disallowEmptySelection={false}
                      onChange={(value) => setFormData({...formData, envImage: value})}
                      options={dockerImages.map(img => ({
                        key: img.name,
                        label: `${img.name} (${(img.size / 1024 / 1024 / 1024).toFixed(2)} GB)`,
                      }))}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">提供 Ubuntu 桌面环境 (noVNC)</p>
                </div>
                
                {/* WebIDE 镜像 */}
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-1.5 block">WebIDE 镜像</label>
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-slate-400" />
                    <ToolbarSelect
                      ariaLabel="WebIDE 镜像"
                      value={formData.ideImage}
                      placeholder="选择镜像"
                      isDisabled={loadingImages}
                      disallowEmptySelection={false}
                      onChange={(value) => setFormData({...formData, ideImage: value})}
                      options={dockerImages.map(img => ({
                        key: img.name,
                        label: `${img.name} (${(img.size / 1024 / 1024 / 1024).toFixed(2)} GB)`,
                      }))}
                      className="flex-1"
                    />
                    {loadingImages && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">提供在线代码编辑器环境</p>
                </div>
              </div>
            </section>
          </div>
        </div>


        {/* Right Area: Syllabus Builder */}
        <div className="flex-1 bg-white p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="w-6 h-6 text-blue-500" />
                  课程大纲
                </h3>
                <p className="text-slate-400 text-sm mt-1">编排课程阶段与具体的学习单元。</p>
              </div>
              <button 
                onClick={handleAddStage}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                新增阶段
              </button>
            </div>

            <div className="space-y-8 relative">
              {formData.stages.length > 0 && (
                <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-100 -z-10"></div>
              )}

              {formData.stages.map((stage, sIdx) => (
                <motion.div 
                  key={stage.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative pl-14"
                >
                  <div className="absolute left-3 top-6 w-6 h-6 rounded-full border-4 border-white bg-slate-200 shadow-sm z-10"></div>

                  <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">
                          {sIdx + 1}
                        </div>
                        <input 
                          type="text" 
                          value={stage.title}
                          onChange={(e) => handleStageUpdate(sIdx, 'title', e.target.value)}
                          className="bg-transparent font-bold text-slate-800 focus:outline-none focus:bg-slate-50 px-2 py-1 rounded transition-colors flex-1"
                          placeholder="阶段名称"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          value={stage.levelLabel}
                          onChange={(e) => handleStageUpdate(sIdx, 'levelLabel', e.target.value)}
                          className="w-28 text-right bg-transparent text-[10px] font-bold uppercase tracking-wider text-slate-400 focus:outline-none focus:text-blue-500"
                          placeholder="LEVEL"
                        />
                        <button 
                          onClick={() => handleDeleteStage(sIdx)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Lessons List */}
                    <div className="p-4 space-y-2">
                      {stage.lessons.map((lesson, lIdx) => (
                        <div key={lesson.id} className="group card-surface-muted flex items-center gap-3 p-3 rounded-xl hover:shadow-sm transition-all">
                          <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                          
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getLessonTypeStyle(lesson.type)}`}>
                            {getLessonTypeIcon(lesson.type)}
                          </div>

                          <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center">
                            <input 
                              type="text" 
                              value={lesson.title}
                              onChange={(e) => handleLessonUpdate(sIdx, lIdx, 'title', e.target.value)}
                              className="col-span-4 text-sm font-bold text-slate-700 bg-transparent focus:outline-none focus:bg-slate-50 px-1 rounded truncate"
                              placeholder="课时标题"
                            />
                            <ToolbarSelect
                              ariaLabel="课时类型"
                              value={String(lesson.type)}
                              onChange={(value) => handleLessonUpdate(sIdx, lIdx, 'type', parseInt(value))}
                              options={[
                                { key: '1', label: '实验' },
                                { key: '2', label: '挑战' },
                                { key: '3', label: '测验' },
                                { key: '4', label: '文本' },
                              ]}
                              className="col-span-2"
                            />
                            <div className="col-span-2 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <input
                                type="number"
                                value={lesson.durationMinutes}
                                onChange={(e) => handleLessonUpdate(sIdx, lIdx, 'durationMinutes', parseInt(e.target.value) || 0)}
                                className="w-12 text-xs bg-slate-50 border border-slate-200 rounded px-1 py-1 text-center"
                              />
                              <span className="text-xs text-slate-400">分</span>
                            </div>
                            <div className="col-span-2 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-slate-400" />
                              <input
                                type="number"
                                value={lesson.points}
                                onChange={(e) => handleLessonUpdate(sIdx, lIdx, 'points', parseInt(e.target.value) || 0)}
                                className="w-12 text-xs bg-slate-50 border border-slate-200 rounded px-1 py-1 text-center"
                              />
                              <span className="text-xs text-slate-400">XP</span>
                            </div>
                            <div className="col-span-2 flex justify-end gap-1">
                              {/* 实验、挑战、知识型课时显示配置按钮 */}
                              {[1, 2, 4].includes(lesson.type) && lesson.id > 0 && !lesson.isNew && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLesson({ id: lesson.id, title: lesson.title, type: lesson.type });
                                    setMaterialModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                                  title="配置课时资料"
                                >
                                  <Settings2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteLesson(sIdx, lIdx)}
                                className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <button 
                        onClick={() => handleAddLesson(sIdx)}
                        className="w-full py-3 border border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        添加课时
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}

              {formData.stages.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                  <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">暂无阶段</p>
                  <p className="text-sm mt-1">点击上方按钮添加第一个阶段</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 学习资料配置弹窗 */}
      {selectedLesson && (
        <LessonMaterialsModal
          isOpen={materialModalOpen}
          lessonId={selectedLesson.id}
          lessonTitle={selectedLesson.title}
          lessonType={selectedLesson.type}
          onClose={() => {
            setMaterialModalOpen(false);
            setSelectedLesson(null);
          }}
        />
      )}
    </motion.div>
  );
};


// --- Course List Component ---

interface CourseListProps {
  courses: Course[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (course: Course) => void;
  onDelete: (id: number) => void;
  onSearch: (keyword: string) => void;
  onCheck: (course: Course) => void;
  onPreview: (course: Course) => void;
  onPublish: (course: Course) => void;
  onArchive: (course: Course) => void;
  onDraft: (course: Course) => void;
}

const CourseList: React.FC<CourseListProps> = ({ courses, loading, onCreate, onEdit, onDelete, onSearch, onCheck, onPreview, onPublish, onArchive, onDraft }) => {
  const [searchKeyword, setSearchKeyword] = useState('');

  const handleSearch = () => {
    onSearch(searchKeyword);
  };

  const getStatusStyle = (status: number) => {
    switch (status) {
      case 1: return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 0: return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  const getStatusText = (status: number) => {
    switch (status) {
      case 1: return '已发布';
      case 0: return '草稿';
      default: return '已下架';
    }
  };

  const getDifficultyText = (difficulty: number) => {
    switch (difficulty) {
      case 1: return '初级';
      case 2: return '中级';
      case 3: return '高级';
      default: return '未知';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">学习路径管理</h1>
          <p className="text-slate-500 mt-2">管理技能树架构、课程阶段及学习单元内容。</p>
        </div>
        <div className="flex items-center gap-4">
          <ToolbarSearchField
            value={searchKeyword}
            onChange={setSearchKeyword}
            onEnter={handleSearch}
            placeholder="搜索课程..."
            className="w-64"
          />
          <button 
            onClick={onCreate}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            创建课程
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* Course Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {courses.map((course, i) => {
            const colorName = getColorName(course.coverColor);
            const IconComponent = getIconFromUrl(course.iconUrl);
            
            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group card-surface relative rounded-[2rem] p-8 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
                onClick={() => onEdit(course)}
              >
                {/* Background Decoration */}
                <div 
                  className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700 blur-2xl"
                  style={{ backgroundColor: course.coverColor }}
                />
                
                {/* Top Section */}
                <div className="relative z-10 flex items-start justify-between mb-6">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300"
                    style={{ backgroundColor: `${course.coverColor}20`, color: course.coverColor }}
                  >
                    <IconComponent className="w-7 h-7" />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusStyle(course.status)}`}>
                      {getStatusText(course.status)}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                      {getDifficultyText(course.difficulty)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="relative z-10 mb-8">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{course.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">{course.description || '暂无简介'}</p>
                </div>

                {/* Stats Grid */}
                <div className="relative z-10 grid grid-cols-3 gap-2 border-t border-slate-100 pt-6">
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">技能</div>
                    <div className="text-lg font-black text-slate-700">{course.totalSkills}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">课时</div>
                    <div className="text-lg font-black text-slate-700">{course.totalLessons}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">时长</div>
                    <div className="text-lg font-black text-slate-700">{course.estimatedHours}h</div>
                  </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-white/90 backdrop-blur-sm border-t border-slate-100 flex flex-wrap gap-2 z-20">
                  <button 
                    className="flex-1 min-w-[90px] py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                    onClick={(e) => { e.stopPropagation(); onEdit(course); }}
                  >
                    编辑内容
                  </button>
                  <button
                    className="px-3 py-2.5 bg-primary-50 text-primary-600 rounded-xl hover:bg-primary-100"
                    onClick={(e) => { e.stopPropagation(); onCheck(course); }}
                    title="发布检查"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                  <button
                    className="px-3 py-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100"
                    onClick={(e) => { e.stopPropagation(); onPreview(course); }}
                    title="学生视角预览"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {course.status === 1 ? (
                    <button
                      className="px-3 py-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100"
                      onClick={(e) => { e.stopPropagation(); onArchive(course); }}
                      title="下架"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  ) : course.status === 2 ? (
                    <button
                      className="px-3 py-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100"
                      onClick={(e) => { e.stopPropagation(); onDraft(course); }}
                      title="设为草稿"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      className="px-3 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100"
                      onClick={(e) => { e.stopPropagation(); onPublish(course); }}
                      title="检查后发布"
                    >
                      <Rocket className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    className="px-3 py-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100"
                    onClick={(e) => { e.stopPropagation(); onDelete(course.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}

          {/* Add New Placeholder */}
          <button 
            onClick={onCreate}
            className="group relative rounded-[2rem] border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-300 min-h-[300px]"
          >
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform group-hover:bg-blue-100 group-hover:text-blue-600 text-slate-400">
              <Plus className="w-8 h-8" />
            </div>
            <span className="font-bold text-slate-500 group-hover:text-blue-600">创建新课程</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && courses.length === 0 && (
        <div className="text-center py-20">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-bold text-slate-600 mb-2">暂无课程</h3>
          <p className="text-slate-400 mb-6">点击上方按钮创建第一个课程</p>
        </div>
      )}
    </div>
  );
};


// --- Main Container Component ---

const LearningManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentCourse, setCurrentCourse] = useState<LocalCourse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [checkDrawerOpen, setCheckDrawerOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<PublishCheckResult | null>(null);
  const [checkTitle, setCheckTitle] = useState('发布检查');
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  
  // Toast 状态
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // 确认对话框
  const confirmDialog = useConfirmDialog();
  
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  }, []);

  // 加载课程列表
  const loadCourses = async (keyword?: string) => {
    setLoading(true);
    try {
      const response = await courseApi.getList({ 
        page: 1, 
        pageSize: 100,
        keyword: keyword || undefined 
      });
      if (response.success && response.data) {
        setCourses(response.data.list);
      } else {
        showToast(response.error || '加载课程列表失败', 'error');
      }
    } catch (error) {
      console.error('加载课程列表失败:', error);
      showToast('加载课程列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadCourses();
  }, []);

  // 搜索
  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    loadCourses(keyword);
  };

  // 创建新课程
  const handleCreate = () => {
    setCurrentCourse({
      id: null,
      title: '',
      slug: '',
      description: '',
      iconUrl: '/icons/book.svg',
      coverColor: '#3b82f6',
      difficulty: 1,
      status: 0,
      estimatedHours: 0,
      totalLessons: 0,
      totalSkills: 0,
      envImage: '',
      ideImage: '',
      labTemplateId: 0,
      stages: [],
    });
    setView('editor');
  };

  // 编辑课程
  const handleEdit = async (course: Course) => {
    setLoading(true);
    try {
      // 获取完整课程信息（包含阶段和课时）
      const response = await courseApi.getById(course.id);
      if (response.success && response.data) {
        const fullCourse = response.data;
        setCurrentCourse({
          id: fullCourse.id,
          title: fullCourse.title,
          slug: fullCourse.slug,
          description: fullCourse.description,
          iconUrl: fullCourse.iconUrl || '/icons/book.svg',
          coverColor: fullCourse.coverColor || '#3b82f6',
          difficulty: fullCourse.difficulty,
          status: fullCourse.status,
          estimatedHours: fullCourse.estimatedHours,
          totalLessons: fullCourse.totalLessons,
          totalSkills: fullCourse.totalSkills,
          envImage: fullCourse.envImage || '',
          ideImage: fullCourse.ideImage || '',
          labTemplateId: fullCourse.labTemplateId || 0,
          stages: (fullCourse.stages || []).map(stage => ({
            id: stage.id,
            title: stage.title,
            description: stage.description || '',
            levelLabel: stage.levelLabel || '',
            sortOrder: stage.sortOrder,
            lessons: (stage.lessons || []).map(lesson => ({
              id: lesson.id,
              title: lesson.title,
              type: lesson.type as LessonTypeValue,
              durationMinutes: lesson.durationMinutes,
              points: lesson.points,
              sortOrder: lesson.sortOrder,
            })),
          })),
        });
        setView('editor');
      } else {
        showToast(response.error || '加载课程详情失败', 'error');
      }
    } catch (error) {
      console.error('加载课程详情失败:', error);
      showToast('加载课程详情失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 删除课程
  const handleDelete = (id: number) => {
    confirmDialog.showConfirm({
      title: '删除课程',
      message: '确定要删除这个课程吗？此操作不可恢复，课程下的所有阶段和课时都将被删除。',
      type: 'danger',
      onConfirm: async () => {
        try {
          const response = await courseApi.delete(id);
          if (response.success) {
            showToast('课程删除成功', 'success');
            loadCourses(searchKeyword);
          } else {
            showToast(response.error || '删除失败', 'error');
          }
        } catch (error) {
          console.error('删除课程失败:', error);
          showToast('删除失败', 'error');
        }
      },
    });
  };

  const openCoursePreview = (course: Course, result: PublishCheckResult | null = null) => {
    setCheckTitle(`${course.title} · 学生视角预览`);
    setPreviewCourse(course);
    setCheckResult(result);
    setCheckDrawerOpen(true);
  };

  const handlePublishCheck = async (course: Course, withPreview = false): Promise<PublishCheckResult | null> => {
    setChecking(true);
    setCheckTitle(`${course.title} · 发布检查`);
    setPreviewCourse(withPreview ? course : null);
    setCheckResult(null);
    setCheckDrawerOpen(true);
    try {
      const response = await teacherPublishingApi.checkCourse(course.id);
      if (response.success && response.data) {
        setCheckResult(response.data);
        return response.data;
      }
      showToast(response.error || '发布检查失败', 'error');
      return null;
    } catch (error) {
      console.error('课程发布检查失败:', error);
      showToast('发布检查失败', 'error');
      return null;
    } finally {
      setChecking(false);
    }
  };

  const handlePublishCourse = async (course: Course) => {
    const check = await handlePublishCheck(course, true);
    if (!check?.canPublish) return;
    const response = await courseApi.publish(course.id);
    if (response.success) {
      showToast('课程发布成功', 'success');
      await loadCourses(searchKeyword);
      setCheckDrawerOpen(false);
      return;
    }
    const blocked = teacherPublishingApi.extractBlockedCheck(response);
    if (blocked) {
      setCheckResult(blocked);
      setCheckDrawerOpen(true);
    }
    showToast(response.error || '课程发布失败', 'error');
  };

  const handleArchiveCourse = async (course: Course) => {
    const response = await courseApi.archive(course.id);
    if (response.success) {
      showToast('课程已下架', 'success');
      await loadCourses(searchKeyword);
    } else {
      showToast(response.error || '课程下架失败', 'error');
    }
  };

  const handleDraftCourse = async (course: Course) => {
    const response = await courseApi.draft(course.id);
    if (response.success) {
      showToast('课程已设为草稿', 'success');
      await loadCourses(searchKeyword);
    } else {
      showToast(response.error || '设置草稿失败', 'error');
    }
  };

  // 保存课程
  const handleSave = async (courseData: LocalCourse) => {
    try {
      let courseId: number | null = courseData.id ?? currentCourse?.id ?? null;
      const coursePayload = {
        title: courseData.title,
        slug: courseData.slug,
        description: courseData.description,
        iconUrl: courseData.iconUrl,
        coverColor: courseData.coverColor,
        difficulty: courseData.difficulty,
        estimatedHours: courseData.estimatedHours,
        envImage: courseData.envImage,
        ideImage: courseData.ideImage,
        labTemplateId: courseData.labTemplateId,
      };

      // 1. 创建或更新课程基本信息
      if (courseId === null) {
        // 创建新课程
        const createResponse = await courseApi.create({
          ...coursePayload,
          status: courseData.status,
        });
        
        if (!createResponse.success || !createResponse.data) {
          showToast(createResponse.error || '创建课程失败', 'error');
          return;
        }
        courseId = createResponse.data.id;
      } else {
        // 更新课程
        const updatePayload = currentCourse?.id === courseId && courseData.status !== currentCourse.status
          ? { ...coursePayload, status: courseData.status }
          : coursePayload;
        const updateResponse = await courseApi.update(courseId, updatePayload);
        
        if (!updateResponse.success) {
          showToast(updateResponse.error || '更新课程失败', 'error');
          return;
        }
      }

      // 2. 处理阶段和课时
      // 获取现有阶段
      const existingStagesResponse = await stageApi.getList(courseId);
      const existingStages = existingStagesResponse.success ? existingStagesResponse.data || [] : [];
      const existingStageIds = new Set(existingStages.map(s => s.id));
      
      // 收集现有课时ID
      const existingLessonIds = new Set<number>();
      existingStages.forEach(stage => {
        (stage.lessons || []).forEach(lesson => {
          existingLessonIds.add(lesson.id);
        });
      });
      
      // 追踪当前保留的课时ID
      const currentLessonIds = new Set<number>();

      // 处理每个阶段
      for (let sIdx = 0; sIdx < courseData.stages.length; sIdx++) {
        const stage = courseData.stages[sIdx];
        let stageId = stage.id;

        if (stage.isNew || stage.id < 0) {
          // 创建新阶段
          const stageResponse = await stageApi.create(courseId, {
            title: stage.title,
            description: stage.description,
            levelLabel: stage.levelLabel,
            sortOrder: sIdx,
          });
          if (stageResponse.success && stageResponse.data) {
            stageId = stageResponse.data.id;
          } else {
            console.error('创建阶段失败:', stageResponse.error);
            continue;
          }
        } else {
          // 更新现有阶段
          existingStageIds.delete(stage.id);
          await stageApi.update(courseId, stage.id, {
            title: stage.title,
            description: stage.description,
            levelLabel: stage.levelLabel,
            sortOrder: sIdx,
          });
        }

        // 处理课时
        for (let lIdx = 0; lIdx < stage.lessons.length; lIdx++) {
          const lesson = stage.lessons[lIdx];
          
          if (lesson.isNew || lesson.id < 0) {
            // 创建新课时
            await lessonApi.create(courseId, stageId, {
              title: lesson.title,
              type: lesson.type,
              durationMinutes: lesson.durationMinutes,
              points: lesson.points,
              sortOrder: lIdx,
            });
          } else {
            // 更新现有课时
            currentLessonIds.add(lesson.id);
            await lessonApi.update(courseId, lesson.id, {
              title: lesson.title,
              type: lesson.type,
              durationMinutes: lesson.durationMinutes,
              points: lesson.points,
              sortOrder: lIdx,
            });
          }
        }
      }

      // 删除被移除的课时
      for (const lessonId of existingLessonIds) {
        if (!currentLessonIds.has(lessonId)) {
          await lessonApi.delete(courseId, lessonId);
        }
      }

      // 删除被移除的阶段
      for (const stageId of existingStageIds) {
        await stageApi.delete(courseId, stageId);
      }

      // 刷新列表并返回
      showToast('课程保存成功', 'success');
      await loadCourses(searchKeyword);
      setView('list');
      setCurrentCourse(null);
    } catch (error) {
      console.error('保存课程失败:', error);
      showToast('保存失败，请重试', 'error');
    }
  };

  // 取消编辑
  const handleCancel = () => {
    setView('list');
    setCurrentCourse(null);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <CourseList 
            key="list" 
            courses={courses}
            loading={loading}
            onCreate={handleCreate} 
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSearch={handleSearch}
            onCheck={(course) => void handlePublishCheck(course)}
            onPreview={(course) => openCoursePreview(course)}
            onPublish={(course) => void handlePublishCourse(course)}
            onArchive={(course) => void handleArchiveCourse(course)}
            onDraft={(course) => void handleDraftCourse(course)}
          />
        ) : currentCourse ? (
          <CourseEditor 
            key="editor" 
            course={currentCourse}
            onSave={handleSave} 
            onCancel={handleCancel}
            loading={loading}
          />
        ) : null}
      </AnimatePresence>
      
      {/* Toast 提示 */}
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

      <PublishCheckDrawer
        isOpen={checkDrawerOpen}
        title={checkTitle}
        result={checkResult}
        loading={checking}
        onClose={() => setCheckDrawerOpen(false)}
        preview={previewCourse ? (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">课程</div>
              <div className="mt-1 text-xl font-black text-slate-900">{previewCourse.title}</div>
              <div className="mt-2 text-sm leading-relaxed text-slate-600">{previewCourse.description || '暂无简介'}</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">课时</div>
                <div className="text-lg font-black text-slate-800">{previewCourse.totalLessons}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">技能</div>
                <div className="text-lg font-black text-slate-800">{previewCourse.totalSkills}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">时长</div>
                <div className="text-lg font-black text-slate-800">{previewCourse.estimatedHours}h</div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              学生端只会看到已发布课程；发布前请确认 Lab 模板、Agent 手册和验证规则均已通过检查。
            </div>
          </div>
        ) : undefined}
      />
    </>
  );
};

export default LearningManagement;
