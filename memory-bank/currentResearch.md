# Current Research

## RLS QueryRunner freeze investigation (2026-01-11)

### Observations
- UI can appear to “freeze” after create operations until server restart; server logs show repeated RLS middleware activity (QueryRunner create/connect).

### Code audit (createQueryRunner call sites)
- `@universo/auth-backend`: `ensureAuthWithRls` creates a per-request QueryRunner and releases it on response completion.
- `@universo/auth-backend`: `permissionService` creates a QueryRunner only when one is not provided; releases it in `finally`.
- `@flowise/core-backend`: export/import uses QueryRunner with explicit connect + transaction and releases in `finally`.

### Current hypothesis
- The freeze is likely caused by pooled connection contention (too many concurrent requests each holding a per-request QueryRunner) or an edge-case where cleanup/release does not run.
- The middleware cleanup is now guarded to run once per request to reduce cleanup races.