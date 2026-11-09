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

**验证**
- `pnpm --filter @nexus-feedback/admin typecheck` ✅
- `pnpm --filter @nexus-feedback/admin build` ✅（chunk 890KB 偏大，待 code-splitting）
- 截图（.tools/shots/v2）：dashboard、feedback list、feedback detail 1440/390、明暗两套，控制台 0 异常。
- `pnpm --filter @nexus-feedback/server typecheck` ✅

**已知问题（承接自上一提交，非本轮引入）**
- server 测试 7 个失败 / 159：`organization.test.ts` inviteMember ×3（代码要求先配置邮件服务）、
  `auth.test.ts` adminAuth 接受 org token、`boardConfig.test.ts` widget-config PUT ×2、
  `routes/feedback.test.ts` upload 归属 ×1。需在后续「测试修复轮」逐一对齐。
- 后台仍有大量页面未做视觉升级（changelog/applications/members/tags/audit-logs/settings 系列/表单弹窗）。
- 暗色模式只验证了 dashboard/list/detail；其余页面需要逐页检查 surface token 生效后的对比度。

**下一步（按优先级）**
1. 合并并验收 3 个 teammate 的公开端改造（board / submit+widget / landing+login），修回归。
2. 管理后台剩余页面逐页升级（从 Changelog、Applications(项目接入)、Members、Tags、AuditLogs 开始）。
3. 全站暗色模式审计 + 移动端审计（390 宽每页截图，无横向溢出）。
4. 动效与可访问性：页面切换动效、focus 顺序、弹窗 focus trap、图标按钮 aria-label。
5. 功能增强候选：命令面板（⌘K）、通知中心、反馈详情内联编辑、看板公开页分享卡片、
   CSV/JSON 导入、邮件模板预览、性能（admin 代码分割）。

---

## 本地环境与验证工具

- 服务：admin 8080、submit 8081、board 8082、API 3000（dev 模式限流已放大）。
- 演示组织：`demo`（Demo Org），账号 `admin@nexus.dev / admin123`；演示项目 `demo-project`。
- 登录态截图：`%TEMP%\nexus_session.json` 由 `/api/v1/org/login` 生成。
- 截图工具：`node .tools/cdp-shot.mjs '{"url":"...","out":"...","width":1440,"height":900,"full":true,"scroll":true,"authFile":"%TEMP%\\nexus_session.json","origin":"http://localhost:8080","dark":false,"mobile":false}'`
  （无头 Chrome CDP 9222；.tools 已 gitignore）
- 演示数据脚本：`.tools/seed-demo-data.mjs`（仅用于 demo 项目，幂等性：会追加数据，慎重复跑）。
