# @universo/metahubs-frontend

> 🏗️ **Современный пакет** - TypeScript-first архитектура с двойной системой сборки

Фронтенд-пакет для entity-first authoring метахабов, общих ресурсов и динамической runtime-навигации в экосистеме Universo Platformo.

## Информация о пакете

- **Пакет**: `@universo/metahubs-frontend`
- **Версия**: `0.1.0`
- **Тип**: React Frontend Package (Modern)
- **Фреймворк**: React 18 + TypeScript + Material-UI
- **Система сборки**: tsdown (двойная сборка - CJS + ESM)
- **Тестирование**: Vitest + React Testing Library

## Ключевые функции

### 🌍 Управление метахабами
- **Entity-First навигация**: Метахабы открывают board, resources, entities и вложенные entity-owned authoring flows
- **Полная изоляция данных**: Данные из разных метахабов полностью разделены
- **Ролевой доступ**: Пользовательские роли и разрешения для контроля доступа
- **Контекстная навигация**: Навигация с учётом метахаба с хлебными крошками и сохранением сайдбара

### 🗂️ Типы сущностей и общие ресурсы
- **Типы сущностей**: Platform-provided standard kinds и пользовательские виды работают в одном authoring workspace
- **Tree Entities**: Иерархические контейнеры управляют вложенным authoring-ом и navigation с учётом publication
- **Linked Collections**: Переиспользуемые schema/data surfaces живут на entity-owned child routes
- **Shared Resources**: Общие layout-ы, metadata pools и scripts доступны на выделенной поверхности `/resources`

### 🎨 Пользовательский интерфейс
- **Интеграция Material-UI**: Согласованные UI-компоненты с современной системой дизайна
- **Адаптивный дизайн**: Оптимизирован для настольных и мобильных устройств
- **Табличное и карточное представление**: Гибкое отображение данных с пагинацией и поиском
- **Диалоговые формы**: Модальные формы для создания и редактирования сущностей

### 🔧 Технические функции
- **TypeScript-First**: Полная реализация на TypeScript со строгой типизацией
- **Интеграция React Query**: Продвинутая загрузка данных и кэширование
- **Интернационализация**: Английские и русские переводы с i18next
- **Валидация форм**: Комплексная валидация с Zod схемами
- **Интеграция API**: RESTful API клиент с аутентификацией

### 🧩 Standard Metadata Entity Routes
- **Entities Workspace**: Platform-provided standard kinds и пользовательские виды настраиваются из единого entities workspace и публикуются через dynamic metahub menu.
- **Unified Authoring**: Стандартные и пользовательские типы сущностей разделяют одни и те же workspace actions и generic entity route contract.
- **Entity-Owned Surfaces**: Standard kinds рендерятся через entity-owned route components, а shared resources остаются на выделенной поверхности `/resources`.
- **Владение маршрутами**: Detail tabs остаются под `/metahub/:id/entities/:kindKey/...`, а ресурсы метахаба под `/metahub/:id/resources/...`; удалённые top-level authoring routes `/hubs`, `/catalogs`, `/sets` и `/enumerations` больше не входят в shipped frontend contract.
- **Runtime Boundary**: Runtime sections материализуются из published entity metadata после publication sync вместо V2-specific compatibility aliases.

### 📋 Выбор шаблона
- **Компонент TemplateSelector**: Выпадающий селектор для выбора шаблона метахаба при создании
- **API шаблонов**: Загрузка доступных шаблонов через эндпоинт `GET /templates`
- **Хук TanStack Query**: Хук `useTemplates()` с кэшированием и состояниями загрузки
- **Шаблон по умолчанию**: Если шаблон не выбран явно, бэкенд автоматически назначает базовый шаблон «basic»

## Установка и настройка

### Предварительные требования
```bash
# Системные требования
Node.js >= 18.0.0
PNPM >= 8.0.0
```

### Установка
```bash
# Установить зависимости
pnpm install

# Собрать пакет
pnpm --filter @universo/metahubs-frontend build

# Запустить в режиме разработки
pnpm --filter @universo/metahubs-frontend dev
```

### Интеграция
```tsx
// Импорт компонентов в ваше React-приложение
import { 
  MetahubList, 
  MetahubBoard, 
  MetahubResources,
  StandardEntityCollectionPage,
  StandardEntityChildCollectionPage,
  FieldDefinitionList,
  RecordList,
  metahubsDashboard 
} from '@universo/metahubs-frontend'

// Импорт i18n ресурсов
import { metahubsTranslations } from '@universo/metahubs-frontend'

// Пример регистрации маршрутов
<Route path="/metahubs" element={<MetahubList />} />
<Route path="/metahub/:id/board" element={<MetahubBoard />} />
<Route path="/metahub/:id/resources" element={<MetahubResources />} />
<Route path="/metahub/:id/entities/:kindKey/instances" element={<StandardEntityCollectionPage />} />
<Route path="/metahub/:id/entities/:kindKey/instance/:entityId/instances" element={<StandardEntityChildCollectionPage />} />
<Route path="/metahub/:id/entities/:kindKey/instance/:entityId/field-definitions" element={<FieldDefinitionList />} />
<Route path="/metahub/:id/entities/:kindKey/instance/:entityId/records" element={<RecordList />} />
```

## Архитектура

### Entity-First модель маршрутов
```
Metahub
  ├── Shared Resources (/resources)
  │   ├── Layouts / metadata pools / scripts
  │   └── Переиспользуемые authoring-поверхности для platform-wide assets
  └── Entity Type (/entities/:kindKey)
      └── Entity Instance (/entities/:kindKey/instance/:entityId)
          ├── Field definitions / records / layout
          └── Nested child collections (/instance/:entityId/instances)
```

### Ключевые концепции
- **Метахабы**: Организационные единицы верхнего уровня, обеспечивающие полную изоляцию данных
- **Shared Resources**: Общие layout-ы, metadata pools и переиспользуемые scripts на выделенной поверхности `/resources`
- **Типы сущностей**: Platform-provided standard kinds и пользовательские виды, публикуемые через unified entities workspace
- **Экземпляры сущностей**: Design-time объекты, настраиваемые на generic entity routes с role-aware actions
- **Дочерние ресурсы**: Field definitions, records и standard child collections, смонтированные под entity-owned routes

### Стратегия изоляции данных
- Полное разделение между метахабами — отсутствие видимости между ними
- Все операции поддерживают контекст метахаба через URL-маршрутизацию
- Фронтенд и бэкенд валидация предотвращают создание сиротских сущностей
- Ролевой контроль доступа для разрешений метахабов

## Структура файлов

```
packages/metahubs-frontend/base/
├── __mocks__/            # Тестовые заглушки для focused frontend slices
├── __tests__/            # Пакетные smoke и export tests
├── src/
│   ├── components/       # Общие metahub-специфичные UI building blocks
│   ├── constants/        # Константы пакета и storage keys
│   ├── domains/          # Entity-first feature domains и screens
│   │   ├── branches/     # Маршруты и UI управления ветками
│   │   ├── entities/     # Типы сущностей, экземпляры, metadata, actions, events
│   │   ├── layouts/      # Настройка макетов и компоновки виджетов
│   │   ├── metahubs/     # Список, доска, создание и members UX
│   │   ├── migrations/   # Migration guard и migration-status UX
│   │   ├── publications/ # Publication authoring и published data surfaces
│   │   ├── scripts/      # Script editor и bundle authoring flows
│   │   ├── settings/     # Настройки метахаба, permissions и helpers
│   │   ├── shared/       # Cross-domain API helpers, query keys, shared UI
│   │   └── templates/    # Выбор шаблонов и preset-aware create flows
│   ├── hooks/            # Общие React hooks уровня пакета
│   ├── i18n/             # EN/RU переводы metahubs UI
│   ├── menu-items/       # Описатели навигации sidebar
│   ├── utils/            # Локальные helpers и adapters
│   ├── displayConverters.ts
│   ├── types.ts
│   └── index.ts          # Публичные экспорты пакета
├── dist/                 # Скомпилированный вывод (CJS, ESM, types)
├── package.json
├── tsconfig.json
├── tsdown.config.ts      # Конфигурация сборки
├── vitest.config.ts      # Конфигурация тестов
├── README.md             # Английская документация
└── README-RU.md          # Данный файл
```

## Основные компоненты

### MetahubList
Основной компонент для отображения и управления метахабами:

```tsx
import { MetahubList } from '@universo/metahubs-frontend'

// Функции:
// - Пагинированный табличный вид с функцией поиска
// - Операции создания, редактирования, удаления
// - Ролевой контроль доступа
// - Отзывчивый дизайн с Material-UI
```

### MetahubBoard
Компонент панели управления для аналитики метахабов:

```tsx
import { MetahubBoard } from '@universo/metahubs-frontend'

// Функции:
// - Специфичная для метахаба панель управления
// - Карточки статистики (сущности, ветки, участники)
// - Интерактивная визуализация данных
```

### StandardEntityCollectionPage
Entity-owned компонент для отображения стандартных экземпляров метаданных через единую динамическую поверхность маршрутов:

```tsx
import { StandardEntityCollectionPage } from '@universo/metahubs-frontend'

// Возможности:
// - Единая route-surface для platform-provided standard entity instances
// - Использует ключ вида из маршрута вместо отдельных экспортов страниц по видам
// - Держит стандартное редактирование метаданных внутри entity workspace
```

### StandardEntityChildCollectionPage
Entity-owned компонент для отображения вложенных стандартных коллекций из контекста родительской сущности:

```tsx
import { StandardEntityChildCollectionPage } from '@universo/metahubs-frontend'

// Возможности:
// - Generic entrypoint для вложенных standard entity collections
// - Сохраняет nested authoring routes на entity-owned surface
// - Убирает необходимость в отдельных public exports для каждого вида
```

### FieldDefinitionList / RecordList
Компоненты для управления entity-owned metadata и records:

```tsx
import { FieldDefinitionList, RecordList } from '@universo/metahubs-frontend'

// Функции:
// - Упорядочивание field definitions (drag & drop)
// - Динамические формы records на основе field definitions
// - Поддержка типов данных (string, с расширяемостью)
```

### TemplateSelector
Компонент для выбора шаблона метахаба при создании:

```tsx
import { TemplateSelector } from '@universo/metahubs-frontend'

// Функции:
// - Загрузка доступных шаблонов через хук useTemplates()
// - Выпадающий список с названием, описанием и версией шаблона
// - Встроен в диалог создания MetahubList
// - Обработка состояний загрузки и пустого списка
```

### ColumnsContainerEditorDialog
Визуальный редактор многоколоночных макетов с поддержкой drag-and-drop:

```tsx
import { ColumnsContainerEditorDialog } from '@universo/metahubs-frontend'

// Функции:
// - Визуальный редактор ColumnsContainerConfig (многоколоночные сеточные макеты)
// - Перетаскивание колонок через @dnd-kit (SortableContext + DragEndEvent)
// - Слайдер ширины колонки (1–12 единиц сетки, 12-колоночная сетка MUI)
// - Список виджетов для каждой колонки: добавление/удаление (макс. MAX_WIDGETS_PER_COLUMN=6)
// - Максимум колонок: MAX_COLUMNS=6 на контейнер
// - Валидация при сохранении: удаление вложенных columnsContainer для предотвращения рекурсии
// - Отслеживание изменений через isDirty memo (сравнение JSON-снимков)
// - Генерация UUID v7 для ID новых колонок через generateUuidV7()
```

### MetahubMigrationGuard

Компонент-гард маршрутов, блокирующий навигацию при наличии незавершённых миграций. Использует `MigrationGuardShell` из `@universo/migration-guard-shared` для общей логики гарда.

> **Полная документация**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)

## Интеграция API

Этот пакет ориентирован на UI-компоненты и не экспортирует публичный API-клиент.
Если нужен программный доступ, обращайтесь напрямую к backend-эндпоинтам.

### Example (custom client)
```typescript
import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })
const { data } = await api.get('/metahubs')
const { data: metahub } = await api.get('/metahub/123')
```

### React Query Example
```typescript
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })

function useMetahubs() {
  return useQuery({
    queryKey: ['metahubs', 'list'],
    queryFn: async () => (await api.get('/metahubs')).data
  })
}
```

## Разработка

### Предварительные требования
- Node.js 18+
- pnpm 8+
- TypeScript 5+

### Доступные скрипты
```bash
# Разработка
pnpm dev              # Запуск сервера разработки
pnpm build            # Сборка для продакшена (двойная CJS/ESM)
pnpm build:watch      # Сборка в режиме наблюдения

# Тестирование
pnpm test             # Запуск тестового пакета Vitest
pnpm test:watch       # Запуск тестов в режиме наблюдения
pnpm test:coverage    # Генерация отчёта покрытия

# Качество кода
pnpm lint             # Запуск ESLint
pnpm lint:fix         # Исправление ошибок ESLint
pnpm type-check       # Проверка типов TypeScript
```

### Система сборки
Данный пакет использует `tsdown` для двойного вывода сборки:
- **CommonJS**: `dist/index.js` (для совместимости с устаревшими системами)
- **ES Modules**: `dist/index.mjs` (для современных сборщиков)
- **Типы**: `dist/index.d.ts` (объявления TypeScript)

## Тестирование

### Структура тестов
```
src/
├── __tests__/
│   ├── exports.test.ts
│   └── ...
├── api/__tests__/
├── hooks/__tests__/
└── pages/__tests__/
```

### Запуск тестов
```bash
pnpm test                    # Запуск всех тестов
pnpm test:watch              # Режим наблюдения
pnpm test:coverage           # С покрытием
pnpm test -- --reporter=verbose  # Подробный вывод
```

## Конфигурация

### Переменные окружения
```bash
# Конфигурация API
VITE_API_URL=http://localhost:3000
VITE_API_VERSION=v1

# Аутентификация
VITE_AUTH_ENABLED=true
VITE_AUTH_PROVIDER=supabase
```

### Конфигурация TypeScript
Пакет использует строгую конфигурацию TypeScript:
- Включены строгие проверки null
- Нет неявных типов any
- Строгие типы функций
- Включены все строгие опции компилятора

## Участие в разработке

### Стиль кода
- Следуйте конфигурации ESLint
- Используйте Prettier для форматирования
- Предпочитайте TypeScript вместо JavaScript
- Используйте функциональные компоненты с хуками

### Процесс Pull Request
1. Создайте feature ветку от `main`
2. Реализуйте изменения с тестами
3. Обновите документацию
4. Запустите полный тестовый пакет
5. Отправьте PR с описанием

### Соглашение о коммитах
Следуйте соглашению conventional commits:
```bash
feat(metahubs): добавить функцию поиска
fix(api): обработка пустого ответа
docs(readme): обновить руководство по установке
```

## Связанные пакеты
- [`@universo/metahubs-backend`](../../metahubs-backend/base/README-RU.md) - Бэкенд сервис
- [`@universo/template-mui`](../../universo-template-mui/base/README-RU.md) - UI компоненты
- [`@universo/types`](../../universo-types/base/README-RU.md) - Общие типы

## Общие абстракции

### Паттерн декомпозиции компонентов

Каждый List-компонент разделён на три слоя:
1. **List-компонент** (`domains/<domain>/ui/<Domain>List.tsx`) — UI-рендеринг, диалоги, действия.
2. **Data-хук** (`domains/<domain>/hooks/use<Domain>ListData.ts`) — React Query логика, пагинация, трансформации данных.
3. **Утилиты** (`domains/<domain>/ui/<domain>ListUtils.ts`) — вспомогательные функции для форматирования, фильтрации, сортировки.

### `createDomainErrorHandler()`

Фабрика для маппинга backend error codes в локализованные snackbar-сообщения. Устраняет повторяющиеся if/else цепочки в mutation `onError` callbacks:

```ts
const handleError = createDomainErrorHandler({
    LIMIT_REACHED: (data, t) => t('attributes.limitReached', { limit: data.limit }),
})

// В мутации: handleError(error, t, enqueueSnackbar, 'attributes.createError')
```

### `createSimpleDeleteMutation()`

Настраиваемая фабрика для стандартных delete mutation hooks с оптимистичным удалением, откатом, snackbar-уведомлениями и инвалидацией кэша.

### `useListDialogs()`

Обобщённый хук на основе `useReducer`, управляющий пятью состояниями диалогов (create, edit, copy, delete, conflict) со стабильными ссылками на callback-функции. Устраняет повторяющееся управление состоянием диалогов в List-компонентах.

### `useMetahubTrees(metahubId)`

Общий хук для получения списка хабов с консистентным кэшированием (staleTime: 5 мин). Все List-компоненты используют один React Query key для автоматической дедупликации.

### `mapBaseVlcFields(entity, locale)`

Извлекает VLC-строки для стандартной тройки codename/name/description. Используется как building block в domain-specific `toXxxDisplay()` converter-функциях в `displayConverters.ts`.

### `fetchAllPaginatedItems(fetchFn, params)`

Рекурсивный пагинатор, который получает все страницы и возвращает единый `PaginatedResponse`.

---
*Часть [Universo Platformo](../../../README-RU.md) - Пакетная бизнес-платформа*
