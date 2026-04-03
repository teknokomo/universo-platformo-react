# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: PR #745 Review Remediation — 2026-04-03

- The active branch is `feature/playwright-cli-e2e-qa-hardening`, and the current wave is limited to validated bot comments on PR `#745`.
- Two high-priority findings are confirmed by code inspection: `LocaleDialog` currently collapses a trailing `-` while typing locale codes, and `InstanceList` currently replaces the full localized JSON when editing only one locale.
- A third backend/admin consistency issue is also active: role codename validation in `admin-backend` is still hardcoded to PascalCase + `en-ru`, while the admin role form and routes already depend on dynamic `metahubs` codename settings.
- This wave must stay minimal and safe: fix only confirmed inconsistencies, preserve legacy role slug compatibility, and validate with targeted tests/builds.

## Current State

- The Turbo 2 config migration remains complete and validated; no further cache work is active in this session.
- PR review triage found three inline bot comments and two review summaries on PR `#745`; all three validated inline findings are now implemented.
- The locale-input and localized-instance update defects are closed in the admin frontend.
- The role codename validation mismatch is closed by moving exact policy enforcement to backend routes that read runtime `metahubs` settings, while keeping legacy lowercase slug compatibility.

## Latest Validated Outcomes

- PR `#745` review feedback was fetched directly from GitHub: three inline comments, no separate issue comments.
- External BCP 47 guidance confirms the locale input should allow a temporary `en-` intermediate state while the user types a region suffix.
- `packages/universo-utils/base/src/vlc/index.ts` already provides `updateLocalizedContentLocale(...)`, which preserves untouched locales and is the correct primitive for the `InstanceList` fix.
- `packages/admin-backend/base/src/routes/rolesRoutes.ts` already reads `codenameLocalizedEnabled` from `admin.cfg_settings`, which confirms role codename behavior is not purely static and strengthens the need to remove the remaining hardcoded style/alphabet validation.
- The targeted backend route suite now covers runtime role codename settings explicitly, including rejection under defaults and acceptance under configured `kebab-case` + `ru` settings.
- Validation passed through `pnpm --filter @universo/admin-backend test -- src/tests/routes/rolesRoutes.test.ts`, package builds for admin backend/frontend, and a full root `pnpm build` (`28 successful, 28 total`).

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

- No active blocker is open for the remediation wave.
- The remaining optional next step is an independent QA/review pass on the updated PR branch.

## Immediate Next Steps

- If the user wants a fresh review pass, switch to QA mode and audit PR `#745` again from the updated branch state.
- If the user wants delivery, commit the remediation and push it to the existing PR branch.

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
