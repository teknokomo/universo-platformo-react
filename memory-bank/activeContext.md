# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: Memory Bank Compression (2026-05-23)

- Running comprehensive MB compression to optimize file sizes and information density.
- Archiving older tasks and detailed implementation progress into the historical log (`progress.md`).
- Updating the GitHub releases version history table to include `0.63.0-alpha` and `0.64.0-alpha`.
- Following the structured sequential phase checklist defined in `tasks.md` and custom modes.
- Validating cross-references, file structure, and factual freshness.
- Post-compression: perform the 12-point self-validation rubric scoring to ensure target ranges are met without over-compression.
- Ensure that `activeContext.md` contains at least 120 lines to satisfy its 80% upper bound rule.
- Current constraints dictate that all historical implementation summaries (anything > 1 week old) be moved completely to `progress.md`.

## Recent Focus: Object Collections And Components Rename (Complete)

- Replaced Catalogs/Attributes with Objects/Components across UI and metadata.
- Internal surface/helper name is `objectCollection`, persisted kind key is `object`.
- System metadata tables updated to `_mhb_components` and `_app_components`.
- Runtime physical table names come from constructor capabilities (`obj_` prefix).
- Recommended vocabulary: user-facing `Objects` / `Объекты`.
- Details: progress.md#2026-05-14

## Recent Focus: Local Supabase Env Profile Generation (Complete)

- Local Supabase env generation derives backend profiles from normal env source order.
- Development source order: `packages/universo-core-backend/base/.env`, `.env.example`, minimal fallback.
- E2E source order: `.env.e2e`, `.env`, `.env.e2e.example`, `.env.example`, fallback.
- Preserves unrelated application settings, replaces only connection values and safe missing defaults.
- README and GitBook docs describe preserved-settings workflow, hosted/local switching, and local E2E stack.
- Details: progress.md#2026-05-13

## Recent Focus: Scoped Menu Contract & Layouts QA Closure (Complete)

- Menu widget authoring uses neutral `section`, `hub`, and `link` item kinds.
- Entity section targets discovered from layout-capable Entity type metadata.
- Shared schemas, templates, and fixtures use `autoShowAllSections`.
- Global layout widgets expose generic per-Entity visibility controls for every layout-capable scope.
- Generic layout scope contracts use `scopeEntityId`, public contracts use `scopedLayouts` and `layoutWidgetOverrides`.
- Metahub layout creation validates scoped targets through Entity component capability metadata.
- Runtime layout selection resolves preferred Entity scope from application navigation.
- Details: progress.md#2026-05-13 and progress.md#2026-05-12

## Current Guardrails

- **E2E Testing Boundaries**: Browser E2E must use the dedicated E2E boundary: hosted dedicated `.env.e2e.local` / `.env.e2e` by default, or the dedicated local Supabase profile on ports `55321/55322/55323` when local mode is explicitly requested.
- **Agent Restrictions**: Agents must not use `pnpm dev` or port `3000` for Playwright E2E. The repository E2E runner owns startup on `http://127.0.0.1:3100`.
- **Main Supabase Testing**: Shared/main Supabase E2E mode is only for manual debugging and must require `E2E_ALLOW_MAIN_SUPABASE=true` plus `E2E_FULL_RESET_MODE=off`.
- **Local Supabase Scripts**: Local Supabase app-start scripts have two supported profiles: full stack (`start:local-supabase`) and minimal stack (`start:local-supabase:minimal`). Both must keep `doctor:local-supabase` before app startup/reset and must pass explicit `.env.local-supabase` profiles.
- **Local URL Distinction**: Local Supabase docs must distinguish Supabase Studio (`http://127.0.0.1:54323`) from the local API URL (`http://127.0.0.1:54321`).
- **Legacy Avoidance**: Do not reintroduce `includeBuiltins`, `isBuiltin`, `source`, `custom.*-v2`, old top-level managed route families, or deleted frontend `domains/catalogs|hubs|sets|enumerations` folder names.
- **Runtime Workspaces**: Runtime workspace management stays on isolated `apps-template-mui` card/list patterns.
- **Public Exposure**: Keep public-runtime exposure tied to publication-backed state, not raw design-time flags.
- **Form Hydration**: Keep the `EntityFormDialog` first-open state hydration pattern intact (no render-phase ref writes).
- **Fixtures Maintenance**: Future fixture changes must be regenerated through documented Playwright generator specs.

## Constraints to Preserve

1. **Canonical Terminology**: Fresh Object/Component terminology is canonical: standard built-in kind key `object`, standard component resource route segment `components`, and standard capability manifest key `capabilities`.
2. **Entity Kinds Validation**: `_mhb_objects.kind` accepts built-in and custom kind values; custom entity kinds may define their own table prefixes through the entity constructor metadata.
3. **Snapshot Versions**: Snapshot schema/template version numbers were intentionally not bumped for this fresh-database migration.
4. **Compatibility Limits**: Existing old test databases are disposable; do not add compatibility shims for old Object/Component fixtures unless a future migration request explicitly requires them.
5. **Testing Integrity**: All existing E2E tests must remain green at every phase boundary. No exceptions.

## Stored Data Access Notes

These names are still allowed when they are domain concepts rather than the renamed entity type:

-   `config.parentHubId`, `config.boundHubId`, `config.hubs` — hub/tree configuration JSONB.
-   `set`, `enumeration`, `page`, `ledger` — separate standard entity kind keys.
-   `catalog` in optional global migration catalog docs/package names may remain only where it refers to the migration registry package, not the Object entity type.

## References

-   [tasks.md](tasks.md)
-   [progress.md](progress.md)
-   [systemPatterns.md](systemPatterns.md)
-   [techContext.md](techContext.md)
