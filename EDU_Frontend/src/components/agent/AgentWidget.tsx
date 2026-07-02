import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Menu, Send, CheckCircle2, XCircle,
  Loader2, HelpCircle, ChevronDown, Lightbulb, BookOpen, Wrench
} from 'lucide-react';
import EnergyRobotGif from '@/images/Energy Robot.gif';
import { Button } from '@heroui/react';
import { StepProgress } from './StepProgress';
import { StructuredContent } from './StructuredContent';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Step, ContentBlock } from './types';
import * as AgentAPI from '@/services/agent';
import { studentClassApi } from '@/services/studentClass';
import confetti from 'canvas-confetti';
import CompleteLessonDialog from '../study/CompleteLessonDialog';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

// Debounce hook
function useDebounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      fn(...args);
    }, delay);
  }, [fn, delay]);
}

// 示例步骤数据（无 API 数据时使用）
const createDemoSteps = (t: TFunction<'agent'>): Step[] => [
  {
    id: 0,
    title: t('demo.step1Title'),
    content: [
      { type: 'text', text: t('demo.greeting') },
      { type: 'text', text: t('demo.errorIntro') },
      { type: 'heading', text: t('demo.createFile') },
      { type: 'code', language: 'bash', code: 'touch hello.sh', executable: true },
      { type: 'heading', text: t('demo.addContent') },
      { type: 'code', language: 'bash', code: '#!/bin/bash\necho "Hello, Bash!"' }
    ],
    quickQuestions: [t('demo.more'), t('demo.shellScript'), t('demo.dotSlash')],
  },
  {
    id: 1,
    title: t('demo.step2Title'),
    content: [
      { type: 'heading', text: t('demo.grantPermission') },
      { type: 'text', text: t('demo.permissionDesc') },
      { type: 'code', language: 'bash', code: 'chmod +x hello.sh', executable: true },
      { type: 'code', language: 'bash', code: './hello.sh', executable: true },
    ],
    quickQuestions: [t('demo.chmod'), t('demo.permission755')],
  }
];

interface AgentWidgetProps {
  // 数据来源（二选一）
  sourceType?: number;  // 1=课程课时, 2=项目单元
  sourceId?: number;
  // 容器 ID（用于验证）
  containerId?: string;
  // 班级上下文（用于 FAQ / 教师干预）
  classId?: number;
  // 静态步骤数据（优先级低于 API）
  steps?: Step[];
  // 模式：'teaching' = 教学模式（有手册）, 'chat' = 纯聊天模式
  mode?: 'teaching' | 'chat';
  // 是否重置进度（新开环境时使用）
  resetProgress?: boolean;
  // 回调
  onComplete?: () => void;
  onExecuteCommand?: (command: string, context?: { manualId?: number; stepOrder?: number }) => Promise<{ output: string; exitCode: number; error?: string }>;
}

type ChatEntry = {
  role: 'user' | 'agent';
  content: string | ContentBlock[];
  hintLevel?: 1 | 2 | 3;
};

const chatStorageKey = (manualId: number, locale: string) => `agent:coach:chat:${manualId}:${locale}`;

const toAPIChatHistory = (chat: ChatEntry[]): AgentAPI.ChatMessage[] => chat
  .filter(msg => typeof msg.content === 'string' && msg.content.trim())
  .slice(-20)
  .map(msg => ({
    role: msg.role === 'agent' ? 'assistant' as const : 'user' as const,
    content: msg.content as string,
  }));

const restoreSessionChat = (manualId: number, locale: string): ChatEntry[] => {
  try {
    const raw = sessionStorage.getItem(chatStorageKey(manualId, locale));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item.role === 'user' || item.role === 'agent').slice(-20);
  } catch {
    return [];
  }
};

const persistSessionChat = (manualId: number | null, locale: string, chat: ChatEntry[]) => {
  if (!manualId) return;
  try {
    sessionStorage.setItem(chatStorageKey(manualId, locale), JSON.stringify(chat.slice(-20)));
  } catch {
    // sessionStorage 不可用时忽略，服务端仍保持无状态
  }
};

const agentBubbleClass = (hintLevel?: 1 | 2 | 3) => {
  if (hintLevel === 2) return 'bg-white text-slate-700 rounded-tl-none border border-primary/25';
  if (hintLevel === 3) return 'bg-white text-slate-700 rounded-tl-none border border-warning-300';
  return 'bg-white text-slate-700 rounded-tl-none';
};

const HintBadge: React.FC<{ level?: 1 | 2 | 3 }> = ({ level }) => {
  const { t } = useTranslation('agent');
  if (level === 2) {
    return <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-1 text-[11px] font-bold text-primary-700"><Lightbulb size={12} />{t('directionHint')}</div>;
  }
  if (level === 3) {
    return <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-1 text-[11px] font-bold text-warning-700"><BookOpen size={12} />{t('fullHint')}</div>;
  }
  return null;
};

export const AgentWidget: React.FC<AgentWidgetProps> = ({
  sourceType,
  sourceId,
  containerId,
  classId,
  steps: propSteps,
  mode: propMode,
  resetProgress = false,
  onComplete,
  onExecuteCommand,
}) => {
  const { t, i18n } = useTranslation('agent');
  const currentLocale = i18n.resolvedLanguage || i18n.language;
  // 自动判断模式：有 sourceType 和 sourceId 时为教学模式，否则为聊天模式
  const mode = propMode || (sourceType && sourceId ? 'teaching' : 'chat');
  const isChatMode = mode === 'chat';
  
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualId, setManualId] = useState<number | null>(null);
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualDescription, setManualDescription] = useState<string>('');
  const [hasManual, setHasManual] = useState<boolean | null>(null);  // null=未加载, true=有手册, false=无手册
  const [steps, setSteps] = useState<Step[]>(() => propSteps || createDemoSteps(t));
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [showToC, setShowToC] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  // 验证结果状态 - 用于以对话形式显示检查结果
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
    checkItems?: Array<{ name: string; status: 'passed' | 'failed'; message?: string }>;
  } | null>(null);
  const [isExiting, setIsExiting] = useState(false);  // 控制离场动画
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingHintLevel, setStreamingHintLevel] = useState<1 | 2 | 3>(1);
  const [widgetWidth, setWidgetWidth] = useState(620);
  const [isResizing, setIsResizing] = useState(false);
  const [showResizeHandle, setShowResizeHandle] = useState(false);
  const [canEscalateHint, setCanEscalateHint] = useState(false);
  const [activeClassId, setActiveClassId] = useState<number | null>(null);
  const [faqItems, setFaqItems] = useState<AgentAPI.AgentFAQItem[]>([]);
  const [pendingInterventions, setPendingInterventions] = useState<AgentAPI.AgentInterventionRecord[]>([]);
  const [faqOpen, setFaqOpen] = useState(false);
  const [showInputBox, setShowInputBox] = useState(false);  // 控制输入框显示
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);  // 控制返回底部按钮显示
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);  // 控制恭喜完成对话框显示
  const widgetStartRef = useRef(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);  // 输入框引用
  const dragRef = useRef({ startX: 0, startWidth: 620, isActive: false });
  const streamingHintLevelRef = useRef<1 | 2 | 3>(1);

  // 从 API 加载手册数据
  useEffect(() => {
    if (sourceType && sourceId) {
      loadManual();
    }
  }, [sourceType, sourceId, currentLocale]);

  const loadManual = async () => {
    if (!sourceType || !sourceId) return;
    
    setLoading(true);
    try {
      // 加载手册
      const manual = await AgentAPI.getManual(sourceType, sourceId);
      console.log('[AgentWidget] Loaded manual:', manual);
      
      if (manual && manual.steps?.length > 0) {
        setManualId(manual.id);
        setManualTitle(manual.title || '');
        setManualDescription(manual.description || '');
        setHasManual(true);
        // 使用 stepOrder 作为步骤索引（从0开始）
        setSteps(manual.steps.map((s, index) => ({
          id: index,  // 使用索引作为 id，与 currentStep 对应
          title: s.title,
          content: s.content as ContentBlock[],
          quickQuestions: s.quickQuestions || [],
          verification: s.verification || undefined,
        })));
        const cachedChat = restoreSessionChat(manual.id, currentLocale);
        if (cachedChat.length > 0) {
          setChatLog(cachedChat);
        }
        void loadV2Context(manual.id, currentStep);
      } else {
        setHasManual(false);
        console.log('[AgentWidget] No manual found for sourceType:', sourceType, 'sourceId:', sourceId);
      }

      // 如果需要重置进度（新开环境），则重置所有状态并清除服务器端进度
      if (resetProgress) {
        console.log('[AgentWidget] Resetting progress for new environment');
        setCurrentStep(0);
        setCompletedSteps([]);
        setChatLog([]);
        // 清除服务器端进度
        try {
          await AgentAPI.updateProgress(sourceType, sourceId, {
            currentStep: 0,
            completedSteps: [],
            chatHistory: [],
          });
        } catch (err) {
          console.error('[AgentWidget] Failed to reset server progress:', err);
        }
        return;
      }

      // 加载进度
      const progress = await AgentAPI.getProgress(sourceType, sourceId);
      if (progress) {
        setCurrentStep(progress.currentStep);
        setCompletedSteps(progress.completedSteps);
        const cachedChat = manual?.id ? restoreSessionChat(manual.id, currentLocale) : [];
        // v1 coach 对话优先从 sessionStorage 恢复；没有本地历史时兼容旧服务端进度。
        if (cachedChat.length > 0) {
          setChatLog(cachedChat);
        } else if (progress.chatHistory && progress.chatHistory.length > 0) {
          const restoredChat = progress.chatHistory.map(msg => ({
            role: msg.role === 'assistant' ? 'agent' as const : 'user' as const,
            content: msg.content,
          }));
          setChatLog(restoredChat);
        }
        if (manual?.id) {
          void loadV2Context(manual.id, progress.currentStep);
        }
      }
    } catch (err) {
      console.error('[AgentWidget] Load manual error:', err);
      setHasManual(false);
    } finally {
      setLoading(false);
    }
  };

  const loadV2Context = async (nextManualId: number, stepOrder: number) => {
    if (isChatMode) return;
    try {
      const [history, interventions, classesResponse] = await Promise.all([
        AgentAPI.getCoachHistory(nextManualId, stepOrder),
        AgentAPI.getPendingInterventions(nextManualId),
        classId ? Promise.resolve({ data: [] }) : studentClassApi.getMyClasses(),
      ]);
      if (history.length > 0) {
        setChatLog(history.map(msg => ({
          role: msg.role === 'assistant' ? 'agent' as const : 'user' as const,
          content: msg.content,
        })));
      }
      setPendingInterventions(interventions);
      const fallbackClass = [...(classesResponse.data || [])].sort((a, b) => a.id - b.id)[0];
      const nextClassId = classId || fallbackClass?.id || 0;
      if (nextClassId) {
        setActiveClassId(nextClassId);
        const faq = await AgentAPI.getFAQ(nextManualId, stepOrder, nextClassId);
        setFaqItems(faq);
      } else {
        setActiveClassId(null);
        setFaqItems([]);
      }
    } catch (error) {
      console.warn('[AgentWidget] load V2 context failed:', error);
    }
  };

  // 保存进度（带 debounce）
  const saveProgressImpl = async (step: number, completed: number[], chat: ChatEntry[]) => {
    if (!sourceType || !sourceId) return;
    try {
      // 转换聊天记录格式
      const chatHistory = chat.map(msg => ({
        role: msg.role === 'agent' ? 'assistant' as const : 'user' as const,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      }));
      await AgentAPI.updateProgress(sourceType, sourceId, {
        currentStep: step,
        completedSteps: completed,
        chatHistory,
      });
    } catch (err) {
      console.error('[AgentWidget] Save progress error:', err);
    }
  };

  const debouncedSaveProgress = useDebounce(saveProgressImpl, 1000);

  // 保存进度（立即保存，用于步骤切换）
  const saveProgressNow = (step: number, completed: number[], chat: ChatEntry[] = []) => {
    saveProgressImpl(step, completed, chat);
  };

  // 拖拽调整宽度
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startWidth: widgetWidth, isActive: true };
    setIsResizing(true);
    setShowResizeHandle(true);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.isActive || !widgetRef.current) return;
      const delta = dragRef.current.startX - e.clientX;
      // 最大宽度改为视口宽度减去边距，最小宽度320px
      const maxWidth = window.innerWidth - 48; // 留出左右各24px的边距
      const newWidth = Math.min(maxWidth, Math.max(320, dragRef.current.startWidth + delta));
      widgetRef.current.style.width = `${newWidth}px`;
    };

    const handleMouseUp = () => {
      if (!widgetRef.current) return;
      const finalWidth = parseInt(widgetRef.current.style.width) || 420;
      dragRef.current.isActive = false;
      setWidgetWidth(finalWidth);
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const step = steps[currentStep] || steps[0];

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setShowScrollToBottom(false);
    }
  }, [currentStep, chatLog, isValidating, streamingContent, verificationResult]);

  useEffect(() => {
    persistSessionChat(manualId, currentLocale, chatLog);
  }, [manualId, currentLocale, chatLog]);

  useEffect(() => {
    if (isOpen && manualId) {
      void AgentAPI.recordEvent({ manualId, stepOrder: currentStep, eventType: 'widget_open' });
      void loadV2Context(manualId, currentStep);
    }
  }, [isOpen, manualId, classId]);

  useEffect(() => {
    if (!manualId || !isOpen) return;
    void loadV2Context(manualId, currentStep);
  }, [currentStep, manualId, isOpen, classId]);

  // 监听滚动事件，判断是否显示返回底部按钮
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      // 如果距离底部超过 100px，显示返回底部按钮
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollToBottom(!isNearBottom);
    };

    // 初始检查一次
    handleScroll();

    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [isOpen, loading, hasManual]); // 当窗口打开、加载完成、手册状态变化时重新绑定

  // 滚动到底部
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // 触发礼炮/彩带庆祝动画
  const triggerConfetti = () => {
    // 从右下角（widget 位置）发射礼炮
    const end = Date.now() + 800; // 持续 800ms
    
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];
    
    (function frame() {
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 0.9, y: 0.7 },
        colors: colors,
        zIndex: 9999,
      });
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0.85, y: 0.75 },
        colors: colors,
        zIndex: 9999,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  // 处理继续/下一步
  const handleContinue = async () => {
    setIsValidating(true);
    setVerifyError(null);
    setVerificationResult(null);

    try {
      // 如果有 manualId 和 containerId，调用验证 API
      if (manualId && containerId) {
        const result = await AgentAPI.verifyStep(manualId, currentStep, containerId);
        
        // 构建验证结果对象 - 用于以对话形式显示
        const verifyResult = {
          success: result.success,
          message: result.message,
          details: result.details,
          checkItems: result.checkItems || [
            {
              name: step.title || t('step', { count: currentStep + 1 }),
              status: result.success ? 'passed' as const : 'failed' as const,
              message: result.message,
            }
          ],
        };
        
        setVerificationResult(verifyResult);
        
        if (!result.success) {
          setCanEscalateHint(true);
          setVerifyError(result.message + (result.details ? `\n${result.details}` : ''));
          setIsValidating(false);
          return;
        }
        
        // 验证成功，触发礼炮动画！
        triggerConfetti();
        
        // 判断是否是最后一步
        const isLastStep = currentStep === steps.length - 1;
        
        if (isLastStep) {
          // 最后一步：显示庆祝动画，然后触发离场动画，最后显示恭喜对话框
          setIsValidating(false);
          setTimeout(() => {
            setIsExiting(true);
            // 离场动画结束后显示恭喜对话框
            setTimeout(() => {
              setVerificationResult(null);
              setIsExiting(false);
              // 标记所有步骤完成
              const newCompleted = [...completedSteps];
              if (!newCompleted.includes(currentStep)) {
                newCompleted.push(currentStep);
                newCompleted.sort((a, b) => a - b);
                setCompletedSteps(newCompleted);
              }
              saveProgressNow(currentStep, newCompleted, chatLog);
              // 显示恭喜完成对话框
              setShowCompleteDialog(true);
            }, 800); // 离场动画持续 800ms
          }, 1500); // 先展示 1.5 秒的成功状态
        } else {
          // 非最后一步：正常进入下一步
          setTimeout(() => {
            proceedToNextStep();
          }, 1000);
        }
      } else {
        // 无需验证时
        const isLastStep = currentStep === steps.length - 1;
        
        if (isLastStep) {
          // 最后一步：显示恭喜弹窗
          const successResult = {
            success: true,
            message: t('verifiedAll'),
            checkItems: [
              {
                name: step.title || t('step', { count: currentStep + 1 }),
                status: 'passed' as const,
                message: t('completed'),
              }
            ],
          };
          setVerificationResult(successResult);
          setIsValidating(false);
          
          // 触发礼炮动画！
          triggerConfetti();
          
          // 先显示庆祝，然后触发离场动画，最后显示恭喜对话框
          setTimeout(() => {
            setIsExiting(true);
            // 离场动画结束后显示恭喜对话框
            setTimeout(() => {
              setVerificationResult(null);
              setIsExiting(false);
              // 标记所有步骤完成
              const newCompleted = [...completedSteps];
              if (!newCompleted.includes(currentStep)) {
                newCompleted.push(currentStep);
                newCompleted.sort((a, b) => a - b);
                setCompletedSteps(newCompleted);
              }
              saveProgressNow(currentStep, newCompleted, chatLog);
              // 显示恭喜完成对话框
              setShowCompleteDialog(true);
            }, 800); // 离场动画持续 800ms
          }, 1500); // 先展示 1.5 秒的成功状态
        } else {
          // 非最后一步：直接进入下一步
          setIsValidating(false);
          proceedToNextStep();
        }
      }
    } catch (err: any) {
      const errorResult = {
        success: false,
        message: t('verifyFailed'),
        details: err.message || t('unknownError'),
        checkItems: [
          {
            name: step.title || t('step', { count: currentStep + 1 }),
            status: 'failed' as const,
            message: err.message || t('verifyError'),
          }
        ],
      };
      setVerificationResult(errorResult);
      setCanEscalateHint(true);
      setVerifyError(err.message || t('verifyFailed'));
    } finally {
      setIsValidating(false);
    }
  };

  // 进入下一步的逻辑（从 handleContinue 中提取）
  const proceedToNextStep = () => {
    const newCompleted = [...completedSteps];
    if (!newCompleted.includes(currentStep)) {
      newCompleted.push(currentStep);
      newCompleted.sort((a, b) => a - b);
      setCompletedSteps(newCompleted);
    }

    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);

      // 清除验证结果
      setVerificationResult(null);
      setVerifyError(null);

      saveProgressNow(nextStep, newCompleted, chatLog);
    }
  };

  // 处理重新检查
  const handleRetry = () => {
    setVerificationResult(null);
    setVerifyError(null);
    handleContinue();
  };

  const handleTroubleshoot = () => {
    if (!verificationResult) return;
    const output = verificationResult.details || verificationResult.message || t('noDetails');
    if (manualId) {
      void AgentAPI.recordEvent({
        manualId,
        stepOrder: currentStep,
        eventType: 'troubleshoot_click',
        meta: { hasDetails: Boolean(verificationResult.details) },
      });
    }
    setShowInputBox(true);
    void handleQuestion(t('troubleshootQuestion', { output }), { troubleshootMode: true });
  };

  const handleEscalateHint = () => {
    if (!canEscalateHint) return;
    setShowInputBox(true);
    void handleQuestion(t('escalateQuestion'), { escalate: true });
  };

  // 处理 AI 问答（流式）
  const handleQuestion = async (question: string, options: { escalate?: boolean; troubleshootMode?: boolean } = {}) => {
    if (!question.trim()) return;
    
    // 用户开始提问时，隐藏验证结果气泡
    setVerificationResult(null);
    setVerifyError(null);
    
    const userMessage: ChatEntry = { role: 'user', content: question };
    const nextChat = [...chatLog, userMessage];
    setChatLog(nextChat);
    setInputValue('');
    setIsAsking(true);
    setStreamingContent('');
    setStreamingHintLevel(1);
    streamingHintLevelRef.current = 1;

    if (manualId && options.escalate) {
      void AgentAPI.recordEvent({
        manualId,
        stepOrder: currentStep,
        eventType: 'hint_requested',
        meta: { troubleshootMode: Boolean(options.troubleshootMode) },
      });
    }

    // 构建上下文：聊天模式继续使用通用流式接口；教学模式使用 coach 接口。
    const stepContext = isChatMode
      ? t('chatContext')
      : t('stepContext', { title: step.title, summary: step.content.map(b => b.text || b.code || '').join(' ').slice(0, 500) });

    const onDone = () => {
      setStreamingContent(currentContent => {
        if (currentContent) {
          setTimeout(() => {
            setChatLog(logs => {
              const newLogs = [...logs, { role: 'agent' as const, content: currentContent, hintLevel: streamingHintLevelRef.current }];
              if (!isChatMode) {
                debouncedSaveProgress(currentStep, completedSteps, newLogs);
              }
              return newLogs;
            });
            setIsAsking(false);
          }, 0);
        } else {
          setIsAsking(false);
        }
        return '';
      });
    };

    if (!isChatMode && manualId) {
      await AgentAPI.coachStream(
        {
          manualId,
          stepOrder: currentStep,
          question,
          chatHistory: toAPIChatHistory(chatLog),
          escalate: options.escalate,
          troubleshootMode: options.troubleshootMode,
        },
        (meta) => {
          setStreamingHintLevel(meta.hintLevel);
          streamingHintLevelRef.current = meta.hintLevel;
        },
        (content) => {
          setStreamingContent(prev => prev + content);
        },
        onDone,
        (error) => {
          setChatLog(prev => [...prev, { role: 'agent', content: t('apology', { error }) }]);
          setStreamingContent('');
          setIsAsking(false);
        }
      );
      return;
    }

    // 使用流式 API
    await AgentAPI.chatStream(
      question,
      stepContext,
      undefined,
      (content) => {
        setStreamingContent(prev => prev + content);
      },
      onDone,
      (error) => {
        setChatLog(prev => [...prev, { role: 'agent', content: t('apology', { error }) }]);
        setStreamingContent('');
        setIsAsking(false);
      }
    );
  };

  // 处理代码执行
  const handleCodeRun = async (code: string) => {
    if (onExecuteCommand) {
      return await onExecuteCommand(code, { manualId: manualId || undefined, stepOrder: currentStep });
    }
    return { output: `$ ${code}\n${t('runSuccess')}`, exitCode: 0 };
  };

  // 处理代码解释
  const handleCodeExplain = (code: string, language: string) => {
    handleQuestion(t('explainCode', { language, code }));
  };

  // 处理输入提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleQuestion(inputValue);
    }
  };

  return (
    <>
      {/* 触发按钮 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 w-20 h-20 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-300 z-50 group"
        >
          <img src={EnergyRobotGif} alt="Agent" className="w-20 h-20 object-contain group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* 主窗口 */}
      {isOpen && (
        <div 
          ref={widgetRef}
          className="fixed bottom-6 right-6 max-w-[95vw] h-[calc(100vh-100px)] max-h-[780px] flex z-50 animate-enter origin-bottom-right font-sans"
          style={{ width: widgetWidth }}
          onMouseEnter={() => setShowResizeHandle(true)}
          onMouseLeave={() => !isResizing && setShowResizeHandle(false)}
        >
          {/* 左侧拖拽区域 */}
          <div 
            className="w-6 h-full flex items-center justify-center cursor-ew-resize shrink-0"
            onMouseDown={handleResizeStart}
          >
            <div className={`w-1 h-24 rounded-full transition-opacity duration-200 ${
              showResizeHandle || isResizing ? 'opacity-100' : 'opacity-0'
            } ${isResizing ? 'bg-primary' : 'bg-default-300'}`} />
          </div>
          
          {/* 目录菜单 */}
          {showToC && (
            <div className="absolute top-16 left-2 z-20 w-64 bg-white border border-default-200 rounded-lg shadow-xl animate-enter origin-top-left flex flex-col overflow-hidden ring-1 ring-black/5">
              <div className="text-sm font-bold text-default-900 px-4 py-3 border-b border-default-100 bg-default-50/50">
                {t('outline')}
              </div>
              <div className="flex flex-col py-1 max-h-[400px] overflow-y-auto">
                {steps.map((s) => (
                  <button 
                    key={s.id}
                    onClick={() => {
                      setCurrentStep(s.id);
                      setShowToC(false);
                      setVerifyError(null);
                    }}
                    className={`text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                      s.id === currentStep 
                        ? 'bg-primary-50 text-primary font-semibold' 
                        : 'hover:bg-default-50 text-default-600'
                    }`}
                  >
                    {completedSteps.includes(s.id) ? (
                      <CheckCircle2 size={16} className="text-success shrink-0" />
                    ) : (
                      <span className={`text-xs font-mono w-4 shrink-0 text-center ${
                        s.id === currentStep ? 'text-primary' : 'text-default-400'
                      }`}>
                        {s.id + 1}
                      </span>
                    )}
                    <span className="truncate leading-tight">{s.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 主卡片 */}
          <div className="flex-1 bg-[#e8f4fc] shadow-2xl rounded-2xl overflow-hidden flex flex-col relative">
            {/* 头部 */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#e8f4fc] h-12 shrink-0">
              {!isChatMode && (
                <Button isIconOnly variant="light" size="sm" onClick={() => setShowToC(!showToC)} className="text-default-500 hover:text-default-900">
                  <Menu size={20} />
                </Button>
              )}
              <div className="flex-1 px-1">
                {isChatMode ? (
                  /* 聊天模式 - 不显示头像和名称，只显示空白 */
                  <div />
                ) : (
                  <StepProgress totalSteps={steps.length} currentStep={currentStep} />
                )}
              </div>
              <Button isIconOnly variant="light" size="sm" onClick={() => setIsOpen(false)} className="rounded-full hover:bg-white/50 text-default-400 hover:text-default-600">
                <X size={20} />
              </Button>
            </div>

            {/* 聊天模式 - 简化 UI */}
            {isChatMode ? (
              <>
                {/* 聊天内容区 */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4" ref={scrollRef}>
                  {/* 欢迎消息 */}
                  {chatLog.length === 0 && (
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                        <img src={EnergyRobotGif} alt="Agent" className="w-8 h-8 object-contain" />
                      </div>
                      <div className="flex-1 max-w-[90%]">
                        <div className="bg-white rounded-2xl rounded-tl-none p-4 shadow-sm">
                          <p className="text-[15px] leading-relaxed text-slate-600">
                            {t('hello')}<br/>
                            {t('welcome')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 聊天记录 */}
                  {chatLog.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${
                        msg.role === 'user' ? 'rounded-full bg-default-400 text-white shadow-md ring-2 ring-white' : ''
                      }`}>
                        {msg.role === 'agent' ? <img src={EnergyRobotGif} alt="Agent" className="w-8 h-8 object-contain" /> : <span className="text-xs font-bold">{t('you')}</span>}
                      </div>
                      <div className={`rounded-2xl p-4 shadow-sm max-w-[85%] ${
                        msg.role === 'agent' ? agentBubbleClass(msg.hintLevel) : 'bg-primary text-white rounded-tr-none'
                      }`}>
                        {msg.role === 'agent' && <HintBadge level={msg.hintLevel} />}
                        {typeof msg.content === 'string' ? (
                          msg.role === 'agent' ? (
                            <MarkdownRenderer content={msg.content} />
                          ) : (
                            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          )
                        ) : (
                          <StructuredContent blocks={msg.content} />
                        )}
                      </div>
                    </div>
                  ))}

                  {/* 流式输出中 */}
                  {(isAsking || streamingContent) && (
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                        <img src={EnergyRobotGif} alt="Agent" className="w-8 h-8 object-contain" />
                      </div>
                      <div className={`rounded-2xl p-4 shadow-sm max-w-[85%] ${agentBubbleClass(streamingHintLevel)}`}>
                        <HintBadge level={streamingHintLevel} />
                        {streamingContent ? (
                          <MarkdownRenderer content={streamingContent} />
                        ) : (
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 聊天模式底部输入框 - 始终显示 */}
                <div className="p-3">
                  <form onSubmit={handleSubmit} className="relative">
                    <div className="relative bg-white rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all overflow-hidden">
                      <textarea 
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            handleSubmit(e);
                          }
                        }}
                        placeholder={t('inputPlaceholder')}
                        rows={2}
                        className="w-full px-4 py-3 pr-14 text-[15px] outline-none placeholder:text-default-400 text-default-900 resize-none bg-transparent"
                        disabled={isAsking}
                      />
                      <div className="absolute right-3 bottom-3">
                        <button 
                          type="submit"
                          disabled={isAsking || !inputValue.trim()}
                          className="p-2 text-white bg-primary hover:bg-primary-600 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              /* 教学模式 - 原有 UI */
              <>
                {/* 加载状态 */}
                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : hasManual === false ? (
                  /* 无手册提示 */
                  <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                    <div className="w-16 h-16 flex items-center justify-center mb-4">
                      <img src={EnergyRobotGif} alt="Agent" className="w-16 h-16 object-contain" />
                    </div>
                    <h3 className="text-lg font-semibold text-default-700 mb-2">{t('noManual')}</h3>
                    <p className="text-sm text-default-500 mb-4">
                      {t('noManualDesc')}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 滚动内容区 */}
                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4" ref={scrollRef}>
                      {/* 欢迎消息 - 手册描述（类似 LabEx Labby 风格） */}
                      {manualDescription && currentStep === 0 && chatLog.length === 0 && (
                        <>
                          <div className="flex gap-3 items-start">
                            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                              <img src={EnergyRobotGif} alt="Agent" className="w-8 h-8 object-contain" />
                            </div>
                            <div className="flex-1 max-w-[90%]">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold text-primary">ZG EDU AGENT</span>
                              </div>
                              {/* 介绍卡片 */}
                              <div className="bg-white rounded-2xl rounded-tl-none shadow-sm overflow-hidden">
                                <div className="p-4">
                                  <h3 className="text-lg font-bold text-default-900 mb-3">{t('introduction')}</h3>
                                  <div className="text-[15px] leading-relaxed text-slate-600">
                                    <MarkdownRenderer content={manualDescription} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* 准备提示消息 */}
                          <div className="flex gap-3 items-start">
                            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                              <img src={EnergyRobotGif} alt="Agent" className="w-8 h-8 object-contain" />
                            </div>
                        <div className="flex-1 max-w-[90%]">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-primary">ZG EDU AGENT</span>
                          </div>
                          <div className="bg-white rounded-2xl rounded-tl-none p-4 shadow-sm">
                            <p className="text-[15px] leading-relaxed text-slate-600">
                              {t('environmentReady')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 教师干预提醒 */}
                  {pendingInterventions.length > 0 && (
                    <div className="space-y-2">
                      {pendingInterventions.map(item => (
                        <div key={item.id} className="rounded-xl bg-warning-50 px-3 py-2 text-sm text-warning-800 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{item.title}</div>
                              <div className="mt-1 whitespace-pre-wrap text-warning-700">{item.content}</div>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                await AgentAPI.markInterventionRead(item.id);
                                setPendingInterventions(prev => prev.filter(record => record.id !== item.id));
                              }}
                              className="shrink-0 rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-warning-700 hover:bg-white"
                            >
                              {t('acknowledged')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 步骤内容 */}
                  <div key={`step-${currentStep}`} className="flex gap-3 items-start animate-slide-in-left">
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                      <img src={EnergyRobotGif} alt="Agent" className="w-8 h-8 object-contain" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-primary">ZG EDU AGENT</span>
                      </div>
                      <div className="bg-white rounded-2xl rounded-tl-none p-4 shadow-sm">
                        <StructuredContent 
                          blocks={step.content} 
                          onCodeRun={handleCodeRun}
                          onCodeExplain={handleCodeExplain}
                        />

                        {faqItems.length > 0 && (
                          <div className="mt-4 rounded-xl bg-primary-50/70 p-3">
                            <button
                              type="button"
                              onClick={() => setFaqOpen(value => !value)}
                              className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-primary-700"
                            >
                              <span>{t('classFaq')}</span>
                              <ChevronDown className={`h-4 w-4 transition ${faqOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {faqOpen && (
                              <div className="mt-3 space-y-3">
                                {faqItems.map(item => (
                                  <div key={item.id} className="rounded-lg bg-white/80 p-3 text-sm">
                                    <div className="font-semibold text-default-800">{item.question}</div>
                                    <div className="mt-1 text-default-600 whitespace-pre-wrap">{item.answer}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 继续按钮 - 只在没有聊天记录且没有验证结果时显示在步骤内容中 */}
                        {chatLog.length === 0 && !verificationResult && !isValidating && (
                          <div className="flex justify-end mt-4 pt-3 border-t border-default-100">
                            <button 
                              onClick={handleContinue}
                              className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-600 transition-colors"
                            >
                              {currentStep === steps.length - 1 ? t('complete') : t('continue')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 聊天记录 */}
                  {chatLog.map((msg, idx) => {
                    // 判断是否是最后一条 Agent 消息，用于显示继续按钮
                    // 条件：是 agent 消息 + 是最后一条 + AI 不在回复中 + 没有正在验证 + 没有验证结果显示
                    const isLastAgentMessage = msg.role === 'agent' && 
                      idx === chatLog.length - 1 && 
                      !isAsking && 
                      !verificationResult &&
                      !isValidating;
                    
                    return (
                      <div key={idx} className={`flex gap-3 items-start ${msg.role === 'user' ? 'flex-row-reverse animate-slide-in-right' : 'animate-slide-in-left'}`}>
                        <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${
                          msg.role === 'user' ? 'rounded-full bg-default-400 text-white shadow-md ring-2 ring-white' : ''
                        }`}>
                          {msg.role === 'agent' ? <img src={EnergyRobotGif} alt="Agent" className="w-8 h-8 object-contain" /> : <span className="text-xs font-bold">{t('you')}</span>}
                        </div>
                        <div className={`rounded-2xl p-4 shadow-sm max-w-[85%] ${
                          msg.role === 'agent' ? agentBubbleClass(msg.hintLevel) : 'bg-primary text-white rounded-tr-none'
                        }`}>
                          {msg.role === 'agent' && <HintBadge level={msg.hintLevel} />}
                          {typeof msg.content === 'string' ? (
                            msg.role === 'agent' ? (
                              <MarkdownRenderer content={msg.content} />
                            ) : (
                              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            )
                          ) : (
                            <StructuredContent blocks={msg.content} />
                          )}
                          
                          {/* 继续按钮 - 显示在最后一条 Agent 消息中 */}
                          {isLastAgentMessage && (
                            <div className="flex justify-end mt-4 pt-3 border-t border-default-100">
                              <button 
                                onClick={handleContinue}
                                className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-600 transition-colors"
                              >
                                {currentStep === steps.length - 1 ? t('complete') : t('continue')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* 流式输出中 */}
                  {(isAsking || streamingContent) && (
                    <div className="flex gap-3 items-start animate-slide-in-left">
                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                        <img src={EnergyRobotGif} alt="Agent" className="w-8 h-8 object-contain" />
                      </div>
                      <div className={`rounded-2xl p-4 shadow-sm max-w-[85%] ${agentBubbleClass(streamingHintLevel)}`}>
                        <HintBadge level={streamingHintLevel} />
                        {streamingContent ? (
                          <MarkdownRenderer content={streamingContent} />
                        ) : (
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 验证中状态 - 以对话形式显示 */}
                  {isValidating && (
                    <div className="flex gap-3 items-start animate-slide-in-left">
                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                        <img src={EnergyRobotGif} alt="Agent" className="w-8 h-8 object-contain" />
                      </div>
                      <div className="flex-1 min-w-0 max-w-[85%]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-primary">ZG EDU AGENT</span>
                        </div>
                        <div className="bg-white rounded-2xl rounded-tl-none p-4 shadow-sm">
                          <div className="flex items-center gap-2 text-default-600">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span>{t('checking')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 验证结果 - 以对话形式显示（类似 LabEx） */}
                  {verificationResult && !isValidating && (
                    <div className={`flex gap-3 items-start ${isExiting ? 'animate-float-away' : 'animate-slide-in-left'}`}>
                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                        <img src={EnergyRobotGif} alt="Agent" className="w-8 h-8 object-contain" />
                      </div>
                      <div className="flex-1 min-w-0 max-w-[85%]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-primary">ZG EDU AGENT</span>
                        </div>
                        <div className={`bg-white rounded-2xl rounded-tl-none p-4 shadow-sm overflow-hidden ${
                          verificationResult.success && currentStep === steps.length - 1 ? 'animate-celebrate' : ''
                        }`}>
                          {/* 检查结果标题 */}
                          <h4 className="text-lg font-bold text-default-900 mb-3">
                            {verificationResult.success && currentStep === steps.length - 1 ? t('congratulations') : t('checkResult')}
                          </h4>
                          
                          {/* 检查项列表 */}
                          <div className="space-y-2 mb-4">
                            {verificationResult.checkItems?.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                {item.status === 'passed' ? (
                                  <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium break-words ${
                                    item.status === 'failed' ? 'text-danger' : 'text-success-700'
                                  }`}>
                                    {item.name}
                                  </p>
                                  {item.message && (
                                    <p className="text-xs text-default-500 mt-0.5 break-words">{item.message}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* 错误详情 */}
                          {!verificationResult.success && verificationResult.details && (
                            <div className="mb-4 p-3 bg-danger-50 rounded-lg overflow-x-auto">
                              <p className="text-sm text-danger-700 whitespace-pre-wrap break-words">{verificationResult.details}</p>
                            </div>
                          )}
                          
                          {/* 操作按钮 - 验证失败时显示 */}
                          {!verificationResult.success && (
                            <div className="flex flex-wrap justify-end gap-3 pt-3 border-t border-default-100">
                              <button
                                onClick={handleTroubleshoot}
                                disabled={isAsking}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 border border-primary-200 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
                              >
                                <Wrench size={14} />
                                {t('troubleshoot')}
                              </button>
                              <button
                                onClick={handleEscalateHint}
                                disabled={!canEscalateHint || isAsking}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-warning-700 border border-warning-200 bg-warning-50 rounded-lg hover:bg-warning-100 transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <BookOpen size={14} />
                                {t('giveFullHint')}
                              </button>
                              <button 
                                onClick={handleRetry}
                                className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-600 transition-colors"
                              >
                                {t('recheck')}
                              </button>
                            </div>
                          )}
                          
                          {/* 验证成功时显示提示 */}
                          {verificationResult.success && (
                            <div className="flex justify-end pt-3 border-t border-default-100">
                              <div className="flex items-center gap-2 text-success">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-sm font-medium">
                                  {currentStep === steps.length - 1 
                                    ? t('allStepsComplete')
                                    : t('nextStep')}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 快捷问题 */}
                  <div className="flex flex-wrap gap-2">
                    {step.quickQuestions?.map((q, i) => (
                      <button 
                        key={i} 
                        onClick={() => handleQuestion(q)}
                        disabled={isAsking}
                        className="px-3 py-2 text-[13px] text-primary border border-primary/30 rounded-lg bg-white hover:bg-primary-50 transition-colors disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 返回底部按钮 - 居中显示在输入框上方 */}
                {showScrollToBottom && (
                  <div className="flex justify-center pb-2">
                    <button
                      onClick={scrollToBottom}
                      className="px-3 py-1.5 bg-white rounded-full shadow-lg border border-default-200 hover:bg-default-50 transition-all flex items-center gap-1.5 text-sm text-default-600"
                      title={t('scrollBottom')}
                    >
                      <ChevronDown size={16} />
                      <span>{t('scrollBottom')}</span>
                    </button>
                  </div>
                )}

                {/* 底部工具栏 - 悬浮卡片样式 */}
                <div className="p-3">
                  <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    {/* 按钮行 */}
                    <div className="flex items-center gap-2 px-4 py-3">
                      <button 
                        onClick={() => {
                          setShowInputBox(!showInputBox);
                          // 展开时自动聚焦输入框
                          if (!showInputBox) {
                            setTimeout(() => inputRef.current?.focus(), 100);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                          showInputBox 
                            ? 'text-white bg-primary shadow-md' 
                            : 'text-white bg-primary hover:bg-primary-600'
                        }`}
                      >
                        <HelpCircle size={14} />
                        {t('ask')}
                      </button>
                      <button
                        onClick={handleEscalateHint}
                        disabled={!canEscalateHint || isAsking}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-warning-700 bg-warning-50 rounded-full hover:bg-warning-100 transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <BookOpen size={14} />
                        {t('fullHint')}
                      </button>
                      
                      {/* 关闭输入框按钮 - 只在输入框展开时显示 */}
                      {showInputBox && (
                        <button 
                          onClick={() => setShowInputBox(false)}
                          className="ml-auto p-1.5 text-default-400 hover:text-default-600 hover:bg-default-100 rounded-full transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* 输入框区域 - 可折叠 */}
                    {showInputBox && (
                      <div className="px-4 pb-4 pt-1">
                        <form onSubmit={handleSubmit} className="relative">
                          <div className="relative bg-default-50 rounded-xl focus-within:ring-2 focus-within:ring-primary/20 transition-all overflow-hidden">
                            <textarea 
                              ref={inputRef}
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSubmit(e);
                                }
                              }}
                              placeholder={t('inputPlaceholder')}
                              rows={2}
                              className="w-full px-4 py-3 pr-14 text-[15px] outline-none placeholder:text-default-400 text-default-900 resize-none bg-transparent"
                              disabled={isAsking}
                            />
                            <div className="absolute right-3 bottom-3">
                              <button 
                                type="submit"
                                disabled={isAsking || !inputValue.trim()}
                                className="p-2 text-white bg-primary hover:bg-primary-600 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Send size={16} />
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 恭喜完成实验对话框 */}
      <CompleteLessonDialog
        isOpen={showCompleteDialog}
        onClose={() => setShowCompleteDialog(false)}
        lessonName={manualTitle || t('experiment')}
        earnedXP={100}
        manualId={manualId}
        duration={(() => {
          const elapsed = Math.round((Date.now() - widgetStartRef.current) / 1000);
          const mins = Math.floor(elapsed / 60);
          const secs = elapsed % 60;
          if (mins > 0) return t('durationMinutes', { minutes: mins, seconds: secs });
          return t('durationSeconds', { seconds: secs });
        })()}
      />
    </>
  );
};

export default AgentWidget;
