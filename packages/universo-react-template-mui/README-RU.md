# @universo-react/template-mui

Общий пакет Material UI для текущей React-оболочки Universo Platformo.

## Overview

Этот пакет содержит переиспользуемые блоки layout, dashboard, dialog, table, pagination, navigation и optimistic-CRUD, которые используются в разных frontend-модулях.
Это общий слой представления для текущей React-оболочки, а не самостоятельный бизнес-модуль.

## Package Surface

-   `MainLayoutMUI` и `MainRoutesMUI` предоставляют общий layout и route shell.
-   `StatCard` и `HighlightedCard` дают переиспользуемое отображение метрик в административных интерфейсах. Виджеты и композиция Dashboard опубликованных приложений находятся в изолированном пакете `@universo-react/apps-template-mui`.
-   Dialog, table, selection, pagination и card-компоненты переэкспортируются из корня пакета.
-   Фабричные хелперы вроде `createEntityActions()` и `createMemberActions()` уменьшают дублирование CRUD-action wiring.
-   Хуки вроде `usePaginated()`, `useDebouncedSearch()`, `useUserSettings()`, `useListDialogs()` и optimistic CRUD helpers поддерживают общие frontend-сценарии.

## Integration Role

-   Пакет используется frontend-модулями auth, onboarding, admin, profile, metahubs и applications.
-   Он зависит от общих frontend-контрактов из `@universo-react/i18n`, `@universo-react/types`, `@universo-react/utils` и `@universo-react/store`.
-   Пакет собирается как переиспользуемый модуль с двойным JavaScript output и сгенерированными type declarations.
-   Он должен оставаться domain-neutral: бизнес-термины и route semantics должны жить в consumer-пакетах, а не в общем template-layer.

## Development Notes

```bash
pnpm --filter @universo-react/template-mui build
pnpm --filter @universo-react/template-mui lint
pnpm --filter @universo-react/template-mui test
```

-   Держите экспортируемые компоненты универсальными и пригодными для повторного использования в нескольких frontend-модулях.
-   Добавляйте новые translation keys через общие или consumer namespaces с EN/RU parity.
-   Здесь лучше документировать ответственность пакета, а module-specific workflows оставлять README consumer-пакетов.

## Перенос импортов Dashboard опубликованных приложений

UI Dashboard опубликованных приложений находится в изолированном пакете `@universo-react/apps-template-mui`. Старые импорты из этого общего пакета нужно перенести:

| Старый импорт           | Новый импорт                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `Dashboard`             | `AppsDashboard` из `@universo-react/apps-template-mui`         |
| `DashboardLayoutConfig` | `DashboardLayoutConfig` из `@universo-react/apps-template-mui` |
| `DashboardDetailsSlot`  | `DashboardDetailsSlot` из `@universo-react/apps-template-mui`  |

`SessionsChart` и `PageViewsBarChart` больше не являются публичными экспортами пакета. Используйте зарегистрированные Dashboard-виджеты через `AppsDashboard`: отрисовка графиков остаётся внутри шаблона опубликованных приложений, где данные runtime и размещение согласованы с effective layout.

## Related Documentation

-   [Индекс пакетов](../../../packages/README-RU.md)
-   [Core frontend shell](../universo-react-core-frontend/README-RU.md)
-   [Общий i18n runtime](../universo-react-i18n/README-RU.md)
-   [Общие доменные типы](../universo-react-types/README-RU.md)

---

Universo Platformo | Shared MUI package
