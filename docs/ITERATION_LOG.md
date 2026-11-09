# 迭代日志（自主迭代阶段）

> 用户离开、由 AI 接管后的持续迭代记录。**最新一轮记录在最上方**；
> 每轮开始先读顶部「下一轮计划」，结束前在顶部插入本轮记录。验证方式与本地服务见文末。

## 轮次记录

### Round 4 — 2026-11-10（应用内通知中心 + 表单基元收敛）

**本轮完成**
- **应用内通知中心（全栈，Lead + teammate）**
  - 数据模型：新增 `Notification`（org/member/feedback 关联、type/title/body/link/read_at、未读索引），
    additive migration `20261110031000_add_notification_center`。
  - 后端：`services/notificationCenter.ts` + `/api/v1/org/notifications` 系列接口（列表含 unread_count、
    未读数、标记已读-校验归属、全部已读）；在反馈创建 / 指派 / 状态变更 / 公开评论时写入通知
    （created 发全体 owner/admin；assigned 发被指派人；status 发被指派人或 staff；comment 发 assignee+staff；
    自动排除操作人，全部 fire-and-forget 不影响主流程）。新增 6 条 service 测试。
  - 前端（teammate notifications-ui）：侧边栏铃铛 + 未读角标（9+ / aria-live / 60s 轮询）、portal fixed
    面板（外点/Esc/焦点管理、四类型图标、乐观标记已读、全部已读、空/骨架/错误重试、390 宽适配、
    底部「查看全部通知」）；Lead 接入 Layout（侧边栏搜索行右侧 + 移动端顶栏）。
  - 完整通知页 `/notifications`（Lead）：全部/未读过滤、分页、全部已读、类型徽标与跳转。
- **表单基元收敛**（teammate primitives-polish）：`ui.tsx` 新增 `Field`、`Switch`（role=switch +
  aria-checked + 状态文字）、`SecretInput`（aria-label/pressed）、`SectionCard`、`settingsInputClass`；
  9 个设置/配置页删除重复实现并替换；Tags 删除按钮键盘可见、Members 角色控件补 aria。
- **命令面板**新增「查看通知」快捷操作。
- ⚠️ 工程注意：本仓库 Prisma migration 历史与本地 DB 存在既有 drift（DB 有 invite_token/board_url/
  system_config.org_id 等列，但 migration 记录未覆盖），`prisma migrate dev` 会要求 reset。本轮用
  `prisma migrate diff` + `prisma db execute` 生成并应用增量迁移，未破坏数据；未来部署需先补 baseline。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **173/173** ✅、`pnpm build` 5 包 ✅、`pnpm lint` 0 error ✅
- 真实链路：公开 API 建反馈 → 通知入库 → 未读数 +1 → 铃铛角标/面板 → 点击已读并跳转 → 全部已读清零；
  分页通知页、390 面板宽 358 无溢出、暗色 token 正常、0 console error/exception。

**提交**：`c9a1a84`（通知后端）、`1a8bac1`（铃铛/面板/通知页）、`f758946`（基元收敛 + a11y）

**遗留 / 技术债**
- 通知偏好（按类型/项目静音）尚未实现；面板固定 20 条（历史走完整页）。
- `SaveStatus`（dirty 指示）在 OrgSettings/SystemConfig 仍有副本；ProjectSettings 仍有自身 Field/
  SecretInput/Switch 副本，下轮收敛。
- Prisma migration baseline 需要单独整理一次（否则 production migrate 会有 drift 风险）。
- 公开端仍无自动化冒烟；`.tools/` 的 CDP 脚本可整理为 smoke 脚本。

**下一轮计划（Round 5）**
1. 通知偏好：按类型（新反馈/指派/状态/评论）静音开关（新增 `notification_setting` 或 org/member 级
   JSON 字段），服务端 fan-out 时过滤；设置页内加入通知开关分组。
2. 反馈列表「分配给我」快捷筛选 chip + 通知链接直达过滤视图。
3. `.tools/smoke.mjs`：一次跑通公开端（board/submit/widget）+ 后台关键流程的 CDP 冒烟并输出报告。
4. 继续收敛：SaveStatus、ProjectSettings 基元；Prisma migration baseline 整理。
5. 功能候选：CSV 导入（预览+校验）、公开看板 RSS feed、邮件模板预览。


### Round 3 — 2026-11-10（功能迭代：命令面板 / 内联编辑 / SEO 分享 / Widget 优先级）

**本轮完成（Lead + 2 teammate）**
- **⌘K 命令面板**（Lead）：页面跳转（角色过滤）、反馈关键词搜索（状态/分类展示）、快捷操作
  （新建更新日志、复制公开看板链接、邀请成员、切换主题/语言、快捷键帮助）；完整键盘操作
  （↑↓/↵/Esc）、移动端适配；侧边栏与移动端顶栏入口；导航配置抽到 `config/navigation.ts` 复用。
- **反馈内联编辑**（Lead，全栈）：新增 `PATCH /admin/feedback/:id`（owner/admin）→ zod 校验、
  分类合法性、审计日志；详情页编辑弹窗（标题/描述/分类/优先级/联系方式、字段级错误、dirty 提交）。
  **修复路由顺序 bug**：通用 PATCH 路由曾 shadow `/feedback/batch-status|batch-assign`，已移到批量
  路由之后，并补了 2 条路由顺序回归测试。
- **仪表盘运营视图**（Lead）：新增「最近动态」（审计流）与「分配给我」两卡；审计标签/色调抽到
  `utils/auditLabels.ts` 复用。
- **公开看板 SEO 与分享**（teammate board-seo）：`usePageMeta` 按路由维护 title/description/
  canonical/OG/Twitter（upsert 无重复）；详情 JSON-LD（DiscussionForumPosting）、更新日志 JSON-LD
  （Blog）；分享按钮（native share / 复制链接 + aria-live）；index.html 静态兜底。
- **Widget 优先级字段**（teammate widget-priority）：服务端已有 `fields.priority` 但前端从未渲染；
  新增可访问 segmented 控件（radiogroup + roving tabindex + 方向键/Home/End）、默认 medium、
  按开关决定是否附带 payload；IIFE +1.6%（183.87KB / gzip 58.2KB）。
- 深链：`/changelog?new=1` 自动打开创建表单、`/members?invite=1` 自动打开邀请弹窗。

**验证**
- `pnpm typecheck` ✅、`pnpm build` 5 包 ✅、`pnpm lint` 0 error ✅、`pnpm test` **167/167** ✅（新增
  updateFeedbackContent 5 条 + 路由顺序 2 条）。
- CDP 实测：⌘K 打开/搜索/键盘/移动端（390 无溢出）；编辑弹窗保存后详情标题即时更新并已还原；
  命令面板「新建更新日志」→ /changelog 且表单自动展开；看板 4 条路由 title/canonical/OG/JSON-LD
  断言全部正确且无重复；Widget 优先级 41/41 检查通过（payload/开关/键盘/移动端/主题）。
- 截图：`.tools/shots/r3/`、`.tools/shots/seo/`、`.tools/shots/widget-priority/`。

**提交**：`3229e68`（命令面板+内联编辑）、`c9d92f7`（board SEO+分享）、`e36c9ad`（widget 优先级）、
`13aca5c`（dashboard 动态卡+路由修复）

**遗留 / 技术债**
- 命令面板反馈搜索用的是 admin 关键词接口（不支持拼音/模糊），后续可加分类/状态快捷筛选 chip。
- 内联编辑目前只覆盖正文级字段；状态/负责人沿用操作栏（有意为之）。
- 通知中心需要新建数据模型（未做，列入 Round 4）；audit 流只作为活动视图，不是未读通知。
- 共享 Switch/FieldLabel/SecretInput 仍分散在多个页面，待收敛到 `components/ui.tsx`。
- 公开端保持截图级回归；可补 Playwright/脚本冒烟到 `.tools/`。

**下一轮计划（Round 4）**
1. **应用内通知中心（全栈）**：新增 Notification 模型 + 迁移；状态变更/指派/新评论时写入；
   API（列表/未读数/全部已读）；Layout 顶栏铃铛 + 下拉面板 + 移动端；60s 轮询或手动刷新。
2. Dashboard 通知入口与未读角标联动；通知偏好页补充"站内通知"开关（若模型支持）。
3. 反馈列表增加「按我负责」快捷筛选 chip；详情页状态流转补快捷备注。
4. 收敛共享表单基元（Switch/Field/SecretInput）并替换各页重复实现。
5. Playwright 冒烟脚本（公开端 + 关键后台流程），纳入 `pnpm test:e2e`（若环境允许）。


### Round 2 — 2026-11-10（后台剩余页面 + 全站暗色/移动审计 + 性能与健壮性）

**本轮完成**
- 后台剩余 12 个页面完成升级（Lead 4 页 + teammate 8 页）：
  - Lead：项目接入（项目卡、API Key/看板地址/Origins、重置 Key 确认弹窗、创建项目弹窗）、
    团队成员（头像/角色行内变更/移除与邀请弹窗/邀请链接回退/重发邀请）、标签管理（预设色板、
    实时颜色预览、删除确认）、审计日志（筛选工具栏、动作徽标、metadata 展开、分页）。
  - settings-polish：组织设置（资料卡 + 品牌预览 + 密码卡 + dirty 保存）、系统配置（邮件/存储卡、
    密钥掩码提示、按存储条件字段、页头统一保存）、项目设置（信息/通知策略/SSO 卡、删除确认）、
    Widget 配置（外观/文案字段 + 粘性实时预览 + 嵌入代码）。
  - config-polish：自定义分类（列表 + 新建/删除 Modal）、状态配置（默认工作流提示、内置保护、
    添加/删除 Modal）、Webhooks（**修复白屏 bug**：分页响应被当数组；启停开关、就地测试结果、
    编辑/删除 Modal、页内投递日志）、通知偏好（响应式订阅者列表、role=switch、移除确认）。
- 健壮性/体验：路由级 lazy 加载（初始 bundle 893KB → 340KB，Dashboard 图库按需加载）、
  ErrorBoundary（渲染异常不再白屏，可重试/刷新）、Toast 重做为 surface 风格 + 类型图标 + 移动端底部、
  移除无引用的 WebhookLogs 组件。
- 服务端小修：系统配置空密钥不再被掩码成 `****`（避免“已配置”误判）；项目反馈数排除回收站数据。
- 修复开发环境 Tailwind 扫描陈旧导致新色板类缺失的问题（重启 8080 dev server 后恢复）。

**验证**
- `pnpm typecheck` ✅、`pnpm test` 160/160 ✅、`pnpm build` 5 包 ✅、`pnpm lint` 0 error ✅
- 全后台 16 条路由 × 移动端 390（含滚动宽度检测）与暗色 1440 双轮审计：
  16/16 无横向溢出、0 exception、0 console error。
- 截图：`.tools/shots/r2/`（我的 4 页明暗+移动）、`.tools/shots/final-*-1440/390/dark`（设置页）、
  `.tools/shots/config/`（配置页含交互态）、`.tools/shots/audit2/`（全站审计）。

**提交**：`91d7fc8`、`f8bf82c`、`c8f1ac1`、`ea3f084`

**遗留（承接）**
- 共享组件缺口：Switch / FieldLabel / SecretInput / SettingsCard 在多个页面各自实现，
  建议抽到 `components/ui.tsx` 统一（Round 3 工程项）。
- Webhooks.tsx 701 行、ProjectSettings/WidgetConfig 偏长，可在允许新增文件时拆分。
- 公开端（board/submit/widget/landing）交互回归测试仍以截图为主，可补 Playwright 冒烟。
- admin bundle 已拆包，但 Dashboard 依赖 recharts 393KB，可评估按需引入图表类型。

**下一步（Round 3 计划：从 UI 打磨转入「有价值的功能」迭代）**
1. 命令面板（⌘K）：页面跳转 + 反馈搜索 + 快捷操作（新建更新/复制看板链接），键盘可达。
2. 通知中心：状态变更/指派/新反馈的未读列表，顶栏铃铛 + 未读角标 + 全部已读。
3. 反馈详情内联编辑：标题/描述可编辑，保存走既有 update 接口（需确认后端支持）。
4. 公开看板增强：分享卡片、路线图/更新日志 SEO meta、空状态引导。
5. 小工程：共享 Switch/Field 组件收敛；Board/Submit/Widget 冒烟测试脚本。
6. 若时间允许：CSV 导入、邮件模板预览、周报摘要开关。


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

**下一步（按优先级）** —— *其中 1/2/4（部分）已在 Round 2 完成，Round 2 见文件顶部*
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
   - 数据导入（CSV）、邮件模板预览、管理后台性能（code-splitting，Round 2 已完成懒加载）
5. 工程：为新增组件补关键单测（导航标签映射、周序列补零、markdown 摘录、权限判断）。

---

## 本地环境与验证工具

- 服务：admin 8080、submit 8081、board 8082、API 3000（dev 模式限流已放大）。
- 演示组织：`demo`（Demo Org），账号 `admin@nexus.dev / admin123`；演示项目 `demo-project`。
- 登录态截图：`%TEMP%\nexus_session.json` 由 `/api/v1/org/login` 生成。
- 截图工具：`node .tools/cdp-shot.mjs '{"url":"...","out":"...","width":1440,"height":900,"full":true,"scroll":true,"authFile":"%TEMP%\\nexus_session.json","origin":"http://localhost:8080","dark":false,"mobile":false}'`
  （无头 Chrome CDP 9222；.tools 已 gitignore）
- 演示数据脚本：`.tools/seed-demo-data.mjs`（仅用于 demo 项目，幂等性：会追加数据，慎重复跑）。
