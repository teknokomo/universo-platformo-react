# @universo-react/theme

Typed theme-preset primitives for Universo Platformo layouts: the build-validated file-preset registry, size guards, and the pure MUI adapter. The Node-only resolver (canonical hashing) is isolated behind a subpath so browser bundles never pull `node:crypto`.

## Layout

```
src/
├── presets/
│   ├── universo-default.theme.json   # built-in preset (mirrors the platform base appearance)
│   └── index.ts                      # registry: Zod-parsed at init, unique codenames, sorted
├── adapter.ts                        # ThemeTokens → MUI input (palette/typography/shape/spacing/shadows)
├── validate.ts                       # 64 KiB token size guard
├── resolve.ts                        # server-only: pollution-guarded merge + sha256 (subpath ./resolve)
└── index.ts                          # browser-safe entry
```

## Usage

```ts
// Browser (runtime host / authoring preview)
import { themeTokensToMuiInput, fileThemePresets } from '@universo-react/theme'
const input = themeTokensToMuiInput(resolved.tokens) // spread into AppTheme via AppMainLayout appearance

// Server (preset services, publication integrity checks)
import { resolveThemeAppearance } from '@universo-react/theme/resolve'
const resolved = resolveThemeAppearance({ preset: { source: 'file', id, version }, presetTokens, overrides })
// → { hash: 'sha256:…', tokens } — throws ThemeAppearanceResolveError on validation failure
```

## File presets

Add a `<codename>.theme.json` file to `src/presets/` following the envelope (`schemaVersion`, `id` matching `^[a-z][a-z0-9-]{2,63}$`, `version`, localized `name`/`description`, `tokens`). The registry validates every file against `themeFilePresetEnvelopeSchema` at module init and rejects duplicate codenames — an invalid or duplicate file fails the build. Exported DB presets (`GET …/theme-presets/:id/export`) use the same envelope and can be dropped in directly.

Token reference, contrast semantics, limits, and the appearance contract live in `docs/en/platform/theme-presets.md`.
