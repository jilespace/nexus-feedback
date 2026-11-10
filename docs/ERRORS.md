# 错误码与错误处理

本文档描述 Nexus Feedback API 的错误响应格式、错误码分配规则，以及管理端如何把这些错误本地化展示。
适用于前后端联调、客户端接入与排障。

## 1. 响应格式

所有接口（含错误）都返回统一信封：

```json
{
  "code": 0,
  "data": { "…": "…" },
  "message": "ok"
}
```

- 成功：`code === 0`，`data` 为业务数据。
- 失败：`code` 为下表错误码，`data` 恒为 `null`，`message` 为可读说明（服务端语言为中文）。
- HTTP 状态码与错误码一一对应（见下表），**客户端应同时判断 HTTP 状态与 `code`**。

服务端统一出口位于 `packages/server/src/middleware/error.ts`：`AppError` 子类直接映射；
Prisma 已知错误（P2002 唯一约束、P2003 外键、P2025 未找到）转换为 40900 / 40002 / 40400；
其余未捕获异常统一 50000，日志中会输出 `Unhandled error` 与堆栈。

## 2. 错误码总表

| code | HTTP | 含义 | 典型场景 | 管理端 i18n key |
|---|---|---|---|---|
| 40001 | 400 | 参数校验失败 | 字段缺失/非法格式/越界，消息通常带字段细节 | `errors.validation`（保留服务端细节并加本地化前缀） |
| 40002 | 400 | 关联数据不存在 | 引用的项目/成员/反馈不存在（Prisma P2003） | `errors.validation` |
| 40100 | 401 | 未认证 | 缺少令牌 / 未登录访问受保护接口 | `errors.unauthenticated` |
| 40101 | 401 | 凭证无效 | 登录邮箱或密码错误、API Key 无效 | `errors.invalid_credentials` |
| 40110 | 401 | 会话无效或过期 | 令牌类型错误、验签失败、已过期 | `errors.invalid_session` |
| 40111 | 401 | 账号未激活 | 被邀请成员尚未设置密码 | `errors.account_not_activated` |
| 40300 | 403 | 权限不足 | 非 owner/admin 执行受限操作 | `errors.forbidden` |
| 40400 | 404 | 资源不存在 | 路由不存在、按 id 查询未命中、P2025 | `errors.not_found` |
| 40900 | 409 | 状态冲突 | 唯一约束冲突、重复订阅/重复关联、幂等冲突 | `errors.conflict` |
| 41300 | 413 | 文件过大 | 上传超过限制 | `errors.file_too_large` |
| 41500 | 415 | 不支持的文件类型 | 上传 MIME 校验失败 | `errors.unsupported_file` |
| 42900 | 429 | 尝试次数过多 | 登录/找回密码等敏感操作限流 15 分钟或 1 小时 | `errors.too_many_attempts` |
| 42901 | 429 | 请求过于频繁 | 通用接口限流 | `errors.rate_limited` |
| 42902 | 429 | API Key 限流 | 公开 API（feedback/widget）超限 | `errors.rate_limited_api` |
| 50000 | 500 | 服务器内部错误 | 未捕获异常 / 数据库不可用 | `errors.internal` |

补充约定：

- 错误码按「HTTP 类别 + 序号」分配：`4xxyy` 对应 HTTP 4xx，`50000` 为通用 5xx；
  新增错误码时保持该规律并在本文档登记。
- 校验类错误（40001/40900）的消息包含具体字段/原因，前端本地化时保留原文细节
  （例如 `Validation failed: 无效的分类: xxx`），避免丢失定位信息。
- 40110 与 40101 语义不同：前者表示「当前会话失效」（应提示重新登录），
  后者表示「本次登录凭证错误」（应停留在登录页并提示账号密码问题）。

## 3. 管理端本地化策略

实现位于 `packages/admin/src/utils/apiErrors.ts` 与 `packages/admin/src/api/client.ts`：

1. `apiRequest` 在收到 `code !== 0` 时，先按 `code` 查本地化表，再抛出 `ApiError(code, message, status)`。
2. `GENERIC_CODE_KEYS`（鉴权、权限、404、限流、文件、5xx）直接替换为当前语言的通用文案。
3. `DETAILED_CODE_KEYS`（40001、40900）输出「本地化前缀 + 服务端细节」，中英文冒号按语言区分。
4. 未知错误码回退服务端 `message`；网络失败统一转为 50000 + `errors.network`。
5. 页面统一 `catch (err) → toast(err.message)` 即可获得当前语言文案；
   不再需要在每个页面重复判断 `code`。

对应 i18n 文案位于主 locale 的 `errors.*`（zh/en 各 14 条，locale-parity 测试保证一致）。

## 4. 新增错误码的检查清单

- 在 `packages/server/src/utils/errors.ts` 使用对应错误类（或 `new AppError(status, code, message)`），
  避免裸 `res.status(4xx).json`。
- 在本文档错误码总表登记 `code`、HTTP 状态、含义与典型场景。
- 如属于通用失败类别，在 `packages/admin/src/utils/apiErrors.ts` 增加映射，
  并在主 locale 的 `errors.*` 添加 zh/en 文案（保持 key 与插值一致）。
- 补充路由/服务测试（成功、失败、边界），并在 PR/提交信息中说明错误码变化。

## 5. 客户端接入建议

- 依据 HTTP 状态分类处理：401 跳转登录、403 提示无权限、429 提示稍后再试、5xx 提示重试。
- 展示 `message` 前优先使用 `code` 做程序化分支；`message` 仅用于展示与日志。
- 幂等写操作（订阅、关联更新日志、标记已读）在 409/404 时应视为可恢复状态，
  例如「已存在」提示成功、「已删除」提示刷新。
