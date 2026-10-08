# @universo-react/apps-template-mui

> 🎨 **Современный пакет** — TypeScript-first шаблоны дашборда и marketing-page на Material UI v9

Рантайм-шаблон дашборда для опубликованных приложений в экосистеме Universo Platformo. Предоставляет зонную систему виджетов, управляемый данными рендеринг сетки, создание контента на стороне приложения и переиспользуемые CRUD UI-компоненты без зависимости от легаси-пакета `@universo-react/template-mui`.

## Информация о пакете

| Поле           | Значение                               |
| -------------- | -------------------------------------- |
| **Версия**     | 0.1.0                                  |
| **Тип**        | React Frontend пакет (TypeScript)      |
| **Статус**     | ✅ Активная разработка                 |
| **Фреймворк**  | React 18 + TypeScript + Material UI v9 |
| **Имя пакета** | `@universo-react/apps-template-mui`    |

## Ключевые возможности

### 🖥️ Система дашбордов

-   **Зонная компоновка**: 5 зон дашборда — left (боковая панель), top (заголовок/навбар), right (боковая панель), center (основной контент) и bottom (подвал/хвост основного контента)
-   **Рендеринг на основе данных**: Виджеты рендерятся из конфигурации `ZoneWidgets`, а не из захардкоженного JSX
-   **DashboardDetailsContext**: Контекст host/runtime для содержимого standalone-страниц рабочих областей и настроек Page Player; данные сущностей передаются виджетам в проверенных runtime DTO.
-   **Выбор макета в runtime**: Hosted и standalone используют один target-aware effective-layout ответ и отображают только активные макеты и виджеты
-   **Сохранённая композиция**: Единственный источник видимости и размещения Dashboard-виджетов — effective placement graph. Дочерние виджеты являются отдельными размещениями, связанными семантическими `parentInstanceKey` и `slotKey`; при отсутствии размещений показывается локализованное пустое состояние. Булевого fallback видимости нет.
-   **Многострочные данные runtime**: Семантические длинные строки безопасно переносятся и по умолчанию получают auto-height строки; настроенная числовая высота по-прежнему поддерживается.
-   **Действия над исходными строками**: Hosted и standalone Dashboard используют общий `useDashboardBoundRowActions`: он однозначно разрешает Entity, проверяет её права, перечитывает строку в активной рабочей области и передаёт текущую версию существующим CRUD-, record-command- и workflow-обработчикам. Во время повторной загрузки старые данные строки скрыты типизированным load-state контрактом.
-   **Разрешение Entity-target**: `resolveDashboardEntityTargetSectionId` предпочитает явный ID, принимает уникальный codename и отказывает при совпадении нескольких Entity.

### 📣 Управляемая данными маркетинговая страница

-   **Композиция MUI 9**: App bar, первый экран, логотипы, возможности, отзывы, преимущества, тарифы, FAQ и подвал получают данные из типизированной модели `MarketingPageData`.
-   **Контент принадлежит сущностям**: опубликованный рантайм получает локализованные записи из шаблона метахаба `marketing-page`; в секциях нет захардкоженных demo-массивов.
-   **Безопасные действия и медиа**: внутренние, anchor, внешние, email- и telephone-действия валидируются до рендера; небезопасные URL и отсутствующие медиа завершаются локализованным fallback.
-   **Внешний вид приложения**: режим темы, ограниченные цвета, брендовые медиа и политика действий настраиваются в типизированном макете приложения; сохранённые маркетинговые экземпляры виджетов владеют зоной, порядком, активностью, источником и флагами представления.
-   **Макеты с экземплярами**: runtime сохраняет каждое активное размещение, включая несколько строк с одним ключом виджета. Идентичность размещения отделена от типа виджета, поэтому повторяемые экземпляры dashboard- и marketing-виджетов отображаются независимо; `appNavbar` и `header` дашборда являются явными одиночными shell-размещениями.
-   **Единая граница темы**: провайдеры принадлежат hosted/standalone shell, а `MarketingPage` остаётся provider-free presentational-компонентом.
-   **Общая возможность виджета**: `languageSwitcher` зарегистрирован один раз, доступен в Dashboard `top` и marketing `marketing-header` и отображается существующими shell-контролами без дублирования.

### 📊 Виджет ColumnsContainer

-   **Многоколоночная сетка**: Рендерит `ColumnsContainerConfig` как MUI Grid с настраиваемой шириной колонок (12-юнитовая сетка)
-   **Вложенные виджеты**: Каждая колонка может содержать несколько отдельных размещений, связанных с контейнером через семантические `parentInstanceKey` и `slotKey`; конфиг виджета не содержит дочерние виджеты.
-   **Защита от рекурсии**: `MAX_CONTAINER_DEPTH=8` ограничивает вложенность контейнеров и защищает от бесконечного рекурсивного рендера.
-   **Композиция размещений**: базовый Dashboard задаётся явными размещениями и привязками к сущностям. Вложенные виджеты являются отдельными размещениями, связанными через `parentInstanceKey` и `slotKey`.

### 🧩 Рендерер виджетов

-   **Общий рендерер**: `renderWidget()` маппит ключи виджетов в конкретные React-компоненты
-   **Зарегистрированные виджеты**: `workspaceSwitcher`, `divider`, `menuWidget`, `spacer`, `infoCard`, `userProfile`, `appNavbar`, `header`, `breadcrumbs`, `search`, `datePicker`, `optionsMenu`, `languageSwitcher`, `colorModeSwitcher`, `overviewTitle`, `overviewCards`, `sessionsChart`, `pageViewsChart`, `detailsTitle`, `detailsTable`, `relationBuilder`, `columnsContainer`, `detailsTabs`, `interpretationNetworkWorkspace`, `quizWidget`, `playcanvasCanvas`, `resourcePreview`, `learnerPlayer`, `footer`
-   **Union datasources**: `detailsTable` умеет рендерить `records.union`, резолвя несколько runtime-разделов из metadata и запрашивая их через обычный `fetchAppData`
-   **Конструктор связей**: `relationBuilder` удерживает дочерние записи в контексте выбранной родительской строки и переиспользует общие CRUD-диалоги, picker-ы записей и сохранённую сортировку строк
-   **Данные меню**: `menuWidget` отображает только проверенные runtime-данные своего размещения; рендерер не генерирует содержимое меню по фолбэку.
-   **Сгенерированная навигация Dashboard**: Видимые Страницы становятся пунктами меню и при необходимости группируются по связанным Хабам. Записи Объектов, включая регистры, остаются источниками содержимого и не становятся ссылками меню. Иконки Страниц и Хабов задаются ограниченной семантической метаинформацией и отображаются готовыми иконками MUI; для неизвестных значений используются безопасные иконки Страницы и Хаба.
-   **Общие runtime-поверхности**: Агрегации сохранённых отчётов, предпросмотр ресурсов, политики последовательностей и workflow-действия задаются через общие метаданные, а не через LMS-специфичные форки виджетов

### 📝 CRUD-компоненты

-   **FormDialog**: Универсальный модальный диалог с настраиваемыми полями, правилами валидации и интеграцией Zod
-   **ConfirmDeleteDialog**: Диалог подтверждения для операций удаления
-   **CrudDialogs**: Объединённый компонент диалогов создания/редактирования/удаления
-   **RowActionsMenu**: Меню действий для каждой строки с опциями редактирования/удаления
-   **useCrudDashboard**: Headless-хук контроллера, управляющий состоянием CRUD и вызовами API
-   **Workflow-действия**: Метаданные действий строк отображаются только при явно разрешённых runtime-capabilities
-   **Создание блочного контента**: JSON-поля с `editorjsBlockContent` используют общий пакет `@universo-react/block-editor` вместо сырого JSON и отдельной runtime-копии редактора
-   **ResourcePreview**: Общий безопасный предпросмотр ресурсов с локализованными состояниями deferred/unsupported
-   **Отчёты и экспорт**: Опубликованный runtime умеет показывать сохранённые отчёты через общие details-виджеты и экспортировать серверно определённые CSV-отчёты
-   **Trash-aware операции**: Runtime-списки могут запрашивать `lifecycleState=deleted`, delete-вызовы передают optimistic row version, а adapters предоставляют restore-вызовы для общего soft-delete contract
-   **Progress page player**: Metadata-страницы отображают Editor.js page blocks с оглавлением/progress controls и сохраняют завершение через общий runtime progress API.

### 🧱 Runtime UI-примитивы

-   **Локальные примитивы**: `ViewHeaderMUI`, `ToolbarControls`, `ItemCard`, `FlowListTable`, `PaginationControls` и `useViewPreference` находятся в `src/components/runtime-ui`
-   **Граница пакета**: Исходники runtime защищены тестом, который запрещает импорты из `@universo-react/template-mui`
-   **Визуальная согласованность**: Таблицы, карточки записей, карточки рабочих пространств и карточки метрик сохраняют исходные отступы и outlined-поверхности MUI dashboard

### 🧑‍🤝‍🧑 Runtime Workspaces

-   **WorkspaceSwitcher**: Быстрое переключение текущего рабочего пространства в desktop/mobile shell
-   **RuntimeWorkspacesPage**: Полноценный раздел управления рабочими пространствами в существующей области details
-   **Workspace APIs**: Типизированные helper-ы и query keys для списков, участников, default workspace и shared workspace операций
-   **Размещение навигации**: Пункт рабочих пространств может быть основным, скрытым или перенесённым в overflow без отдельного LMS-only компонента

### 🔌 Фабрика маршрутов

-   **createAppRuntimeRoute()**: Создаёт маршрут react-router-dom v6 для рантайм-представления приложения
-   **Поддержка гардов**: Опциональный компонент-обёртка (напр., AuthGuard) для защиты маршрута
-   **Путь по умолчанию**: паттерн `a/:applicationId/*` с полноэкранным минимальным макетом

### 🌍 Интернационализация

-   **appsTranslations**: Сайд-эффект регистрации i18n-ресурсов для домена приложений
-   **Утилиты локализации**: `getDataGridLocaleText()` для переопределения локали MUI DataGrid
-   **Namespace interpretationNetwork**: Английские и русские подписи рабочего пространства трактовочной сети, трёх переключателей представления Матрицы, состояний семантической таблицы и виджета `cellStylePicker`

## Добавления первого этапа (Трактовочная сеть)

-   **Structure-first runtime**: приложение трактовочной сети открывается со стартовой локализованной страницы `InterpretationNetworkIntro`; центральный виджет `interpretationNetworkWorkspace` привязан к разделу `Structures` (`Concept`), поэтому пустая левая панель показывает только создание Структуры, а правая панель отвечает за стартовую памятку и добавление Материала к выбранной ячейке.
-   **Режимы навигации по Структурам**: встроенный шаблон трактовочной сети по умолчанию использует `structureMode: "multiple"` и показывает список Структур. Автор может явно выбрать `singleSystem`, чтобы использовать одну скрытую серверную Структуру и сразу открывать её Матрицу из пункта `Structures`, без списка, видимого названия Структуры и кнопки возврата. Вкладки Матрицы и Шаблонов остаются доступны согласно `templatePanel.showInMatrix`.
-   **Иерархическая Матрица**: `interpretationNetworkWorkspace.config.matrixMode` по умолчанию равен `hierarchicalCells`. Новая Структура получает корневую ячейку `Universe` / `Вселенная`, а следующие ячейки создаются через действие «Добавить». `independentRows` остаётся для совместимости со строками и колонками.
-   **Шаблоны таблиц рабочего пространства**: редакторы с правами создания и редактирования содержимого могут сохранить текущую Структуру как шаблон и выбрать копирование только структуры или структуры вместе с Материалами ячеек. Развёртывания с несколькими Структурами позволяют создать новую видимую Структуру из шаблона; в режиме одной системной Структуры создание дополнительных Структур скрыто, но сохранение текущей Матрицы как шаблона остаётся доступным.
-   **Размещение и доступ к шаблонам**: `templatePanel.showInStructureList` и `templatePanel.showInMatrix` по умолчанию равны `true`. Если оба флага равны `false`, шаблоны остаются изолированными данными рабочего пространства, но интерфейс шаблонов не показывается. Для сохранения и создания из шаблона нужны права создания и редактирования содержимого, для метаданных — редактирования, для удаления — удаления. Матрица и выбранные поля созданных Материалов копируются с новыми UUID v7; Связи, двоичные объекты и внешние файлы не клонируются, а обычные внешние URL в сохранённом `Body` Материала остаются пользовательским содержимым.
-   **Контракт равноправных представлений Матрицы**: `allowedMatrixViews`, `defaultMatrixView`, `tableProjection`, `breadcrumbDepth`, `toolbarLayout`, `showHierarchicalTableHeaders`, `showHierarchicalTableHeaderCard`, `showMatrixTreeTotalCells` и `colorBreadcrumbsByCell` приходят из общего контракта `@universo-react/types`. Среда выполнения позволяет переключаться между разрешёнными `table`, `horizontalRows` и `verticalTree` и возвращается к разрешённому настроенному представлению.
-   **Иерархическая Таблица**: Таблица по умолчанию использует `hierarchicalPath`: родительские ячейки отображаются кликабельными хлебными крошками с цветом ячейки, выбранный родитель по умолчанию является отдельной карточкой контекста таблицы, прямые дочерние ячейки становятся строками, ограниченная глубина хлебных крошек использует меню с многоточием, необязательные заголовки колонок скрыты по умолчанию, а нажатия на крошки обновляют выбор, URL-фокус и панель Материалов.
-   **Табличная проекция с независимыми осями**: `tableProjection: "independentAxes"` сохраняет явную таблицу строк и колонок с настоящими заголовками, доступными именами ячеек, локализованными пустыми пересечениями, локальным горизонтальным скроллом и без горизонтального переполнения страницы.
-   **Drag/drop Матрицы**: ячейки используют sortable-примитивы dnd-kit с drag overlay, приглушённой исходной ячейкой, пунктирным индикатором цели, состоянием недопустимой цели и menu/keyboard fallback через существующее меню действий ячейки.
-   **`CellStyleDialogField`**: расширение стандартного `FormDialog` через `uiConfig.widget: 'cellStylePicker'` для цвета и границ ячеек Матрицы.
-   **Cell ID и иерархические дефолты**: `buildInitialTabularRowValues` создаёт RFC 9562 UUID v7 для скрытого поля `CellId`. `ParentCellId` скрыт и принадлежит системе, `_tp_sort_order` хранит порядок среди соседей, а `Depth` вычисляется в runtime.
-   **Гибкое редактирование ячейки**: пользователь изменяет `RowLabel`, `ColLabel`, `CellValue` и необязательное многострочное `CellDescription`. `CellId`, `ParentCellId`, `RowKey`, `ColKey` и `_tp_sort_order` остаются защищёнными системными полями.

Все три представления Матрицы используют одну модель данных. Они сохраняют совместимые операции создания, выбора, привязки Материалов, настройки стиля, перемещения и перетаскивания. Внутренние UUID, ключи осей, родительские идентификаторы, сохраняемый порядок, идентификаторы виджетов и связей, а также JSON-пакеты не показываются на обычных пользовательских экранах.

### Runtime скриптовых ассетов PlayCanvas

`PlayCanvasCanvasWidget` может работать с опубликованным `runtimeManifest`.
Если manifest содержит скрипты, виджет ждёт загрузки всех артефактов до вызова
`app.start()`. Loader в main thread получает каждый `data:` или HTTP URL,
проверяет SHA-256 `artifactHash` в нижнем шестнадцатеричном регистре,
импортирует модуль как `text/javascript`, регистрирует экспортированный класс в
реестре приложения и прикрепляет его к сущности с `sceneEntityStableId`,
передавая опубликованные значения атрибутов. Отсутствующая сущность, ошибка
загрузки или несовпадение hash завершают процесс закрыто и показывают
локализованную ошибку загрузки скрипта.

Canvas предоставляет стабильные диагностические markers для browser-проверок:
`data-scripts-loaded` (`true`, `failed` или `none`),
`data-runtime-module-executed`, `data-ship-screen-x`, `data-ship-screen-y`,
`data-camera-distance` и `data-camera-yaw`. Фикстура MMOOMM использует эти
markers для проверки загрузки скриптов, движения и поведения камеры без показа
внутренних идентификаторов в интерфейсе.

## Установка

```bash
# Установка из корня монорепозитория
pnpm install

# Сборка пакета
pnpm --filter @universo-react/apps-template-mui build
```

## Использование

### Интеграция дашборда

После загрузки published runtime передавайте в `AppsDashboard` проверенную
effective-композицию Dashboard. Не вычисляйте видимость из булевых флагов и не
встраивайте дочерние виджеты в конфиг контейнера:

```tsx
import { AppsDashboard, fetchRuntimeEffectiveLayout, toDashboardZoneWidgets } from '@universo-react/apps-template-mui'
import type { DashboardProps } from '@universo-react/apps-template-mui'

const effectiveLayout = await fetchRuntimeEffectiveLayout({ apiBaseUrl, applicationId })
if (effectiveLayout.status !== 'ok' || effectiveLayout.layout.templateKey !== 'dashboard') {
  throw new Error('A Dashboard effective layout is required')
}

const props: DashboardProps = {
  zoneWidgets: toDashboardZoneWidgets(effectiveLayout),
}

<AppsDashboard {...props} />
```

### Фабрика маршрутов

```tsx
import { createAppRuntimeRoute } from '@universo-react/apps-template-mui'
import ApplicationRuntime from './ApplicationRuntime'
import AuthGuard from './AuthGuard'

const runtimeRoute = createAppRuntimeRoute({
    component: ApplicationRuntime,
    guard: AuthGuard
})

// Использовать в дочерних MinimalRoutes:
// children: [...otherRoutes, runtimeRoute]
```

### Хук CRUD-дашборда

Хуку нужны адаптер и локаль; он возвращает `CrudDashboardState`.
`CrudDialogs` получает это состояние и локализованные подписи. Размещения
виджетов и необязательный host/runtime-контекст передаёт host, а не CRUD-хук.

```tsx
import { AppsDashboard, CrudDialogs, useCrudDashboard } from '@universo-react/apps-template-mui'
import type { CrudDataAdapter, CrudDialogsLabels, DashboardDetailsSlot, ZoneWidgets } from '@universo-react/apps-template-mui'

type MyDashboardProps = {
    adapter: CrudDataAdapter | null
    locale: string
    labels: CrudDialogsLabels
    zoneWidgets?: ZoneWidgets
    details?: DashboardDetailsSlot
}

function MyDashboard({ adapter, locale, labels, zoneWidgets, details }: MyDashboardProps) {
    const state = useCrudDashboard({ adapter, locale })

    return (
        <>
            <AppsDashboard details={details} zoneWidgets={zoneWidgets} />
            <CrudDialogs state={state} locale={locale} labels={labels} />
        </>
    )
}
```

### Автономное приложение

```tsx
import { DashboardApp } from '@universo-react/apps-template-mui'

// Рендерит автономный дашборд со своими i18n и темой
;<DashboardApp adapter={myAdapter} />
```

## Архитектура

### Зонная система виджетов

```
Dashboard
├── SideMenu (зона left)
│   └── активные размещения зоны left с проверенными runtime-данными
├── AppNavbar (зона top, мобильная)
├── Основной контент (зона center)
│   ├── Header (зона top)
│   ├── MainGrid отображает активные корневые размещения в effective-порядке
│   │   └── контейнеры находят дочерние размещения по semantic parentInstanceKey + slotKey
│   └── Виджеты bottom (зона bottom, опционально)
└── SideMenuRight отображает активные корневые размещения зоны right
```

### DashboardDetailsContext

```
Dashboard (DashboardDetailsProvider value={details})
  └── MainGrid
       ├── необязательное host-содержимое standalone-рабочей области
       └── renderWidget(placement.runtimeData)
            └── проверенная типизированная проекция сущности
```

Данные вложенного виджета поступают в его типизированном runtime DTO. Контекст
сохранён для явного host-содержимого standalone-страниц и настроек Page Player;
он не является параллельным хранилищем бизнес-данных виджетов.

### Поток данных

```
Конфиг ZoneWidgets → Dashboard → распределение по зонам
  ├── left[]   → SideMenu (renderWidget для каждого элемента)
  ├── top[]    → явные top-размещения; Header показывает только controls без одноимённого явного размещения
  ├── right[]  → SideMenuRight (renderWidget для каждого элемента)
  ├── center[] → MainGrid
       └── рендер корневых размещений; контейнеры находят дочерние по semantic parent + slot
  └── bottom[] → подвал/хвост основного контента
```

### Target-aware runtime-контракт

Runtime сначала запрашивает `GET /api/v1/applications/:applicationId/runtime/effective-layout`.
Запрос может относиться к глобальной поверхности приложения или к
авторизованному типу сущности Page/Object. Сервер применяет precedence для
scoped-макета, проверяет совместимость шаблона и виджетов и возвращает выбранный
шаблон, зоны, lineage и `effectiveHash` одним ответом. `recordKey` относится
только к загрузке контента и никогда не выбирает макет.

Scoped-макет того же шаблона может быть точечным overlay. Scoped-макет другого
шаблона является явно независимой композицией: он не наследует несовместимые
виджеты или физические зоны. Отсутствующая или повреждённая материализация даёт
локализованную fail-closed ошибку runtime, а не незаметный fallback на глобальный
шаблон.

Standalone использует тот же effective-layout API и требует аутентифицированный
runtime adapter с контекстом target/workspace. GuestApp и анонимный выбор
шаблона не входят в этот контракт.

Hosted-маршруты хранят runtime-контекст в обычной query-строке. В standalone
hash-маршрутах те же параметры находятся внутри hash route, например:

```text
/a/<applicationId>?targetKind=object&entityTypeId=<entityTypeId>&workspaceId=<workspaceId>&locale=ru
/#/a/<applicationId>?targetKind=object&entityTypeId=<entityTypeId>&workspaceId=<workspaceId>&locale=ru
```

Общий языковой контрол обновляет правильное расположение query и сохраняет
параметры target/workspace. Некорректный target selector завершается fail-closed
до рендера любого макета.

## Структура файлов

```
packages/universo-react-apps-template-mui/
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
│   │   ├── DashboardDetailsContext.tsx  # Host/runtime-контекст; данные Сущностей виджеты получают в типизированных runtime DTO
│   │   └── components/
│   │       ├── MainGrid.tsx            # Рендерер содержимого центральной зоны
│   │       ├── widgetRenderer.tsx      # Диспетчер размещённых виджетов
│   │       ├── DashboardDataWidget.tsx # Таблицы, связи и метрики из Сущностей
│   │       ├── LibraryDetailsTableWidget.tsx # Библиотека и корзина пользователя
│   │       ├── ReportDetailsTableWidget.tsx  # Представление сохранённого отчёта
│   │       ├── LearnerPlayerWidget.tsx # Обучающий контент и прогресс по шагам
│   │       ├── SideMenu.tsx            # Левая боковая панель
│   │       ├── SideMenuRight.tsx       # Правая боковая панель
│   │       ├── AppNavbar.tsx           # Мобильная панель навигации
│   │       ├── Header.tsx              # Верхний заголовок
│   │       ├── MenuContent.tsx         # Рендерер виджета меню
│   │       ├── CustomizedDataGrid.tsx  # Обёртка MUI DataGrid
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

### Миграция типов меню Dashboard

Прежние корневые экспорты `DashboardMenuItem`, `DashboardMenuSlot` и `DashboardMenusMap` удалены вместе с устаревшим путём передачи меню через props. У них нет прямой замены один к одному: содержимое меню теперь настраивается зарегистрированными размещениями виджетов Dashboard, а runtime-данные разрешаются из сущностей. Пользовательские host-компоненты Dashboard должны использовать проверенный `ZoneWidgets` и типы `ZoneWidgetItem` / `DashboardDetailsSlot` из `@universo-react/apps-template-mui`; не собирайте строки меню вручную из сырых ID сущностей.

### DashboardProps

```typescript
interface DashboardProps {
    layoutConfig?: Pick<DashboardLayoutConfig, 'sideMenu'> // Только поведение бокового меню
    zoneWidgets?: ZoneWidgets // Проверенные effective-размещения по зонам
    details?: DashboardDetailsSlot // Контекст host/runtime; данные виджетов приходят в типизированных DTO
}
```

### ZoneWidgetItem

```typescript
interface ZoneWidgetItem {
    id: string // UUID v7 размещения
    instanceKey: string // Семантическая идентичность размещения
    widgetKey: string // Тип виджета из реестра
    zone: 'left' | 'top' | 'right' | 'bottom' | 'center'
    sortOrder: number
    config: Record<string, unknown> // Проверяется схемой виджета из общего реестра
    isActive: boolean
    parentInstanceKey: string | null
    slotKey: string | null
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
    actions?: React.ReactNode // Действия панели (напр., кнопка «Создать»)
    localeText?: Partial<GridLocaleText> // Переопределения локали MUI DataGrid
}
```

### Настройки оболочки Dashboard

Видимость Dashboard определяется effective-размещениями. Прямой компонент
принимает в `layoutConfig` только параметры бокового меню; настройки отображения
виджетов принадлежат их конфигурации, проверяемой схемами общего реестра:

```typescript
type DashboardShellLayoutConfig = Pick<DashboardLayoutConfig, 'sideMenu'>

interface EffectiveChildPlacement {
    instanceKey: string
    parentInstanceKey: string
    slotKey: string
}
```

## Разработка

### Доступные модули

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

-   [`@universo-react/metahubs-frontend`](../universo-react-metahubs-frontend/README-RU.md) — UI управления метахабами
-   [`@universo-react/metahubs-backend`](../universo-react-metahubs-backend/README-RU.md) — Бэкенд-сервис
-   [`@universo-react/types`](../universo-react-types/README-RU.md) — Общие TypeScript-типы
-   [`@universo-react/i18n`](../universo-react-i18n/README-RU.md) — Общие ресурсы локализации
-   [`@universo-react/utils`](../universo-react-utils/README-RU.md) — Общие runtime-хелперы и нормализация

---

_Часть [Universo Platformo](../../README-RU.md) — Пакетная платформа бизнес-приложений_
