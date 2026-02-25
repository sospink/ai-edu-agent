# Design Document: Agent Widget UX Improvement

## Overview

本设计文档描述了 Agent Widget 教学智能体组件的用户体验改进方案。主要改进包括：
1. 按钮文案本地化（Continue → 继续）
2. 悬浮继续按钮（方便长对话后快速操作）
3. 验证结果弹窗化（参考 LabEx Labby 设计）
4. 滚动行为优化

## Architecture

### 组件结构

```
AgentWidget
├── Header (步骤进度指示器)
├── ChatPanel (对话区域)
│   ├── StepContent (步骤内容)
│   ├── ChatMessages (对话消息)
│   └── FloatingContinueButton (悬浮继续按钮) [NEW]
├── VerificationDialog (验证结果弹窗) [NEW]
└── BottomToolbar (底部工具栏)
```

### 状态管理

```typescript
// 新增状态
interface AgentWidgetState {
  // 现有状态...
  
  // 新增：悬浮按钮相关
  showFloatingButton: boolean;      // 是否显示悬浮继续按钮
  scrollPosition: number;           // 当前滚动位置
  isUserScrolling: boolean;         // 用户是否正在手动滚动
  
  // 新增：验证弹窗相关
  showVerificationDialog: boolean;  // 是否显示验证弹窗
  verificationResult: VerificationResult | null;  // 验证结果
}

interface VerificationResult {
  success: boolean;
  message: string;
  details?: string;
  checkItems?: CheckItem[];  // 检查项列表
}

interface CheckItem {
  name: string;
  status: 'passed' | 'failed' | 'pending';
  message?: string;
}
```

## Components and Interfaces

### 1. FloatingContinueButton 组件

悬浮在对话区域右下角的继续按钮。

```typescript
interface FloatingContinueButtonProps {
  visible: boolean;
  isLoading: boolean;
  isLastStep: boolean;
  onClick: () => void;
}

const FloatingContinueButton: React.FC<FloatingContinueButtonProps> = ({
  visible,
  isLoading,
  isLastStep,
  onClick
}) => {
  if (!visible) return null;
  
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="fixed bottom-24 right-10 z-40 px-6 py-3 bg-primary text-white 
                 rounded-full shadow-lg hover:bg-primary-600 transition-all
                 flex items-center gap-2 animate-fade-in"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>检查中...</span>
        </>
      ) : (
        <>
          <span>{isLastStep ? '完成' : '继续'}</span>
          <ChevronRight className="w-4 h-4" />
        </>
      )}
    </button>
  );
};
```

### 2. VerificationDialog 组件

验证结果弹窗，参考 LabEx 设计。

```typescript
interface VerificationDialogProps {
  open: boolean;
  result: VerificationResult | null;
  onRetry: () => void;
  onSkip: () => void;
  onClose: () => void;
}

const VerificationDialog: React.FC<VerificationDialogProps> = ({
  open,
  result,
  onRetry,
  onSkip,
  onClose
}) => {
  if (!open || !result) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 - 点击不关闭 */}
      <div className="absolute inset-0 bg-black/20" />
      
      {/* 弹窗卡片 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[400px] max-w-[90vw] overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-default-900">检查结果</h3>
          <button onClick={onClose} className="text-default-400 hover:text-default-600">
            <X size={20} />
          </button>
        </div>
        
        {/* 检查项列表 */}
        <div className="px-6 py-4 space-y-3">
          {result.checkItems?.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3">
              {item.status === 'passed' ? (
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
              ) : item.status === 'failed' ? (
                <XCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              ) : (
                <Loader2 className="w-5 h-5 text-default-400 animate-spin shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  item.status === 'failed' ? 'text-danger' : 'text-default-700'
                }`}>
                  {item.name}
                </p>
                {item.message && (
                  <p className="text-xs text-default-500 mt-1">{item.message}</p>
                )}
              </div>
            </div>
          ))}
          
          {/* 错误详情 */}
          {!result.success && result.details && (
            <div className="mt-4 p-3 bg-danger-50 rounded-lg">
              <p className="text-sm text-danger-700">{result.details}</p>
            </div>
          )}
        </div>
        
        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-default-50">
          <Button variant="flat" onClick={onSkip}>
            跳过
          </Button>
          <Button color="primary" onClick={onRetry}>
            重新检查
          </Button>
        </div>
      </div>
    </div>
  );
};
```

### 3. 滚动行为管理 Hook

```typescript
interface UseScrollBehaviorOptions {
  threshold: number;  // 显示悬浮按钮的滚动阈值
  onScrollStateChange?: (isScrolling: boolean) => void;
}

function useScrollBehavior(
  scrollRef: React.RefObject<HTMLDivElement>,
  options: UseScrollBehaviorOptions
) {
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    
    let scrollTimeout: ReturnType<typeof setTimeout>;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // 显示悬浮按钮：滚动超过阈值
      setShowFloatingButton(scrollTop > options.threshold);
      
      // 显示回到底部按钮：不在底部
      setShowScrollToBottom(distanceFromBottom > 50);
      
      // 检测用户手动滚动
      setIsUserScrolling(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsUserScrolling(false);
      }, 150);
    };
    
    element.addEventListener('scroll', handleScroll);
    return () => {
      element.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [scrollRef, options.threshold]);
  
  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [scrollRef]);
  
  return {
    showFloatingButton,
    isUserScrolling,
    showScrollToBottom,
    scrollToBottom
  };
}
```

## Data Models

### VerificationResult 扩展

```typescript
// 扩展现有的验证结果接口
interface VerificationResult {
  success: boolean;
  message: string;
  details?: string;
  
  // 新增：检查项列表
  checkItems?: Array<{
    name: string;           // 检查项名称
    status: 'passed' | 'failed' | 'pending';
    message?: string;       // 状态说明
  }>;
  
  // 新增：AI 建议
  suggestion?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 悬浮按钮显示逻辑

*For any* 滚动位置 scrollTop，当 scrollTop > threshold 时，悬浮继续按钮应该显示；当 scrollTop <= threshold 时，悬浮继续按钮应该隐藏。

**Validates: Requirements 2.1, 2.2, 2.5**

### Property 2: 悬浮按钮功能等价性

*For any* 用户点击操作，悬浮继续按钮和原继续按钮应该触发相同的验证逻辑和步骤切换行为。

**Validates: Requirements 2.3**

### Property 3: 验证弹窗内容完整性

*For any* 验证结果，验证弹窗应该包含：标题、检查项列表（每项有状态图标）、操作按钮（跳过、重新检查）。如果验证失败，还应显示错误详情。

**Validates: Requirements 3.2, 6.3, 6.4**

### Property 4: 步骤导航状态一致性

*For any* 步骤切换操作，进度指示器应该正确反映已完成、当前和未完成的步骤状态，且对话历史应该保持不变。

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 5: 滚动行为管理

*For any* 滚动事件序列，当用户手动向上滚动时自动滚动应暂停，当用户滚动到底部时自动滚动应恢复，且在非底部位置应显示"回到底部"按钮。

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

## Error Handling

### 验证失败处理

1. **网络错误**: 显示 "网络连接失败，请检查网络后重试"
2. **超时错误**: 显示 "检查超时，请检查您的代码"
3. **环境错误**: 显示具体的环境检查失败信息

### 弹窗交互错误处理

1. **点击外部不关闭**: 防止用户误操作关闭弹窗
2. **重试失败**: 显示重试次数限制提示
3. **跳过确认**: 可选的跳过确认对话框

## Testing Strategy

### 单元测试

1. **FloatingContinueButton 组件测试**
   - 测试 visible 属性控制显示/隐藏
   - 测试 isLoading 状态下的 UI 变化
   - 测试 onClick 回调触发

2. **VerificationDialog 组件测试**
   - 测试弹窗打开/关闭
   - 测试检查项列表渲染
   - 测试按钮点击回调

3. **useScrollBehavior Hook 测试**
   - 测试滚动阈值判断
   - 测试用户滚动状态检测

### 属性测试

使用 fast-check 进行属性测试：

1. **Property 1 测试**: 生成随机滚动位置，验证悬浮按钮显示逻辑
2. **Property 3 测试**: 生成随机验证结果，验证弹窗内容完整性
3. **Property 4 测试**: 生成随机步骤切换序列，验证状态一致性

### 集成测试

1. 完整的验证流程测试（点击继续 → 显示弹窗 → 验证 → 结果展示）
2. 步骤切换与对话历史保持测试
3. 滚动行为与悬浮按钮联动测试
