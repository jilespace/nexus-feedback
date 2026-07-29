# 项目状态

## 当前阶段

Nexus Feedback 已进入可运行实现阶段。当前仓库包含后端、管理后台、公开看板、
Widget 和公开提交页源码，不再是纯设计文档阶段。

当前架构正在收敛到 Project Only 模型：`Project` 是唯一反馈归属和 API Key
主体，旧的独立 `Application` 概念只作为历史模型存在于早期迁移记录中。

## 当前已有内容

- `packages/server`：Express + Prisma API 服务。
- `packages/admin`：React 管理后台。
- `packages/board`：公开反馈看板。
- `packages/widget`：可嵌入反馈 Widget。
- `packages/submit-page`：公开反馈提交页。
- `docs/*`：API、认证、数据规则、运行、测试、部署和接入契约。

## 当前验收基线

- 根目录提供 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- `packages/server` 暴露 `GET /api/v1/health`。
- 外部反馈提交通过 Project API Key 推导 `project_id`。
- 所有 API 使用统一响应包裹格式。
- `pnpm test:e2e` 目前只是根命令占位；没有包定义真实 e2e 脚本时，不能把它算作通过。

## 文档同步规则

如果实现与文档冲突，必须在同一次变更中更新文档。不要留下与真实代码矛盾的
设计草案。
