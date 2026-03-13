# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: PR #721 Review Remediation

- Date: 2026-03-13.
- Status: applying bot-review fixes from PR #721 (System App Structural Convergence).
- Scope: address validated review comments from Copilot and Gemini Code Assist bots.

## Fixes Applied

1. **authProvider.tsx**: replaced bare `process.env.NODE_ENV` with `isDevelopment()` to avoid Vite browser ReferenceError.
2. **localesStore.ts**: added `_upl_created_at` key to SORT_WHITELIST so the Zod-validated `sortBy` value maps correctly.
3. **MetahubBranchesService.ts**: added `_upl_deleted = false AND _app_deleted = false` to the LEFT JOIN on `profiles.cat_profiles` in `getBlockingUsers()`.
4. **systemPatterns.md**: relocated the misplaced "Why" block from Explicit RETURNING pattern back to Repeated-Startup Fast-Path Pattern.
5. **activeContext.md**: compressed to ≤150 lines (was 215) per memory-bank rules.

## Review Comments Dismissed (With Justification)

- **connectorsStore.ts double assignment**: `softDeleteSetClause()` does NOT include `_upl_version` — no duplication exists.
- **createApplicationsServiceRoutes breaking change**: internal monorepo function, caller already updated — no external breaking change.
- **tsconfig.json path mappings to dist/**: valid architectural suggestion for future improvement, not a bug for this PR.

## Operational Posture

- The System App Structural Convergence wave is complete.
- All previous completed waves are documented in `progress.md`.
- Active tasks and follow-up checklists are in `tasks.md`.
- Keep converged system app definitions, manifest-only migration loading, and relocated application sync routes stable.
- Prefer shared-layer fixes when regressions originate in root confirm infrastructure, shared table behavior, or request-scoped database seams.

## Constraints

- Branch schemas `mhb_<uuid>_bN` intentionally keep `_mhb_*` fields.
- Dynamic application schemas `app_<uuid>` intentionally keep `_app_*` fields.
- Fixed application-like system schemas are the only target of the convergence.
- Monolithic fixed-schema SQL definitions remain reference parity contracts, not the active bootstrap source.

## Working Rules For Next Reopen

- Reproduce first with live repeated startup or concrete route path.
- Verify snapshot shape at the read boundary before changing migrator behavior.
- Finish with focused tests, touched lint/build, full root build, and health check.

## References

- Progress details: `memory-bank/progress.md`.
- Active tasks: `memory-bank/tasks.md`.
- Architecture patterns: `memory-bank/systemPatterns.md`.
