# 迭代日志（自主迭代阶段）

> 用户离开、由 AI 接管后的持续迭代记录。每轮开始先读本文件末尾的「下一步」，
> 结束前更新「本轮完成 / 未完成 / 下一步」。验证方式与本地服务见文末。

## 轮次记录

### Round 1 — 2026-11-10（UI 打磨第一阶段 + 并行分派）

**本轮完成**
- 设计契约：`docs/UI_REDESIGN.md`（Signal Desk 方向、颜色/字体/圆角/阴影/间距/动效 token、各端方向、验收标准）。
- 管理后台设计系统基础：Tailwind token（surface 变量化、brand/accent、字体、圆角、阴影、动效）、
  `index.css` 基础排版/滚动条/focus-visible/骨架屏/减少动效、Instrument Sans 本地字体（admin/board/submit）。
- 布局壳：分组侧边栏、品牌区、用户区、移动端抽屉、页头组件 `PageHeader`、共享徽标组件
  （Status/Category/Priority/Source）、分页、批量操作条、合并弹窗、内部备注、状态历史。
- 仪表盘重做：KPI 网格 + 8 周趋势（补零对齐 ISO 周）+ 来源环图图例 + 分类分布 + 最近反馈。
- 反馈列表重做：搜索/筛选工具栏、已选筛选 chip、本地化分类、表格/移动卡片、分页、CSV 导出。
- 反馈详情重做：页头信息、正文卡、附件、对话时间线、回复编辑器（Cmd/Ctrl+Enter）、状态侧栏、
  负责人/标签、内部备注、状态历史、合并弹窗。
- 服务端修复：`memberLogin` 返回 `display_name` 与 `organization`（此前侧边栏显示“用户/Nexus”）；
  `getFeedbackDetail` 返回 `tags`（此前详情页标签永远为空）；ISO 周统计修正；`response_count`；
  dev 环境限流放大 20 倍（本地截图/联调不被 429 卡住）。
- 并行分派 3 个 teammate（独立写作用域）：board 看板、submit-page+widget、landing+login+accept-invite。

**Teammate 成果（均已验收并合入）**
- `packages/board`：token 化明暗主题、顶栏项目身份 + 胶囊导航、首页 2/3+1/3 粘性两栏
  （搜索/排序/状态筛选 chip、投票 pill、分类色点、骨架/空/错误态、移动端适配）、路线图三列看板、
  更新日志时间线、详情页与提交弹窗（focus trap/Esc）、分类中文化 zh/en 全覆盖。
- `packages/submit-page`：左品牌说明 + 右表单卡片分栏、分类卡片、优先级分段、附件拖拽状态、
  成功态/429 限流态/access 引导页、字段级校验、reduced-motion。
- `packages/widget`：Shadow DOM 样式隔离、launcher tooltip、focus trap + Esc + 焦点恢复、
  移动端全屏 sheet + safe-area、主题变量 primaryColor/radius/density、完整 success/error。
- `packages/admin` Landing/Login/AcceptInvite：新落地页（hero 产品 mock、Bento 能力、流程、CTA、页脚）、
  登录/注册/找回密码分栏页（字段级校验、错误横幅、密码可见、规则实时校验）、邀请接受页五态；
  移除 GSAP 依赖，改 CSS/IntersectionObserver 揭示动画（无滚动/减少动效时内容仍可见）。

**验证（全仓库）**
- `pnpm typecheck` ✅（5 个包）
- `pnpm test` ✅ 33 文件 / 160 测试全部通过（修复了此前 7 个既有失败：邀请邮件可选回退、
  platform admin 角色、上传 magic bytes 测试数据、widget-config 项目 mock、admin token 语义）
- `pnpm build` ✅（admin 893.77KB / board 282.63KB / submit 182.08KB / widget IIFE 180.97KB）
- `pnpm lint` ✅（清理 gsap 依赖与 2 处 unused 变量）
- 截图（.tools/shots/）：dashboard、feedback list、feedback detail、changelog 的 1440/390 明暗套图；
  landing 桌面/移动全页；board 首页/路线图/更新日志/详情 1440/390/暗色；submit 桌面/移动/成功/限流；
  widget launcher/面板/成功/错误/移动端/主题变体。控制台无 error/exception（仅既有 React Router
  future-flag 警告）。

**收尾提交**
- `9ef0039` admin design system refresh
- `9734e8e` server fixes + green tests
- `e06df8c` changelog workspace
- `919e534` board + landing/auth
- `067fd64` submit + widget
- `9e475f5` cleanup (gsap removal, lint)

**验证**
- `pnpm --filter @nexus-feedback/admin typecheck` ✅
- `pnpm --filter @nexus-feedback/admin build` ✅（chunk 890KB 偏大，待 code-splitting）
- 截图（.tools/shots/v2）：dashboard、feedback list、feedback detail 1440/390、明暗两套，控制台 0 异常。
- `pnpm --filter @nexus-feedback/server typecheck` ✅

**遗留问题（Round 1 收尾时状态）**
- ~~server 测试 7 个失败~~ 已在本轮修复（160/160 通过）：
  `inviteMember` 在未配置邮件服务时创建 pending 成员并返回 `invite_url`（UI 已支持手动分享）；
  `adminAuth` 将 legacy platform-admin token 视为 owner；更新了 org token 语义、上传 magic bytes、
  widget-config 项目查询三处过期测试。
- 后台仍有页面未做视觉升级：Applications / Members / Tags / AuditLogs / 设置系列 / 表单弹窗。
- 暗色模式只验证了 dashboard/list/detail/changelog；其余页面需逐页检查对比度。
- admin bundle 893KB（gzip 256KB）偏大，待 code-splitting（recharts 是主要占用）。
- Landing 817 行 / Login 773 行偏大，后续可拆子组件（页面级样式已拆分）。

**下一步（按优先级）**
1. 管理后台剩余页面逐页升级（统一 PageHeader / Card / Button / 表单规范）：
   - Applications（项目接入）：项目卡/表格、API Key 展示与复制、Allowed origins、操作分组
   - Members：成员行（头像/角色徽标/加入时间/操作菜单）、邀请结果弹窗展示 invite_url
   - Tags / AuditLogs / Categories / StatusSettings / Webhooks / Notifications
   - OrgSettings / SystemConfig / ProjectSettings / WidgetConfig 表单分组与危险操作确认
2. 全站暗色模式审计（每页截图）与移动端审计（390 宽，无横向溢出）。
3. 动效与可访问性：页面切换动效、弹窗 focus trap 统一、图标按钮 aria-label、Toast 可读性。
4. 功能增强候选（按价值排序）：
   - 命令面板（⌘K）：跳转页面、搜索反馈、快捷操作
   - 通知中心：状态变更/指派/新反馈未读列表
   - 反馈详情内联编辑（标题/描述）与复制引用
   - 公开看板分享卡片 / 路线图 SEO meta
   - 数据导入（CSV）、邮件模板预览、管理后台性能（code-splitting）
5. 工程：为新增组件补关键单测（导航标签映射、周序列补零、markdown 摘录、权限判断）。

---

## 本地环境与验证工具

- 服务：admin 8080、submit 8081、board 8082、API 3000（dev 模式限流已放大）。
- 演示组织：`demo`（Demo Org），账号 `admin@nexus.dev / admin123`；演示项目 `demo-project`。
- 登录态截图：`%TEMP%\nexus_session.json` 由 `/api/v1/org/login` 生成。
- 截图工具：`node .tools/cdp-shot.mjs '{"url":"...","out":"...","width":1440,"height":900,"full":true,"scroll":true,"authFile":"%TEMP%\\nexus_session.json","origin":"http://localhost:8080","dark":false,"mobile":false}'`
  （无头 Chrome CDP 9222；.tools 已 gitignore）
- 演示数据脚本：`.tools/seed-demo-data.mjs`（仅用于 demo 项目，幂等性：会追加数据，慎重复跑）。
