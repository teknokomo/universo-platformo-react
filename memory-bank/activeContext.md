# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: Turbo 2 .env Cache Correctness — 2026-04-03

- QA review of the Turbo 2 migration identified that `core-frontend` reads `.env` files at Vite build time via `dotenv`, but these gitignored files were not included in Turbo task inputs.
- A Package Configuration was added at `packages/universo-core-frontend/base/turbo.json` using `$TURBO_EXTENDS$` to inherit root inputs and add `.env*` (excluding `*.example`) to the build hash.
- `core-backend` does NOT need this fix because its `tsc` build does not read `.env` files; `env.ts` loads them at runtime only.
- Remote cache remains local-only by design; `TURBO_TEAM`/`TURBO_TOKEN` secrets are wired in CI but intentionally left empty.

## Current State

- The Turbo 2 config migration is implemented and validated at the root, package-override, and CI layers.
- The repeated-build cache blocker is closed: output artifacts are now excluded from task inputs, and a second full root build restored `28/28` cache hits.
- The .env cache gap for `core-frontend` is now closed via a dedicated Package Configuration.
- No unrelated product/runtime regression appeared during the migration.

## Latest Validated Outcomes

- The root workspace now uses Turbo `2.9.3`, a root `packageManager` declaration, Turbo 2 `tasks`, and strict env-mode wiring.
- `packages/apps-template-mui` now overrides `build.outputs` to `[]`, matching its `tsc --noEmit` contract instead of inheriting artifact expectations it never produces.
- The first full `pnpm build` passed successfully with `28/28` packages under the new Turbo 2 configuration.
- Turbo run summaries proved the remaining cache issue was configuration-bound rather than package-bound: generated `dist/**`, `build/**`, and `.turbo/turbo-build.log` files were being included in task inputs, and the final root contract now excludes them.
- CI now exposes optional remote-cache secrets without making them mandatory for local development.
- The final repeated full `pnpm build` completed in about `1.8s` with `Cached: 28 cached, 28 total`, confirming real local Turbo reuse across the monorepo.

## Validation Snapshot

- Root build status: the first `pnpm build` under Turbo 2 passed with `28 successful, 28 total` in about `3m47s`.
- Diagnostic status: the first repeated build also passed, but initially stayed at `0 cached, 28 total`, which exposed the output-artifact self-invalidation seam.
- Turbo summary status: `pnpm turbo run build --summarize` confirmed that task `inputs` still included generated `dist/**`, `build/**`, and `.turbo/**` files before the final root-contract fix.
- Final cache status: after excluding generated artifacts from task inputs, the next root build repopulated the cache and the following repeated `pnpm build` ended with `Cached: 28 cached, 28 total`.

## Guardrails To Preserve

- Keep `pnpm build` as the canonical root validation path so Turbo sees the real workspace dependency graph.
- Preserve Turbo `envMode: "strict"`; do not weaken environment correctness just to chase cache hits.
- Keep package-level Turbo overrides minimal and evidence-based; `apps-template-mui` remains the only confirmed build-output exception in the current workspace inventory.
- Exclude generated `dist/**`, `build/**`, `coverage/**`, and `.turbo/**` artifacts from task inputs so cache validity depends on source/config changes rather than on the previous build's outputs.
- Leave remote cache opt-in through CI secrets rather than hardwiring a provider-specific contract into local workflows.

## Recent Closures Still Relevant

- [progress.md#2026-04-02-final-e2e-hardening-closure-and-full-suite-green](progress.md#2026-04-02-final-e2e-hardening-closure-and-full-suite-green)
  is the primary closure record for this finished wave.
- [progress.md#2026-04-02-extended-playwright-coverage-restart-safe-validation-and-diagnostics](progress.md#2026-04-02-extended-playwright-coverage-restart-safe-validation-and-diagnostics)
  tracks the expanded acceptance scope that closed earlier on the same day.
- [progress.md#2026-04-02-playwright-full-suite-closure-and-route-surface-completion](progress.md#2026-04-02-playwright-full-suite-closure-and-route-surface-completion)
  tracks the route-surface completion wave that preceded the final hardening closure.
- [progress.md#2026-04-01-playwright-determinism-and-linked-application-stability-hardening](progress.md#2026-04-01-playwright-determinism-and-linked-application-stability-hardening)
  tracks the determinism and runtime hardening that the final suite still depends on.
- [progress.md#2026-04-01-supabase-jwtjwks-compatibility-remediation--complete](progress.md#2026-04-01-supabase-jwtjwks-compatibility-remediation--complete)
  remains relevant because the current E2E environment still depends on that auth/RLS compatibility.

## Operational Constraints Still Worth Remembering

- The browser suite should continue to extend existing specs rather than introducing parallel replacement flows.
- The product surface should remain real: dialogs, lists, route guards, and existing backend helpers are the preferred seams.
- Helper changes should fail closed when persisted state is missing instead of continuing on optimistic UI assumptions.
- Any future route-level browser assertion on guarded metahub pages should assume a transient loading shell can appear first.
- Any future create/copy helper should prefer entity-id or durable persisted-state confirmation over transport-level timing.

## Active Blockers

- No active blocker is open for the Turbo migration wave.
- Any next step should be QA review or future Turbo remote-cache enablement, not more local cache fixes.

## Immediate Next Steps

- If the user wants an independent validation pass, switch to QA mode and audit the Turbo 2 contract from a review perspective.
- If CI remote cache should be activated in practice, populate `TURBO_TEAM` and `TURBO_TOKEN` secrets and confirm cache reuse across workflow runs.
- Keep future package-level Turbo overrides evidence-based and verify them through repeated root builds rather than by assuming one-off local success.

## Session Hygiene

- Keep this file current-focus only.
- Keep durable completion detail in [progress.md](progress.md).
- Keep checklist state in [tasks.md](tasks.md).
- This scope can remain closed unless a later repo change reopens it with new evidence.

## References

- [tasks.md](tasks.md)
- [progress.md](progress.md)
- [techContext.md](techContext.md)
- [systemPatterns.md](systemPatterns.md)
