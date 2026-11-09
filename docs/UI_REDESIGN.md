# Nexus Feedback — UI 升级设计方向（v1）

> 本文件是 UI 打磨阶段的唯一设计契约。所有界面改造以此为准；实现与本文冲突时，
> 先改本文再改代码。该阶段目标：统一、精致、可信，而不是重做成营销页。

## 1. 设计气质

**Signal Desk** — 一个安静、锐利、有信息密度的运营工作台。

- 信息优先：该出现的数据一个不少，装饰只做层次，不抢注意力。
- 冷峻中性底色 + 单点高饱和信号色：主色只用于可操作与当前状态，警告/危险色只在
  真正需要判断时出现。
- 表面有层次：画布/卡片/浮层三级，靠 1px 细边框和轻微阴影区分，不用重投影。
- 排版有节奏：标题紧、正文松、数字等宽；英文与数字使用 Instrument Sans。
- 动效克制：短、快、只在状态变化与首屏出现；尊重 `prefers-reduced-motion`。

## 2. 设计 Token

### 2.1 颜色

| Token | Light | Dark | 用途 |
|---|---|---|---|
| ink-950（画布） | `#F6F7F9` | `#0B0F19` | 页面底色 |
| surface（卡片） | `#FFFFFF` | `#111827` | 卡片、表格、面板 |
| surface-subtle | `#F9FAFB` | `#151D2E` | 表头、次级面板、hover 底色 |
| border-subtle | `#E5E8EE` | `#1F2937` | 常规分隔线/边框 |
| border-strong | `#CBD2DE` | `#334155` | 输入框、focus 前边框 |
| text-primary | `#0F172A` | `#F1F5F9` | 标题、正文 |
| text-secondary | `#475569` | `#94A3B8` | 说明、次要信息 |
| text-tertiary | `#7B8794` | `#64748B` | 占位、时间戳、辅助元数据 |
| brand-600 | `#3D5AFE` | 同左 | 主操作、当前导航、链接 |
| brand-50 | `#EEF1FF` | `brand-600`/15% | 主色浅底 |
| accent-500（琥珀） | `#F59E0B` | 同左 | 待处理、提醒、高亮信号 |
| success-500 | `#10B981` | `#34D399` | 已解决、成功 |
| danger-500 | `#EF4444` | `#F87171` | 紧急、删除、错误 |
| info-500 | `#0EA5E9` | `#38BDF8` | 进行中、信息 |

分类色板（固定顺序，图表与分类标签共用）：
`#6366F1`、`#F59E0B`、`#0EA5E9`、`#10B981`、`#8B5CF6`、`#EC4899`、`#64748B`。

要求：正文对比度 ≥ 4.5:1；颜色不能作为唯一状态信号（必须同时有文字或图标）。

### 2.2 字体

- 英文/数字：`'Instrument Sans Variable', 'Instrument Sans'`（已安装
  `@fontsource-variable/instrument-sans`，引入 `wght.css`）。
- 中文回退栈：`'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif`。
- 等宽：`'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace`（仅 ID、代码、数字对齐场景）。
- 字号阶梯：11 / 12 / 13 / 14 / 16 / 18 / 22 / 28 / 34px。
  - 组件内正文 13–14px；表格 13px；页面标题 22–24px（公开页 hero 可 34–44px）。
  - 标题 `font-weight: 650` 左右（变量字体可用 600–650），`letter-spacing: -0.01em`。
  - 数字使用 `font-variant-numeric: tabular-nums`。
- 禁止用 `vw` 直接缩放字号。

### 2.3 形状与阴影

- 圆角：卡片 14px、浮层/弹窗 16px、输入与按钮 10px、小徽标 6px / 全圆。
- 阴影：
  - `shadow-card: 0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)`
  - `shadow-pop: 0 12px 32px -12px rgb(15 23 42 / 0.25), 0 4px 12px -4px rgb(15 23 42 / 0.10)`
- 边框统一 1px；hover 可加深边框或加极轻阴影，不做发光。

### 2.4 间距与网格

- 基准 4px；常用：4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48。
- 管理后台内容区：左右 padding 24px（≥1280px 32px），最大宽度 1440px。
- 卡片内边距 16–20px；卡片间距 16–24px。
- 页面顶部到首个卡片 20–24px；section 间距 24–32px。

### 2.5 动效

- 时长：微交互 120–160ms；进入 180–240ms；大面积过渡 ≤ 300ms。
- 缓动：`cubic-bezier(0.2, 0.8, 0.2, 1)`（进入），`ease-out`（退出）。
- 可复用：`fade-up`（opacity 0→1，translateY 8px→0）、首屏 stagger 30–50ms。
- hover：颜色/边框/阴影 150ms；可点击卡片上浮 1px 或阴影加深，二选一。
- `@media (prefers-reduced-motion: reduce)` 下关闭 transform 与无限动画。

## 3. 组件规则

- **按钮**：主按钮实心 `brand-600`，hover `brand-700`；次按钮白底细边框；幽灵按钮无边框
  hover 浅底；危险操作只在确认时用 danger 实心。高度 32 / 36 / 40px 三档；图标按钮
  与文字按钮视觉对齐。
- **输入框**：高 36–40px，`border-strong`，focus 时 1px brand 边框 + 3px
  `brand-600/15%` ring；错误态红色边框 + 字段下错误文案。
- **徽标/状态**：小圆点 + 文案 + 浅色底 + 细 ring，高度 22px 左右；暗色模式必须有对应底/字色。
- **卡片**：单一层次，不卡片套卡片；有交互的卡片 hover 有反馈；卡片标题 13–14px
  半粗，右侧可放操作。
- **表格/列表**：行高 44–48px；表头 11–12px 大写或半粗、弱色；hover 行浅底；选中行
  brand 浅底；固定表头；空状态、加载骨架、错误态必须设计。
- **空状态**：图标（浅色圆底）+ 标题 + 一句说明 + 可选主按钮，垂直居中。
- **focus-visible**：全站 2px brand ring + 2px offset，不允许 outline:none 后无替代。
- **响应式**：360 / 390 / 768 / 1024 / 1280 / 1440 检查；不允许横向溢出；触控目标 ≥ 40px。

## 4. 各端方向

### 4.1 管理后台（packages/admin）

- 侧边栏：品牌区 + 导航分组（工作台 / 内容 / 团队 / 设置）+ 分组标题 + 激活态
  浅底 + 左侧 3px 指示条 + 底部用户区（头像、角色、语言、主题、退出）。
- 页面头：标题 + 一行说明/面包屑 + 右侧主操作；全站统一（PageHeader）。
- 仪表盘：问候 + 日期；6 个 KPI 卡一行（可换行但不同宽裂行）；趋势图有网格、
  渐变面积、tooltip、空数据占位；来源/分类分布有图例与数值；最近反馈列表带状态、
  分类、优先级、时间；欢迎新用户的引导区块。
- 反馈列表：筛选区两层（搜索 + 状态分段 + 排序/视图/筛选按钮；已选筛选条件以 chip
  展示可清除）；表格列：选择、标题（含来源小图标与标签）、分类（色点+中文名）、
  负责人头像、标签、优先级（色点+中文）、状态、时间；批量操作浮条；空/加载/错误。
- 反馈详情：两栏，左：标题区（返回、状态、标题、元信息）、正文、附件、对话时间线、
  回复编辑器（Markdown 工具栏）；右：状态流转、负责人、分类/优先级、标签、内部备注、
  状态历史、合并；粘性右栏。
- 其余管理页：沿用同一 PageHeader / Card / 表单规范；设置页左侧锚点或分组卡片。

### 4.2 公开看板（packages/board）

- 顶栏：项目身份（Logo 方块 + 项目名 + 副标题）+ 主导航（反馈 / 路线图 / 更新日志）
  + 右侧主题与语言；移动端导航可横向滚动或收进菜单。
- 首页：宽 `max-w-5xl`，桌面两栏（左侧列表 2/3 + 右侧 1/3 提交卡片/统计/分类）；
  列表项：投票按钮（上箭头 + 数字，投票后高亮）、标题、中文分类色点、状态、评论数、
  时间；排序分段控件；搜索框；筛选 chip。
- 路线图：三列看板（计划中/进行中/已完成），列头带数量徽标，卡片 hover 抬升；
  移动端横向滚动或纵向堆叠。
- 更新日志：时间线样式，左侧日期，右侧卡片，Markdown 排版精致。
- 分类名必须中文化：bug→Bug 修复、feature→功能建议、performance→性能优化、
  ui→界面体验、other→其他；未知分类原样显示。

### 4.3 公开提交页（packages/submit-page）

- 桌面分栏：左品牌区（产品名、说明、信任信息、常见问题/下一步链接），右表单卡片；
  移动端单列，顶部品牌条。
- 表单：字段标签 + 提示 + 错误都在字段内；分类为可点击卡片/胶囊选择；优先级分段；
  附件拖拽区有 hover/dragover/上传中/失败状态；提交按钮显示 loading。
- 成功状态：大图标 + 明确说明（已收到、会怎样处理）+ 查看看板/继续提交操作。
- 错误状态（含限流）：图标 + 说明 + 重试按钮，不能只有一行红字。

### 4.4 Widget（packages/widget）

- 保持可嵌入与样式隔离；launcher 带 tooltip；弹窗有完整头部（标题/关闭）、表单、
  成功与错误态；移动端全屏 sheet + 安全区；主题来自 `WidgetConfig`（primaryColor、
  radius、密度）；focus trap 与 Esc 关闭；动画尊重 reduced-motion。
- Widget 体积敏感：不引入字体包，使用系统字体栈。

## 5. 验收

1. `pnpm --filter <package> typecheck` 与 `build` 通过；控制台无新增报错。
2. 截图验证 1440×900 与 390×844（含滚动触发的动画区域），无横向溢出、无遮挡、
   无未本地化文案（管理后台/看板/提交页中文默认）。
3. 暗色模式（管理后台）逐页检查对比度与边框；公开页如支持暗色也要检查。
4. 交互：hover / focus-visible / active / disabled / loading / 空状态齐全。
5. 不在本阶段新增产品功能，不改 API 契约与数据结构；专注视觉与交互体验。

## 6. 本地验证工具

- 截图：`.tools/cdp-shot.mjs`（无头 Chrome，CDP 端口 9222）。
  ```powershell
  node .tools/cdp-shot.mjs '{"url":"http://localhost:8082/demo-project","out":".tools/shots/board.png","width":1440,"height":900,"full":true,"scroll":true}'
  ```
  带登录态的管理后台截图追加：
  `"authFile":"%TEMP%\\nexus_session.json","origin":"http://localhost:8080"`。
  另有 `"dark":true`、`"width"/"height"`、`"evalJs"`。
- 服务已启动：admin 8080、submit 8081、board 8082、API 3000。
- 公开 API 限流 100 次 / 15 分钟；截图/测试高频访问时可重启 server 清除内存计数
  （不要修改限流配置）。
- 演示数据项目：`demo-project`（Demo Org），有 28 条反馈、标签、更新日志。
