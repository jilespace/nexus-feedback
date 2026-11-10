# 迭代日志（自主迭代阶段）

> 用户离开、由 AI 接管后的持续迭代记录。**最新一轮记录在最上方**；
> 每轮开始先读顶部「下一轮计划」，结束前在顶部插入本轮记录。验证方式与本地服务见文末。

## 轮次记录

### Round 16 — 2026-11-10（a11y 全清零 / 可分享筛选 / Markdown 附件）

**本轮完成（Lead + 3 个 teammate 并行）**
- **a11y 全站清零（Lead）**：高优先级 badge 由 orange-600→orange-700（3.56→4.9:1）→ 全站 7 页
  **严重 0 / 中等 0 / 轻微 0**；`pnpm a11y:check` 阈值收紧为 `--fail-on=medium`（任何中等即失败），
  当前基线通过，DEVELOPMENT 同步。
- **看板筛选 URL 持久化（teammate）**：首页 sort/status/category/q 与 URL 双向同步（防抖 300ms、
  `replaceState` 不增历史、popstate 应用、非法值回退并规范化、清除移除参数）；分享按钮复制带筛选
  完整链接；新增纯函数 `urlFilters.ts`；a11y board 复跑 0/0。
- **Markdown 复制含附件（teammate）**：`buildFeedbackMarkdown` 增加附件章节（内容后、回复前，
  `- [name](url)`，无附件不输出），label 转义 + 特殊 URL `<>` 包裹；详情页传入附件绝对链接；
  6 条测试（由 3 条扩展）。
- **smoke 43 → 45（teammate）**：新增「公开看板订阅」（幂等 upsert、偏好查询、退订+删除清理）与
  「通知按项目静音」（保存/恢复设置、静默丢弃、非法负载 400）两项写操作链路检查。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **290/290**（server 260 + admin 30）✅、`pnpm build` 5 包 ✅、
  `pnpm lint` 0 error ✅、`pnpm smoke` **45/45 PASS**（34.2s）✅、`pnpm a11y:check` **PASS**
  （0 严重 / 0 中等 / 0 轻微，exit 0）✅、`pnpm perf` **12/12 PASS** ✅
- CDP：分享链接还原筛选（1440/390）、非法参数回退、前进/后退同步；Markdown 附件（zh 336 字符 /
  en 383 字符含附件章节）；订阅写入 DB 后清理；静音项目静默丢弃后恢复。

**提交**：`4a9c49b`（badge 对比度 + 门禁收紧）、`19f49b4`（smoke 45）、`3819a12`（Markdown 附件）、
`349411b`（看板 URL 筛选）

**遗留 / 技术债**
- a11y 审计仍为 DOM 近似且只覆盖亮色模式；暗色对比度未纳入门禁（可后续扩展）。
- 看板 URL 未知 category 在数据加载后才回退（短暂空列表）。
- 订阅类型语义（单类型订阅不关闭另一类）待产品确认；订阅不发确认邮件。
- 通知内容仍服务端中文；主 locale 冗余 key 未清理；Landing 双语字典未接命名空间。
- smoke 覆盖订阅/静音，但「订阅成功后的退订入口」UI 未做。

**下一轮计划（Round 17）**
1. a11y 门禁扩展暗色模式（脚本增加 dark 扫描与阈值）；补充键盘交互回归（焦点顺序断言）。
2. 公开看板订阅体验完善：已订阅邮箱状态回显 / 退订入口（复用 unsubscribe）。
3. 功能候选：通知按类型过滤/分组折叠、反馈详情关联更新日志双向跳转、合并建议已合并来源跳转。
4. 质量：Landing 文案拆分命名空间 + 主 locale 冗余 key 清理（配合 parity 测试）。


### Round 15 — 2026-11-10（公开订阅 / 项目静音 / a11y 门禁）

**本轮完成（Lead + 3 个 teammate 并行）**
- **公开看板邮件订阅（全栈，teammate）**：`POST /public/:projectSlug/subscribe`（email 归一校验、type 枚举、
  项目 404、复用 public 限流、幂等 upsert NotificationPreference、不发邮件）；看板全局页脚新增订阅卡片
  （邮箱 + 类型选择、行内校验 aria、成功/失败态、remember email），zh/en/暗色/390；6 条路由测试。
- **通知按项目静音（全栈，teammate）**：`notification_settings.mutedProjects`（≤50、读时归一/去重/截断）；
  fan-out 链路「类型偏好 → 项目静音 → DND」跳过命中收件人（按需解析 feedback.project）；偏好卡项目
  checkbox 多选 + 乐观保存 + 上限提示；12 条 service 测试（notificationCenter 共 46 条）。
- **a11y 门禁模式（teammate）**：`--fail-on=serious|medium|none` + `--max-medium`，退出码语义明确、
  JSON/MD 报告含 gate 字段；新增 `pnpm a11y:check`（当前基线：严重 0 / 中等 1 → PASS）。
- **登录页对比度（Lead）**：auth ink-3 加深 + 深色品牌面板页脚文字提亮 → 登录页中等 **4 → 0**；
  全站 a11y 中等降至 **1**（仅数据驱动标签色）。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **287/287**（server 260 + admin 27）✅、`pnpm build` 5 包 ✅、
  `pnpm lint` 0 error ✅、`pnpm smoke` **43/43 PASS**（32.6s）✅、`pnpm a11y:check` **PASS**（exit 0）✅
- CDP：真实订阅写库→DB 确认→unsubscribe 清理；静音项目→提交无通知→取消恢复；登录页对比度 0；
  截图 `.tools/shots/board-subscribe/`、`.tools/shots/notification-mute-projects/`。

**提交**：`008df72`（登录页对比度）、`9714a7c`（a11y 门禁）、`41f8842`（项目静音）、
`166a0b3`（公开订阅）

**遗留 / 技术债**
- a11y 中等 1 处：反馈列表标签颜色由数据驱动（自定义标签色），可做「深色文字 + 低饱和底色」兜底。
- 订阅类型语义：单类型订阅不关闭另一类型（unsubscribe 按 type 置 false），产品语义待明确。
- 通知内容仍服务端中文；DND/静音均静默丢弃不补发；静音需按 feedback 反查项目（可让调用方传 projectId 优化）。
- 主 locale 冗余 key 未清理；Landing 文案仍内置双语字典。

**下一轮计划（Round 16）**
1. smoke 增加订阅/静音 API 链路检查（43 → 45）。
2. 标签颜色 a11y 兜底（深色文字 + 低饱和背景），把最后 1 处中等消除，`--fail-on=medium` 可达标。
3. 功能候选：反馈详情 Markdown 复制包含附件；公开看板「订阅/退订」入口联动；
   通知按类型分组折叠。
4. 删除/清理：评估主 locale 冗余 key 清理与 Landing 命名空间迁移。


### Round 14 — 2026-11-10（对比度清零 / 免打扰多时段 / 合并来源）

**本轮完成（Lead + 3 个 teammate 并行）**
- **board 对比度 token（teammate）**：亮色 `--ink-tertiary` #7B8794→#5F6B7A（3.4–3.7→5.0–5.4:1）、
  `--danger`→#DC2626、暗色 tertiary 提亮、新增 `--brand-ink` 修复暗色激活态（3.01→6.54:1）；
  board 首页/详情对比度违规 **125/12 → 0/0**（亮暗双口径均 0）。
- **admin 对比度（Lead）**：浅色 `text-gray-500` 加深（4.44→5.0+）、amber badge 文本改 amber-700
  （3.07→5.0）；后台三页中等 **56 → 1**（唯一剩余为数据驱动的标签颜色）。
- **通知免打扰多时段（teammate）**：`dnd {enabled, slots[]}` 最多 5 段、跨午夜、旧 `{start,end}`
  自动归一、PUT 逐段校验且只持久化 slots；前端时段列表增删/行内错误/空列表拦截；34 条 service 测试。
- **合并弹窗展示已合并来源（teammate）**：similar 响应增加 `mergedSources`（最多 10 条），
  弹窗顶部展示来源标题/状态/相对时间；4 条测试。
- smoke DND 检查同步升级为 slots 契约（43/43 全绿）。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **269/269**（server 242 + admin 27）✅、`pnpm build` 5 包 ✅、
  `pnpm lint` 0 error ✅、`pnpm smoke` **43/43 PASS**（32.4s）✅
- `pnpm a11y` 全量：**严重 0 / 中等 5 / 轻微 0**（登录页 4、反馈列表 1 为数据驱动标签色），
  提交页、board 首页/详情、dashboard、notifications 全 PASS。
- CDP：多时段 DND 配置→提交静默→关闭恢复；合并来源区块 zh/en/390；对比度修复后视觉仅轻微加深。

**提交**：`ddea457`（admin 对比度）、`83253c6`（合并来源）、`388cc10`（board 对比度）、
`f270809`（多时段 DND + smoke 契约）

**遗留 / 技术债**
- a11y 中等 5 处：admin 登录页 4（辅助文字对比度）+ 反馈列表 1（数据驱动标签颜色）；可继续处理。
- a11y 审计为 DOM 近似，非 WCAG 认证；渐变背景对比度跳过。
- 通知标题/正文/邮件内容仍服务端中文；DND 服务器时区；合并来源上限 10。
- 主 locale 历史冗余 key 未清理；Landing 仍内置双语字典（未接命名空间）。

**下一轮计划（Round 15）**
1. 收尾 admin 登录页对比度（4 处）+ 反馈列表数据标签色兜底（深色文字底）。
2. 新功能候选：公开看板邮件订阅（weekly digest opt-in）、反馈详情「复制为 Markdown」增强（附件列表）、
   通知「按项目静音」。
3. 质量：将 `pnpm a11y` 阈值化（严重>0 失败）接入 smoke 或 CI 脚本。
4. 主 locale 冗余 key 清理 + landing 文案接入命名空间（可选）。


### Round 13 — 2026-11-10（无障碍审计与修复 / 看板详情 CLS）

**本轮完成（Lead + 3 个 teammate 并行）**
- **a11y 审计工具（teammate）**：新增 `pnpm a11y`（零依赖 CDP）：可访问名称/表单 label/ARIA 合法性/
  图片 alt/html lang/标题层级/真实 Tab 顺序与焦点可见性/颜色对比度（AA 近似）/重复 id，覆盖 7 个页面，
  输出中文表格 + JSON/MD 报告。发现的问题不影响退出码，便于持续观察。
- **提交页无障碍（teammate）**：文件输入补 label、`ink-3` 次要文字加深（4.5:1）、半透明提示/选中分类/
  必填星号对比度修正 → **严重 4/中等 31 → 0/0**，布局与文案零变化。
- **后台无障碍（Lead）**：新增 skip-to-content 链接 + main 地标；反馈列表搜索框/保存视图控件补
  aria-label；浅色模式 `text-gray-400/300` 全局提升至 AA（暗色变体保持），侧栏分组标题修正 →
  审计严重问题 **dashboard/feedback/notifications 40/40/19 → 0/0/0**（中等 14/40/2）。
- **看板无障碍 + 详情 CLS（teammate）**：品牌链接/主题开关/投票按钮（aria-pressed/busy）、状态筛选 group、
  结果计数 aria-live、侧栏 aside 地标、卡片 article↔标题关联、评论表单 aria-describedby+自动聚焦、
  详情 h1/article/time、弹窗 describedby；live region 常驻 42→3。详情骨架改为与最终内容同构 →
  详情 CLS **0.0245 → 0.001**（首页保持 0.000）。
- **smoke 43 项**：新增后台/公开端无障碍基础断言（lang、唯一 h1、可访问名称、img alt）。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **257/257** ✅、`pnpm build` 5 包 ✅、`pnpm lint` 0 error ✅、
  `pnpm smoke` **43/43 PASS**（33.8s）✅
- `pnpm a11y` 全量：**严重 0**（7 页全部）；中等 112（board 首页 40/详情 12、admin 登录 4、
  dashboard 14/feedback 40/notifications 2，均为对比度 3.0–4.4:1 的边缘项或彩色 badge）
- `pnpm perf`：12/12 PASS；看板详情 0.001、首页 0.000。

**提交**：`f5970f3`（a11y 工具 + 提交页修复）、`2102882`（smoke a11y 断言）、
`cedbf3e`（后台 a11y + 对比度）、`b0d578b`（看板 a11y + 详情 CLS）

**遗留 / 技术债**
- 中等对比度问题 112 处：board 的 `text-ink-tertiary`（3.42–3.66:1）与彩色 badge（3.07:1）、
  admin 的 `text-gray-500` 于浅底（4.44:1 边缘）——可做 token 级统一调整。
- a11y 审计为 DOM 级近似（渐变背景跳过对比度、键盘顺序为启发式），不等同 WCAG 认证。
- 服务端通知/邮件内容仍中文；DND 服务器时区；关联更新日志 100 条上限。
- 主 locale 存在历史冗余 key（parity 测试仅保证 zh/en 对齐）。

**下一轮计划（Round 14）**
1. board 对比度 token 统一（`ink-tertiary` 加深到 AA）+ 彩色 badge 文字色适配；admin gray-500 边缘项微调。
2. 看板首页/详情中等对比度问题清零并纳入 a11y 回归基线。
3. 功能候选：通知多时段免打扰、公开端邮件订阅、合并建议已合并来源展示。
4. 主 locale 冗余 key 清理（配合 parity 测试）。


### Round 12 — 2026-11-10（复制为 Markdown / 性能双口径 / CLS 清零 / smoke 41）

**本轮完成（Lead + 3 个 teammate 并行）**
- **反馈「复制为 Markdown」（Lead）**：新增纯函数 `buildFeedbackMarkdown`（标题/元信息/内容/回复/链接），
  详情页新增复制按钮（中英文案、Toast），3 条单测；Markdown 特殊多行内容保持原样。
- **看板首页 CLS 修复（teammate）**：CDP 帧级定位发现骨架 5 卡时 footer 在首屏内、数据到位后页高
  4500px 导致主位移；改为骨架 8 卡 + 统计骨架与最终 StatCell 完全等高 → 1440 CLS **0.093 → 0.000**，
  移动端 0，详情页 0.024 保持 ≤0.05。
- **perf 生产口径模式（teammate）**：`pnpm perf:prod`（`--mode=preview`）零依赖静态服务托 dist +
  `/api` 反代、端口冲突自动 +1、结束清理；报告区分 mode。生产基线 12/12 PASS：
  首屏传输 **94–309KB / 3–16 请求**（dev 口径 1.6–4.35MB / 31–83），FCP/LCP 76–256ms。
- **smoke 39 → 41（teammate）**：新增「更新日志关联反馈」链路（feedbacks 数组契约 + 关联/取消幂等，
  finally 兜底）与「通知免打扰静默丢弃」（保存/恢复原设置、全天窗口下 unread 不变、非法时间 400）。
- 过程发现并记录：dev 口径提交页 CLS 0.214 在 preview 未复现（dev 冷模块时序问题，Round 11 已修复
  且生产口径本就不受影响）。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **257/257**（server 230 + admin 27）✅、`pnpm build` 5 包 ✅、
  `pnpm lint` 0 error ✅、`pnpm smoke` **41/41 PASS**（29.5s）✅、`pnpm perf` dev 12/12 PASS ✅、
  `pnpm perf:prod` 12/12 PASS ✅
- CLS：看板首页 0.0002–0.0003（3 次复测）、看板详情 0.0245、移动端 0；提交页 0.000。

**提交**：`a03a443`（复制为 Markdown）、`f88e94b`（smoke 41）、`e026c07`（perf preview 模式）、
`29e0755`（看板 CLS）

**遗留 / 技术债**
- 看板详情残余 CLS 0.0245（骨架→内容页高变化），达标但可再优化。
- 关联更新日志前端一次最多取 100 条；DND 使用服务器时区；通知内容仍为服务端中文。
- admin index CSS ~79KB；smoke chrome.mjs 405 行可再拆。
- 未做系统化无障碍审计（焦点顺序/对比度/aria 覆盖率）。

**下一轮计划（Round 13：无障碍 + 打磨）**
1. 无障碍审计：新增 `scripts/a11y.mjs`（CDP 采集焦点顺序、可访问名称缺失、对比度、标题层级、
   表单 label 关联），覆盖后台关键页 + 公开端；修复发现的问题。
2. smoke 增加无障碍基础断言（按钮可访问名称、图片 alt、lang 属性）。
3. 看板详情 CLS 优化（骨架等高）。
4. 功能候选：通知多时段免打扰、合并建议展示已合并来源、更新日志 RSS 增强。


### Round 11 — 2026-11-10（前端测试基建 / 合并建议外的新功能 / 性能观测）

**本轮完成（Lead + 4 个 teammate 并行）**
- **前端单元测试基建（Lead）**：admin 引入 vitest（devDependency）+ vitest.config + 轻量浏览器全局 setup
  （无需 jsdom）；新增 7 个测试文件 24 条：labels / ISO 周序列 / API 错误本地化 / 相对时间 /
  审计标签 / markdown 工具 / **locale 一致性校验**（zh-en key 对齐、复数变体、插值占位符、空值）。
  `pnpm test` 现在同时跑 server 230 + admin 24。
- **反馈详情关联更新日志（teammate）**：`listChangelogs` include 并扁平化 `feedbacks:[{id,title}]`；
  详情页新增卡片（已关联列表/发布 badge/日期/展开摘要/取消关联）+「关联更新」Modal（搜索、排除已关联、
  点击关联）；detail 命名空间 +18 key。真实 API 实测 link/unlink 幂等行为。
- **通知免打扰时段（teammate，full-stack）**：`notification_settings.dnd {enabled,start,end}`（复用
  JSON，无迁移），`isWithinDnd` 左闭右开/支持跨午夜，fan-out 静默跳过命中收件人（仅站内通知）；
  设置接口校验非法时间；通知偏好卡新增开关 + 两个时间输入 + draft 保存 + 无效提示；13 条测试。
- **smoke 模块化（teammate）**：1848 行单文件 → 73 行入口 + 15 个职责模块（config/util/report/cli/
  chrome/lifecycle + 9 个 checks）；重构前后 39 项输出逐项 IDENTICAL，CLI/退出码/Chrome 管理不变。
- **性能观测脚本（teammate）**：新增 `pnpm perf`（零依赖 CDP，6 页面 × 2 视口 × 3 次中位数，
  FCP/LCP/CLS/DCL/Load/TTFB/资源体积，PASS/FAIL + 问题线索，JSON+MD 报告）。
  实测 11/12 组合 PASS，唯一 FAIL：提交页桌面 CLS 0.214。Lead 修复：校验期预留下单表单高度 →
  **CLS 0.214 → 0.000**，复测 12/12 PASS。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **254/254**（server 230 + admin 24）✅、`pnpm build` 5 包 ✅、
  `pnpm lint` 0 error ✅、`pnpm smoke` **39/39 PASS**（28.0s）✅、`pnpm perf` 12/12 PASS ✅
- CDP：关联/取消关联更新日志（zh/en/390/暗色）、DND 开启后提交不产生通知/关闭恢复、性能报告对比；
  全程 0 console error/exception。

**提交**：`1160d40`（前端测试基建）、`ef6034b`（关联更新日志）、`a12c94a`（通知免打扰）、
`ccc5929`（smoke 模块化）、`46677c6`（性能脚本）、`67939f9`（提交页 CLS 修复）

**遗留 / 技术债**
- 看板首页桌面 CLS 0.094（接近阈值 0.1），首屏卡片加载高度变化，可下一步用预留高度消除。
- 性能实测基于 Vite dev server，生产基线需对 `vite preview`/部署环境再跑（可作为发布检查）。
- 关联更新日志前端一次拉取最多 100 条 changelog；DND 按服务器时区；通知内容仍是服务端中文。
- smoke chrome.mjs 405 行可再拆；admin index CSS ~79KB 可继续拆分。

**下一轮计划（Round 12）**
1. 看板首页 CLS 修复（预留首屏卡片高度）+ 生产口径性能基线（vite preview 端口）。
2. 功能候选：反馈详情「复制为 Markdown」、通知免打扰按星期/多时段、合并建议展示已合并来源。
3. smoke 增加「关联更新日志」「免打扰」链路检查（复用 API 断言，不依赖 UI）。
4. 清理主 locale 中已迁移的冗余 key（配合 locale parity 测试防回归）。


### Round 10 — 2026-11-10（合并建议 / 邮件预览 / 错误本地化 / 性能与冒烟）

**本轮完成（Lead + 4 个 teammate 并行）**
- **相似反馈合并建议（全栈，teammate）**：`GET /admin/feedback/:id/similar` 基于标题 token
  （英文词 + 中文 2-gram）Jaccard/containment、内容 2-gram、同分类/同标签加成打分，阈值 0.2、
  top5、候选最近 500 且排除 deleted/merged/self/跨 org；合并弹窗搜索为空时展示建议（相似度 %、点击合并）；
  13 条单测。
- **邮件模板预览（全栈，teammate）**：`GET /org/system-config/email-preview?type=invite|reset|status|digest`
  用品牌模板渲染示例数据（无需邮件配置）；系统配置邮件卡新增预览 Modal（类型切换/主题行/sandbox iframe/
  加载错误重试）；8 条路由测试。Lead 顺手收敛实际发送路径：密码重置邮件与周报 job 改用共享模板
  （预览=实发）。
- **API 错误本地化（Lead）**：客户端在一处把稳定错误码翻译为当前语言（鉴权/权限/404/限流/网络/500），
  validation/conflict 保留服务端细节 + 本地化前缀；拆分 40101 无效凭证 / 40110 会话过期 / 40111 未激活；
  实测 en 登录失败显示 "Invalid email or password"。
- **首屏性能（teammate）**：Landing 拆为 copy.ts/icons/MockPanel/useScrollReveal，Landing.tsx
  1207→349 行，DOM 输出逐字一致；Landing 路由 lazy 加载 → 登录用户 index JS 476→447KB（-6.1%）、
  index CSS 106→79KB（-25.7%），登录首屏 raw -57KB / gzip -12.6KB。
- **冒烟扩展到 39 项（teammate）**：新增 i18n 切换（en↔zh + html lang + 侧边栏/命令面板英文断言）、
  移动端 390 三项交互（抽屉开/遮罩关、通知面板开/Esc 关、⌘K 跳转无溢出），总耗时 ~29s。
- 工程注记：本轮发现 Vite dev server 的模块 transform 缓存可能陈旧（client.ts 改动未生效），
  重启 admin dev server 后恢复；生产 build 不受影响。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **217/217** ✅、`pnpm build` 5 包 ✅、`pnpm lint` 0 error ✅、
  `pnpm smoke` **39/39 PASS**（28.2s）✅
- CDP：合并建议 zh/en/390/空态/成功合并；邮件预览四类型中英 iframe 渲染；en 错误文案；
  Landing 中英 1440/390 与拆分前 DOM 等价；移动端交互；0 console error/exception。

**提交**：`4f6f2a1`（合并建议）、`22fec2b`（邮件预览）、`ee43013`（错误本地化 + 模板收敛）、
`a3f2783`（Landing 拆分/lazy）、`e73320d`（smoke 39）、`1cef1cb`（测试对齐）

**遗留 / 技术债**
- 前端尚无单元测试（纯函数 weekSeries/labels/apiErrors/date 等可测）；建议引入 vitest 前端配置。
- 相似度算法：内容统一字符 2-gram、候选按时间倒序 500；可加 IDF/阈值调优。
- 通知面板固定 20 条；免打扰/按项目静音未做；服务端通知标题/正文仍为中文数据。
- smoke 单文件 ~1724 行，建议拆分模块；移动端未覆盖表单输入交互。
- admin index CSS 仍 ~79KB，可继续拆分 shell 样式。

**下一轮计划（Round 11）**
1. 前端单元测试基建：admin 引入 vitest（devDependency）+ 纯函数测试（labels/weekSeries/apiErrors/
   formatRelativeTime/auditLabels），纳入 `pnpm test`。
2. smoke 模块化拆分（scripts/smoke/）+ 移动端表单交互检查。
3. 功能候选：合并建议阈值/IDF 优化 + 建议显示已合并关系；通知免打扰时段；反馈详情「关联更新日志」。
4. 性能：admin shell CSS 拆分、Board/Submit Lighthouse 式指标采集（CDP 采集 LCP/FCP）。


### Round 9 — 2026-11-10（i18n 全站收尾：7 个命名空间并行落地）

**本轮完成（Lead + 7 个 teammate 并行，写作用域按命名空间隔离）**
- 新增 6 个 i18n 命名空间（`feedback`/`detail`/`settings`/`config`/`content`/`team`）+ 每语言 500+ key，
  i18n 基础设施支持 feature namespace；所有页面按命名空间接入 `useTranslation`，语言切换即时生效。
- **Lead**：shell（Layout/ShortcutHelp/CommandPalette/Dashboard/相对时间）、共享基元（Modal/Toast/
  Switch/SecretInput/MarkdownToolbar）、官网 Landing（EN/ZH 切换 + 完整英文营销文案）、
  Login/AcceptInvite 全英文；`<html lang>` 随语言切换；Dashboard 动态卡引号按语言切换。
- **teammates**：反馈列表 + 筛选/表格/批量条/分页（59+2 key）；反馈详情/合并/备注/编辑（83 key）；
  设置 4 页（222 key）；配置 4 页（162 key）；内容/审计 3 页 + auditLabels 语言感知（159 key）；
  团队/标签 2 页（90 key）。中英 key 对齐、插值/复数校验通过；en 复数（2 unread notifications 等）。
- 各页 CJK 硬编码残留清零；英文界面 1440/390 无横向溢出；0 console error/exception。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **196/196** ✅、`pnpm build` 5 包 ✅、`pnpm lint` 0 error ✅、
  `pnpm smoke` **35/35 PASS**（23.4s）✅
- 英文抽查：Landing、Dashboard、Feedback list/detail、Settings、Audit 等页面 UI 全英文、数据保持原语言；
  语言切换无刷新即时生效（各 teammate 均用 marker 验证）。
- 截图：`.tools/shots/i18n-*/`（notifications/import/feedback-list/feedback-detail/settings/config/
  content/team/public/shell），以及 Lead 的 `r9/` 抽查。

**提交**：`7e14858`（shell/公开页/共享基元）、`2f3d575`（feedback+detail）、`84da144`（settings+config）、
`a4f477b`（content+team）

**遗留 / 技术债**
- 服务端错误消息仍是中文（en 页面 API 失败时可能中文）；需后端错误码结构化后客户端映射。
- 通知标题/正文、审计 metadata、自定义分类/状态/标签名是服务端数据，不随语言切换。
- Landing.tsx 因页面内双语字典增至 ~1207 行，建议允许时拆 `pages/landing/copy.ts`。
- 部分页面（Login）复用主 locale 的 `login.*` key，若清理主 locale 需同步迁移。
- smoke 尚未覆盖 i18n 切换；移动端交互覆盖仍不足。

**下一轮计划（Round 10：工程质量 + 新功能）**
1. smoke 增加 i18n 语言切换检查（html lang + 侧边栏/关键页英文断言），移动端抽屉/弹层交互检查。
2. 后端错误结构化：统一错误码 → `errors` 命名空间映射，客户端 en/zh 提示一致。
3. 新功能候选：相似反馈合并建议（服务端文本相似度 + 详情页提示）、通知免打扰时段、
   邮件模板预览（系统配置内）。
4. 拆分 Landing copy、清理主 locale 冗余 key；性能复查（admin 首屏 chunk）。


### Round 8 — 2026-11-10（i18n：shell / 命令面板 / 通知 / CSV 导入）

**本轮完成**
- **i18n 基础设施**：i18n 支持 feature 命名空间（`notifications`、`importCsv`），新增
  `locales/{zh,en}/` 子目录；`formatRelativeTime` 改为语言感知（en: `8 min ago`）；
  `<html lang>` 随语言切换更新（en / zh-CN）。
- **Shell 与通用组件**：Layout（搜索触发、抽屉/主题/语言 aria、成员角色）、ShortcutHelp
  （全部快捷键说明）、CommandPalette（动作名/提示/分组/占位/空态/footer，关键词保留中英双语
  以支持混合搜索）全部接入 `t()`；Dashboard「最近动态」「分配给我」卡片同步。
- **通知中心 i18n**（teammate）：新增 `notifications` 命名空间 68 个逻辑 key（en 含复数形式），
  铃铛/面板/通知页/偏好卡/删除与清空确认/Toast/aria 全部本地化；语言即时切换无刷新；复数
  （2 unread notifications → 1 unread notification）正确；硬编码中文 0 残留。
- **CSV 导入 i18n**（teammate）：新增 `importCsv` 命名空间 50/52 个 key，弹窗所有文案、客户端校验
  错误、统计/Toast（英文复数）本地化；服务端中文 invalid_rows 通过模式映射为英文（未知原样）；
  弹窗打开时切换语言即时生效。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **196/196** ✅、`pnpm build` 5 包 ✅、`pnpm lint` 0 error ✅、
  `pnpm smoke` **35/35 PASS**（22.9s）✅
- CDP：zh/en 面板与通知页、清空 Modal、导入弹窗（含无效行/服务端错误映射）、⌘K 面板、Dashboard
  动态卡、相对时间英文；语言切换即时生效；en 下 390 无横向溢出；0 console error。
- key 校验脚本：通知命名空间引用 key 68 个，zh/en 缺失 0、未使用 0、插值不一致 0；导入命名空间同理。

**提交**：`472b658`（shell/palette/dashboard/time i18n）、`f2f423c`（通知 + CSV 导入命名空间）

**遗留 / 技术债**
- **后台其余页面仍有大量硬编码中文**（Landing 营销页有意中文优先；Login/Applications/Members/
  Tags/AuditLogs/Changelog/FeedbackList/FeedbackDetail/设置系列/Webhooks/Categories/Status/Notifications）。
- 服务端错误消息为中文（前端仅对已知错误做映射）；通知标题/正文是后端数据，英文界面下仍中文。
- smoke 单文件 ~1442 行；移动端只验证布局未验证抽屉/弹层交互。
- 通知面板固定 20 条；免打扰/按项目静音未做；分页边界小问题仍在。

**下一轮计划（Round 9：i18n 收尾 + 质量）**
1. i18n 落地：按页面命名空间并行拆分（`feedback`/`settings`/`team`/`content`），覆盖列表/详情/
   设置/成员/标签/审计/更新日志等剩余页面；Landing 保持中文优先但补英文切换。
2. smoke 拆分 `scripts/smoke/` 模块化 + 移动端交互检查（抽屉/弹层）。
3. 功能候选：相似反馈合并建议（服务端相似度 + 详情页提示）、通知免打扰、邮件模板预览。
4. 工程：服务端错误码→前端 i18n 映射表、审计/通知内容的结构化（type+params）以便翻译。


### Round 7 — 2026-11-10（通知删除/清空 / 图表懒加载 / 冒烟 35 项）

**本轮完成**
- **通知删除与清空（全栈）**：新增 `DELETE /org/notifications`（清空当前成员全部通知，service+测试）；
  前端通知面板与通知页支持单条删除（乐观更新、失败回滚、桌面 hover/focus 显示、移动端 36px 常显）、
  清空全部（Modal 二次确认 + Toast）；统一通知查询 root key，面板 / 通知页分页 / 未读角标三处缓存联动；
  顺手修复 390 宽行内徽标被挤成两行的问题。
- **Dashboard 图表懒加载（性能）**：recharts 从路由 chunk 拆出为 `TrendChart`/`SourceDonut` 异步 chunk，
  Dashboard chunk **393KB → 12.26KB**（recharts 312KB 独立异步，首屏先渲染骨架）；截图验证图表正常。
- **冒烟扩展到 35 项**：新增 API 统一信封契约、未认证 401、CSV 导入 dry-run→commit→清理链路、
  移动端 390 三页溢出检查（新增 setViewport），失败注入 exit 1，总耗时 23-26s。
- 数据卫生：清空回收站中累积的 58 条测试反馈（均为测试产物）；通知/反馈 demo 数据重新播种为真实感条目。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **196/196** ✅、`pnpm build` 5 包 ✅、`pnpm lint` 0 error ✅、
  `pnpm smoke` **35/35 PASS**（23.0s）✅
- 通知删除 CDP：2 条→删除 1 条→行数 2→1、角标同步、API 一致；清空全部有确认与空态；390/暗色通过。

**提交**：`00ed578`（图表懒加载 + 清空 API）、`2562f72`（通知删除 UI + smoke 扩展）

**遗留 / 技术债**
- **i18n 尚未覆盖 Round 3-7 新增界面**（通知中心/导入弹窗/Dashboard 动态卡/命令面板新动作等仍中文硬编码）。
- smoke 单文件 ~1442 行，需要拆分模块；移动端仅覆盖布局不覆盖抽屉/弹层交互。
- 分页边界：在第 2 页删除最后一条会停留在空列表（可后续自动回退上一页）。
- CSV 导入会写一条只读审计记录，smoke 跑多了审计里会有 `feedback.import` 累积（可接受）。
- 通知面板固定 20 条；免打扰时段/按项目静音未做。

**下一轮计划（Round 8）**
1. **i18n 补齐**（优先级最高）：新增页面/组件文案入 zh/en locale，移除硬编码中文，语言切换即时生效。
2. smoke 拆分：`scripts/smoke/` 目录（cdp client / checks / fixtures），保持 `pnpm smoke` 入口不变。
3. 移动端交互 smoke：侧边栏抽屉、通知面板、命令面板在 390 下可开可关。
4. 分页边界修复 + 通知「免打扰/按项目静音」评估。
5. 功能候选：相似反馈合并建议、邮件模板预览、公开路线图订阅提醒。


### Round 6 — 2026-11-10（CSV 导入 / 迁移基线 / 会话过期 / 冒烟写链路）

**本轮完成**
- **反馈 CSV 导入（全栈）**：`POST /admin/feedback/import`（dry_run 校验 + commit createMany
  source='import' + 审计 `feedback.import`）；管理端导入弹窗（文件/粘贴、RFC4180 解析、预览与错误行、
  模板下载、项目选择、成功刷新）；补 import 来源徽标与审计标签；14 条 service 测试。
- **Prisma 迁移基线修复（重要）**：用 `migrate diff --from-migrations --shadow-database-url` 生成
  `20261110040000_baseline_sync`，补齐历史 drift（invite_token/board_url/password_hash 可空等），
  `migrate resolve --applied` 修正本地历史；**已验证空库 `migrate deploy` 全绿且 schema diff 为空**；
  新增 `docs/MIGRATIONS.md` 记录流程与约定。
- **会话过期处理**：API 401 且有 token 时清理会话、触发 `auth:expired`；AuthProvider 登出、登录页
  展示「登录已过期，请重新登录」（修复 StrictMode 双渲染吞掉提示的问题）。
- **Widget demo 入库 + 冒烟扩展**：`packages/widget/demo`（宿主页 + 零依赖静态代理服务器），
  smoke 不再依赖 gitignored `.tools`；`pnpm smoke` 29 项（新增公开提交真实链路、通知 unread→read-all、
  ⌘K 动作跳转），全部带 try/finally 清理。
- **通知可删除**：`DELETE /org/notifications/:id`（成员归属校验）；smoke 用其清理自身产生的通知，
  实测重复跑不积累脏数据（运行前后通知数一致）。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **195/195** ✅、`pnpm build` 5 包 ✅、`pnpm lint` 0 error ✅、
  `pnpm smoke` **29/29 PASS**（20.8s，exit 0）✅
- 迁移：空库 deploy 12 个迁移全绿；主库 `migrate status` → up to date；fresh diff 为空。
- CSV 导入 CDP 端到端：错误行预览 → 修正 → 导入成功 Toast → 列表刷新 → 清理；390 弹窗无溢出。
- 会话过期 CDP：伪造 token 打开 dashboard → 自动回登录页并显示过期提示。
- 冒烟副作用核对：运行前后 `notification` 数与活动 `[SMOKE]` 反馈数为 0 差异。

**提交**：`7447082`（CSV 导入）、`b09685e`（widget demo + smoke + 通知删除）、`a145466`（会话过期 +
迁移基线）、以及本轮 log。

**遗留 / 技术债**
- 通知页尚无「删除单条/清空全部」UI（API 已有 DELETE，前端未接）；回收站测试数据未硬删。
- smoke 单文件 ~1200 行，后续可拆 CDP 客户端/检查模块。
- 后台新页面（通知中心、导入弹窗、dashboard 动态卡）仍有中文硬编码，i18n 未全覆盖。
- 导入不触发 webhook/通知（有意），后续可按批量策略提供开关。
- admin 首次加载 386KB / Dashboard 393KB（recharts），可继续优化图表按需加载。

**下一轮计划（Round 7）**
1. 通知中心收尾：列表项删除、全部清空（复用 DELETE API）+ 通知页 i18n；回收站彻底清理入口。
2. i18n：把 Round 3-6 新增页面文案接入 zh/en（通知中心、导入、动态卡、命令面板新动作）。
3. 性能：Dashboard 图表动态加载/骨架、admin 构建 chunk 分析，公开端图片/字体优化。
4. 冒烟拆分与扩展：API 契约检查（响应包裹结构）、CSV 导入链路、移动端 390 检查项。
5. 功能候选：合并建议（相似反馈检测）、邮件模板预览、看板路线图订阅提醒。


### Round 5 — 2026-11-10（通知偏好 / RSS / 冒烟门禁 / 快捷筛选）

**本轮完成**
- **通知偏好（全栈）**：`member.notification_settings` JSON 列 + 增量迁移；通知 fan-out 时按类型过滤
  （缺省全开，向后兼容）；`GET/PUT /org/notifications/settings`（成员级、校验类型与布尔值）；
  通知页新增「通知偏好」卡（共享 Switch 四类开关，乐观更新）；5 条新 service 测试。
- **反馈列表「分配给我」快捷筛选**：工具栏一键 chip（aria-pressed、激活态高亮），与负责人筛选联动。
- **公开看板 RSS 订阅**（teammate board-seo）：`GET /api/v1/public/:slug/changelog.rss`（RSS 2.0，
  仅已发布且到时间的最多 20 条、XML 转义、Markdown 转纯文本、RFC822 时间、看板链接基址解析）；
  board 更新日志页头「RSS 订阅」入口 + 条目锚点；2 条路由测试。
- **端到端冒烟门禁**（teammate public-polish）：`scripts/smoke.mjs`（零依赖、Node 内置 WebSocket 实现
  最小 CDP、可自动起停 headless Chrome）；`pnpm smoke` 覆盖 26 项（API 2 + 公开端 6 + 后台 18），
  全绿 16.3s，截图落 `.tools/shots/smoke/`；用法写入 `DEVELOPMENT.md`。
- 清理了迭代过程中产生的测试反馈/通知，demo 数据保持干净（29 条活跃反馈，含 1 条真实感新反馈）。

**验证**
- `pnpm typecheck` ✅、`pnpm test` **180/180** ✅、`pnpm build` 5 包 ✅、`pnpm lint` 0 error ✅、
  `pnpm smoke` **PASS 26 / FAIL 0 / SKIP 0** ✅
- 通知偏好实测：关闭「新反馈」后公开提交不产生通知，重新开启后恢复；UI 开关 aria-checked/状态文字/API 持久化通过。
- RSS 实测：`Content-Type: application/rss+xml; charset=utf-8`、`[xml]` 解析通过、3 条 item、未知 slug 404 JSON。
- 冒烟失败注入（错误 API 端口）exit 1、widget demo 缺失时 SKIP 且 exit 0（门禁语义正确）。

**提交**：`417c0cd`（通知偏好+快捷筛选）、`bef54a9`（RSS）、`f39e898`（smoke 套件）

**遗留 / 技术债**
- Prisma migration 历史 baseline 仍未整理（drift 存在，本轮继续用 diff+execute；生产 deploy 需先处理）。
- 冒烟未覆盖写操作（提交反馈、通知已读、命令面板动作）与登录过期场景（401 不会自动登出）。
- widget demo 依赖 gitignored `.tools/`，clean checkout 会 SKIP；建议内置最小宿主页。
- 通知偏好目前只支持「类型开关」，不支持按项目静音/免打扰时段。
- 布局与文案在新功能处仍为中文硬编码（i18n 覆盖不完全），后续统一。

**下一轮计划（Round 6）**
1. Prisma migration baseline 整理（shadow DB 生成 baseline + `migrate resolve`，先备份 DB；文档化流程）。
2. 扩展 smoke：写操作流程（公开提交→后台看到→标记已读→命令面板执行）、token 过期后 401 处理/引导重登。
3. widget demo 宿主页入库（`packages/widget/demo/`）让 CI 冒烟可覆盖 Widget。
4. 功能候选：CSV 导入（预览+校验+错误报告）、通知免打扰/按项目静音、邮件模板预览。
5. 工程：API 响应类型收口（admin 端手写类型 vs server 共享）、i18n 补齐新页面文案。


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
