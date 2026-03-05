# Active Context

> **Last Updated**: 2026-03-04
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Sets/Constants Stabilization + SemVer Alignment — Completed

**Status**: ✅ Completed  
**Date**: 2026-03-04  
**Scope**: Final runtime stabilization for Sets/Constants UI + migration/versioning behavior after QA.

### Finalized in this cycle

1. **Sets/Constants UI correctness**
   - Fixed namespace usage on Sets/Constants screens to avoid raw i18n keys (`useTranslation('metahubs')`).
   - Kept breadcrumbs for `/metahub/:id/sets` and `/metahub/:id/set/:setId/constants` aligned with catalogs behavior.
   - Confirmed constants table footer pagination + spacing parity with attributes list.
2. **Mutation responsiveness**
   - Hardened constants mutation invalidation (`invalidateQueries` + `refetchQueries`) with awaited async flow.
   - Reduced perceived delay after create/copy/update/delete/reorder in constants list.
3. **Versioning consistency**
   - SemVer baseline remains `0.1.0` across branch/template contracts and runtime checks.
   - Fresh branch/template sync logic stays aligned with one active structure baseline (no intentional V2 drift).
4. **Build/runtime safety**
   - Removed direct `@universo/metahubs-frontend/i18n` import from template routes to avoid circular self-resolution in tests.
   - Rebuilt `@universo/template-mui` so `dist` reflects updated route imports used by `metahubs-frontend` tests.
5. **Environment finding (UP-test)**
   - Supabase `UP-test` still contains legacy DB state (`structure_version`/`min_structure_version` are `integer`, active basic template version is `1.0.0`, branch row with `structure_version = 2`).
   - This state can still force migration-required UX even with corrected code; DB must be reset or migrated to the new SemVer schema baseline.

### Immediate Next Steps

1. Run focused QA in UI against a freshly initialized DB/schema baseline (`0.1.0`).
2. If `UP-test` remains in use, execute a controlled DB alignment migration/reset before next validation cycle.
