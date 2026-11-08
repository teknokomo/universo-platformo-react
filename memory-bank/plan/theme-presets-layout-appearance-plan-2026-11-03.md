# Plan: Theme Presets — Typed Layout Appearance Layer

> Created: 2026-11-03
> Status: Draft (for discussion)
> Research: `memory-bank/research/theme-presets-layout-appearance-research-2026-11-03.md` (Reviewed) — **required input**
> Brief: QA-reviewed Manager brief "Theme Presets — Typed Layout Appearance Layer" (2026-11-03); source TZ DOC-2026-004
> Complexity: Level 4 (cross-package feature: types + new package + 2 backends + 2 authoring frontends + runtime template + E2E + docs)

## Overview

Add a typed `ThemePreset` layer for the three application layout templates (`dashboard`, `marketing-page`, `messenger-app`): named token presets (colors, typography, spacing, shape, shadows) stored as read-only file presets in a new `@universo-react/theme` package (seeded with `universo-default`) and as editable DB presets scoped to a metahub or an application. Each layout stores an `appearance` object (mode, presetRef, overrides, server-resolved snapshot) in `layouts[].config`; appearance is carried through publication and application sync; the runtime applies the resolved snapshot through the existing single MUI CSS-variables theme (`AppTheme`/`AppMainLayout`) with no preset-table reads and no raw CSS. Authoring happens in one shared UI panel used by both metahub and application frontends.

**Owner-confirmed contract for this implementation (fresh-database, no-legacy):**

- The test database will be deleted and recreated; new metahubs/applications are created fresh. **No backfill, no compatibility projections, no legacy code in touched paths.**
- Consequently the legacy marketing appearance fields `themeMode` / `primaryColor` / `accentColor` are **removed** from `marketingPageConfigSchema` and fully superseded by `appearance` (deviation from TZ FR-031's "old fields stay readable", approved by the owner in the PLAN session; the action-policy fields `allowEmailActions` / `allowTelephoneActions` / `externalLinkTarget` remain — they are not appearance). Under the same fresh-DB contract, TZ §16.5 acceptance criterion 7 ("old marketing layouts don't break") is satisfied by construction: the recreated database contains no old layouts, and no legacy read path is carried forward.
- **No platform schema version bump and no metahub-template version bump** (`CURRENT_SCHEMA_SNAPSHOT_VERSION` stays `1`).
- Serious refactoring of existing packages is allowed where it removes duplication (per research F1/F5 and the mui-runtime-ux reuse rules).

## Affected Areas

| Area | Files / packages |
|---|---|
| Shared types | `packages/universo-react-types/src/common/themePreset.ts` (new), `marketingPageRuntimeSchemas.ts`, `dashboardLayout.ts`, `messengerAppPrimitives.ts`, `applicationLayouts.ts`, `publicApplicationRuntime.ts`/DTOs |
| New package | `packages/universo-react-theme/` (`@universo-react/theme`): presets, resolver, MUI adapter, contrast validator, tsdown dual build, README |
| Metahubs backend | `platform/migrations/1800000000290-*`, `platform/systemAppDefinition.ts`, `domains/theme-presets/*` (new), `domains/router.ts`, `domains/shared/snapshotLayouts.ts` (no change expected), `domains/layouts` (appearance endpoints) |
| Applications backend | `platform/migrations/1800000000350-*`, `platform/systemAppDefinition.ts`, `persistence/themePresetsStore.ts` (new), `persistence/themePresetsAuditStore.ts` (new), `routes/themePresetsRoutes.ts` (new), `routes/index.ts` (flag gate), `controllers/*` (appearance endpoints), `utils/applicationLayoutHash.ts` (strip `resolved`), `services/effectiveLayoutResolverCore.ts` (expose appearance), `services/publicMarketingRuntime.ts`, `controllers/runtimeMarketingPageController.ts`, `services/publicMessengerRuntime.ts`, `routes/applicationSyncRoutes` (no change expected), `marketing-page/runtimeDto.ts` in apps-template-mui |
| rest-docs | `packages/universo-react-rest-docs/scripts/generate-openapi-source.js` (routeSources), `src/openapi/index.yml` (regenerated) |
| Shared utils | `packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts` (strip `resolved`), `src/env/themePresetsConfig.ts` (new flag), `permissionService` config exposure (auth-backend) |
| Runtime template | `packages/universo-react-apps-template-mui/src/shared-theme/{AppTheme,themePrimitives}.ts`, `src/layouts/AppMainLayout.tsx`, `src/marketing-page/MarketingRuntimeContent.tsx`, `src/standalone/DashboardApp.tsx` + messenger/public dashboard hosts, `src/marketing-page/runtimeDto.ts`, `index.html` shells (InitColorSchemeScript), customizations re-tokenization |
| Shared UI | `packages/universo-react-template-mui/src/components/theme/ThemeAppearancePanel.tsx` (new), `ThemePresetManagerDialog.tsx` (new), `ThemePreview.tsx` (new) |
| Authoring frontends | `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/*` (appearance section; remove marketing branch), `packages/universo-react-applications-frontend/src/pages/application-layouts/*` (appearance section; delete `ApplicationMarketingAppearancePanel.tsx`), API clients + TanStack Query hooks |
| i18n | `packages/universo-react-i18n/src/locales/{en,ru}/core/appearance.json` (new shared namespace) + `tools/check-i18n-coverage.mjs` + i18n `fallbackNS` |
| Tests | Vitest (types, theme, template-mui, apps-template-mui, frontends), Jest (both backends incl. PostgreSQL integration), Playwright flow + visual specs, parity/migration tests, `test:mui-v9-policy`, `test:i18n-coverage` |
| Docs | `docs/en/platform/theme-presets.md` (new) + `docs/ru/...`, `docs/{en,ru}/guides/application-layouts.md`, `docs/{en,ru}/platform/marketing-page-template.md`, `docs/{en,ru}/platform/messenger-app-template.md`, package README |

## Pinned Decisions (from research F1–F14; PLAN confirms)

1. **Storage**: `appearance` is an optional field on each template's strict renderer config schema, referencing one shared `themeAppearanceSchema` in `@universo-react/types`. Not the neutral `__layout` slot (research F1).
2. **Hashes**: `appearance.resolved` is stripped from the sync content hash (`decodeLayoutForHash`, `applicationLayoutHash.ts:90-96`) and the publication snapshot hash (`normalizeLayout`, `publicationSnapshotHash.ts:57-70`); `mode/presetRef/overrides` stay hashed; `resolved` stays in the runtime `effectiveHash` (research F2).
3. **Canonicalization**: `json-stable-stringify` (existing `stableStringify` wrapper in `@universo-react/utils`); RFC 8785 deferred (F3).
4. **Migrations**: `SqlMigrationDefinition` chain (AGENTS.md's `createSchemaMigrationDefinition()` does not exist): metahubs `1800000000360`, applications `1800000000350`; `targetBusinessTables` + parity tests updated in lockstep; `down: []`; never edit applied migrations (F4).
5. **Audit**: dedicated append-only `rel_theme_preset_audits` table per schema, written through a store module on `DbExecutor` inside the same transaction as the mutation (no auto-triggers) (F6).
6. **Registry**: statically imported `.theme.json` + Zod parse + duplicate-codename module-init guard; tsdown `platform:'neutral'` dual build mirroring `universo-react-types/tsdown.config.ts` (F7).
7. **Flag**: `THEME_PRESETS_ENABLED` (default **true**) in `@universo-react/utils/env`, gating route registration in both backends; exposed to the frontend via the `/auth/permissions` config payload; **runtime read path ungated** — accepted rollback semantics: layouts that already carry `appearance` keep rendering their persisted resolved tokens with the flag off (research F8 caveat) (owner may override the name; TZ proposed `THEME_PRESETS_V2`).
8. **Runtime**: `resolvedTokens` prop on `AppTheme` memoized **on the resolved hash** (not object identity); `appearance.mode` applied via `setMode()` from `useColorScheme` (post-mount `defaultMode` is ignored by MUI); single ThemeProvider via `AppMainLayoutContext`; `xThemeComponents` memoized; `InitColorSchemeScript` added to shell HTMLs (F9/F10).
9. **Mode precedence at runtime boot** (resolves the research open question): effective mode = user's stored `mui-mode` (MUI storage — user toggle wins per TZ §7.3) → else viewer `?themeVariant=` (explicit URL intent) → else `appearance.mode` → else `system`. Implemented server-side: the public/effective runtime payload returns `appearance.mode` **already overridden by `themeVariant`** when present, so the client never re-derives.
10. **Security**: allowlist-only Zod tokens; forbidden keys (`__proto__`, `constructor`, `prototype`) rejected explicitly at validation; resolver deep-merge is pollution-guarded (F12).
11. **Contrast**: pair-based checker — blocking errors for text pairs at 4.5:1 (WCAG 1.4.3), non-blocking warnings for UI pairs at 3:1 (WCAG 1.4.11). Pair matrix below (research F11). **Owner-confirm note:** TZ FR-019 literally reads "ошибка при < 3:1 для крупного/UI"; this plan downgrades UI-pair violations to warnings (FR-020's warning channel) because "large text" has no token representation and blocking on divider contrast would be overly strict — confirm with the owner.
   **RESOLVED 2026-11-08 (implemented matrix):** text pairs (text.primary/secondary vs backgrounds) are blocking errors at 4.5:1; `contrastText`/`main` pairs and UI pairs (divider, primary/secondary vs background) are **warnings**; divider exempt from the error list. In-code rationale (`themePreset.ts`): universo-default itself is ~3.7:1 on contrastText — blocking would reject the platform's own built-in preset. Owner accepted the implemented matrix during the 2026-11-06 review cycle (no correction requested).
12. **Re-tokenization (MVP-minimal)**: static literals in `apps-template-mui/src/shared-theme/customizations/*` and `src/dashboard/theme/customizations/*` move to `(theme.vars || theme)` reads; dead `getDesignTokens` (zero callers, mode-unsafe) is removed; component-level hardcodes are follow-up backlog (F13).
13. **Permissions**: metahubs — mutations via `createMetahubHandler(..., { permission: 'manageMetahub' })`, reads via bare membership; applications — mutations via `ensureApplicationAccess(..., ['owner','admin'])` (same as layouts `APPLICATION_ADMIN_ROLES`), reads via the same configurable read-policy pattern as layouts.
14. **Cross-schema preset policy (no invented plumbing)**: there is no application→metahub FK and the applications RLS executor has no metahubs membership, so the applications backend **never reads `metahubs.obj_theme_presets`**. Application layouts synced from a metahub carry the metahub-authored `appearance` (incl. `resolved`) verbatim through publication/sync — the runtime renders it without preset reads (FR-034). Re-resolution (`PATCH`/`apply-latest`) on a layout whose `preset.source === 'metahub'` returns **409 `THEME_PRESET_SOURCE_UNAVAILABLE`** (TZ §11.5/§7.5), and the UI responds exactly as §7.5 says: warning + "Скопировать в приложение" (copy creates an application-scoped DB preset with `base_preset_codename` origin and rebinds the layout) or select another preset. Metahub publication re-validates appearance integrity at snapshot time (TH-17).

## UI Contract (mui-runtime-ux skill)

- Panel composition (shared `ThemeAppearancePanel` in `template-mui`), rendered as a **`Paper variant='outlined'` section**. **DEVIATION (owner decision 2026-11-06, implemented):** appearance moved into a dedicated **Main|Theme («Основное|Тема»)** tab pair on the layout details page in BOTH frontends (metahubs `LayoutDetails.tsx`, applications `ApplicationLayouts.tsx`) — replacing the original `beforeZonesContent` placement; the panel itself lives on the Theme tab, dashboard behavior/side-menu panels stay on Main. Also renamed UI-wide «Оформление»→«Тема»/Theme per the owner's terminology decision:
- Panel composition (shared `ThemeAppearancePanel` in `template-mui`):
  - Preset picker: `DropdownSelect` (`@universo-react/template-mui/dropdowns`) listing file + DB presets as "Name (source, vN)"; archived presets excluded for new selection; inherited-source badge for application layouts showing a metahub preset.
  - Mode selector: `DropdownSelect` with `system | light | dark`, helper text "user toggle overrides this default" (localized).
  - Overrides editor: color rows use the existing `HexColorField` (apps-template-mui) via a thin wrapper passed as props from the host package (panel stays package-agnostic; template-mui uses `HexColorPickerPopover`); `themeHexColorSchema` is #RRGGBB-only (stricter than the legacy `parseInterpretationNetworkHexColor` normalizer — token fields never accept shorthand/alpha; the normalizer stays untouched for its existing consumers), numeric fields for base spacing/radius/border width, `DropdownSelect` enums for density/font/shadows.
  - Contrast feedback: blocking errors as localized `Alert` with the failing pair names; warnings as non-blocking `Alert` with severity `warning`; both shown before save; save button disabled while errors exist.
  - Preview: `ThemePreview` renders representative primitives (Button variants, TextField, Card, Table snippet, Dialog trigger) in light and dark using `MuiThemeProvider`-isolated preview canvas **inside the authoring surface only** (authoring preview is exempt from the single-provider rule because it is an isolated sandbox; the runtime keeps exactly one provider).
  - Preset manager dialog (`ThemePresetManagerDialog`): **Card-grid list** (`gridTemplateColumns: repeat(auto-fit, minmax(min(100%,280px),1fr))` + `gridSpacing` from template-mui — the `MessengerBindingsPanel` idiom; `CompactListTable` is the fallback if a table reads better) showing name/description/source/version/status/usage count (localized, no UUIDs); actions Create / Copy / Archive / Export (download `<codename>.theme.json`); Delete via `ConfirmDeleteDialog` enabled only when unused (API 409 + usage list backs it); `Alert` with inline retry for load errors and `Alert` empty states; notistack (`useSnackbar`) toasts for every action result.
- Localized validation EN/RU via the shared `appearance` i18n namespace; no page-level horizontal overflow at 320px; long names truncate with tooltips; every control carries `data-testid` via a **`testIdPrefix` prop** (mirroring `HexColorField`'s `testId`), so hosts render `application-appearance-*` / `metahub-appearance-*` consistent with the existing `application-marketing-appearance-*` convention (`appearance-preset-select`, `appearance-mode-select`, `appearance-color-primary-main`, `appearance-save`, `appearance-contrast-error`, `preset-manager-open` are the suffixed names).
- Read-only users (members without manage rights) see the panel disabled with an explanatory hint; server still enforces 403.

## Plan Steps

### Phase A — Types and schemas (`@universo-react/types`)

- [ ] **TH-01** Create `packages/universo-react-types/src/common/themePreset.ts`: `themeTokensSchema` (strict, allowlist), `themeAppearanceSchema` (mode/presetRef/overrides/resolved), limits, codename regex, contrast pair checker (generalizing `marketingColorLuminance` → `themeColorLuminance`, reusable by the marketing schema which will import from here), error-code constants. Export from the package index.

```ts
// packages/universo-react-types/src/common/themePreset.ts (core excerpt)
import { z } from 'zod'

export const THEME_PRESET_CODENAME_REGEX = /^[a-z][a-z0-9-]{2,63}$/
export const THEME_PRESET_MAX_BYTES = 64 * 1024
export const THEME_PRESETS_MAX_PER_SCOPE = 100

const forbiddenKeySchema = z.string().refine(
  (key) => !['__proto__', 'constructor', 'prototype'].includes(key),
  { message: 'forbidden-key' },
)

export const themeHexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex-color') // #RRGGBB only, per TZ FR-018

export const themeFontFamilySchema = z.enum(['inter', 'system', 'serif', 'mono'])
export const themeDensitySchema = z.enum(['compact', 'comfortable'])
export const themeShadowScaleSchema = z.enum(['none', 'soft', 'default', 'strong'])

const colorSlotSchema = z.strictObject({
  main: themeHexColorSchema,
  contrastText: themeHexColorSchema,
})

export const themeModeColorsSchema = z.strictObject({
  primary: colorSlotSchema,
  secondary: colorSlotSchema,
  background: z.strictObject({ default: themeHexColorSchema, paper: themeHexColorSchema }),
  text: z.strictObject({ primary: themeHexColorSchema, secondary: themeHexColorSchema }),
  divider: themeHexColorSchema,
})

export const themeSharedTokensSchema = z.strictObject({
  typography: z.strictObject({
    fontFamily: themeFontFamilySchema,
    baseSize: z.number().int().min(12).max(20),
    scale: z.number().min(1.1).max(1.4),
    weights: z.strictObject({ regular: z.number().int().min(300).max(400), medium: z.number().int().min(400).max(600), bold: z.number().int().min(600).max(900) }),
  }),
  spacing: z.strictObject({ base: z.number().int().min(4).max(16), density: themeDensitySchema }),
  shape: z.strictObject({ borderRadius: z.number().int().min(0).max(24), borderWidth: z.number().int().min(0).max(4) }),
  shadows: z.strictObject({ scale: themeShadowScaleSchema }),
})

export const themeTokensSchema = z.strictObject({
  shared: themeSharedTokensSchema,
  modes: z.strictObject({ light: themeModeColorsSchema, dark: themeModeColorsSchema }),
})
// `strictObject` at every level rejects unknown keys (incl. __proto__/constructor/prototype) — no extra walk needed.
// Weight ranges are a PLAN decision (TZ §10.3 only exemplifies 400/500/700).

export const themePresetRefSchema = z.strictObject({
  source: z.enum(['file', 'metahub', 'application']),
  id: z.string().min(1),          // file codename or UUID v7
  version: z.number().int().positive(),
})

export const themeResolvedSchema = z.strictObject({
  hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  tokens: themeTokensSchema,
})

export const themeAppearanceSchema = z.strictObject({
  mode: z.enum(['system', 'light', 'dark']).default('system'),
  preset: themePresetRefSchema,
  overrides: themeOverridesSchema, // deep-partial of themeTokensSchema; sparse; null = revert to preset value
  resolved: themeResolvedSchema,   // server-owned
})
```

  Key detail: `overrides` is a deep partial of tokens where `null` means "revert to preset" — implement `themeOverridesSchema` via a deepPartial helper plus explicit `nullable()` on leaves. The appearance schema used **inside** layout config keeps `resolved` optional-at-transport and required-after-resolution; the write API schema (TH-16) makes client-sent `resolved` forbidden (server-owned).

- [ ] **TH-02** Wire `appearance` into the three template schemas and remove the legacy marketing fields:
  - `marketingPageRuntimeSchemas.ts`: drop `themeMode/primaryColor/accentColor`; keep `allowEmailActions/allowTelephoneActions/externalLinkTarget`; add `appearance: themeAppearanceSchema.optional()`. Re-point the marketing color validation to the shared luminance helper; keep `marketingThemeColorSchema` for any remaining consumer or delete it if unused after refactor.
  - `dashboardLayout.ts` / `messengerAppPrimitives.ts`: add the same optional `appearance`.
  - `applicationLayoutConfig.ts`: `MARKETING_ONLY_LAYOUT_CONFIG_KEYS` shrinks to the still-marketing-only keys (`brandLogo`, `allowEmailActions`, `allowTelephoneActions`, `externalLinkTarget`); `appearance` is cross-template and must **not** enter that list; `RESERVED_LAYOUT_CONFIG_KEYS` unchanged.
  - Update the strict consumers in the same commit (research F5 lockstep): `toPublicConfig` (TH-18), `runtimeDto.ts` renderer schema, `ApplicationMarketingAppearancePanel` (deleted in TH-28), metahubs `MarketingAppearancePanel` branch (removed in TH-27). Because the DB is fresh, no data migration is needed; all touched paths drop legacy projections outright.
  - Tests (Vitest, `packages/universo-react-types/src/__tests__/themePreset.test.ts` per the existing convention): valid/invalid tokens, boundary values, unknown keys, `__proto__`/`constructor`/`prototype`, the TZ FR-017 string vectors (`url()`, `@import`, `expression()`, `javascript:` — unreachable by construction, asserted as rejected cases), overrides sparse/null semantics, appearance round-trip through `parseApplicationLayoutConfig` for all three templates, legacy marketing fields now rejected.

### Phase B — New package `@universo-react/theme`

- [ ] **TH-03** Package skeleton mirroring `universo-react-types`: `package.json` (`main`/`module`/`types` + `exports` map, `"test": "vitest run"` + `vitest.config.ts`, `workspace:*` deps on `@universo-react/types` and `@universo-react/utils` only), `tsdown.config.ts` (`format: ['esm','cjs']`, `dts: true`, `platform: 'neutral'`, `treeshake: true`), `tsconfig.json` (CJS) + `tsconfig.esm.json`. The package is auto-discovered by the `packages/*` workspace glob — run `pnpm install` to link deps; no catalog entries needed (react-colorful is **not** a dependency of this package).
- [ ] **TH-04** `src/schema.ts` defines the file-preset envelope `themeFilePresetEnvelopeSchema` (`$schema/schemaVersion/id/version/name/description/tokens`), then `src/presets/universo-default.theme.json` — tokens extracted from `apps-template-mui/src/shared-theme/themePrimitives.ts` (`colorSchemes.light/dark` palette mains/backgrounds/text/divider, Inter, `baseSize: 16`, `scale`, `borderRadius: 8`, `borderWidth: 1`, `shadows.scale: 'default'`) + `src/presets/index.ts`:

```ts
// packages/universo-react-theme/src/presets/index.ts
import universoDefaultJson from './universo-default.theme.json'
import { themeFilePresetEnvelopeSchema } from '../schema'
import type { ThemeFilePreset } from '../schema'

const FILE_PRESETS: readonly ThemeFilePreset[] = [universoDefaultJson as ThemeFilePreset]

const codenames = new Set<string>()
export const fileThemePresets: readonly ThemeFilePreset[] = FILE_PRESETS.map((raw) => {
  const preset = themeFilePresetEnvelopeSchema.parse(raw) // throws at import time => build/boot fails on bad data
  if (codenames.has(preset.id)) throw new Error(`Duplicate file theme preset codename: ${preset.id}`)
  codenames.add(preset.id)
  return preset
})

export const defaultThemePresetRef = { source: 'file', id: 'universo-default', version: 1 } as const
export const findFileThemePreset = (id: string) => fileThemePresets.find((p) => p.id === id)
```

- [ ] **TH-05** `src/resolve.ts` — server-side resolver: `resolveThemeAppearance({ presetRef, overrides, mode })` → `resolved { hash, tokens }`. Deep-merge order: file/DB preset tokens → `overrides.shared` → `overrides.modes[mode]`, with pollution-guarded merge and `null`-revert semantics; canonical hash via `stableStringify` from `@universo-react/utils` + Node `crypto.createHash('sha256')` over `{ schemaVersion, presetRef, overrides, tokens }` (payload kept to JSON primitives per F3).

```ts
// pollution-guarded merge (excerpt)
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype'])
function mergeTokens<T>(base: T, patch: unknown): T {
  if (patch === null) return base                       // explicit revert to preset value
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return patch as T
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (FORBIDDEN.has(key)) continue                    // defense in depth; validation already rejected
    if (!(key in (base as Record<string, unknown>))) continue // unknown key: never materialized; strictObject validation already rejects it
    out[key] = mergeTokens((base as Record<string, unknown>)[key], value)
  }
  return out as T
}
```

  The merge only ever applies patches onto schema-valid base tokens and the result is re-validated with `themeTokensSchema.parse` before hashing — a resolved snapshot can never contain a key the schema rejects.
- [ ] **TH-06** `src/validate.ts` — contrast pair checker: blocking errors for `text.primary/text.secondary` vs `background.default/paper` and `contrastText` vs own `main` at ≥4.5:1; warnings for `divider` vs `background.default/paper`, `primary.main`/`secondary.main` vs `background.default` at ≥3:1. Returns `{ errors: ContrastIssue[], warnings: ContrastIssue[] }` with pair names for localization. Unit-test against WCAG fixtures.
- [ ] **TH-07** `src/createMuiThemeInput.ts` — pure adapter `themeTokensToMuiInput(tokens): MuiThemeInput` producing per-scheme palette overrides (`primary/secondary/background/text/divider` incl. `contrastText`), `typography` (font stack mapping for the `inter|system|serif|mono` enum, px-to-rem via the caller-provided `pxToRem`), `shape.borderRadius`, `spacing` unit, shadow-scale mapping (`none` → all-zero shadows; `soft|default|strong` → predefined CSS-var-safe arrays). No React import — keeps the package Node-safe for server-side resolution.
- [ ] **TH-08** Vitest unit tests: registry (duplicate codename guard, schema failure, deterministic sort order — TZ §16.1 item 5), merge semantics (sparse overrides, `null` revert, forbidden keys, mode selection), hash stability (same inputs → same hash; key-order independence), contrast pass/error/warning fixtures, MUI adapter shape. **TZ §16.1 area 7 ("CSS vars serialization") is satisfied by MUI itself**: `createTheme` with `cssVariables` generates the `--template-*` variables, so no custom serializer is built — the adapter tests assert the input shape instead. `pnpm --filter @universo-react/theme test`.

### Phase C — Database layer

- [ ] **TH-09** Metahubs migration `packages/universo-react-metahubs-backend/src/platform/migrations/1800000000290-CreateThemePresets.sql.ts` + `themePresetsMigrationSql.ts` module: `metahubs.obj_theme_presets` (TZ §10.1 DDL: UUID v7 PK via `public.uuid_generate_v7()`, `metahub_id` FK, `codename`, `name/description JSONB`, `tokens JSONB` with object/size CHECKs, `base_preset_id/base_preset_codename`, `schema_version`, full `_upl_*` block) + unique active-codename partial index + `metahubs.rel_theme_preset_audits` (append-only: `event_type VARCHAR(48)`, `changed_fields JSONB`, `previous_version/new_version INTEGER`, actor + FK RESTRICT; mutation-blocking trigger copied from `reject_application_control_audit_mutation` pattern). RLS: `ENABLE ROW LEVEL SECURITY`; policy `FOR ALL USING (membership EXISTS(metahubs.rel_metahub_users) OR admin.is_superuser(auth.uid)) WITH CHECK (...)` per the `1766351182000` exemplar; `REVOKE ALL FROM PUBLIC/anon`; conditional `GRANT TO authenticated` DO-block. Register in `platform/migrations/index.ts` + `systemAppDefinition.ts` (`{ kind: 'sql', definition, bootstrapPhase: 'post_schema_generation' }`) and append both tables to `targetBusinessTables`. Update `metahubsSchemaParityContract.test.ts` chain + tables.
- [ ] **TH-10** Applications migration `1800000000350-CreateThemePresets.sql.ts`: mirror with `applications.obj_theme_presets` (FK `application_id` → `obj_applications`) + `applications.rel_theme_preset_audits`; RLS via the non-recursive `applications.has_active_application_membership(application_id, roles)` helper pattern from `1800000000340` (owner/admin/editor for read-and-manage per policy below; anon revoked). Register + `targetBusinessTables` + `systemAppDefinition.test.ts` chain update.
- [ ] **TH-11** `packages/universo-react-metahubs-backend/src/domains/theme-presets/themePresetsStore.ts`: free functions over `SqlQueryable` — `listThemePresets` (file + DB by default, TZ §11.1 `?include=file`; usage counts via a `jsonb_path_exists` scan over the scope's layouts — bounded by the layouts-per-scope scale; if that scan proves hot, a maintained usage counter column is the fallback), `getThemePreset`, `createThemePresetInTransaction` (codename uniqueness → typed conflict; **scope limit: count active presets and refuse with 409 `THEME_PRESET_LIMIT_REACHED` when `THEME_PRESETS_MAX_PER_SCOPE` is reached** — enforcement of Security §13/Brief Goal 1), `updateThemePresetInTransaction` (`WHERE _upl_version = $expectedVersion`, `RETURNING`, zero-rows → `OptimisticLockError`), `archiveThemePresetInTransaction` / `deleteThemePresetIfUnusedInTransaction` (**both take `expectedVersion`** like the bot-bindings release and layout delete precedents; delete counts usages first, refuses with `THEME_PRESET_IN_USE` and returns the usage list per FR-009), `recordThemePresetAuditInTransaction` — called for **create/update/copy/archive/apply/export** (FR-051/FR-053; export audit rides in the same transaction that reads the preset for export). Audit `changed_fields` records **token refs** (codename, version, changed token paths), never full token payloads — keeps audit rows small and avoids duplicating up to 64 KiB per mutation; never log a raw appearance body on resolve failure (the metahubs logger has no redaction). Controller-level mapping: `OptimisticLockError` → **409 `THEME_PRESET_VERSION_CONFLICT`** (the TZ §11.5 code — mapped at the metahubs controller, not the generic `OPTIMISTIC_LOCK_CONFLICT`). All SQL schema-qualified, `$1`-parameterized, soft-delete predicates consistent with `activeMetahubRowCondition`; DDL includes the TZ `codename` CHECK and both indexes (unique active-codename partial + `idx_*_active`).
- [ ] **TH-12** `packages/universo-react-applications-backend/src/persistence/themePresetsStore.ts` + `persistence/themePresetsAuditStore.ts`: same contract over `applications.obj_theme_presets`; audit store mirrors `applicationControlAuditStore.ts` shape (plain INSERT inside the caller's transaction, fail-closed on zero rows).
- [ ] **TH-13** Store tests: Jest + PostgreSQL against the local minimal Supabase (existing integration harness `run-applications-integration-local-supabase.mjs` pattern): CRUD round-trip, codename conflict → 409-mapped error, optimistic lock → `OptimisticLockError`, archive semantics, delete-in-use → refused, RLS denies cross-scope access and direct anonymous writes (deny-direct-writes pattern from the bot-bindings suite), audit rows immutable via trigger.

### Phase D — Backend domains, resolution, runtime

- [ ] **TH-14** Metahubs domain `packages/universo-react-metahubs-backend/src/domains/theme-presets/` — `routes/themePresetsRoutes.ts` (`createThemePresetsRoutes(ensureAuth, getDbExecutor, readLimiter, writeLimiter)`; `GET/POST /metahub/:metahubId/theme-presets`, `GET/PATCH/DELETE /metahub/:metahubId/theme-presets/:presetId`, `POST .../copy`, `GET .../export`), `controllers/themePresetsController.ts` built on `createMetahubHandlerFactory` — mutations **and `GET .../export`** require `{ permission: 'manageMetahub' }` (FR-051), list is bare membership; **path params validated with `uuidV7Schema` from `@universo-react/utils`** (the canonical home of the shared UUID-v7 schema per the bot-bindings precedent; `:presetId` and `:metahubId` both). `POST .../copy` accepts either a DB `presetId` (origin → `base_preset_id`) or a file preset ref body `{ source: 'file', id }` (origin → `base_preset_codename`) — copying any available preset into the managed scope per FR-005/FR-038; deep copy, new codename, source never mutated. **FR-048**: create/copy validate the requested codename against `fileThemePresets` and reject a conflicting codename (`THEME_PRESET_INVALID` with a "codename reserved by a file preset" detail); export of a DB preset whose codename collides with a file preset requires the caller to pass an explicit `?codename=` override that passes the same check. CSRF note: covered by the global `/api/v1` middleware (`core-backend/src/index.ts:597`) — **no per-route CSRF** in either backend. Export endpoint follows the `runtimeReportsController.exportReport` precedent:

```ts
res.setHeader('Content-Type', 'application/json; charset=utf-8')
res.setHeader('Content-Disposition', `attachment; filename="${preset.codename}.theme.json"`)
res.status(200).send(stableStringify(exportEnvelope)) // { $schema, schemaVersion, id, version, name, description, tokens }
```

  Wire into `domains/router.ts` behind the flag gate: `if (isThemePresetsEnabled()) router.use('/', createThemePresetsRoutes(...))`.
- [ ] **TH-16b** rest-docs: update `packages/universo-react-rest-docs/scripts/generate-openapi-source.js` routeSources with the new `themePresetsRoutes.ts` files (both backends) and the appearance PATCH/reset/apply-latest paths, regenerate `src/openapi/index.yml` (documenting `/…/theme-presets` and `/…/layouts/:layoutId/appearance*`). Mandatory: `scripts/verify-route-sources.js` exits 1 on an unregistered metahubs `router.use('/', createXRoutes(...))` mount and rest-docs `build` runs it first — a full `pnpm build` fails otherwise (precedent: messenger plan updated the same generator).
- [ ] **TH-15** Applications backend `routes/themePresetsRoutes.ts` (`/:applicationId/theme-presets` shape following `createApplicationsRoutes`), `controllers/themePresetsController.ts` (factory signature mirrors the real one — `(ensureAuth, getDbExecutor, readLimiter, writeLimiter, getRequestDbExecutor?: (req: Request) => DbExecutor)` per `applicationsRoutes.ts:24-37`; the controller throws when the request-scoped executor is missing, bot-bindings style), `services/themePresetsService.ts`, `persistence/themePresetsStore.ts` + `persistence/themePresetsAuditStore.ts` (TH-12). Path params validated with `uuidV7Schema`. **No cross-schema reads** (Pinned 14): the list returns file + application-scoped DB presets; there is no `?include=metahub` — inherited metahub appearance arrives inside the synced layout config, and the appearance surface offers "Скопировать в приложение" (copy of the inherited tokens into an application-scoped DB preset with `base_preset_codename` origin, rebinding the layout) whenever a layout carries `preset.source === 'metahub'`. Authorization inside `executor.transaction` (`ensureApplicationAccess(executor, userId, applicationId, ['owner','admin'])`), reads per the layouts read-policy. Wire into `routes/index.ts` behind `isThemePresetsEnabled()`.
- [ ] **TH-16** Layout appearance endpoints (both backends): `PATCH /…/layouts/:layoutId/appearance` (body: `{ mode, preset, overrides, expectedVersion }` — client-sent `resolved` rejected 400), `POST …/layouts/:layoutId/appearance/reset` (body `{ expectedVersion }` — removes `appearance` from config), `POST …/layouts/:layoutId/appearance/apply-latest` (body `{ expectedVersion }` — re-reads the referenced preset's latest active version, re-resolves). **Path params (`:layoutId`, `:metahubId`, `:applicationId`) validated with `uuidV7Schema`** (precedents `layoutsController.ts:48`, `applicationBotBindingsController.ts:65-73`). `preset.source === 'metahub'` in the applications backend → 409 `THEME_PRESET_SOURCE_UNAVAILABLE` with the copy/select guidance (Pinned 14). Server flow: authorize → load layout (optimistic `expectedVersion` 409 on mismatch) → resolve via `@universo-react/theme` (`resolveThemeAppearance`) → validate contrast (errors → 422 `THEME_APPEARANCE_RESOLVE_FAILED` with pair details) → write config through the store's renderer-config path → bump `_upl_version` → audit row. Response returns `{ layoutId, version, appearance }`. **Error mapping per backend**: metahubs — a `MetahubDomainError` subclass (`statusCode: 422/409/404`) flows through `createMetahubHandler` + `domainErrorHandler`; applications — the global `errorHandlerMiddleware` drops `code`/details, so the controller maps typed errors with `instanceof` (bot-bindings style) and returns `{ statusCode, code, message, details }` explicitly, with contrast pair details in `details.errors` for the frontend.
- [ ] **TH-17** Hash normalization + publication integrity: in `decodeLayoutForHash` (`applicationLayoutHash.ts:90-96`) strip `appearance.resolved` from the renderer config (keep `mode/preset/overrides`); in `normalizeLayout` (`publicationSnapshotHash.ts:57-70`) deep-omit `appearance.resolved` from `config` (single helper, reused for `layouts`/`scopedLayouts`). **Publication integrity (TZ §7.5/Appendix A #7)**: metahubs snapshot normalization (`snapshotLayouts.ts`, after the strict config parse) re-validates each `appearance` and, when `preset.source` is resolvable server-side (file registry, or the same-metahub DB preset), recomputes the hash and fails the publication with `THEME_APPEARANCE_RESOLVE_FAILED` on mismatch; `preset.source === 'metahub'` inside an application sync payload is carried as data (no re-check — Pinned 14). Tests: preset-library edit does not flip `local_content_hash`; overrides edit does; publication rejects a tampered `resolved`.
- [ ] **TH-18** Runtime projections: `toPublicConfig` (`publicMarketingRuntime.ts`) → new shape `{ appearance: { mode (effective: themeVariant override applied), hash, tokens }, allowEmailActions, allowTelephoneActions, externalLinkTarget }` — resolved tokens only, no preset IDs; **when `config.appearance` is absent the projection backfills the `universo-default` resolved snapshot** (TZ §11.4/§15.2 — behaviorally identical to today's primitives, but the contract and its test are explicit); re-validate with the schema (fail-closed preserved). Apply the same projection in `publicMessengerRuntime.ts`, `runtimeDto.ts` (frontend DTO), and extend `effectiveLayoutResolverCore` response so authenticated runtimes get `appearance` in `layout.config` (already pass-through after TH-02). Implement the `themeVariant` → `appearance.mode` override server-side in the marketing/messenger runtime builders (single place per backend). Observability (TZ §14.4, minimal): log `themeHash` and resolve duration on resolution paths — **never the raw appearance body** (metahubs logger has no redaction); metrics stay log-field based in the MVP (no metrics stack exists). Update `runtimeMarketingPageController` tests accordingly.
- [ ] **TH-19** Flag: `packages/universo-react-utils/src/env/themePresetsConfig.ts` — `isThemePresetsEnabled()` reading `THEME_PRESETS_ENABLED` via the private `parseEnvBoolean(value, true)` pattern (copy from `adminConfig.ts:27`, do not export the helper); expose in the `/auth/permissions` config payload (`permissionService.ts` `getAdminConfig()` extension) so frontends gate the tab server-controlled.
- [ ] **TH-20** Backend Jest suites: routes/controllers (auth 401/403, 409 conflicts incl. `THEME_PRESET_LIMIT_REACHED`, 404, flag-off 404), service resolution (deterministic `resolved`, hash equality across orderings), **FR-048: export/create codename conflicts with file presets (override accepted, conflict rejected)**, projection tests (appearance in public payload; **default backfill when appearance absent**; no internal IDs; tokens only), sync behavior (`local_modified` marks on overrides change only — not on preset re-resolution; **source-removed layout retains its resolved snapshot**), `LAYOUT_PERSISTED_INVALID` fail-closed path with an appearance-bearing config, and copy-from-file-preset → DB (FR-038: new codename, `base_preset_codename` origin, version 1).

### Phase E — Runtime frontend (`apps-template-mui`)

- [ ] **TH-21** `AppTheme`: new `resolvedTokens?: { hash: string; input: MuiThemeInput }` prop; `createTheme` memoized on `[tokensHash, disableCustomTheme, themeComponentsKey]` where the adapter output is rebuilt only when `tokensHash` changes; `AppMainLayout` extends `AppMainLayoutAppearance` with the resolved snapshot, applies palette via the adapter, and switches mode through a `useColorScheme().setMode(effectiveMode)` effect keyed on the runtime appearance mode (not `defaultMode`, which is init-only); `xThemeComponents` wrapped in module-level memo or `useMemo([])`. Guest/public hosts (`PublicDashboardApplicationRuntime`, messenger host) get the same extraction; `DashboardApp` extracts `appearance` from `layout.config` (today only `sideMenu` is read).
- [ ] **TH-22** `InitColorSchemeScript` with defaults (`attribute="data-mui-color-scheme"`) added to `packages/universo-react-apps-template-mui/index.html` and `packages/universo-react-core-frontend/index.html` (+ `public/index.html` if it is a served shell), placed before the app mount script — kills the dark-mode first-paint flash (research F10).
- [ ] **TH-23** Runtime consumers: `MarketingRuntimeContent` reads `config.appearance` (resolved) instead of building `{ defaultMode, primaryColor, accentColor }`; messenger and public-dashboard hosts pass the same; `runtimeDto.ts` parses the new public payload; delete the legacy three-field mapping. Preview story: the authoring preview (TH-26) is the only place rendering an alternate theme.
- [ ] **TH-24** Vitest for `apps-template-mui`: AppTheme memoization (rebuild only on hash change — spy on `createTheme`), `setMode` effect, runtime DTO parsing of the new payload, host extraction for all three templates.

### Phase F — Authoring UI

- [ ] **TH-25** i18n: `packages/universo-react-i18n/src/locales/{en,ru}/core/appearance.json` (namespace `appearance`) — shared labels for the panel and preset manager (mode names, token labels, contrast messages incl. pair names, source labels `file/metahub/application`, actions, empty states, read-only hint, and the "user toggle overrides layout mode" helper per TZ §7.3). Register statically in `src/instance.ts` next to `common`, **and register the namespace in both guard points or the gate fails**: add `appearance` to `FALLBACK_LOCALES` in `tools/check-i18n-coverage.mjs:147-161` and to `fallbackNS` in `packages/universo-react-i18n/src/instance.ts:235`. Verify `test:i18n-coverage`.
- [ ] **TH-26** Shared UI in `packages/universo-react-template-mui/src/components/theme/`: `ThemeAppearancePanel.tsx` (presentational; props: presets list, appearance value, contrast result, callbacks `onChange/ onSave / onManagePresets`; uses `DropdownSelect`, `StandardDialog`, `useConfirm`; all controls `data-testid`-tagged; localized validation), `ThemePresetManagerDialog.tsx` (list + create/copy/archive/export actions; usage counts; delete disabled when used), `ThemePreview.tsx` (light/dark canvas with `createTheme` from the adapter — sandboxed preview provider scoped to the preview Box, runtime untouched). Panel is dependency-clean: no imports from feature packages (isolation rule); color picker passed in as a prop (`HexColorPickerPopover` from template-mui itself; hosts may pass `HexColorField`).
- [ ] **TH-27** Metahubs integration: `domains/layouts/ui/LayoutAppearanceSection.tsx` (wraps the shared panel; save via the dedicated appearance PATCH), replace the `MarketingAppearancePanel` branch in `LayoutRuntimeSettingsPanel.tsx` with the appearance section for all three templates; hooks `hooks/useThemePresets.ts` following the existing `mutations.ts` idiom (TanStack Query keys `metahubsQueryKeys.themePresets(metahubId)`, `useSnackbar` + localized toasts, invalidation of presets + layouts + runtime queries); `api/themePresets.ts`.
- [ ] **TH-28** Applications integration: `pages/application-layouts/ApplicationAppearanceSection.tsx`; delete `ApplicationMarketingAppearancePanel.tsx` and fold `resetMarketingAppearance` into the appearance reset mutation; hooks + `api/applications.ts` extensions (`fetchApplicationThemePresets`, `updateLayoutAppearance`, `resetLayoutAppearance`, `applyLatestAppearance`) following the existing inline-`useMutation` + `invalidateLayouts()` pattern (`useApplicationLayoutsController.ts`), with notistack feedback and the copy-to-application action for inherited metahub appearance (Pinned 14); invalidate `layouts`, `layoutDetail`, `applicationDiff`, runtime queries (existing `invalidateApplicationLayoutsQueries`).
- [ ] **TH-29** Component tests (**Jest + Testing Library for `template-mui`** — that package's runner is Jest with `jest-canvas-mock`, not Vitest; Vitest for the host frontends): panel rendering per template, contrast error/warning display blocks save, preset manager flows with mocked API, i18n EN/RU snapshots, no raw IDs/JSON in DOM; `check:apps-template-isolation` and `test:mui-v9-policy` stay green.
- [ ] **TH-30** Browser UX evidence (runtime-ux-qa skill): Playwright-driven manual pass on the authoring surfaces at 1280px and 390px — screenshots captured and **reviewed** (no page-level horizontal overflow, portals themed, EN/RU); accessibility items from TZ §14.2 checked on the new surfaces: keyboard path + visible focus on every control, `prefers-reduced-motion` unaffected (the theme adds no animations), color is not the sole carrier (contrast messages name the pair in text), dark mode keeps inactive elements distinguishable.

### Phase G — Minimal re-tokenization

- [ ] **TH-31** Convert static literals in `apps-template-mui` customizations to `(theme.vars || theme)` reads: `surfaces.ts:79`, `navigation.tsx:48-57`, `datePickers.ts:16`, `charts.ts:41` (white popper backgrounds → `background.paper` var), static shadows → token-mapped shadows, `color:'#fff'` → `contrastText` vars; remove dead `getDesignTokens` from both `themePrimitives.ts` files (zero callers; mode-unsafe). Keep SVG brand fills untouched. Snapshot tests cover the visual output of customizations before/after.

### Phase H — E2E, visual, docs, gate

- [ ] **TH-32** E2E flow spec `tools/testing/e2e/specs/flows/theme-presets.spec.ts` using `support/backend/api-session.mjs` helpers (extend with `createThemePreset`, `updateLayoutAppearance`, `copyThemePreset`, `exportThemePreset`; record entities in `run-manifest.mjs`): create metahub → create DB preset (copy of default) → edit tokens → apply to layouts of all three templates → create application → publish → sync → assert public runtime payload carries `appearance.tokens` and no internal IDs → **application layout with inherited metahub appearance: PATCH returns 409 `THEME_PRESET_SOURCE_UNAVAILABLE`; copy-to-application succeeds and rebinding allows edits** (Pinned 14) → override in application (local modified) → re-sync → conflict semantics per existing rules → reset → export JSON (assert schema + `Content-Disposition`; codename-conflict case) → delete-in-use 409 (usage list in body) → read-only member sees disabled panel. Store-level RLS/deny-direct-write coverage follows the `applicationBotBindings.constraints.integration.test.ts` pattern (TH-13). Run under the minimal chain:

```bash
pnpm supabase:e2e:start:minimal && pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase \
  && cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase pnpm run build:e2e
# then
cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase \
  node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/theme-presets.spec.ts --project chromium
```

- [ ] **TH-33** Visual spec `tools/testing/e2e/specs/visual/theme-presets.visual.spec.ts` tagged `@visual`: public runtime pages for `dashboard`, `marketing-page`, `messenger-app` × light/dark (matrix projects `en-light`/`en-dark`/`ru-light`/`ru-dark` run it anonymously), plus the authoring surface states (default, contrast error, preset manager dialog). Baselines committed beside the spec; **every screenshot visually reviewed** — verify buttons, cards, tables, navigation, dialogs, portals, hero, messenger zones inherit preset tokens and there is no layout shift on theme switch; update baselines only via `test:e2e:visual:update` after human review.
- [ ] **TH-34** Docs (GitBook format, EN/RU): new `docs/en/platform/theme-presets.md` + `docs/ru/platform/theme-presets.md` (preset model, file vs DB presets, token reference with ranges, contrast rules and the UI-pairs-as-warnings semantics, export/import-to-file flow, security limits, feature flag, screenshots from TH-33; explicit warning that theme data is public UI data — no secrets, URLs, or personal data per FR-057; document that a 409 on delete returns the usage list; document that the user's light/dark toggle overrides the layout default mode and is stored per browser, plus the legacy Berry `isDarkMode` caveat; private/sensitive presets must not be shared in public issues/PRs — fork/PR hygiene per TZ §13); update `docs/{en,ru}/guides/application-layouts.md` (appearance in config, reset/apply-latest, sync semantics); rewrite the appearance paragraph in `docs/{en,ru}/platform/marketing-page-template.md` (appearance supersedes the three-field model; action policy unchanged); add an appearance note to `docs/{en,ru}/platform/messenger-app-template.md`; `packages/universo-react-theme/README.md` (format, resolver, hash, examples); correct AGENTS.md §"Creating a New Service" (`createSchemaMigrationDefinition()` → the `SqlMigrationDefinition` file chain, research F4).
- [ ] **TH-35** Full verification gate (record exact outcomes): `pnpm --filter @universo-react/types test`, `pnpm --filter @universo-react/theme test`, `pnpm --filter @universo-react/template-mui test` (Jest), `pnpm --filter @universo-react/apps-template-mui test`, `pnpm --filter @universo-react/metahubs-frontend test`, `pnpm --filter @universo-react/applications-frontend test`, metahubs/applications-backend Jest suites, `pnpm --filter @universo-react/rest-docs verify:route-sources` + regenerated catalog, `test:mui-v9-policy`, `check:apps-template-isolation`, `test:i18n-coverage`, fixture-contract checks (existing fixtures carry no `appearance` — expect no drift), `pnpm --filter <pkg> lint` per touched package, full `pnpm build`. **Typecheck (TZ §16.6)**: no root `typecheck` script exists — the existing equivalent is the full `pnpm build` (per-package `tsc`; `apps-template-mui` and `universo-react-i18n` have package-level `typecheck`); per §16.6 the plan uses the equivalent rather than inventing a command (IMPLEMENT may add a root `typecheck` script if desired). Then the TH-32/TH-33 minimal-Supabase chains **plus an E2E regression run of existing flow specs** (`application-layout-management.spec.ts`, marketing/messenger runtime specs, or `run-playwright-suite.mjs --grep @flow`), scoped Thermos/autoreview + OntoIndex `verify_diff` before commit (AGENTS.md gates). Fix-forward any regression — existing suites must stay green.

## Potential Challenges

1. **Strict-consumer lockstep** (research F5): removing the legacy marketing fields while adding `appearance` breaks `toPublicConfig`, `runtimeDto`, and both marketing panels simultaneously — TH-02/TH-18/TH-27/TH-28 must land as one coherent change set per commit series; the type compiler is the checklist (strict Zod fails loudly).
2. **Hash discipline**: `resolved` must be stripped in exactly two places (sync hash, snapshot hash) while remaining in `effectiveHash`; a missed path flips sync states. Covered by dedicated tests in TH-17/TH-20.
3. **Cross-schema duplication**: two migration catalogs, two RLS idioms (membership-table policy vs `has_active_application_membership` helper), two route-wiring styles. Both parity contracts are hard-coded — they must move in lockstep with `systemAppDefinition.ts`.
4. **Mode handling**: post-mount `defaultMode` is ignored by MUI; the `setMode` effect must be idempotent and must not fight the user's `mui-mode` override (server-side `themeVariant` resolution in TH-18 removes one client-side decision; the client applies only the final effective mode when the user has not overridden it).
5. **MUI v9 policy**: new UI must avoid removed props (`slotProps` only), use `catalog:` versions, and keep `DropdownSelect` as the only Select import path (boundary test).
6. **Preview vs single-provider rule**: the authoring preview renders an alternate theme — implemented as a scoped sandbox with an explicit comment; runtime surfaces keep exactly one provider.
7. **TanStack Query invalidation breadth**: appearance changes affect runtime queries (`invalidateApplicationRuntimeQueries.all`) and diff queries; missed invalidation shows stale runtime — covered in TH-28 by reusing the existing invalidation helper.
8. **Fresh-DB contract**: any accidental backfill/compat code (e.g. reading legacy fields "just in case") violates the owner instruction — code review gate in TH-35.

## Design Notes

- Resolver placement (TZ Appendix A #7): server-side at save/publish/apply-latest, inside `@universo-react/theme` (Node-safe: no React imports in `resolve.ts`/`createMuiThemeInput.ts`); the client never merges — it consumes `resolved`.
- Naming: UI «Оформление»/`appearance`; domain `ThemePreset`; API `/theme-presets`; config key `preset` inside `appearance` (TZ §10.2 JSON); prose uses the TZ §5 term `presetRef` for the same object; flag `THEME_PRESETS_ENABLED`.
- The shared `themeAppearanceSchema` lives in `@universo-react/types`; `@universo-react/theme` depends on types+utils only; frontends depend on theme+types. `apps-template-mui` adds `"@universo-react/theme": "workspace:*"` (a shared primitive, not a banned feature package — `check:apps-template-isolation` stays green) and imports only the `MuiThemeInput` type + adapter; it never imports `template-mui` or feature packages.
- IDs are UUID v7 (`public.uuid_generate_v7()`); optimistic concurrency on `_upl_version` everywhere (presets and layouts).
- Error codes follow TZ §11.5 (`THEME_PRESET_NOT_FOUND`, `THEME_PRESET_INVALID`, `THEME_PRESET_VERSION_CONFLICT`, `THEME_PRESET_IN_USE`, `THEME_PRESET_SCOPE_FORBIDDEN`, `THEME_APPEARANCE_RESOLVE_FAILED`, `THEME_EXPORT_FAILED`), mapped in the domain error handlers.

## Dependencies

- No cross-project (MMOOMM/Kiberplano) impact.
- Requires the fresh local test database (user recreates it; `supabase:e2e:start:minimal` profile for E2E — seed is empty, all data via API helpers).
- External references: MUI CSS theme variables + `InitColorSchemeScript` (mui.com, verified 2026-11-03; Context7 unavailable in this environment — vendored 9.2.0 sources used instead), WCAG 2.1 SC 1.4.3/1.4.11, DTCG 2025.10 (later phase only), research artifact citations.

## Suggested Execution Order

TH-01 → TH-02 → TH-03…TH-08 → TH-09/TH-10 → TH-11/TH-12/TH-13 → TH-14…TH-20 → TH-21…TH-24 → TH-25…TH-30 → TH-31 → TH-32…TH-35. Phases A–C are independently testable; D depends on A–C; E/F can start after D's contracts exist; H last.
