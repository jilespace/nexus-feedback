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
