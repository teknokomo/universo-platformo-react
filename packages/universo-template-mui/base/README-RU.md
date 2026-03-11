# @universo/template-mui

Общий пакет Material UI для текущей React-оболочки Universo Platformo.

## Overview

Этот пакет содержит переиспользуемые блоки layout, dashboard, dialog, table, pagination, navigation и optimistic-CRUD, которые используются в разных frontend-модулях.
Это общий слой представления для текущей React-оболочки, а не самостоятельный бизнес-модуль.

## Package Surface

- `MainLayoutMUI` и `MainRoutesMUI` предоставляют общий layout и route shell.
- Экспорты dashboard, такие как `Dashboard`, `StatCard` и `HighlightedCard`, дают общие примитивы композиции страниц.
- Dialog, table, selection, pagination и card-компоненты переэкспортируются из корня пакета.
- Фабричные хелперы вроде `createEntityActions()` и `createMemberActions()` уменьшают дублирование CRUD-action wiring.
- Хуки вроде `usePaginated()`, `useDebouncedSearch()`, `useUserSettings()` и optimistic CRUD helpers поддерживают общие frontend-сценарии.

## Integration Role

- Пакет используется frontend-модулями auth, onboarding, admin, profile, metahubs и applications.
- Он зависит от общих frontend-контрактов из `@universo/i18n`, `@universo/types`, `@universo/utils` и `@universo/store`.
- Пакет собирается как переиспользуемый модуль с двойным JavaScript output и сгенерированными type declarations.
- Он должен оставаться domain-neutral: бизнес-термины и route semantics должны жить в consumer-пакетах, а не в общем template-layer.

## Development Notes

```bash
pnpm --filter @universo/template-mui build
pnpm --filter @universo/template-mui lint
pnpm --filter @universo/template-mui test
```

- Держите экспортируемые компоненты универсальными и пригодными для повторного использования в нескольких frontend-модулях.
- Добавляйте новые translation keys через общие или consumer namespaces с EN/RU parity.
- Здесь лучше документировать ответственность пакета, а module-specific workflows оставлять README consumer-пакетов.

## Related Documentation

- [Индекс пакетов](../../../packages/README-RU.md)
- [Core frontend shell](../../universo-core-frontend/base/README-RU.md)
- [Общий i18n runtime](../../universo-i18n/base/README-RU.md)
- [Общие доменные типы](../../universo-types/base/README-RU.md)

---

Universo Platformo | Shared MUI package