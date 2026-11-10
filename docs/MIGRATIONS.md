# 数据库迁移说明

## 现状

`packages/server/prisma/migrations` 中的迁移历史与 `schema.prisma` 已对齐。当前共 **14** 个迁移
（最新为 `20261110110000_notification_params`），`prisma migrate status` 在本机数据库上输出
**Database schema is up to date!**，并且已验证：空数据库从零执行 `prisma migrate deploy`
可以完整建出与 `schema.prisma` 一致的库（无 drift）。

> 升级已部署环境时请使用 `prisma migrate deploy`（只执行未记录迁移）。
> 若线上库是早期 `db push` 演进而来、`20261110040000_baseline_sync` 处于 pending，
> 需先确认相关列已存在，再 `prisma migrate resolve --applied 20261110040000_baseline_sync`；
> 详细步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md) 的「升级已部署环境」。

### 历史说明

仓库早期曾直接使用 `db push` 演进数据库，导致三个迁移在一段时间内未记录到
`_prisma_migrations`，另有部分列（`member.invite_token*`、`organization.board_url` 等）
只存在于数据库而没有迁移文件。Round 6 已通过以下方式补齐：

1. 用 `prisma migrate diff --from-migrations ... --to-schema-datamodel ... --shadow-database-url ...`
   生成补齐 drift 的基线迁移 `20261110040000_baseline_sync`（仅包含缺失的列与可空性）。
2. 对已存在的数据库执行 `prisma migrate resolve --applied <migration>`，把补齐的迁移记录为已应用。
3. 在影子数据库上从零 `migrate deploy` 验证，再做一次 schema diff，结果为空。

## 常用命令

```bash
# 本地开发应用迁移（会生成 client）
pnpm --filter @nexus-feedback/server exec prisma migrate dev

# 生产/CI：仅应用已有迁移（不生成、不改 schema）
pnpm --filter @nexus-feedback/server exec prisma migrate deploy

# 查看状态
pnpm --filter @nexus-feedback/server exec prisma migrate status
```

## 新增迁移的约定

1. 修改 `packages/server/prisma/schema.prisma`。
2. `prisma migrate dev --name <描述>`（会生成迁移文件并应用）。
3. 若因权限/环境无法用 `migrate dev`，可用：
   ```bash
   prisma migrate diff \
     --from-url "$DATABASE_URL" \
     --to-schema-datamodel prisma/schema.prisma \
     --script > prisma/migrations/<timestamp>_<name>/migration.sql
   prisma db execute --file <上面的文件> --url "$DATABASE_URL"
   prisma migrate resolve --applied <timestamp>_<name>
   ```
   `migrate resolve` 只写入历史记录，**不会**执行 SQL；务必先执行 SQL 再 resolve。
4. 迁移只允许增量变更（新增列/表/索引）；删除列或改类型需要单独评估数据影响。
5. 提交前确认 `prisma migrate status` 无待应用迁移，且本地 `schema.prisma` 能通过
   `prisma validate`。
