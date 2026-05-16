# @universo/apps-template-mui

> 🎨 **Современный пакет** — TypeScript-first шаблон дашборда с Material-UI v7

Рантайм-шаблон дашборда для опубликованных приложений в экосистеме Universo Platformo. Предоставляет зонную систему виджетов, управляемый данными рендеринг сетки, создание контента на стороне приложения и переиспользуемые CRUD UI-компоненты без зависимости от легаси-пакета `@universo/template-mui`.

## Информация о пакете

| Поле | Значение |
|------|----------|
| **Версия** | 0.1.0 |
| **Тип** | React Frontend пакет (TypeScript) |
| **Статус** | ✅ Активная разработка |
| **Фреймворк** | React 18 + TypeScript + Material-UI v7 |
| **Имя пакета** | `@universo/apps-template-mui` |

## Ключевые возможности

### 🖥️ Система дашбордов
- **Зонная компоновка**: 4 зоны дашборда — left (боковая панель), right (боковая панель), center (основной контент), top (заголовок/навбар)
- **Рендеринг на основе данных**: Виджеты рендерятся из конфигурации `ZoneWidgets`, а не из захардкоженного JSX
- **DashboardDetailsContext**: React Context, предоставляющий данные таблицы (строки, колонки, пагинация) вложенным виджетам
- **Конфиг макета**: Булевые флаги видимости (`showSideMenu`, `showHeader`, `showColumnsContainer` и т.д.)

### 📊 Виджет ColumnsContainer
- **Многоколоночная сетка**: Рендерит `ColumnsContainerConfig` как MUI Grid с настраиваемой шириной колонок (12-юнитовая сетка)
- **Вложенные виджеты**: Каждая колонка может содержать несколько виджетов через `ColumnsContainerColumnWidget[]`
- **Защита от рекурсии**: `MAX_CONTAINER_DEPTH=1` предотвращает бесконечную вложенность columnsContainer
- **Сид по умолчанию**: 2-колоночный макет — 9/12 `detailsTable` + 3/12 `productTree`

### 🧩 Рендерер виджетов
- **Общий рендерер**: `renderWidget()` маппит ключи виджетов в конкретные React-компоненты
- **Поддерживаемые виджеты**: `brandSelector`, `divider`, `menuWidget`, `spacer`, `infoCard`, `userProfile`, `productTree`, `usersByCountryChart`, `detailsTable`, `columnsContainer`
- **Резолвинг меню**: 2-уровневый фолбэк — ID виджета → карта menus → легаси одиночный menu проп
- **Общие runtime-поверхности**: Агрегации сохранённых отчётов, предпросмотр ресурсов, политики последовательностей и workflow-действия задаются через общие метаданные, а не через LMS-специфичные форки виджетов

### 📝 CRUD-компоненты
- **FormDialog**: Универсальный модальный диалог с настраиваемыми полями, правилами валидации и интеграцией Zod
- **ConfirmDeleteDialog**: Диалог подтверждения для операций удаления
- **CrudDialogs**: Объединённый компонент диалогов создания/редактирования/удаления
- **RowActionsMenu**: Меню действий для каждой строки с опциями редактирования/удаления
- **useCrudDashboard**: Headless-хук контроллера, управляющий состоянием CRUD и вызовами API
- **Workflow-действия**: Метаданные действий строк отображаются только при явно разрешённых runtime-capabilities
- **Создание блочного контента**: JSON-поля с `editorjsBlockContent` используют общий пакет `@universo/block-editor` вместо сырого JSON и отдельной runtime-копии редактора
- **ResourcePreview**: Общий безопасный предпросмотр ресурсов с локализованными состояниями deferred/unsupported
- **Отчёты и экспорт**: Опубликованный runtime умеет показывать сохранённые отчёты через общие details-виджеты и экспортировать серверно определённые CSV-отчёты

### 🧱 Runtime UI-примитивы
- **Локальные примитивы**: `ViewHeaderMUI`, `ToolbarControls`, `ItemCard`, `FlowListTable`, `PaginationControls` и `useViewPreference` находятся в `src/components/runtime-ui`
- **Граница пакета**: Исходники runtime защищены тестом, который запрещает импорты из `@universo/template-mui`
- **Визуальная согласованность**: Таблицы, карточки записей, карточки рабочих пространств и карточки метрик сохраняют исходные отступы и outlined-поверхности MUI dashboard

### 🧑‍🤝‍🧑 Runtime Workspaces
- **WorkspaceSwitcher**: Быстрое переключение текущего рабочего пространства в desktop/mobile shell
- **RuntimeWorkspacesPage**: Полноценный раздел управления рабочими пространствами в существующей области details
- **Workspace APIs**: Типизированные helper-ы и query keys для списков, участников, default workspace и shared workspace операций
- **Размещение навигации**: Пункт рабочих пространств может быть основным, скрытым или перенесённым в overflow без отдельного LMS-only компонента

### 🔌 Фабрика маршрутов
- **createAppRuntimeRoute()**: Создаёт маршрут react-router-dom v6 для рантайм-представления приложения
- **Поддержка гардов**: Опциональный компонент-обёртка (напр., AuthGuard) для защиты маршрута
- **Путь по умолчанию**: паттерн `a/:applicationId/*` с полноэкранным минимальным макетом

### 🌍 Интернационализация
- **appsTranslations**: Сайд-эффект регистрации i18n-ресурсов для домена приложений
- **Утилиты локализации**: `getDataGridLocaleText()` для переопределения локали MUI DataGrid

## Установка

```bash
# Установка из корня монорепозитория
pnpm install

# Сборка пакета
pnpm --filter @universo/apps-template-mui build
```

## Использование

### Интеграция дашборда

```tsx
import { AppsDashboard } from '@universo/apps-template-mui'
import type { DashboardProps } from '@universo/apps-template-mui'

const props: DashboardProps = {
  layoutConfig: {
    showSideMenu: true,
    showHeader: true,
    showAppNavbar: true,
    showDetailsTitle: true,
    showColumnsContainer: true,
  },
  zoneWidgets: {
    left: [
      { id: 'w1', widgetKey: 'menuWidget', sortOrder: 1, config: {} },
    ],
    center: [
      { id: 'w2', widgetKey: 'columnsContainer', sortOrder: 1, config: {
        columns: [
          { id: 'col1', width: 9, widgets: [{ widgetKey: 'detailsTable' }] },
          { id: 'col2', width: 3, widgets: [{ widgetKey: 'productTree' }] },
        ]
      }},
    ],
  },
  details: {
    title: 'Товары',
    rows: [{ id: '1', name: 'Элемент A' }],
    columns: [{ field: 'name', headerName: 'Название', flex: 1 }],
  },
}

<AppsDashboard {...props} />
```

### Фабрика маршрутов

```tsx
import { createAppRuntimeRoute } from '@universo/apps-template-mui'
import ApplicationRuntime from './ApplicationRuntime'
import AuthGuard from './AuthGuard'

const runtimeRoute = createAppRuntimeRoute({
  component: ApplicationRuntime,
  guard: AuthGuard,
})

// Использовать в дочерних MinimalRoutes:
// children: [...otherRoutes, runtimeRoute]
```

### Хук CRUD-дашборда

```tsx
import { useCrudDashboard, CrudDialogs } from '@universo/apps-template-mui'

function MyDashboard({ adapter }) {
  const crud = useCrudDashboard({ adapter })

  return (
    <>
      <AppsDashboard
        details={crud.details}
        layoutConfig={crud.layoutConfig}
        zoneWidgets={crud.zoneWidgets}
      />
      <CrudDialogs {...crud.dialogs} />
    </>
  )
}
```

### Автономное приложение

```tsx
import { DashboardApp } from '@universo/apps-template-mui'

// Рендерит автономный дашборд со своими i18n и темой
<DashboardApp adapter={myAdapter} />
```

## Архитектура

### Зонная система виджетов

```
Dashboard
├── SideMenu (зона left)
│   └── [виджеты left: brandSelector, menuWidget, spacer, infoCard, userProfile]
├── AppNavbar (зона top, мобильная)
├── Основной контент (зона center)
│   ├── Header (зона top)
│   ├── MainGrid
│   │   ├── Секция обзора (опционально: карточки, графики)
│   │   └── Секция деталей
│   │       ├── columnsContainer → renderWidget() для каждой колонки
│   │       │   ├── Колонка 1 (ширина: 9/12) → detailsTable
│   │       │   └── Колонка 2 (ширина: 3/12) → productTree
│   │       └── ИЛИ отдельный detailsTable (фолбэк)
│   └── Footer (опционально)
└── SideMenuRight (зона right, опционально)
    └── [виджеты right: productTree, usersByCountryChart]
```

### DashboardDetailsContext

```
Dashboard (DashboardDetailsProvider value={details})
  └── MainGrid
       └── renderWidget('detailsTable')
            └── DetailsTableWidget
                 └── useDashboardDetails() → { rows, columns, pagination, ... }
```

Виджеты внутри `columnsContainer` получают данные таблицы через хук `useDashboardDetails()`,
что устраняет необходимость прокидывания пропсов через множество уровней компонентов.

### Поток данных

```
Конфиг ZoneWidgets → Dashboard → распределение по зонам
  ├── left[]   → SideMenu (renderWidget для каждого элемента)
  ├── right[]  → SideMenuRight (renderWidget для каждого элемента)
  └── center[] → MainGrid
       └── фильтр по widgetKey === 'columnsContainer'
            → renderWidget(container) → Grid с вложенными вызовами renderWidget
```

## Структура файлов

```
packages/apps-template-mui/
├── src/
│   ├── api/              # Типы адаптеров данных и реализации
│   │   ├── types.ts      # Интерфейсы CrudDataAdapter, CellRendererOverrides
│   │   ├── adapters.ts   # Фабрика createStandaloneAdapter
│   │   └── mutations.ts  # appQueryKeys, утилиты React Query
│   ├── components/       # Переиспользуемые UI-компоненты
│   │   ├── block-editor/             # Editor.js authoring в опубликованном приложении
│   │   ├── dialogs/
│   │   │   ├── FormDialog.tsx          # Универсальный настраиваемый диалог формы
│   │   │   └── ConfirmDeleteDialog.tsx # Диалог подтверждения удаления
│   │   ├── resource-preview/         # Общие безопасные состояния предпросмотра ресурсов
│   │   ├── runtime-ui/               # Локальные runtime-примитивы списков и карточек
│   │   ├── CrudDialogs.tsx             # Объединённый компонент CRUD-диалогов
│   │   └── RowActionsMenu.tsx          # Выпадающий список действий строки
│   ├── dashboard/        # Ядро дашборда
│   │   ├── Dashboard.tsx               # Главный компонент дашборда (оркестратор зон)
│   │   ├── DashboardDetailsContext.tsx  # React Context для передачи данных таблицы
│   │   └── components/
│   │       ├── MainGrid.tsx            # Рендерер содержимого центральной зоны
│   │       ├── widgetRenderer.tsx      # Маппер ключей виджетов → компоненты
│   │       ├── SideMenu.tsx            # Левая боковая панель
│   │       ├── SideMenuRight.tsx       # Правая боковая панель
│   │       ├── AppNavbar.tsx           # Мобильная панель навигации
│   │       ├── Header.tsx              # Верхний заголовок
│   │       ├── MenuContent.tsx         # Рендерер виджета меню
│   │       ├── CustomizedDataGrid.tsx  # Обёртка MUI DataGrid
│   │       ├── CustomizedTreeView.tsx  # Виджет дерева продуктов
│   │       └── ...                     # Графики, карточки статистики и т.д.
│   ├── hooks/            # Пользовательские React хуки
│   │   └── useCrudDashboard.ts         # Headless CRUD-контроллер
│   ├── i18n/             # Ресурсы интернационализации
│   ├── layouts/          # Обёртки макетов
│   │   └── AppMainLayout.tsx           # Основной макет приложения
│   ├── routes/           # Конфигурация маршрутов
│   │   └── createAppRoutes.tsx         # Фабричная функция маршрутов
│   ├── standalone/       # Точка входа автономного приложения
│   │   └── DashboardApp.tsx            # Самодостаточное приложение дашборда
│   ├── workspaces/       # Runtime-экраны управления рабочими пространствами
│   │   └── RuntimeWorkspacesPage.tsx
│   ├── utils/            # Вспомогательные функции
│   │   ├── columns.ts    # toGridColumns, toFieldConfigs
│   │   └── getDataGridLocale.ts        # Хелпер локали MUI DataGrid
│   └── index.ts          # Экспорты пакета
├── package.json
├── tsconfig.json
├── tsconfig.build.json   # TypeScript конфиг для сборки
├── vite.config.ts        # Конфигурация Vite (автономная разработка)
└── README.md             # Английская документация
```

## Основные типы

### DashboardProps
```typescript
interface DashboardProps {
  layoutConfig?: DashboardLayoutConfig  // Булевые флаги видимости
  zoneWidgets?: ZoneWidgets             // Конфиги виджетов по зонам
  details?: DashboardDetailsSlot        // Данные таблицы для виджетов деталей
  menu?: DashboardMenuSlot              // Легаси одиночное меню (устарело)
  menus?: DashboardMenusMap             // Карта меню по ID виджетов
}
```

### ZoneWidgetItem
```typescript
interface ZoneWidgetItem {
  id: string
  widgetKey: string                     // Идентификатор типа виджета
  sortOrder: number
  config: Record<string, unknown>       // Конфигурация, специфичная для виджета
  isActive?: boolean
}
```

### DashboardDetailsSlot
```typescript
interface DashboardDetailsSlot {
  title: string
  rows: Array<Record<string, unknown> & { id: string }>
  columns: GridColDef[]
  loading?: boolean
  rowCount?: number
  paginationModel?: GridPaginationModel
  onPaginationModelChange?: (model: GridPaginationModel) => void
  pageSizeOptions?: number[]
  actions?: React.ReactNode             // Действия панели (напр., кнопка «Создать»)
  localeText?: Partial<GridLocaleText>  // Переопределения локали MUI DataGrid
}
```

### DashboardLayoutConfig — Настройки отображения

Интерфейс `DashboardLayoutConfig` поддерживает опциональные настройки отображения,
которые включают расширенные режимы отображения в секции деталей:

```typescript
interface DashboardLayoutConfig {
  // ... существующие булевые флаги (showSideMenu, showHeader и т.д.)

  // Настройки отображения (опционально — при отсутствии используется классический табличный режим)
  showViewToggle?: boolean       // Показать переключатель режима карточки/таблица
  defaultViewMode?: 'table' | 'card'  // Начальный режим отображения
  showFilterBar?: boolean        // Показать поле поиска в панели инструментов
  cardColumns?: number           // Количество колонок в карточном виде (2–4)
  rowHeight?: number | 'auto'    // Фиксированная высота в пикселях или 'auto' для авторазмера
}
```

Когда `showViewToggle` или `showFilterBar` установлены, секция деталей рендерит
**EnhancedDetailsSection**, которая использует локальные runtime UI-примитивы пакета
(`ViewHeaderMUI`, `ToolbarControls`, `ItemCard`, `PaginationControls`) вместе с DataGrid.

Эти настройки валидируются во время выполнения Zod-схемой `dashboardLayoutConfigSchema`
в `api/api.ts`.

## Разработка

### Доступные скрипты
```bash
# Разработка
pnpm build                       # Проверка типов (noEmit)
pnpm dev:standalone              # Автономный Vite dev-сервер (порт 5174)
pnpm preview:standalone          # Предпросмотр автономной сборки

# Качество кода
pnpm lint                        # Запуск ESLint
```

### Конфигурация TypeScript
Пакет использует строгую конфигурацию TypeScript с режимом сборки `noEmit`.
Исходные файлы потребляются напрямую другими пакетами рабочей области через `main`/`module`, указывающие на `./src/index.ts`.

## Связанные пакеты
- [`@universo/metahubs-frontend`](../metahubs-frontend/base/README-RU.md) — UI управления метахабами
- [`@universo/metahubs-backend`](../metahubs-backend/base/README-RU.md) — Бэкенд-сервис
- [`@universo/types`](../universo-types/base/README-RU.md) — Общие TypeScript-типы
- [`@universo/i18n`](../universo-i18n/base/README-RU.md) — Общие ресурсы локализации
- [`@universo/utils`](../universo-utils/base/README-RU.md) — Общие runtime-хелперы и нормализация

---
*Часть [Universo Platformo](../../README-RU.md) — Пакетная платформа бизнес-приложений*
