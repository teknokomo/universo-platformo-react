# @universo/i18n

Centralized i18n runtime package for the Universo Platformo monorepo.

## Overview

This package provides the shared i18next instance, namespace registration helpers, supported-language registry, and the typed base translation surface used by frontend packages.
It is the common runtime layer for translations, while feature packages remain responsible for their own additional namespaces.

## Public API

- The default export is the initialized singleton i18n instance from `getInstance()`.
- `useTranslation` and `Trans` are re-exported from `react-i18next`.
- `registerNamespace()` allows consumer packages to attach their own namespace bundles.
- `useCommonTranslations()`, `useHeaderTranslations()`, and `useSpacesTranslations()` expose typed convenience hooks for shared namespaces.
- `supported-languages.json` is the canonical list consumed by apps and build tooling.

## How Namespaces Work

- Base namespaces and shared locale files live in this package.
- Consumer packages may register additional namespaces on import through `registerNamespace()`.
- Type safety for shared namespaces is provided here through the package types and i18next augmentation.
- Domain-specific typed wrappers should be documented by the consumer package that owns that namespace.

## Typical Usage

```typescript
import '@universo/i18n'
import { useTranslation } from '@universo/i18n'

export const Example = () => {
  const { t } = useTranslation('common')
  return <button>{t('actions.save')}</button>
}
```

## Development Notes

```bash
pnpm --filter @universo/i18n typecheck
pnpm --filter @universo/i18n lint
```

- Keep English and Russian locale files synchronized.
- Add new base namespaces only when they are genuinely shared across multiple frontend packages.
- Keep package-level docs focused on the shared runtime; feature-specific translation helpers belong in consumer docs.
- Runtime debug logs are disabled by default; enable them only when needed via `UNIVERSO_I18N_DEBUG=1` (or `globalThis.__UNIVERSO_I18N_DEBUG__ = true` in browser diagnostics).

## Related Documentation

- [Main package index](../../README.md)
- [Core frontend shell](../../universo-core-frontend/base/README.md)
- [Shared MUI package](../../universo-template-mui/base/README.md)
- [i18next documentation](https://www.i18next.com/)

---

Universo Platformo | Shared i18n runtime
