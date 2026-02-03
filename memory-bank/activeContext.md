# Active Context

> **Last Updated**: 2026-02-03
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Double Rate Limits for Normal Workflow (Completed)

**Status**: Completed. No code behavior changes besides new limits.

### Change Implemented
- **Rate limits doubled**: 600 read / 240 write per 15 min across backend packages
- **Metahubs documentation updated**: comments and log message reflect new limits

### Key Files Changed
- 8 backend packages `routes/index.ts` - updated `maxRead` and `maxWrite`
- `packages/metahubs-backend/base/src/domains/router.ts` - updated limits, comments, log message

### Next Step
User testing to confirm 429 errors are resolved.

---

## Previous: Supabase Connection Pool Optimization (Completed)

Pool sizes reduced (TypeORM 5 + Knex 5), pool diagnostics added, and rate limits increased (see progress.md for details).

---

## Previous: Display Attribute UX Fixes Round 2 (Completed)
