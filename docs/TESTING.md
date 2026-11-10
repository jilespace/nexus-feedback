# 测试与验收标准

## 测试理念

测试要表达行为背后的业务意图。删掉关键业务规则后仍然通过的测试，是弱测试。

优先直接测试纯逻辑：校验、payload 构造、状态流转、存储决策。能用小单元
验证的规则，不要为了它启动完整应用。

## 必须提供的根目录命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

如果某个命令没有运行，不能说“测试通过”；必须明确说明跳过原因。

## 质量门禁命令（当前项目）

一键执行基础校验（类型 + 代码风格 + 单测 + 构建）：

```bash
pnpm verify
```

一键执行界面/运行时校验（需要本地服务与 Chrome 9222 或自动启动）：

```bash
pnpm verify:ui
```

`verify:ui` 依次执行：

| 命令 | 覆盖内容 |
|---|---|
| `pnpm smoke` | 52 项端到端冒烟：公开端/后台页面渲染、API 契约、写操作链路（提交、CSV 导入、订阅、静音、DND、已保存视图）、i18n 切换、移动端 390、无障碍基础断言；写操作自清理 |
| `pnpm a11y:check:themes` | 亮色 + 暗色无障碍审计门禁（严重/中等均为 0，退出码 1 表示回退） |
| `pnpm a11y:interactions:check` | 键盘交互门禁：Modal/命令面板/看板提交弹窗焦点陷阱、Esc、焦点恢复 |
| `pnpm perf` | 公开端性能采样（dev 口径）：FCP/LCP/CLS 等，12 个「页面 × 视口」组合 |

补充命令：

| 命令 | 用途 |
|---|---|
| `pnpm a11y` / `pnpm a11y:check` | 只审计/门禁亮色（medium 阈值） |
| `pnpm a11y:check:themes` | 亮暗双主题门禁（medium 阈值） |
| `pnpm perf:prod` | 生产口径性能基线（构建产物 + 静态服务 + API 代理），数据记录见 `docs/PERF_BASELINE.md` |
| `pnpm --filter @nexus-feedback/server exec prisma migrate status` | 迁移状态（应为 up to date） |

单测分布（`pnpm test` 递归执行）：

- `server`：264+ 条（服务、路由、中间件、迁移相关行为）
- `admin`：30 条（纯函数 + locale parity 校验）
- `board`：8 条（URL 筛选解析）

## 单元测试约定

- 服务端：Vitest，位于 `packages/*/src/**/__tests__/*.test.ts`；
  外部依赖（Prisma、邮件、HTTP）以 `vi.mock` 隔离。
- 管理端/看板：Vitest + 轻量浏览器全局 stub（无 jsdom），
  新增纯工具（formatter、parser、i18n 映射）必须同时提交测试。
- i18n：`locale-parity.test.ts` 保证各命名空间 zh/en key 对齐、插值占位符一致、无空值；
  新增文案时先加 locale 再写组件。

## 冒烟约定

- 所有写操作必须 try/finally 清理（软删除测试反馈、恢复设置、清理通知/订阅）；
- 新检查项追加在既有项之后，保持既有项名称与顺序不变（避免门禁差异噪音）；
- 失败注入（错误 API 端口）必须仍以退出码 1 结束。

## M1 验收测试

服务端：

- `GET /api/v1/health` 返回 `code: 0`。
- 不带 `X-API-Key` 提交反馈返回 `40100`。
- 无效 API Key 返回 `40101`。
- 空 `title` 返回 `40001`。
- 不支持的 `category` 返回 `40001`。
- 合法反馈创建后状态为 `open`，并绑定由 Project API Key 推导出的 `project_id`。

业务规则：

- `closed` 反馈不能再流转到其他状态。
- `resolved` 反馈可以回到 `in_progress`。
- 客户端提交的 `project_id` 被忽略或拒绝；归属只来自 Project API Key。

管理端：

- 管理端接口拒绝 Project API Key。
- 管理端接口缺失或过期 JWT 时返回 `40110`。
- 反馈列表默认按 `created_at desc` 排序。
- 分页响应包含 `items`、`page`、`page_size`、`total`。

上传：

- 超过 `MAX_FILE_SIZE` 返回 `41300`。
- 不支持的 MIME 类型返回 `41500`。
- 上传响应包含 `id`、`url`、`filename`、`size`、`mime_type`。

## UI 验收

管理后台：

- 20 行以上反馈列表仍然可扫描，不显得空或散。
- 筛选状态清晰可见，并且可以一键重置。
- 详情视图展示状态、分类、优先级、联系方式、metadata、附件和回复。
- 状态变更有成功和失败反馈。

Widget：

- 打开、提交、成功、字段校验错误、上传错误、重试状态都必须存在。
- Widget 不破坏宿主页布局。

## 无障碍与性能验收

- a11y：亮色/暗色审计「严重 / 中等」均为 0；键盘交互（焦点陷阱、Esc、焦点恢复）通过。
- 性能：`pnpm perf` 12 组合全部 PASS（FCP ≤1.8s、LCP ≤2.5s、CLS ≤0.1）；
  生产口径基线见 `docs/PERF_BASELINE.md`，回归时对比同一口径数据。
- 错误码：新增错误码需登记到 `docs/ERRORS.md` 并补测试。
