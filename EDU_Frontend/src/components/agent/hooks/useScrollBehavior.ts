import { useState, useEffect, useCallback, useRef, RefObject } from 'react';

/**
 * useScrollBehavior Hook 配置选项
 */
export interface UseScrollBehaviorOptions {
  /** 显示悬浮按钮的滚动阈值（默认 200px） */
  threshold?: number;
  /** 滚动状态变化回调 */
  onScrollStateChange?: (isScrolling: boolean) => void;
  /** 判断是否在底部的距离阈值（默认 50px） */
  bottomThreshold?: number;
}

/**
 * useScrollBehavior Hook 返回值
 */
export interface UseScrollBehaviorReturn {
  /** 是否显示悬浮继续按钮 */
  showFloatingButton: boolean;
  /** 用户是否正在手动滚动 */
  isUserScrolling: boolean;
  /** 是否显示"回到底部"按钮 */
  showScrollToBottom: boolean;
  /** 是否在底部位置 */
  isAtBottom: boolean;
  /** 滚动到底部的方法 */
  scrollToBottom: () => void;
}

/**
 * 滚动行为管理 Hook
 * 
 * 用于管理对话区域的滚动行为，包括：
 * - 监听滚动位置
 * - 判断是否显示悬浮继续按钮（滚动超过阈值时显示）
 * - 检测用户手动滚动
 * - 控制自动滚动行为
 * 
 * @param scrollRef - 滚动容器的 ref
 * @param options - 配置选项
 * @returns 滚动状态和控制方法
 * 
 * @example
 * ```tsx
 * const scrollRef = useRef<HTMLDivElement>(null);
 * const {
 *   showFloatingButton,
 *   isUserScrolling,
 *   showScrollToBottom,
 *   scrollToBottom
 * } = useScrollBehavior(scrollRef, { threshold: 200 });
 * ```
 * 
 * Requirements:
 * - 2.2: 悬浮继续按钮仅在用户向下滚动超过一定距离（如 200px）时显示
 * - 2.5: 用户滚动回顶部时，悬浮继续按钮自动隐藏
 * - 5.2: 用户手动向上滚动查看历史消息时，暂停自动滚动
 */
export function useScrollBehavior(
  scrollRef: RefObject<HTMLDivElement>,
  options: UseScrollBehaviorOptions = {}
): UseScrollBehaviorReturn {
  const {
    threshold = 200,
    onScrollStateChange,
    bottomThreshold = 50,
  } = options;

  // 状态
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // 用于检测用户手动滚动的定时器
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 记录上一次滚动位置，用于判断滚动方向
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // 判断是否显示悬浮按钮：滚动超过阈值
      // Requirements 2.2: 仅在用户向下滚动超过一定距离时显示
      // Requirements 2.5: 滚动回顶部时自动隐藏
      setShowFloatingButton(scrollTop > threshold);

      // 判断是否在底部
      const atBottom = distanceFromBottom <= bottomThreshold;
      setIsAtBottom(atBottom);

      // 显示"回到底部"按钮：不在底部时显示
      // Requirements 5.4: 在用户手动滚动时显示"回到底部"按钮
      setShowScrollToBottom(!atBottom);

      // 检测用户手动滚动
      // Requirements 5.2: 用户手动向上滚动查看历史消息时，暂停自动滚动
      setIsUserScrolling(true);
      
      // 通知外部滚动状态变化
      onScrollStateChange?.(true);

      // 清除之前的定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // 设置新的定时器，滚动停止后重置状态
      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
        onScrollStateChange?.(false);
      }, 150);

      // 更新上一次滚动位置
      lastScrollTopRef.current = scrollTop;
    };

    // 添加滚动事件监听
    element.addEventListener('scroll', handleScroll, { passive: true });

    // 初始化时检查一次滚动位置
    handleScroll();

    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollRef, threshold, bottomThreshold, onScrollStateChange]);

  /**
   * 滚动到底部
   * Requirements 5.3: 用户滚动到底部时，恢复自动滚动行为
   */
  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior: 'smooth',
    });
  }, [scrollRef]);

  return {
    showFloatingButton,
    isUserScrolling,
    showScrollToBottom,
    isAtBottom,
    scrollToBottom,
  };
}

export default useScrollBehavior;
