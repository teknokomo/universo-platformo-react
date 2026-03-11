# @universo/i18n

Централизованный i18n runtime-пакет для монорепозитория Universo Platformo.

## Overview

Этот пакет предоставляет общий экземпляр i18next, хелперы регистрации namespaces, реестр поддерживаемых языков и типизированный базовый слой переводов, который используется frontend-пакетами.
Это общий runtime-layer переводов, а дополнительные namespaces остаются ответственностью feature-пакетов.

## Public API

- Default export — это инициализированный singleton i18n instance из `getInstance()`.
- `useTranslation` и `Trans` переэкспортируются из `react-i18next`.
- `registerNamespace()` позволяет consumer-пакетам подключать собственные namespace bundles.
- `useCommonTranslations()`, `useHeaderTranslations()` и `useSpacesTranslations()` дают типизированные convenience hooks для shared namespaces.
- `supported-languages.json` является каноническим списком, который используют приложения и build tooling.

## How Namespaces Work

- Базовые namespaces и общие locale-файлы живут в этом пакете.
- Consumer-пакеты могут регистрировать дополнительные namespaces при импорте через `registerNamespace()`.
- Типобезопасность общих namespaces обеспечивается здесь через типы пакета и i18next augmentation.
- Domain-specific typed wrappers должны документироваться в том consumer-пакете, который владеет этим namespace.

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

- Держите English и Russian locale-файлы синхронизированными.
- Добавляйте новые base namespaces только тогда, когда они действительно общие для нескольких frontend-пакетов.
- Документация пакета должна оставаться сфокусированной на shared runtime; feature-specific translation helpers лучше описывать в consumer docs.

## Related Documentation

- [Индекс пакетов](../../README-RU.md)
- [Core frontend shell](../../universo-core-frontend/base/README-RU.md)
- [Общий MUI package](../../universo-template-mui/base/README-RU.md)
- [Документация i18next](https://www.i18next.com/)

---

Universo Platformo | Shared i18n runtime