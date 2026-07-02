import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Input,
  Textarea,
  Button,
  Select,
  SelectItem,
  Switch,
  Card,
  CardBody,
  Tabs,
  Tab,
} from '@heroui/react';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import type { ContentBlock, Verification, AgentStepAdmin } from '@/services/adminAgent';

interface StepEditorProps {
  step: AgentStepAdmin;
  index: number;
  onChange: (step: AgentStepAdmin) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const LANGUAGES = ['bash', 'sql', 'python', 'javascript', 'typescript', 'json', 'yaml', 'text'];
const VERIFICATION_TYPES = [
  { key: 'none', labelKey: 'verificationTypes.none' },
  { key: 'file_exists', labelKey: 'verificationTypes.fileExists' },
  { key: 'command_output', labelKey: 'verificationTypes.commandOutput' },
  { key: 'service_running', labelKey: 'verificationTypes.serviceRunning' },
  { key: 'custom', labelKey: 'verificationTypes.custom' },
];
const EXPECT_TYPES = [
  { key: 'not_empty', labelKey: 'expectTypes.notEmpty' },
  { key: 'contains', labelKey: 'expectTypes.contains' },
  { key: 'equals', labelKey: 'expectTypes.equals' },
  { key: 'regex', labelKey: 'expectTypes.regex' },
];

export const StepEditor: React.FC<StepEditorProps> = ({
  step,
  index,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) => {
  const { t } = useTranslation('stepEditor');
  const [activeTab, setActiveTab] = useState('visual');

  // 更新步骤字段
  const updateField = <K extends keyof AgentStepAdmin>(field: K, value: AgentStepAdmin[K]) => {
    onChange({ ...step, [field]: value });
  };

  // 更新内容块
  const updateContentBlock = (blockIndex: number, block: ContentBlock) => {
    const newContent = [...step.content];
    newContent[blockIndex] = block;
    updateField('content', newContent);
  };

  // 添加内容块
  const addContentBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = { type };
    if (type === 'text' || type === 'heading') newBlock.text = '';
    if (type === 'code') {
      newBlock.language = 'bash';
      newBlock.code = '';
      newBlock.executable = false;
    }
    if (type === 'list') newBlock.items = [''];
    updateField('content', [...step.content, newBlock]);
  };

  // 删除内容块
  const deleteContentBlock = (blockIndex: number) => {
    updateField('content', step.content.filter((_, i) => i !== blockIndex));
  };

  // 移动内容块
  const moveContentBlock = (blockIndex: number, direction: 'up' | 'down') => {
    const newContent = [...step.content];
    const targetIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1;
    if (targetIndex < 0 || targetIndex >= newContent.length) return;
    [newContent[blockIndex], newContent[targetIndex]] = [newContent[targetIndex], newContent[blockIndex]];
    updateField('content', newContent);
  };

  // 更新验证规则
  const updateVerification = (v: Verification | null) => {
    updateField('verification', v);
  };

  // 渲染内容块编辑器
  const renderContentBlockEditor = (block: ContentBlock, blockIndex: number) => {
    return (
      <Card key={blockIndex} className="mb-2 border-none shadow-sm">
        <CardBody className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <GripVertical size={16} className="text-default-400 cursor-move" />
            <span className="text-xs font-medium text-default-500 uppercase">{block.type}</span>
            <div className="flex-1" />
            <Button size="sm" isIconOnly variant="light" onPress={() => moveContentBlock(blockIndex, 'up')} isDisabled={blockIndex === 0}>
              <ChevronUp size={14} />
            </Button>
            <Button size="sm" isIconOnly variant="light" onPress={() => moveContentBlock(blockIndex, 'down')} isDisabled={blockIndex === step.content.length - 1}>
              <ChevronDown size={14} />
            </Button>
            <Button size="sm" isIconOnly variant="light" color="danger" onPress={() => deleteContentBlock(blockIndex)}>
              <Trash2 size={14} />
            </Button>
          </div>

          {(block.type === 'text' || block.type === 'heading') && (
            <Textarea
              size="sm"
              placeholder={block.type === 'heading' ? t('headingText') : t('textContent')}
              value={block.text || ''}
              onChange={(e) => updateContentBlock(blockIndex, { ...block, text: e.target.value })}
              minRows={block.type === 'heading' ? 1 : 2}
            />
          )}

          {block.type === 'code' && (
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <Select
                  size="sm"
                  label={t('language')}
                  selectedKeys={block.language ? [block.language] : []}
                  onChange={(e) => updateContentBlock(blockIndex, { ...block, language: e.target.value })}
                  className="w-32"
                >
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang}>{lang}</SelectItem>
                  ))}
                </Select>
                <Switch
                  size="sm"
                  isSelected={block.executable || false}
                  onValueChange={(v) => updateContentBlock(blockIndex, { ...block, executable: v })}
                >
                  {t('executable')}
                </Switch>
              </div>
              <Textarea
                size="sm"
                placeholder={t('codeContent')}
                value={block.code || ''}
                onChange={(e) => updateContentBlock(blockIndex, { ...block, code: e.target.value })}
                minRows={3}
                classNames={{ input: 'font-mono text-sm' }}
              />
            </div>
          )}

          {block.type === 'list' && (
            <div className="space-y-1">
              {(block.items || []).map((item, itemIndex) => (
                <div key={itemIndex} className="flex gap-2">
                  <Input
                    size="sm"
                    value={item}
                    onChange={(e) => {
                      const newItems = [...(block.items || [])];
                      newItems[itemIndex] = e.target.value;
                      updateContentBlock(blockIndex, { ...block, items: newItems });
                    }}
                  />
                  <Button
                    size="sm"
                    isIconOnly
                    variant="light"
                    color="danger"
                    onPress={() => {
                      const newItems = (block.items || []).filter((_, i) => i !== itemIndex);
                      updateContentBlock(blockIndex, { ...block, items: newItems });
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="flat"
                onPress={() => updateContentBlock(blockIndex, { ...block, items: [...(block.items || []), ''] })}
              >
                <Plus size={14} /> {t('addItem')}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // 渲染验证规则编辑器
  const renderVerificationEditor = () => {
    const vType = step.verification?.type || 'none';

    return (
      <div className="space-y-3">
        <Select
          size="sm"
          label={t('verificationType')}
          selectedKeys={[vType]}
          onChange={(e) => {
            const newType = e.target.value;
            if (newType === 'none') {
              updateVerification(null);
            } else {
              updateVerification({ type: newType as Verification['type'] });
            }
          }}
        >
          {VERIFICATION_TYPES.map(item => (
            <SelectItem key={item.key}>{t(item.labelKey)}</SelectItem>
          ))}
        </Select>

        {vType === 'file_exists' && (
          <Input
            size="sm"
            label={t('filePath')}
            placeholder="/path/to/file"
            value={step.verification?.path || ''}
            onChange={(e) => updateVerification({ ...step.verification!, path: e.target.value })}
          />
        )}

        {vType === 'command_output' && (
          <>
            <Input
              size="sm"
              label={t('command')}
              placeholder="ls -la"
              value={step.verification?.command || ''}
              onChange={(e) => updateVerification({ ...step.verification!, command: e.target.value })}
            />
            <Select
              size="sm"
              label={t('expectation')}
              selectedKeys={step.verification?.expect ? [step.verification.expect] : ['not_empty']}
              onChange={(e) => updateVerification({ ...step.verification!, expect: e.target.value as any })}
            >
              {EXPECT_TYPES.map(item => (
                <SelectItem key={item.key}>{t(item.labelKey)}</SelectItem>
              ))}
            </Select>
            {step.verification?.expect && step.verification.expect !== 'not_empty' && (
              <Input
                size="sm"
                label={t('expectedValue')}
                value={step.verification?.value || ''}
                onChange={(e) => updateVerification({ ...step.verification!, value: e.target.value })}
              />
            )}
          </>
        )}

        {vType === 'service_running' && (
          <Input
            size="sm"
            type="number"
            label={t('port')}
            placeholder="3306"
            value={step.verification?.port?.toString() || ''}
            onChange={(e) => updateVerification({ ...step.verification!, port: parseInt(e.target.value) || 0 })}
          />
        )}

        {vType === 'custom' && (
          <Textarea
            size="sm"
            label={t('customScript')}
            placeholder={t('customScriptPlaceholder')}
            value={step.verification?.script || ''}
            onChange={(e) => updateVerification({ ...step.verification!, script: e.target.value })}
            minRows={3}
            classNames={{ input: 'font-mono text-sm' }}
          />
        )}
      </div>
    );
  };

  return (
    <Card className="mb-4 border-none shadow-sm">
      <CardBody>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg font-bold text-primary">{t('step', { number: index + 1 })}</span>
          <div className="flex-1" />
          {!isFirst && (
            <Button size="sm" isIconOnly variant="light" onPress={onMoveUp}>
              <ChevronUp size={16} />
            </Button>
          )}
          {!isLast && (
            <Button size="sm" isIconOnly variant="light" onPress={onMoveDown}>
              <ChevronDown size={16} />
            </Button>
          )}
          <Button size="sm" isIconOnly variant="light" color="danger" onPress={onDelete}>
            <Trash2 size={16} />
          </Button>
        </div>

        <Input
          size="sm"
          label={t('stepTitle')}
          value={step.title}
          onChange={(e) => updateField('title', e.target.value)}
          className="mb-4"
        />

        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          size="sm"
          className="mb-4"
        >
          <Tab key="visual" title={t('visualEdit')} />
          <Tab key="json" title={t('jsonEdit')} />
        </Tabs>

        {activeTab === 'visual' ? (
          <>
            <div className="mb-4">
              <div className="text-sm font-medium mb-2">{t('contentBlocks')}</div>
              {step.content.map((block, blockIndex) => renderContentBlockEditor(block, blockIndex))}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="flat" onPress={() => addContentBlock('text')}>
                  <Plus size={14} /> {t('text')}
                </Button>
                <Button size="sm" variant="flat" onPress={() => addContentBlock('heading')}>
                  <Plus size={14} /> {t('heading')}
                </Button>
                <Button size="sm" variant="flat" onPress={() => addContentBlock('code')}>
                  <Plus size={14} /> {t('code')}
                </Button>
                <Button size="sm" variant="flat" onPress={() => addContentBlock('list')}>
                  <Plus size={14} /> {t('list')}
                </Button>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm font-medium mb-2">{t('quickQuestions')}</div>
              {step.quickQuestions.map((q, qIndex) => (
                <div key={qIndex} className="flex gap-2 mb-1">
                  <Input
                    size="sm"
                    value={q}
                    onChange={(e) => {
                      const newQuestions = [...step.quickQuestions];
                      newQuestions[qIndex] = e.target.value;
                      updateField('quickQuestions', newQuestions);
                    }}
                  />
                  <Button
                    size="sm"
                    isIconOnly
                    variant="light"
                    color="danger"
                    onPress={() => updateField('quickQuestions', step.quickQuestions.filter((_, i) => i !== qIndex))}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="flat" onPress={() => updateField('quickQuestions', [...step.quickQuestions, ''])}>
                <Plus size={14} /> {t('addQuestion')}
              </Button>
            </div>

            <div className="mb-4">
              <div className="text-sm font-medium mb-2">{t('skillTags', { ns: 'uiReview' })}</div>
              <Input
                size="sm"
                value={(step.skillTags || []).join(', ')}
                onChange={(e) => updateField('skillTags', e.target.value.split(',').map(item => item.trim()).filter(Boolean))}
                placeholder="Kubernetes, kubectl, namespace"
                description={t('skillTagsHelp')}
              />
            </div>

            <div>
              <div className="text-sm font-medium mb-2">{t('verificationRules')}</div>
              {renderVerificationEditor()}
            </div>
          </>
        ) : (
          <Textarea
            label={t('jsonData')}
            value={JSON.stringify({ content: step.content, quickQuestions: step.quickQuestions, verification: step.verification, skillTags: step.skillTags || [] }, null, 2)}
            onChange={(e) => {
              try {
                const data = JSON.parse(e.target.value);
                if (data.content) updateField('content', data.content);
                if (data.quickQuestions) updateField('quickQuestions', data.quickQuestions);
                if (data.verification !== undefined) updateField('verification', data.verification);
                if (data.skillTags) updateField('skillTags', data.skillTags);
              } catch {
                // 忽略 JSON 解析错误
              }
            }}
            minRows={10}
            classNames={{ input: 'font-mono text-sm' }}
          />
        )}
      </CardBody>
    </Card>
  );
};

export default StepEditor;
