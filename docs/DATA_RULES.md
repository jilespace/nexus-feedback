# 数据与业务规则

## 枚举

反馈分类：

- `bug`
- `feature`
- `performance`
- `ui`
- `other`

优先级：

- `low`
- `medium`
- `high`
- `critical`

状态：

- `open`
- `in_progress`
- `resolved`
- `closed`

API 和数据库统一使用这些英文枚举值。UI 可以展示中文或其他本地化标签。

## 状态流转

允许的流转：

| 当前状态 | 可流转到 |
|---|---|
| `open` | `in_progress`, `closed` |
| `in_progress` | `resolved`, `closed` |
| `resolved` | `in_progress`, `closed` |
| `closed` | 无 |

对 `closed` 反馈继续改状态时，API 返回 `40900`。

## 反馈归属

- 每条反馈必须属于一个 project。
- project 从提交请求的 Project API Key 或公开看板 slug 推导。
- 客户端不能直接提交 `project_id` 覆盖归属。
- 管理端列表和详情可以展示 project 摘要信息。

## 联系方式

`contact` 可选，可以是邮箱、账号、手机号或其他简短联系方式。v1 不强制
email-only，除非产品需求后来明确收紧。

## 元数据

`metadata` 可选，用于保存低风险客户端上下文，例如：

- `page_url`
- `user_id`
- `user_agent`
- `app_build`
- `locale`

metadata 的值应为 JSON 基础类型或基础类型数组。不要允许很深或很大的嵌套
对象，避免 payload 不可控。

## 附件

- 每条反馈最多关联 5 个附件。
- 附件先上传，再在提交反馈时引用。
- 提交反馈时必须校验 attachment id 属于同一个 project。
- 未绑定反馈的附件 24 小时后清理。

## 回复

- 回复由管理员创建。
- v1 回复只作为管理端内部记录，不对提交用户公开。
- `closed` 反馈不能新增回复。

## 删除

v1 不提供常规用户侧删除反馈接口。

如果后续为了后台清理或隐私请求需要删除，优先实现软删除：

- 增加 `deleted_at`。
- 普通列表和详情隐藏已删除数据。
- 除非法律删除要求硬删除，否则保留审计能力。
