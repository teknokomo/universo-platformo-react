# Research: Theme Presets — Typed Layout Appearance Layer

> Created: 2026-11-03
> Status: Reviewed
> Trigger: RESEARCH mode on the QA-reviewed Manager brief "Theme Presets — Typed Layout Appearance Layer" (2026-11-03, local-only source), sourced from stakeholder TZ DOC-2026-004 (2026-11-02, local-only Manager input)
> Follow-up plan: ../plan/theme-presets-layout-appearance-plan-2026-11-03.md (to be created by PLAN mode)

## Research Question

The brief requires a typed `ThemePreset` layer (file presets in a new `@universo-react/theme` package + DB presets in metahub/application scope) with an `appearance` object (mode, presetRef, overrides, resolved tokens+hash) inside `layouts[].config`, applied through the existing MUI CSS-variables theme. This artifact answers the brief's Open Questions and the TZ §18 research questions against current code (repo 0.88.0-alpha, HEAD `ed0fc5534`, MUI 9.2.0, React 18.3.1) and current external documentation, and recommends decisions for PLAN.

Method note: prior MANAGER/QA sessions (2026-11-03) already verified the brief's factual baseline with two read-only agents; this research builds on those confirmed facts and re-verified load-bearing claims while expanding into the open decisions. MCP Context7 is not available in this environment; the repository-pinned MUI 9.2.0 behavior was confirmed against mui.com documentation (sources listed) and against the vendored MUI source in `node_modules` where the agents quoted internal files (`@mui/system/cssVars/*`).

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
|--------|------|------------------|----------------|
| Manager stakeholder input TZ DOC-2026-004 (local-only source) | Primary (stakeholder input) | 2026-11-02 | Requirements FR-001…FR-058, data model §10, API §11, open questions §18 |
| QA-reviewed Manager brief "Theme Presets — Typed Layout Appearance Layer" (local-only source) | Primary (brief) | 2026-11-03, QA-reviewed same day | Verified baseline facts + open questions this artifact resolves |
| Repo source under `packages/` (see per-finding citations) | Primary | HEAD `ed0fc5534` (2026-11-02) | All code verdicts |
| MUI CSS theme variables usage/configuration, dark-mode docs | Primary (vendor) | Current (mui.com) | `cssVariables` object form, `colorSchemeSelector`, `InitColorSchemeScript`, `useColorScheme`, `applyStyles`, FOUC/SSR guidance |
| Vendored MUI 9.2.0 internals (`@mui/system/cssVars/createCssVarsProvider.js`, `useCurrentColorScheme.js`) | Primary | pinned 9.2.0 | Authoritative for repo behavior (mode initializer, storage default, var attachment) |
| DTCG format 2025.10 (designtokens.org) | Primary (standard) | stable 2025-10-28 | Confirms "DTCG later" phasing; simplified profile is a valid MVP stance |
| RFC 8785 (JSON Canonicalization Scheme) | Primary (standard) | Proposed Standard, 2020-06 | Reference point for token-hash canonicalization |
| WCAG 2.1 SC 1.4.3 / 1.4.11 (W3C Understanding docs) | Primary (standard) | current | Contrast thresholds: text 4.5:1, large text 3:1, UI components 3:1 |
| MDN / PortSwigger / Snyk CVE-2024-32866 | Secondary/Primary (security) | current | Prototype-pollution behavior of Zod strict parsing vs downstream merge |
| react-colorful npm | Primary (package) | 5.8.1 (catalog) | Color picker sufficiency |
| Prior artifact: `memory-bank/research/messenger-app-max-telegram-research-2026-10-31.md` + PR #928 | Primary (prior research, implemented) | 2026-11-02 merged | Introduces `applicationLayoutConfig.ts`, messenger template, sync/runtime machinery that presets extend |
| Two RESEARCH subagent reports (runtime/theme; infrastructure) — quotes embedded below | Primary (derived) | 2026-11-03 | RQ-A…RQ-D and RQ-1…RQ-6 evidence |

## Key Findings

### F1. Where `appearance` must live: extend the per-template renderer schemas (design a), not the neutral `__layout` slot

- All three renderer config schemas are `.strict()` and are enforced on every write, on snapshot normalization, on sync apply paths, and at runtime resolution (`parseApplicationLayoutConfig`, `packages/universo-react-types/src/common/applicationLayoutConfig.ts:64-87`; representative call sites: `applicationLayoutStoreSupport.ts:229,240`, `routes/sync/syncLayoutSnapshot.ts:172-201`, `metahubs-backend/src/domains/shared/snapshotLayouts.ts:281-308`, `effectiveLayoutResolverCore.ts:224-227` with fail-closed `LAYOUT_PERSISTED_INVALID`). The parse also guards sync apply (`applicationLayoutSyncStore.ts`, `syncDataLoader.ts`), snapshot metadata validation and metahub layout services — PLAN must enumerate the full call-site inventory for the option (a) companion work.
- **Option (a)** — optional `appearance` field on each of the three schemas (referencing one shared `themeAppearanceSchema` in `@universo-react/types`) — touches ~11 sites (schemas, public projections, marketing panel, runtime parse consumers).
- **Option (b)** — `appearance` inside the neutral `__layout` metadata (`persistedLayoutNeutralMetadataSchema`, `layoutEnvelope.ts`) — touches fewer files, but has three disqualifying couplings:
  1. `encodeNeutralMetadata`/`normalizeNeutralMetadata` (`layoutEnvelope.ts:213-234,256-261`) build the encoded neutral via **explicit whitelists** (composition, zoneSettings, sourceZoneSettings, skipDefaultZoneWidgetSeed) — a field added to the schema but missed in either spread is silently stripped on every re-encode, so both must be edited atomically with the schema change.
  2. Sync compares/re-encodes the neutral slot without a source/local split (`buildComparableLayout`, `syncLayoutPersistence.ts:193-240`): a source-side appearance change would overwrite a persisted layout's appearance regardless of local modification.
  3. `normalizeApplicationLayoutForHash` does **not** include raw neutral fields (`applicationLayoutHash.ts:223-241`) — appearance would be invisible to the content hash, breaking TZ FR-029 (an appearance change must mark the layout as local modified), because local-modified detection is exactly `source_content_hash !== local_content_hash`.
- **Verdict (inference from facts): option (a)**. Only (a) makes appearance part of the semantic content hash and the publication diff with zero new machinery, which FR-029 and the sync rules (TZ §7.5) require. The (a) cost is bounded: the public runtime projections must be extended regardless (F5), and the duplicated marketing panel that would silently drop `appearance` (`ApplicationMarketingAppearancePanel.tsx:43,69` — strict `safeParse` fails on the new key) is scheduled for replacement by the shared authoring UI anyway. `MARKETING_ONLY_LAYOUT_CONFIG_KEYS` must **not** receive `appearance` (it is cross-template by design).

### F2. Hash normalization: exclude `appearance.resolved` from content hashes at two hash-only choke points; keep mode/presetRef/overrides hashed

- `decodeLayoutForHash` (`applicationLayoutHash.ts:90-96`) is used **only** by the hash normalizer — stripping `appearance.resolved` there removes the server-owned materialization from the sync semantic hash without touching any other path; widget hashing flows through a different decoder (`decodeWidgetForHash`), so no leakage.
- `normalizeLayout` (`packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts:57-70`) keeps `config` verbatim (line 65); the same deep-omit for `appearance.resolved` belongs there (single helper reused for `layouts` and `scopedLayouts`).
- Rationale (fact → inference): `resolved` is deterministically derived from `presetRef.version + overrides + preset tokens`; including it would couple sync state to server-side re-resolution instead of authorial intent. Keeping `mode/presetRef/overrides` hashed preserves FR-029. The runtime `effectiveHash` (`effectiveLayoutResolverCore.ts:620`) can keep `resolved` hashed — there it is the desired cache-busting behavior (consumed by `runtimeMarketingPageController.ts:276,468`).
- Sync comparison itself does not use the hash (`hasPublishedLayoutsChanges` uses `stableStringify` on `buildComparableLayout` output, `syncLayoutPersistence.ts:505-544`); appearance in the renderer config therefore also participates in publication diffing correctly under option (a).

### F3. Canonicalization: reuse `json-stable-stringify@1.3.0`; do not adopt RFC 8785 in MVP

- json-stable-stringify 1.3.0 (catalog `^1.0.0`, `pnpm-workspace.yaml:207`) is the repo-wide canonicalizer with 15+ hash sites (layout hash, snapshot hash `publishedApplicationRuntimeSnapshot.ts:37`, release bundle checksums, realtime auth signatures, seed-migration `checksumSource`). A repo wrapper exists (`packages/universo-react-utils/src/serialization/stableStringify.ts`).
- Its key-sorting (code-unit order) and JS number formatting are JCS-compatible for a tokens payload of JSON primitives (hex strings, small integers, enums); known gaps (`-0`, bigint, circulars) are irrelevant if the token schema restricts values to primitives — which FR-011…FR-018 already do.
- Verdict: RFC 8785 conformance is unnecessary now; note it as a later-phase option if DTCG export (which may need strict JCS for cross-tool verification) lands.

### F4. Migration authoring: AGENTS.md names a helper that does not exist; follow the `SqlMigrationDefinition` chain and update the parity contracts

- `createSchemaMigrationDefinition()` from `@universo-react/schema-ddl` (AGENTS.md §"Creating a New Service") **does not exist** in the codebase (schema-ddl exports `MigrationManager`, `generateMigrationName`, `buildSchemaSnapshot`, `CURRENT_SCHEMA_SNAPSHOT_VERSION`). The real pattern is `{unixMs}-{Name}.sql.ts` files exporting `SqlMigrationDefinition { id, version, summary, up[], down }`, registered in `platform/migrations/index.ts` → `platform/systemAppDefinition.ts` (`{ kind: 'sql', definition, bootstrapPhase: 'post_schema_generation' }`) → `migrations-platform/src/platformMigrations.ts` via `sqlAdapter.ts`.
- **Checksum discipline**: `sqlAdapter` checksums the full up/down SQL — never edit an applied migration; new tables need new files. Next free IDs: metahubs `1800000000290+`, applications `1800000000350+`.
- **Parity contracts are hard-coded**: `metahubsSchemaParityContract.test.ts` asserts the exact migration-ID chain (ending `…1800000000280`) and `currentBusinessTables === targetBusinessTables`; the applications side does the same in `src/tests/platform/systemAppDefinition.test.ts` (chain ending `…1800000000340`). New `obj_theme_presets` tables must be appended to `targetBusinessTables` in **both** `systemAppDefinition.ts` files and both parity tests updated in lockstep. Registered migration IDs, not file-name prefixes, drive parity and the manifest (e.g. `1800000000200-SeedBuiltinTemplates.ts` registers id `SeedBuiltinMetahubTemplates1800000000250`), so PLAN must read IDs from the definitions. `down: []` is the convention.
- RLS exemplars: metahubs membership policy (`1766351182000-CreateMetahubsSchema.sql.ts:924-944` — `FOR ALL USING (is_public OR membership EXISTS OR admin.is_superuser(...)) WITH CHECK (...)`); applications prefer the newer non-recursive helper from `1800000000340` (`applications.has_active_application_membership(application_id, roles)` SECURITY DEFINER STABLE, `REVOKE ALL FROM PUBLIC`, conditional `GRANT` DO-blocks). Published runtime must not read preset tables (TZ §10.1) — no anon policy, `REVOKE` from `anon`.

### F5. Strict consumers that must move in lockstep with schema (option (a) companion list)

- Public projections whitelist config keys and must be extended explicitly: `toPublicConfig` (`publicMarketingRuntime.ts:29-42`, six marketing keys, re-validated by `marketingPageConfigSchema.safeParse` — an unprojected `appearance` is silently dropped or fails parse), `runtimeMarketingPageController.ts:119`, `publicMessengerRuntime.ts:563`, and the frontend runtime DTO `runtimeDto.ts:19` (`rendererConfigSchema = marketingPageConfigSchema`).
- `ApplicationMarketingAppearancePanel.tsx:43,69` strict-parses the whole config; unextended, saving from it would drop `appearance`. This panel is replaced/deprecated by the shared `ThemeAppearancePanel` in the same MVP, sequencing the risk away.
- Runtime `effectiveLayoutResolverCore.ts:224-227` and both snapshot normalizers require no code change beyond the schemas (they delegate to `parseApplicationLayoutConfig`).

### F6. Audit: new append-only table per schema; do not retrofit `rel_application_control_audits`

- Existing audit is application-control-specific: columns (`previous_show_in_app_list` etc.), event-type whitelists inside SECURITY DEFINER plpgsql functions, and an append-only mutation trigger (`applicationBotBindingsMigrationSql.ts:30-41,492-584`). Adding theme event types would mean editing applied migration SQL (checksum drift) — forbidden (F4).
- Recommendation: a dedicated append-only audit table per schema (metahubs + applications) following the same pattern (event_type, changed_fields JSONB, previous/new_version, FK RESTRICT, append-only trigger or store-enforced inserts), written through a theme-presets store module on `DbExecutor` at the service mutation points for create/update/copy/archive/apply/export (FR-053). A store-only table without auto-triggers is sufficient — unlike catalog visibility, theme presets have explicit service mutation points to hook.

### F7. File-preset registry: explicit typed imports + Zod-validated record + module-init guard; tsdown dual build

- Precedents: metahub templates data uses an explicit TS-module registry ("Add new templates here", `metahubs-backend/src/domains/templates/data/index.ts:7-50`) with validation at seed time; `widgetConfigSchemaByKey` (`applicationLayoutConfig.ts:93-130`) shows the const-record + module-init sanity-guard pattern. The repo has **zero** `import.meta.glob`/`require.context` usage and no fs-read precedent for bundled static data (fs reads exist only for user/tenant data).
- Backends are tsc-built CJS-only consumers; the types package builds with tsdown `platform: 'neutral'`, dts, treeshake (`universo-react-types/tsdown.config.ts`). A new `@universo-react/theme` must mirror that dual build (AGENTS.md §2.2 dual CJS/ESM) and must not use bundler-only APIs at module top level.
- Verdict: keep the TZ's `.theme.json` file contract (exported JSON == file content, FR-043/FR-045) but ship presets as statically imported JSON modules (`resolveJsonModule` is already on across backends/frontends) with Zod parse and duplicate-codename guards executed at registry module init — duplicate codename or schema failure fails the build/boot (FR-036).

### F8. Feature flag: server-gated routes + server-controlled frontend config; default ON; runtime read path ungated

- Pattern precedent: `ADMIN_PANEL_ENABLED` (default true) with per-route gates (`admin-backend/routes/dashboardRoutes.ts:15`, `guards/ensureGlobalAccess.ts:53`); `UPL_GLOBAL_MIGRATION_OBJECT_ENABLED` (default false) for infra toggles. Env helpers live in `packages/universo-react-utils/src/env/` (`getEnv`, `parsePositiveInt`; `parseEnvBoolean` exists only as a private helper to copy). Frontends learn backend capabilities through the `/auth/permissions` config payload (`permissionService.ts:204` embeds `getAdminConfig()`); there is no generic capability endpoint.
- Recommendation: `THEME_PRESETS_ENABLED` (default **true**, env override to disable for rollback per TZ §15.4), read via a new `isThemePresetsEnabled()` in `env/`; gate route registration in `applications-backend/src/routes/index.ts` and `metahubs-backend/src/domains/router.ts`; expose to the frontend via the `/auth/permissions` config so the UI can hide the tab without a second source of truth. (TZ §15.4 proposes the name `THEME_PRESETS_V2`; this research recommends `THEME_PRESETS_ENABLED` as the clearer name for a v1 feature — confirm with the owner.) Default-on was chosen because the flag is a rollback mechanism, not a staged-rollout gate: tables ship regardless and the flag only controls route registration and UI visibility. **Do not gate the runtime read path**: `appearance` becomes part of config parsing; with the flag off, old configs without `appearance` render defaults anyway, and forked parsing would be worse than reading inert data. Rollback caveat: TZ §15.4 says that on rollback the runtime continues on the old fields or default — that holds for layouts without appearance; for layouts that already carry appearance, this recommendation keeps rendering the persisted resolved tokens with the flag off (validated, inert, server-owned data) rather than fork-stripping them at parse time. PLAN must record this as the accepted rollback semantics, or gate the public projection instead of the parse if strict TZ conformance is required.

### F9. Runtime theme application: the seam is `AppTheme`'s `colorSchemes` override; mode needs `setMode()`, not `defaultMode`

- `AppTheme` (`apps-template-mui/src/shared-theme/AppTheme.tsx:25-65`) is `useMemo`-memoized on `[accentColor, disableCustomTheme, primaryColor, themeComponents]`; today only `palette.primary.main`/`palette.secondary.main` are overridden per scheme. A `resolvedTokens` prop replacing the two color props is a 1:1 structural fit: per-scheme palette overrides plus top-level `typography`/`shape`/`spacing`/`shadows` slots that `createTheme` already accepts. CSS vars swap in place on theme identity change — no remount.
- **Mode caveat (verified against vendored MUI 9.2.0)**: `defaultMode` seeds only the initial state (`const initialMode = modeStorage?.get(defaultMode) || defaultMode` in the `useState` initializer, `@mui/system/cssVars/useCurrentColorScheme.js:72-82`; it is also read as a fallback inside `setMode`, but a post-mount prop change does not switch the active mode). `appearance.mode` must be applied by calling `setMode()` from `useColorScheme` inside the provider tree (or by mounting `AppMainLayout` fresh with appearance, which is what marketing does today via self-wrap, `MarketingRuntimeContent.tsx:256`; the `setAppearance` effect path `:204-208` would not switch mode).
- **User mode persistence (matches TZ §7.3, needs a deliberate decision)**: the provider's storage key is `mui-mode` (set by the `@mui/material` ThemeProvider layer; `@mui/system`'s own default is `mode`), localStorage, origin-global; initializer is `modeStorage?.get(defaultMode) || defaultMode` — a visitor who ever toggled mode will not see the layout's `appearance.mode` until they reset. This is exactly the TZ §7.3 rule that the user's light/dark toggle overrides the layout's default mode — keep it, but document it, and reconcile with the legacy Berry key `isDarkMode` (`universo-react-store/src/reducers/customizationReducer.js:13`) so the platform does not carry two user-mode systems into a third.
- Provider inventory: Berry ThemeProvider wraps everything in the hosted shell (`core-frontend/src/App.tsx:204,226`); apps `AppTheme` nests via `AppMainLayout` (runtime surface in scope); metahub shells use template-mui `AppTheme` (no color props — out of scope unless presets should brand the metahub shell itself). Keep the single-provider pattern documented at `AppMainLayout.tsx:38-44`; memoize `xThemeComponents` (`AppMainLayout.tsx:11-16`) when adding a frequently-changing tokens prop.
- `getDesignTokens(mode)` in themePrimitives has **zero callers** and mutates shared module state (mode-unsafe) — do not revive; use the `colorSchemes` override seam.
- Dashboard/messenger runtimes never consume layout appearance today (only `sideMenu`, `DashboardApp.tsx:653-657`) — extraction for these templateKeys is new plumbing.

### F10. FOUC: no InitColorSchemeScript anywhere; add one to the HTML shells

- Repo-wide: zero `InitColorSchemeScript`/inline color-scheme logic in any HTML (`apps-template-mui/index.html`, `core-frontend/index.html` incl. public/build copies); the `data-mui-color-scheme` attribute is set only when React mounts. Dark-mode visitors get a light flash on every standalone/hosted runtime load.
- MUI guidance: `InitColorSchemeScript` must be placed early in the HTML; its defaults already match this stack (`attribute: 'data-mui-color-scheme'`, `defaultMode: 'system'`, `modeStorageKey: 'mui-mode'` per the MUI API docs), and `attribute` must match `colorSchemeSelector`. In a pure SPA there is no server-painted wrong-theme markup, but the pre-mount paint still uses the browser default — the script fixes first paint. Plain `CssBaseline` is unaffected (CSS vars attach at `:root`). PLAN should add it to the shell HTML(s) as part of preset work (TZ §14.1 requires the default theme to be available before hydration).

### F11. Contrast validation: generalize the existing luminance checker to arbitrary pairs; errors for text, warnings for UI

- Existing reusable core: `marketingHexColorSchema` (regex incl. 8-digit), `marketingColorLuminance` (WCAG relative luminance), `marketingThemeColorSchema` (`marketingPageRuntimeSchemas.ts:22-52`) — currently requires ≥4.5:1 **against white or black** (whichever is better), which is stricter/narrower than arbitrary text-pair checking.
- WCAG 2.1 thresholds: SC 1.4.3 — 4.5:1 normal text, 3:1 large text (≥24px, or ≥18.66px bold); SC 1.4.11 — 3:1 for UI component boundaries/states. TZ FR-019/FR-020 align.
- Recommendation: extend to a pair-based checker in the new package (`validate.ts`): hard errors for text pairs (`text.primary`/`text.secondary` vs `background.default`/`background.paper`, `primary.contrastText` vs `primary.main`, `secondary.contrastText` vs `secondary.main`) at 4.5:1; warnings (pre-save, non-blocking) for UI pairs (divider vs background, primary/secondary main vs background) at 3:1. Final pair list is a PLAN decision; blocking semantics follow TZ FR-019 (errors block save).

### F12. Security posture of the token pipeline

- Strict Zod schemas reject unknown keys outright, and `JSON.parse` creates `__proto__` as a safe own property, so parsing itself cannot pollute prototypes; the residual risk is downstream merging of validated objects (Object.assign/spread chains, deep merges — cf. CVE-2024-32866 in a Zod-based library). The resolver's merge (default → preset → overrides, TZ §7.3) must therefore use a pollution-guarded deep merge (reject/ignore `__proto__`, `constructor`, `prototype` keys) and the token schema must additionally forbid those keys explicitly (FR-017) so the block is visible in validation errors, not just in merge behavior.
- Public runtime payload must stay a strict projection (F5) with `resolved` only — no preset IDs, no internal identifiers (TZ §11.4); the existing fail-closed `LAYOUT_PERSISTED_INVALID` behavior is the correct model for invalid persisted appearance.

### F13. Hardcoded values inventory (TZ §18 Q6) — scoped, mostly bounded

- Theme primitives: ~62 (apps-template-mui) / ~68 (template-mui) color-literal lines — these become the source of `universo-default` tokens (FR-035).
- Template customizations: ~18 / ~12 literals; mostly theme-aware via `(theme.vars || theme)` callbacks, but static leftovers (white popper backgrounds `hsl(0,0%,100%)` in `surfaces.ts:79`, `navigation.tsx:48`, `datePickers.ts:16`, `charts.ts:41`; static shadows `navigation.tsx:49,57`; `color:'#fff'`) respond to MUI's built-in dark scheme where `theme.applyStyles('dark', …)` overrides exist alongside, but ignore arbitrary preset tokens unless migrated to token reads. **These customizations are the minimum re-tokenization set for presets to be visually coherent.**
- Component-level: ~128 hex + 42 rgb/hsl lines (apps) / ~85 hex (template-mui), of which ~55-70% are legitimately static SVG brand fills. Real theme-relevant stragglers exist (e.g. `PlayCanvasCanvasWidget.tsx:920`, `CustomizedDataGrid.tsx:235`, `pendingAnimations.ts:9`, 43 `borderRadius` literals). Recommendation: out of MVP scope except where a widget visibly breaks under dark presets; record as a follow-up backlog item (decision for owner, see Open Questions).

### F14. TZ §18 residual questions — closed by this research

1. Publication snapshot encoder: `attachLayoutsToSnapshot`/`normalizeSnapshotLayoutConfig` (`metahubs-backend/src/domains/shared/snapshotLayouts.ts:281-308`) — config carried verbatim through decode/re-encode; with schemas extended (F1/F5), `appearance` passes losslessly. ✔
2. Semantic hash: answered — F2. ✔
3. MUI switching: answered — F9/F10 (portals inherit `:root` vars, no ScopedCssBaseline; mode needs `setMode`; FOUC needs InitColorSchemeScript). ✔
4. ThemeProvider accepts full tokens: answered — F9 (single provider confirmed; `resolvedTokens` prop is a 1:1 fit). ✔
5. RLS/DDL patterns: answered — F4. ✔
6. Hardcoded inventory: answered — F13. ✔
7. Migration numbering: metahubs next `1800000000290+`, applications `1800000000350+`; parity tests named — F4. ✔
8. File registry: answered — F7. ✔
9. Color validation: answered — F11. ✔
10. Color picker: react-colorful 5.8.1 suffices (`HexColorField`, `HexColorPickerPopover` already wrap it; current marketing panels use plain hex TextFields — the new shared UI should adopt the existing picker components per the mui-runtime-ux skill). ✔
11. Standalone runtime default theme: answered — F9/F10 (pre-fetch theme is template defaults under MUI `system` mode or stored `mui-mode`; hosted shell additionally shows Berry theme; no FOUC mitigation exists). ✔
12. Export CLI: validated — download + manual PR suffices for MVP (matches FR-043…FR-046 Should-priority and the brief's pre-decision); no CLI in MVP. ✔

## Conflicts And Uncertainty

- **AGENTS.md vs code**: AGENTS.md documents `createSchemaMigrationDefinition()` which does not exist. This research follows the code; AGENTS.md correction is repo-content edit outside RESEARCH scope and should ride with the implementation PR (docs task in PLAN).
- **Design (a) vs (b)** is a genuine trade-off, not a hard fact: (b) minimizes touched files but breaks FR-029 semantics and needs new sync/hash plumbing; (a) needs the F5 companion list. Recommended (a); PLAN must keep the companion list atomic.
- **`resolved` in hashes**: excluding it from sync hashes is an inference from the "server-owned materialization" contract (TZ §10.2), not measured behavior; if PLAN prefers simpler code, keeping `resolved` hashed is survivable (preset edits would mark dependent application layouts `local_modified` on next sync — semantically defensible but noisier).
- **Contrast pair list** (F11) is a recommendation; WCAG fixes thresholds, not the exact pair matrix for MUI palettes.
- **Hardcoded inventory counts are approximate** (grep-based, category-level); fine for scoping, not for per-file task lists.
- **Dual color-mode persistence** (`mui-mode` vs Berry `isDarkMode`) is pre-existing tech debt; presets do not require resolving it, but the UX rule "user toggle overrides preset mode" must be stated in docs (FR-055) to avoid bug reports.
- **Context7 unavailable** in this environment; MUI behavior verified via mui.com + vendored 9.2.0 sources instead. No freshness concern (MUI pinned 9.2.0), but the pnpm store carries a second `@mui/system` build (9.3.0, transitive) — any future reading of vendored internals must resolve the consumer's actual store path.
- The layout mutation surface is richer than config-only: `applicationLayoutMutationSchema` (`applicationLayouts.ts:811-822`) carries name/description/config/placement flags/`expectedVersion`, and a config-only reset surface already exists (`applicationLayoutConfigResetMutationSchema`, `:838-843`) — PLAN should map the appearance PATCH/reset endpoints onto the existing reset-style schema rather than inventing a new one.

## Project Implications

- Packages touched confirm the brief's file map; additions surfaced by research: `packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts` (resolved-token omission), `packages/universo-react-applications-backend/src/utils/applicationLayoutHash.ts` (`decodeLayoutForHash`), both `systemAppDefinition.ts` files + both parity tests, shell HTML files for `InitColorSchemeScript`, `publicMessengerRuntime.ts` and `runtimeDto.ts` (frontend runtime DTO), `/auth/permissions` config payload for the flag.
- Rules that bind PLAN: schema-qualified parameterized SQL with `DbExecutor` stores and `RETURNING` fail-closed mutations (AGENTS.md); no edits to applied migrations (checksum); tsdown `platform:'neutral'` dual build for the new package; EN/RU i18n for all UI strings, with shared authoring labels registered in the `@universo-react/i18n` common namespace rather than duplicated per feature bundle; mui-runtime-ux skill for the shared panel; E2E visual specs under `tools/testing/e2e/specs/visual/*.visual.spec.ts`.
- Package boundary: per the mui-runtime-ux isolation rule, `apps-template-mui` must not depend on `template-mui` or feature packages — the shared `ThemeAppearancePanel` lives in `template-mui` (TZ §7.1) and `AppTheme` must receive resolved tokens as plain data; PLAN must keep `@universo-react/theme` and panel imports out of `apps-template-mui`'s dependency set.
- The metahub editor shell (template-mui AppTheme / Berry) is out of scope for preset application — presets style application layouts, not the platform chrome; if the owner wants metahub-shell branding, that is a separate decision.

## Recommended Decision

1. Store `appearance` as an optional field in each template's strict renderer config schema, referencing one shared `themeAppearanceSchema` in `@universo-react/types`; do not use the neutral `__layout` slot (F1).
2. Extend the strict consumers in lockstep (F5 list), replacing the marketing panel with the shared authoring UI in the same MVP; the resolver runs server-side at save/publish/apply-latest through the shared `@universo-react/theme` package (TZ Appendix A #7) — the runtime client never re-merges.
3. Exclude `appearance.resolved` from the sync content hash (`decodeLayoutForHash`) and the snapshot hash (`normalizeLayout`); keep it in the runtime `effectiveHash`; keep mode/presetRef/overrides hashed (F2).
4. Canonicalize with the existing `json-stable-stringify` wrapper; keep token payloads primitive; defer RFC 8785 (F3).
5. New `@universo-react/theme`: tsdown dual build like `universo-react-types`; presets as statically imported `.theme.json` + Zod parse + duplicate-codename module-init guard; resolver with pollution-guarded deep merge; pair-based contrast checker (errors 4.5:1 text, warnings 3:1 UI) (F7, F11, F12).
6. Migrations: two new `SqlMigrationDefinition` files (metahubs `1800000000290+`, applications `1800000000350+`) with `_upl_*` columns, RLS via the exemplars, GRANT/REVOKE blocks, `down: []`; update `targetBusinessTables` + parity tests in both packages (F4).
7. Audit: dedicated append-only audit table per schema written from the theme service (F6).
8. Flag: `THEME_PRESETS_ENABLED` default true in `env/`, gating route registration + exposed via `/auth/permissions` config; runtime read path ungated (F8).
9. Runtime: `resolvedTokens` prop on `AppTheme` memoized on the resolved hash (not object identity, per the brief's rebuild-only-on-hash-change goal), mode applied via `setMode()`, keep single provider via `AppMainLayoutContext`, memoize `xThemeComponents`; add `InitColorSchemeScript` (matching `data-mui-color-scheme` / `mui-mode`) to the shell HTMLs (F9, F10).
10. MVP re-tokenization limited to template customizations' static literals; component-level hardcodes → follow-up backlog (F13).

## Open Questions Before PLAN

- Confirm with the owner: metahub editor shell stays unthemable in MVP (platform chrome), and component-level re-tokenization is follow-up work (F13).
- Final contrast pair matrix and which pairs are warnings vs blocking errors (F11).
- Exact audit table shape (columns/event list) and whether an append-only DB trigger is required or store-enforced inserts suffice (F6).
- Whether `resolved` should additionally be omitted from the publication diff (`hasPublishedLayoutsChanges`) or only from hashes — PLAN to verify diff behavior with tokens present (F2).
- `themeVariant` query param vs `appearance.mode` precedence at runtime boot (today themeVariant is server-side only and post-mount `defaultMode` is ignored — PLAN must define the boot-time mode resolution order: user `mui-mode` > `themeVariant`/runtime target > `appearance.mode` > `system`) (F9).
- Legacy marketing-field migration (TZ §15.1, FR-031): where are old `themeMode`/`primaryColor`/`accentColor` read after the switch (server-side fallback in the resolver vs panel display only), and does the first appearance write seed `overrides.modes` from the old fields or leave them as legacy read-only? MVP per TZ §4.1 — PLAN must decide the mapping path.

## Sources

- TZ: DOC-2026-004 (2026-11-02, local-only Manager input); brief: QA-reviewed Manager brief "Theme Presets — Typed Layout Appearance Layer" (2026-11-03, local-only source)
- Repo source cited inline per finding (packages/universo-react-{types,apps-template-mui,template-mui,metahubs-backend,applications-backend,utils,migrations-platform,schema-ddl}, pnpm-workspace.yaml, pnpm-lock.yaml)
- MUI: https://mui.com/material-ui/customization/css-theme-variables/usage/ ; https://mui.com/material-ui/customization/css-theme-variables/configuration/ ; https://mui.com/material-ui/customization/dark-mode/ ; vendored `@mui/system/cssVars/*` at 9.2.0
- DTCG: https://www.designtokens.org/tr/2025.10/format/ (stable 2025-10-28)
- RFC 8785: https://www.rfc-editor.org/rfc/rfc8785
- WCAG: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html ; https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html
- Prototype pollution: https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/Prototype_pollution ; https://portswigger.net/web-security/prototype-pollution ; https://security.snyk.io/vuln/SNYK-JS-CONFORMTOZOD-6673141
- react-colorful: https://www.npmjs.com/package/react-colorful
- Prior research: `memory-bank/research/messenger-app-max-telegram-research-2026-10-31.md`
