# EDU Frontend — Design System

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS v3 |
| 组件库 | HeroUI v2（原 NextUI） |
| 动画 | Framer Motion v11 |
| 图标 | Lucide React |
| 工具 | clsx + tailwind-merge |

---

## 色彩系统

### 主题色（HeroUI Semantic Tokens）

| Token | Hex | 用途 |
|---|---|---|
| `primary` | `#006fee` | 主操作按钮、激活状态、链接、焦点环 |
| `secondary` | `#7828c8` | 渐变搭配色、标签 |
| `success` | `#17c964` | 完成状态、验证通过 |
| `warning` | `#f5a524` | 警告提示 |
| `danger` | `#f31260` | 错误、删除操作 |
| `background` | `#fafafa` | 页面底色 |
| `foreground` | `#18181b` | 默认文字 |

### 中性色（Tailwind Slate Scale）

项目全局使用 `slate` 系列作为中性色，不用 `gray`：

```
slate-50   (#f8fafc) — 页面背景、输入框底色
slate-100  (#f1f5f9) — 边框、分割线
slate-200  (#e2e8f0) — 卡片边框
slate-400  (#94a3b8) — 占位符文字
slate-500  (#64748b) — 次要文字
slate-700  (#334155) — 正文
slate-800  (#1e293b) — 标题
slate-900  (#0f172a) — 深色背景、主按钮
```

### 语义色使用规范

状态 badge 使用带透明背景的三色组合：

```tsx
// 成功
'bg-success-50 text-success-700 border border-success-200'
// 警告
'bg-warning-50 text-warning-700 border border-warning-200'
// 错误
'bg-danger-50  text-danger-700  border border-danger-200'
// 普通
'bg-slate-50   text-slate-600   border border-slate-200'
```

### 代码块颜色（VS Code Dark+）

```
背景:    #0d1117 / #1e1e1e
关键字:  #569cd6
字符串:  #ce9178
函数:    #dcdcaa
类型:    #4ec9b0
变量:    #9cdcfe
注释:    #6a9955
数字:    #b5cea8
```

---

## 字体

### 字体家族

```css
font-family: 'Inter', system-ui, sans-serif;  /* 全局 */
font-family: font-mono;                        /* 代码、输入框 */
-webkit-font-smoothing: antialiased;           /* 全局抗锯齿 */
```

### 字号约定

| 场景 | Tailwind 类 |
|---|---|
| Hero 主标题 | `text-6xl md:text-8xl lg:text-9xl font-black tracking-tight` |
| 页面 h2 | `text-3xl md:text-5xl font-bold` |
| 卡片标题 | `text-lg font-bold` / `text-xl font-bold` |
| 正文 | `text-sm` / `text-base` |
| 导航项 | `text-sm` |
| 标签/徽章 | `text-[10px] uppercase tracking-widest` |
| 侧边栏分组 | `text-[10px] uppercase tracking-widest font-bold` |

### 渐变文字

```tsx
// 主品牌渐变
'bg-gradient-to-br from-primary-600 to-violet-600 bg-clip-text text-transparent'

// Navbar logo
'bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent'

// Shimmer 动画文字（Hero）
'bg-gradient-to-br from-primary-600 via-secondary-500 to-primary-600 animate-text-shimmer bg-[length:200%_auto]'
```

---

## 圆角规范

| 元素 | 值 |
|---|---|
| 页面卡片（主） | `rounded-2xl` |
| 突出展示卡片 | `rounded-3xl` |
| 操作按钮（药丸型） | `rounded-full` |
| 操作按钮（实心） | `rounded-xl` |
| 侧边栏导航项 | `rounded-lg` |
| 输入框 | `rounded-xl` |
| Navbar | `rounded-full` |
| 弹窗/Modal | `rounded-2xl` |

---

## 间距与布局

### 容器宽度

```
max-w-7xl   (1280px) — 全局页面内容区
max-w-5xl   (1024px) — Navbar
max-w-3xl   (768px)  — 标题文本块
max-w-md    (448px)  — 确认弹窗
max-w-sm    (384px)  — 登录表单
```

### 固定结构尺寸

```
侧边栏宽度:   w-60 (240px)
顶部 Header: h-16 (64px)
内容区偏移:  ml-60
内容区内边距: p-8
```

### Section 间距

```tsx
// Section 组件默认
'py-20 md:py-32 px-6 md:px-12'
```

### 常用 Grid 布局

```tsx
// 四列特性卡片
'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'

// 三列内容
'grid-cols-1 md:grid-cols-3 gap-8'

// Bento 布局
'grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(180px,auto)]'

// 数据统计行
'grid-cols-2 md:grid-cols-4 gap-8'
```

---

## 组件规范

### 卡片（Glassmorphism）

项目的主视觉风格为 **毛玻璃（Glassmorphism）**：

```tsx
// 标准玻璃卡片
'bg-white/60 backdrop-blur-md border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl'

// hover 悬浮效果
'hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300'

// 实心白卡（弹窗/侧边栏）
'bg-white rounded-2xl shadow-2xl border border-slate-200'
```

### 按钮

项目没有独立 Button 组件，按场景内联定义：

```tsx
// 深色主按钮（主 CTA）
'bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 py-1.5 text-sm font-semibold'

// 蓝色主按钮（表单提交）
'bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-4 shadow-xl'

// 幽灵按钮（次要操作）
'rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-white hover:text-slate-900'

// 危险操作
'text-danger-500 hover:bg-danger-50'

// 侧边栏激活项
'rounded-lg px-3 py-2.5 bg-primary-50 text-primary-600'

// 侧边栏非激活项
'text-default-500 hover:bg-default-100/60'

// 浮动操作按钮（FAB）
'w-12 h-12 bg-primary-600 rounded-full shadow-lg shadow-primary-600/30'
```

### 输入框

```tsx
// 标准输入框
'block w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-xl
 text-slate-900 placeholder-slate-300
 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500
 transition-all font-mono text-sm shadow-sm'

// 工具栏搜索框
'h-12 rounded-2xl border border-slate-200
 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.97))]
 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_rgba(15,23,42,0.06)]
 focus-within:border-primary-500'
```

### Toast 通知

```
位置:  fixed top-4 right-4 z-[110]
形状:  rounded-xl shadow-lg
成功:  bg-success-500
错误:  bg-danger-500
信息:  bg-primary-500
动画:  opacity-0 + y:-20 + scale:0.95 → 进场
时长:  3000ms 自动消失
```

### Modal / ConfirmDialog

```
渲染:   createPortal(document.body)  z-index: 10000
遮罩:   bg-black/50 backdrop-blur-sm
进场:   scale(0.95) y(20) → scale(1) y(0)  Framer Motion
形状:   rounded-2xl
底部:   bg-slate-50 border-t border-slate-100
```

### Dialog / Drawer Portal 约束

- 普通弹窗统一使用 `common/PageDialog.tsx`
- 详情抽屉统一使用 `common/PageDrawer.tsx`
- 自定义弹层必须通过 `OverlayPortal` 渲染到 `document.body`
- 禁止在页面组件内直接把 `fixed inset-0` 作为弹窗、抽屉、全屏遮罩根节点
- 原因：后台页面大量使用 `Framer Motion`，上层一旦存在 `transform / filter / contain / overflow` 等布局上下文，局部 `fixed` 会被限制在页面内容容器内，导致顶部露白、遮罩不满屏、滚动穿透或 z-index 异常

---

## 动画系统

### Framer Motion 约定

```tsx
// 标准页面元素入场
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3 }}

// 列表项交错入场
transition={{ delay: index * 0.1 }}

// Navbar 滑入
initial={{ y: -48, opacity: 0 }}
transition={{ ease: [0.22, 1, 0.36, 1] }}

// 弹窗入场
initial={{ scale: 0.95, y: 20, opacity: 0 }}
animate={{ scale: 1, y: 0, opacity: 1 }}
```

### Tailwind 自定义动画

| 动画名 | 效果 | 时长 |
|---|---|---|
| `animate-blob` | translate + scale 循环（背景气泡） | 7s |
| `animate-float` | 垂直浮动 | 6s |
| `animate-pulse_slow` | 呼吸脉冲 | 4s |
| `animate-text-shimmer` | 背景位移光泽 | 2.5s |
| `animate-enter` | scale+translateY 入场 | 0.3s |
| `animate-fade-in` | 透明度渐变 | 0.3s |
| `animate-slide-up` | 透明度+上移 | 0.3s |

---

## 全局背景

`Background.tsx` 注入到所有学生端页面：

```tsx
// 渐变底色
'bg-gradient-to-br from-slate-50 via-white to-blue-50/30'

// 三个动画气泡（绝对定位，pointer-events-none）
蓝色:   bg-blue-100/40    -top-40  -left-40   w-96 h-96
紫色:   bg-purple-100/30  top-40   right-20   w-80 h-80
青色:   bg-cyan-100/20    bottom-0 left-1/3   w-96 h-96
animate-blob + delay-2000/4000

// 网格叠加层
背景图: 60px×60px 网格（CSS linear-gradient）
透明度: 1.5%
```

---

## 各端视觉差异

### 学生端（主门户）

- 动态 `Background` 背景
- 浮动胶囊 Navbar（`rounded-full`、毛玻璃）
- 全局 `AgentWidget`（浮动 AI 助手）
- `GuideHub`（新手引导）
- 大量 Framer Motion 动效（Hero 3D 倾斜、视差、磁性按钮）

### 管理端（`/admin/*`）

- 无动态背景，改为固定模糊色块（`bg-primary-100/40`、`bg-secondary-100/40`）
- **固定左侧边栏**（`w-60 bg-white/95 backdrop-blur-sm`）
- **顶部粘性 Header**（`h-16 bg-white/80 backdrop-blur-md`）
- 品牌标签：`"Admin Console"` `text-[9px] uppercase tracking-widest`
- 无全局 AgentWidget

### 教务端（`/teacher/*`）

- 与管理端相同侧边栏结构
- Sidebar logo 样式差异：`bg-primary-600 rounded-lg`（管理端用渐变 `rounded-xl`）
- 内容区 `motion.div` 包裹入场动画
- 品牌标签：`"Teacher Portal"`
- 无通知铃铛、无面包屑 chevron

### 课程页（`/lesson/:lessonId`）

- 独立页面，无主导航
- 左右分栏：内容区（PDF/Markdown/Word 查看）+ AgentWidget
- `GripVertical` 可拖拽调整分栏比例
- macOS 风格代码块（红绿黄交通灯 + 复制按钮）
- `highlight.js` 语法高亮（vs2015 主题）

---

## 通用组件一览

| 组件 | 位置 | 说明 |
|---|---|---|
| `Background` | `common/Background.tsx` | 全局动画背景（学生端） |
| `Section` | `common/Section.tsx` | 标准 Section 包装（标题+内容） |
| `Toast` + `useToast` | `common/Toast.tsx` | 全局通知系统 |
| `ConfirmDialog` + `useConfirmDialog` | `common/ConfirmDialog.tsx` | 确认弹窗（danger/warning/info） |
| `PageDialog` | `common/PageDialog.tsx` | 全局 Portal 弹窗壳，避免页面局部 fixed 定位异常 |
| `PageDrawer` | `common/PageDrawer.tsx` | 全局 Portal 详情抽屉壳，避免顶部露白和遮罩不满屏 |
| `ToolbarSearchField` | `common/ToolbarControls.tsx` | 工具栏搜索输入 |
| `ToolbarSelect` | `common/ToolbarControls.tsx` | 工具栏下拉选择（封装 HeroUI Select） |
| `BackToTop` | `common/BackToTop.tsx` | 滚动回顶 FAB（300px 后出现） |
| `PlaceholderPage` | `common/PlaceholderPage.tsx` | "Coming Soon" 占位页 |
| `AgentWidget` | `agent/AgentWidget.tsx` | 浮动 AI 助手（可缩放、教学/对话双模式） |

---

## 新增页面开发规范

1. **学生端新页面**：包裹在 `MainLayout` 内，路由加入 `App.tsx` 的 `<Routes>`
2. **管理端新页面**：在 `AdminPanel.tsx` 的内部 `<Routes>` 添加，侧边栏新增对应 `navItems` 条目
3. **教务端新页面**：在 `TeacherPanel.tsx` 的内部 `<Routes>` 添加
4. **色彩**：优先用 Semantic Token（`primary-*`、`success-*`），中性色用 `slate-*`
5. **卡片**：统一用毛玻璃风格（`bg-white/60 backdrop-blur-md`），避免纯 `bg-white` 出现在学生端
6. **圆角**：卡片 `rounded-2xl`，按钮 `rounded-full`（药丸）或 `rounded-xl`（实心）
7. **图标**：只用 `lucide-react`，不引入其他图标库
8. **动画入场**：页面/卡片统一用 `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}`
9. **响应式**：移动端优先，`md:` 断点（768px）为主要分界
