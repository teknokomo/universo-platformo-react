# Theme Presets (Appearance)

Named **theme presets** (UI: «Оформление» / "Appearance") define the visual identity of application layouts: colors, typography, spacing, shape, and shadows. Presets are **data, not CSS**: validated JSON tokens rendered through MUI CSS variables. Arbitrary CSS, custom fonts, external URLs, and per-widget styles are out of scope by design (TZ DOC-2026-004).

## Presets and scopes

| Kind                        | Storage                                                  | Editing                                                    | Addressing                        |
| --------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------- |
| **File preset**             | `packages/universo-react-theme/src/presets/*.theme.json` | PR + rebuild (`FR-036` build validation, unique codenames) | codename, e.g. `universo-default` |
| **DB preset (metahub)**     | `metahubs.obj_theme_presets`                             | API/UI in the metahub                                      | UUID v7 + codename                |
| **DB preset (application)** | `applications.obj_theme_presets`                         | API/UI in the application                                  | UUID v7 + codename                |

The built-in `universo-default` file preset mirrors the platform's base appearance and is available everywhere. Copies get a new codename, version 1, and record their origin in `base_preset_id` (DB origin) or `base_preset_codename` (file origin). Deleting a preset that is used by layouts is refused (409 with the usage list); archiving keeps existing layouts working while hiding the preset from new selection.

## Appearance in a layout

Each layout's `config.appearance` stores:

-   `mode` — `system | light | dark` default color mode. A visitor's own light/dark toggle (persisted `mui-mode`) overrides it.
    -   **Legacy note:** the Berry-based platform shell still carries an old `isDarkMode` localStorage key (`universo-react-store` customization reducer). It is a leftover dual persistence from the previous shell — it does **not** participate in the appearance model. The effective precedence is: the visitor's `mui-mode` toggle → `appearance.mode` → `system`.
-   `preset` — `{ source: file | metahub | application, id, version }`.
-   `overrides` — sparse token overrides; absent keys keep the preset value, `null` reverts to it.
-   `resolved` — **server-owned** snapshot `{ hash: sha256:…, tokens }` recomputed at save/apply-latest. The client never merges tokens.

Application layouts synced from a metahub render the inherited resolved snapshot without reading metahub tables. Re-resolution of an inherited metahub preset returns 409 `THEME_PRESET_SOURCE_UNAVAILABLE`; copy the preset into the application (tokens become an application-scoped preset) or select another one.

## Tokens

-   Colors: `#RRGGBB` only, per light/dark mode — `primary`, `secondary` (each with `contrastText`), `background.default/paper`, `text.primary/secondary`, `divider`.
-   Typography: font (`inter | system | serif | mono`), base size 12–20, heading scale 1.1–1.4.
-   Spacing: base unit 4–16, density `compact | comfortable` (compact multiplies the unit by 0.75).
-   Shape: radius 0–24, border width 0–4.
-   Shadows: `none | soft | default | strong`.
-   Limits: 64 KiB per preset and per resolved snapshot, at most 100 active presets per scope.

**Contrast (WCAG 2.1)**: page-surface text pairs (`text.*` vs `background.*`) are blocking at ≥ 4.5:1 — the save is rejected. Component pairs (`contrastText` on brand colors, brand colors on backgrounds) surface non-blocking warnings at ≥ 3:1 (1.4.11). Dividers are decorative and exempt.

## Runtime

The public/authenticated runtime receives the **resolved tokens only** (no preset IDs); layouts without `appearance` render the `universo-default` snapshot. `?themeVariant=light|dark|system` overrides the appearance mode per request (viewer intent > layout default). The client rebuilds the MUI theme only when the resolved hash changes; `resolved` never participates in sync/publication hashes, so preset re-resolution does not mark layouts as locally modified.

## API

-   Presets: `GET/POST /metahub/:id/theme-presets`, `GET/PATCH/DELETE …/theme-presets/:presetId`, `POST …/copy`, `GET …/export` (JSON download `<codename>.theme.json`; a codename colliding with a file preset requires `?codename=`), and the same set under `/applications/:id/theme-presets`.
-   Layout appearance: `PATCH /…/layouts/:layoutId/appearance`, `POST …/appearance/reset`, `POST …/appearance/apply-latest` (all take `expectedVersion`; 409 on conflict).
-   Errors (TZ §11.5): `THEME_PRESET_NOT_FOUND`, `THEME_PRESET_INVALID`, `THEME_PRESET_VERSION_CONFLICT`, `THEME_PRESET_IN_USE`, `THEME_PRESET_SCOPE_FORBIDDEN`, `THEME_PRESET_SOURCE_UNAVAILABLE`, `THEME_APPEARANCE_RESOLVE_FAILED`, `THEME_EXPORT_FAILED`, `THEME_PRESET_LIMIT_REACHED`.

## Security

Typed allowlist tokens only — unknown keys (including `__proto__`/`constructor`/`prototype`) are rejected at validation and the resolver merge is pollution-guarded. No URLs, `@import`, secrets, or personal data: a theme is public UI data. All writes are audited to append-only `rel_theme_preset_audits` tables (create/update/copy/archive/apply/export). Scope and permissions are enforced server-side (metahub: mutations and export require `manageMetahub`, reads require membership; application: reads follow the application's configurable layouts read policy — "see the layout, see its theme" — while create/copy/archive/delete/export/apply stay `owner/admin`); preset tables are RLS-protected and never readable by anonymous runtimes. File presets are read-only data visible to anyone who can read layouts; application DB presets live strictly inside their application scope with no cross-application access. The anonymous runtime payload carries only `{ mode, resolved: { hash, tokens } }` — never the preset list or internal identifiers.

## Rollout / rollback

The feature is gated by `THEME_PRESETS_ENABLED` (default **true**); setting it to `false` hides the API routes and the authoring UI. Preset tables ship regardless and are inert without the flag. To turn a DB preset into a file preset: export the JSON, add it to `packages/universo-react-theme/src/presets/`, import it in `src/presets/index.ts` (the registry is an explicit import list), and ship via PR + rebuild.
