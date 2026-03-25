# Database backups and recovery

## Supabase (typical for this project)

1. In **Supabase Dashboard → Database → Backups**, confirm **Point-in-Time Recovery (PITR)** or daily backups match your plan.
2. **Restore drill (do once per quarter):** restore a backup to a **branch** or staging project and run `pnpm --filter @geeklogs/api exec prisma migrate status` against the restored URL to verify schema compatibility.
3. Document who can trigger restore and your RPO/RTO targets in your internal runbook.

## Prisma migrations

- Production deploys should run `prisma migrate deploy` (or your host’s equivalent) against the **primary** database URL, not the pooler if migrate docs require direct connection.

## Related

- Row Level Security and Supabase: [`../supabase-security.md`](../supabase-security.md) (if present in repo).
