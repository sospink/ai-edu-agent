import React, { useState, useEffect, useRef } from 'react';
import { Spinner } from '@heroui/react';
import { Plus, Save, Trash2, ChevronUp, ChevronDown, GripVertical, Upload, FileText, X, Rocket, ShieldCheck } from 'lucide-react';
import { ConfirmDialog, useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast, ToastContainer } from '@/components/common/Toast';
import * as AdminAgentAPI from '@/services/adminAgent';
import type { AgentStepAdmin, ContentBlock } from '@/services/adminAgent';
import { teacherManualApi } from '@/services/teacherManual';
import { teacherAssignmentApi } from '@/services/assignment';
import { teacherPublishingApi, type PublishCheckResult } from '@/services/publishing';
import PageDialog from '@/components/common/PageDialog';
import PublishCheckDrawer from '@/components/teacher/PublishCheckDrawer';
import { ToolbarSelect } from '@/components/common/ToolbarControls';
import { useTranslation } from 'react-i18next';

interface AgentManualEditorProps {
  sourceType: 1 | 2;
  sourceId: number;
  sourceName?: string;
  onClose?: () => void;
}

// 简化的步骤编辑器
const SimpleStepEditor: React.FC<{
  step: AgentStepAdmin;
  index: number;
  onChange: (step: AgentStepAdmin) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}> = ({ step, index, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const { t } = useTranslation('agentManualEditor');
  const [expanded, setExpanded] = useState(false);
  const [jsonMode, setJsonMode] = useState(false);

  const updateField = <K extends keyof AgentStepAdmin>(field: K, value: AgentStepAdmin[K]) => {
    onChange({ ...step, [field]: value });
  };

  return (
    <div className="card-surface mb-3 overflow-hidden rounded-lg">
      {/* 步骤头部 */}
      <div 
        className="flex items-center gap-2 px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical size={16} className="text-slate-400" />
        <span className="text-sm font-bold text-blue-600">{t('stepNumber', { number: index + 1 })}</span>
        <input
          type="text"
          value={step.title}
          onChange={(e) => { e.stopPropagation(); updateField('title', e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-400"
          placeholder={t('stepTitle')}
        />
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {!isFirst && (
            <button onClick={onMoveUp} className="p-1 text-slate-400 hover:text-slate-600">
              <ChevronUp size={16} />
            </button>
          )}
          {!isLast && (
            <button onClick={onMoveDown} className="p-1 text-slate-400 hover:text-slate-600">
              <ChevronDown size={16} />
            </button>
          )}
          <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-500">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="p-4 border-t border-slate-100">
          {/* 模式切换 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setJsonMode(false)}
              className={`px-3 py-1 text-xs font-medium rounded ${!jsonMode ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {t('visual')}
            </button>
            <button
              onClick={() => setJsonMode(true)}
              className={`px-3 py-1 text-xs font-medium rounded ${jsonMode ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              JSON
            </button>
          </div>

          {jsonMode ? (
            <textarea
              value={JSON.stringify({ content: step.content, quickQuestions: step.quickQuestions, verification: step.verification, skillTags: step.skillTags || [] }, null, 2)}
              onChange={(e) => {
                try {
                  const data = JSON.parse(e.target.value);
                  if (data.content) updateField('content', data.content);
                  if (data.quickQuestions) updateField('quickQuestions', data.quickQuestions);
                  if (data.verification !== undefined) updateField('verification', data.verification);
                  if (data.skillTags) updateField('skillTags', data.skillTags);
                } catch { /* ignore */ }
              }}
              className="w-full h-64 px-3 py-2 text-xs font-mono border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-blue-400"
            />
          ) : (
            <>
              {/* 内容块 */}
              <div className="mb-4">
                <div className="text-xs font-bold text-slate-500 mb-2">{t('contentBlocks')}</div>
                {step.content.map((block, bi) => (
                  <div key={bi} className="flex gap-2 mb-2 p-2 bg-slate-50 rounded">
                    <ToolbarSelect
                      ariaLabel={t('blockType')}
                      value={block.type}
                      onChange={(value) => {
                        const newContent = [...step.content];
                        newContent[bi] = { type: value as any };
                        updateField('content', newContent);
                      }}
                      options={[
                        { key: 'text', label: t('text') },
                        { key: 'heading', label: t('heading') },
                        { key: 'code', label: t('code') },
                      ]}
                      className="w-28 shrink-0"
                    />
                    {(block.type === 'text' || block.type === 'heading') && (
                      <input
                        type="text"
                        value={block.text || ''}
                        onChange={(e) => {
                          const newContent = [...step.content];
                          newContent[bi] = { ...block, text: e.target.value };
                          updateField('content', newContent);
                        }}
                        className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-400"
                        placeholder={block.type === 'heading' ? t('heading') : t('textContent')}
                      />
                    )}
                    {block.type === 'code' && (
                      <div className="flex-1 space-y-1">
                        <div className="flex gap-2">
                          <ToolbarSelect
                            ariaLabel={t('codeLanguage')}
                            value={block.language || 'bash'}
                            onChange={(value) => {
                              const newContent = [...step.content];
                              newContent[bi] = { ...block, language: value };
                              updateField('content', newContent);
                            }}
                            options={['bash', 'sql', 'python', 'javascript', 'json'].map(l => ({ key: l, label: l }))}
                            className="w-36 shrink-0"
                          />
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={block.executable || false}
                              onChange={(e) => {
                                const newContent = [...step.content];
                                newContent[bi] = { ...block, executable: e.target.checked };
                                updateField('content', newContent);
                              }}
                            />
                            {t('executable')}
                          </label>
                        </div>
                        <textarea
                          value={block.code || ''}
                          onChange={(e) => {
                            const newContent = [...step.content];
                            newContent[bi] = { ...block, code: e.target.value };
                            updateField('content', newContent);
                          }}
                          className="w-full px-2 py-1 text-xs font-mono border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-400"
                          rows={2}
                          placeholder={t('codeContent')}
                        />
                      </div>
                    )}
                    <button
                      onClick={() => updateField('content', step.content.filter((_, i) => i !== bi))}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => updateField('content', [...step.content, { type: 'text', text: '' }])}
                  className="px-3 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                >
                  <Plus size={12} className="inline mr-1" />{t('addBlock')}
                </button>
              </div>

              {/* 快捷问题 */}
              <div className="mb-4">
                <div className="text-xs font-bold text-slate-500 mb-2">{t('quickQuestions')}</div>
                {step.quickQuestions.map((q, qi) => (
                  <div key={qi} className="flex gap-2 mb-1">
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => {
                        const newQ = [...step.quickQuestions];
                        newQ[qi] = e.target.value;
                        updateField('quickQuestions', newQ);
                      }}
                      className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-400"
                    />
                    <button
                      onClick={() => updateField('quickQuestions', step.quickQuestions.filter((_, i) => i !== qi))}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => updateField('quickQuestions', [...step.quickQuestions, ''])}
                  className="px-3 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                >
                  <Plus size={12} className="inline mr-1" />{t('addQuestion')}
                </button>
              </div>

              {/* 技能标签 */}
              <div className="mb-4">
                <div className="text-xs font-bold text-slate-500 mb-2">{t('skillTags', { ns: 'uiReview' })}</div>
                <input
                  type="text"
                  value={(step.skillTags || []).join(', ')}
                  onChange={(e) => updateField('skillTags', e.target.value.split(',').map(item => item.trim()).filter(Boolean) as AgentStepAdmin['skillTags'])}
                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-400"
                  placeholder="Kubernetes, kubectl, namespace"
                />
                <div className="mt-1 text-[11px] text-slate-400">{t('tagHelp')}</div>
              </div>

              {/* 验证规则 */}
              <div>
                <div className="text-xs font-bold text-slate-500 mb-2">{t('verificationRules')}</div>
                <ToolbarSelect
                  ariaLabel={t('verificationRule')}
                  value={step.verification?.type || 'none'}
                  onChange={(value) => {
                    const v = value;
                    updateField('verification', v === 'none' ? null : { type: v as any });
                  }}
                  options={[
                    { key: 'none', label: t('none') },
                    { key: 'file_exists', label: t('fileExists') },
                    { key: 'command_output', label: t('commandOutput') },
                    { key: 'service_running', label: t('serviceRunning') },
                  ]}
                  className="mb-2"
                />
                {step.verification?.type === 'file_exists' && (
                  <input
                    type="text"
                    value={step.verification.path || ''}
                    onChange={(e) => updateField('verification', { ...step.verification!, path: e.target.value })}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                    placeholder={t('filePathPlaceholder')}
                  />
                )}
                {step.verification?.type === 'command_output' && (
                  <input
                    type="text"
                    value={step.verification.command || ''}
                    onChange={(e) => updateField('verification', { ...step.verification!, command: e.target.value })}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                    placeholder={t('commandPlaceholder')}
                  />
                )}
                {step.verification?.type === 'service_running' && (
                  <input
                    type="number"
                    value={step.verification.port || ''}
                    onChange={(e) => updateField('verification', { ...step.verification!, port: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                    placeholder={t('portPlaceholder')}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const AgentManualEditor: React.FC<AgentManualEditorProps> = ({
  sourceType,
  sourceId,
  sourceName,
}) => {
  const { t, i18n } = useTranslation('agentManualEditor');
  // 统一复用全站通知组件，避免本编辑器单独使用 HeroUI addToast 造成弹窗样式不一致
  const { toast, showToast, hideToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualId, setManualId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [steps, setSteps] = useState<AgentStepAdmin[]>([]);
  const confirmDialog = useConfirmDialog();
  
  // Markdown 导入相关状态
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<AdminAgentAPI.ParsedManualPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [markdownContent, setMarkdownContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [checkDrawerOpen, setCheckDrawerOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<PublishCheckResult | null>(null);
  const [checkTitle, setCheckTitle] = useState(() => t('publishCheckTitle'));

  useEffect(() => {
    loadManual();
  }, [sourceType, sourceId, i18n.language]);

  const loadManual = async () => {
    setLoading(true);
    try {
      const data = await AdminAgentAPI.getManual(sourceType, sourceId);
      if (data.exists && data.id) {
        setManualId(data.id);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setIsPublished(data.isPublished === 1);
        setSteps(data.steps || []);
      } else {
        setManualId(null);
        setTitle(sourceName || t('newManual'));
        setDescription('');
        setIsPublished(false);
        setSteps([]);
      }
    } catch (err) {
      console.error('[AgentManualEditor] Load error:', err);
      showToast(t('loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const result = await AdminAgentAPI.createManual({ sourceType, sourceId, title, description });
      if (result) {
        setManualId(result.id);
        showToast(t('created'), 'success');
      }
    } catch (err: any) {
      showToast(err.message || t('createFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const persistManualContent = async (showSuccessToast = true): Promise<number | null> => {
    setSaving(true);
    try {
      let nextManualId = manualId;
      if (!nextManualId) {
        const created = await AdminAgentAPI.createManual({ sourceType, sourceId, title, description });
        if (!created) {
          showToast(t('manualCreateFailed'), 'error');
          return null;
        }
        nextManualId = created.id;
        setManualId(created.id);
      }

      const updateResponse = await teacherManualApi.updateManual(nextManualId, { title, description });
      if (!updateResponse.success) {
        showToast(updateResponse.error || t('saveBasicsFailed'), 'error');
        return null;
      }

      const savedSteps = await AdminAgentAPI.updateSteps(nextManualId, steps.map((step) => ({
        title: step.title,
        content: step.content,
        quickQuestions: step.quickQuestions,
        verification: step.verification,
        skillTags: step.skillTags || [],
      })));
      const nextSteps = savedSteps.map((step, index) => ({
        ...step,
        skillTags: steps[index]?.skillTags || [],
      }));
      await Promise.all(nextSteps.map((step) => (
        step.id ? teacherAssignmentApi.updateAgentStepSkillTags(step.id, step.skillTags || []) : Promise.resolve()
      )));
      setSteps(nextSteps);

      if (showSuccessToast) {
        showToast(t('contentSaved'), 'success');
      }
      return nextManualId;
    } catch (err: any) {
      showToast(err.message || t('saveFailed'), 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openCheckDrawer = (titleText: string, result: PublishCheckResult | null = null) => {
    setCheckTitle(titleText);
    setCheckResult(result);
    setCheckDrawerOpen(true);
  };

  const handleSave = async () => {
    await persistManualContent(true);
  };

  const handlePublishCheck = async (): Promise<PublishCheckResult | null> => {
    const nextManualId = await persistManualContent(false);
    if (!nextManualId) return null;

    setChecking(true);
    openCheckDrawer(t('checkSuffix', { title: title || sourceName || t('unnamedManual') }));
    try {
      const response = await teacherPublishingApi.checkManual(nextManualId);
      if (response.success && response.data) {
        setCheckResult(response.data);
        return response.data;
      }
      showToast(response.error || t('checkFailed'), 'error');
      return null;
    } catch (err: any) {
      showToast(err.message || t('checkFailed'), 'error');
      return null;
    } finally {
      setChecking(false);
    }
  };

  const handlePublish = async () => {
    const check = await handlePublishCheck();
    if (!check?.canPublish) return;

    const nextManualId = manualId || check.contentId;
    setSaving(true);
    try {
      const response = await teacherManualApi.updateManual(nextManualId, { title, description, isPublished: 1 });
      if (response.success) {
        setIsPublished(true);
        showToast(t('published'), 'success');
        setCheckDrawerOpen(false);
        return;
      }

      const blocked = teacherPublishingApi.extractBlockedCheck(response);
      if (blocked) {
        openCheckDrawer(t('checkSuffix', { title: title || sourceName || t('unnamedManual') }), blocked);
      }
      showToast(response.error || t('publishFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDraft = async () => {
    const nextManualId = await persistManualContent(false);
    if (!nextManualId) return;

    setSaving(true);
    try {
      const response = await teacherManualApi.updateManual(nextManualId, { title, description, isPublished: 0 });
      if (!response.success) {
        showToast(response.error || t('draftFailed'), 'error');
        return;
      }
      setIsPublished(false);
      showToast(t('drafted'), 'success');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!manualId) return;
    confirmDialog.showConfirm({
      title: t('deleteTitle'),
      message: t('deleteMessage'),
      type: 'danger',
      onConfirm: async () => {
        setSaving(true);
        try {
          await AdminAgentAPI.deleteManual(manualId);
          setManualId(null);
          setTitle(sourceName || t('newManual'));
          setDescription('');
          setIsPublished(false);
          setSteps([]);
          showToast(t('deleted'), 'success');
        } catch (err: any) {
          showToast(err.message || t('deleteFailed'), 'error');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const addStep = () => {
    setSteps([...steps, {
      stepOrder: steps.length,
      title: t('defaultStep', { number: steps.length + 1 }),
      content: [{ type: 'text', text: '' }] as ContentBlock[],
      quickQuestions: [],
      verification: null,
      skillTags: [],
    }]);
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    newSteps.forEach((s, i) => s.stepOrder = i);
    setSteps(newSteps);
  };

  // MD 导入相关函数
  const closeImportModal = () => {
    setShowImportModal(false);
    setImportPreview(null);
    setImportError('');
    setMarkdownContent('');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await AdminAgentAPI.readMarkdownFile(file);
      setMarkdownContent(content);
      setImportPreview(null);
      setImportError('');
    } catch (err) {
      showToast(t('readFailed'), 'error');
    }
    e.target.value = '';
  };

  const handlePreview = async () => {
    if (!markdownContent.trim()) return;
    setImporting(true);
    setImportError('');
    try {
      const preview = await AdminAgentAPI.parseMarkdownPreview(markdownContent);
      setImportPreview(preview);
    } catch (err: any) {
      const message = err.message || t('parseFailed');
      setImportError(message);
      showToast(message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (!markdownContent.trim()) return;
    setImporting(true);
    setImportError('');
    try {
      const result = await AdminAgentAPI.importMarkdown(sourceType, sourceId, markdownContent);
      // 关闭弹窗
      closeImportModal();
      // 重新加载获取完整步骤数据（不显示loading）
      const data = await AdminAgentAPI.getManual(sourceType, sourceId);
      if (data.exists && data.id) {
        setManualId(data.id);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setIsPublished(data.isPublished === 1);
        setSteps(data.steps || []);
      }
      showToast(t('importSuccess', { count: result.stepsCount }), 'success');
    } catch (err: any) {
      const message = err.message || t('importFailed');
      setImportError(message);
      showToast(message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = () => {
    const markdown = AdminAgentAPI.exportToMarkdown({ title, description, steps });
    const filename = t('exportFilename', { title: title || t('exportDefault') });
    AdminAgentAPI.downloadMarkdown(markdown, filename);
    showToast(t('exported'), 'success');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ToastContainer toast={toast} onClose={hideToast} />
      {/* 基本信息 */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">{t('manualTitle')}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            placeholder={t('titlePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">{t('manualDescription')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
            rows={2}
            placeholder={t('descriptionPlaceholder')}
          />
        </div>
        {/* 发布状态为只读展示：真正的发布/草稿切换由下方“检查后发布 / 设为草稿”按钮持久化，
            避免此处出现一个不落库的复选框，让教师误以为勾选即已发布。 */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">{t('publishStatus')}</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isPublished ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {isPublished ? t('publishedVisible') : t('draftPrivate')}
          </span>
        </div>
      </div>

      {/* 步骤列表 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700">{t('stepList', { count: steps.length })}</h3>
          <button
            onClick={addStep}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Plus size={14} /> {t('addStep')}
          </button>
        </div>

        {steps.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            {t('noSteps')}
          </div>
        ) : (
          steps.map((step, index) => (
            <SimpleStepEditor
              key={index}
              step={step}
              index={index}
              onChange={(s) => {
                const newSteps = [...steps];
                newSteps[index] = s;
                setSteps(newSteps);
              }}
              onDelete={() => setSteps(steps.filter((_, i) => i !== index))}
              onMoveUp={() => moveStep(index, 'up')}
              onMoveDown={() => moveStep(index, 'down')}
              isFirst={index === 0}
              isLast={index === steps.length - 1}
            />
          ))
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Spinner size="sm" color="white" /> : <Save size={16} />}
          {manualId ? t('saveContent') : t('createAndSave')}
        </button>
        <button
          onClick={() => void handlePublishCheck()}
          disabled={saving || checking}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          {checking ? <Spinner size="sm" color="primary" /> : <ShieldCheck size={16} />}
          {t('publishCheck')}
        </button>
        <button
          onClick={() => void handlePublish()}
          disabled={saving || checking}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {(saving || checking) ? <Spinner size="sm" color="white" /> : <Rocket size={16} />}
          {t('publishAfterCheck')}
        </button>
        {manualId && isPublished && (
          <button
            onClick={() => void handleSetDraft()}
            disabled={saving || checking}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            <FileText size={16} /> {t('setDraft')}
          </button>
        )}
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
        >
          <Upload size={16} /> {t('importMD')}
        </button>
        {manualId && steps.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <FileText size={16} /> {t('exportMD')}
          </button>
        )}
        {manualId && (
          <button
            onClick={handleDelete}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            <Trash2 size={16} /> {t('deleteManual')}
          </button>
        )}
      </div>

      {/* MD 导入弹窗 */}
      <PageDialog isOpen={showImportModal} onClose={closeImportModal} panelClassName="max-w-2xl" zIndexClassName="z-[10020]">
        <div className="bg-white rounded-xl shadow-xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">{t('importTitle')}</h3>
              <button onClick={closeImportModal} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {!importPreview ? (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600 mb-2">{t('selectOrPaste')}</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                    >
                      {t('selectFile')}
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{t('pasteLabel')}</label>
                    <textarea
                      value={markdownContent}
                      onChange={(e) => {
                        setMarkdownContent(e.target.value);
                        setImportPreview(null);
                        setImportError('');
                      }}
                      className="w-full h-40 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-blue-400"
                      placeholder={t('markdownPlaceholder')}
                    />
                  </div>
                  {importError && (
                    <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{importError}</div>
                  )}
                  <button
                    onClick={handlePreview}
                    disabled={!markdownContent.trim() || importing}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {importing ? t('parsing') : t('previewParse')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800">{t('parseSuccess')}</p>
                    <p className="text-xs text-green-600 mt-1">{t('previewTitle', { title: importPreview.title })}</p>
                    {importPreview.description && (
                      <p className="text-xs text-green-600">{t('previewDescription', { description: importPreview.description })}</p>
                    )}
                    <p className="text-xs text-green-600">{t('stepCount', { count: importPreview.steps.length })}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-600">{t('stepPreview')}</p>
                    {importPreview.steps.map((step, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm font-medium text-slate-700">{t('previewStep', { number: i + 1, title: step.title })}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {t('previewMetrics', { blocks: step.content.length, questions: step.quickQuestions.length, verification: step.verification ? step.verification.type : t('noVerification') })}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setImportPreview(null)}
                      className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                      {t('backEdit')}
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {importing ? t('importing') : t('confirmImport')}
                    </button>
                  </div>
                </div>
              )}
            </div>
        </div>
      </PageDialog>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText={t('delete')}
        onConfirm={confirmDialog.handleConfirm}
        onCancel={confirmDialog.hideConfirm}
      />

      <PublishCheckDrawer
        isOpen={checkDrawerOpen}
        title={checkTitle}
        result={checkResult}
        loading={checking}
        zIndexClassName="z-[10030]"
        onClose={() => setCheckDrawerOpen(false)}
        preview={
          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('manualLabel')}</div>
              <div className="mt-1 text-xl font-black text-slate-900">{title || t('unnamedManual')}</div>
              <div className="mt-2 text-sm leading-relaxed text-slate-600">{description || t('noDescription')}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">{t('stepCount', { count: steps.length }).split(':')[0]}</div>
                <div className="text-lg font-black text-slate-800">{steps.length}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">{t('verificationCount')}</div>
                <div className="text-lg font-black text-slate-800">{steps.filter((step) => step.verification).length}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">{t('currentStatus')}</div>
                <div className="text-lg font-black text-slate-800">{isPublished ? t('publishedVisible') : t('draft')}</div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-3 text-sm font-bold text-slate-700">{t('studentSummary')}</div>
              <div className="space-y-2">
                {steps.length === 0 && <div className="text-sm text-slate-500">{t('noStepsBeforePublish')}</div>}
                {steps.map((step, index) => (
                  <div key={`${step.id || index}-${step.title}`} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">{t('stepNumber', { number: index + 1 })}</span>
                    <span className="ml-2">{step.title || t('unnamedStep')}</span>
                    <span className="ml-2 text-xs text-slate-400">{step.verification ? t('verificationLabel', { type: step.verification.type }) : t('verificationMissing')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        }
      />
    </div>
  );
};

export default AgentManualEditor;
