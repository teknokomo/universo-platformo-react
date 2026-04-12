# @universo/metahubs-frontend

> 🏗️ **Современный пакет** - TypeScript-first архитектура с двойной системой сборки

Фронтенд-приложение для управления метахабами, хабами, каталогами, атрибутами и элементами в экосистеме Universo Platformo.

## Информация о пакете

- **Пакет**: `@universo/metahubs-frontend`
- **Версия**: `0.1.0`
- **Тип**: React Frontend Package (Modern)
- **Фреймворк**: React 18 + TypeScript + Material-UI
- **Система сборки**: tsdown (двойная сборка - CJS + ESM)
- **Тестирование**: Vitest + React Testing Library

## Ключевые функции

### 🌍 Управление метахабами
- **Иерархическая организация**: Четырёхуровневая архитектура (Метахабы → Хабы → Каталоги → Атрибуты/Элементы)
- **Полная изоляция данных**: Данные из разных метахабов полностью разделены
- **Ролевой доступ**: Пользовательские роли и разрешения для контроля доступа
- **Контекстная навигация**: Навигация с учётом метахаба с хлебными крошками и сохранением сайдбара

### 🗂️ Хабы и каталоги
- **Хабы**: Контейнеры данных, определяющие структуру метахаба
- **Каталоги**: Переиспользуемые определения схем со связью N:M с хабами
- **Атрибуты**: Определения полей внутри каталогов (имя, тип, валидация)
- **Элементы**: Записи данных, соответствующие схемам каталогов (JSONB хранение)

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

### 🧩 Делегирование Entity V2
- **Workspace Entities**: Hubs V2, Catalogs V2, Sets V2 и Enumerations V2 создаются из presets и публикуются в dynamic metahub menu.
- **Переиспользование legacy surfaces**: V2 entity routes делегируются в HubList, CatalogList, SetList и EnumerationList вместо введения параллельных CRUD shells.
- **Владение маршрутами**: Делегированные detail tabs остаются под `/metahub/:id/entities/:kindKey/...`, тогда как legacy routes продолжают сосуществовать для видимости общих данных.
- **Runtime boundary**: Catalog-compatible V2 sections могут появляться в runtime после publication sync, а hub/set/enumeration-compatible V2 sections остаются отфильтрованными из runtime navigation.

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
  HubList,
  CatalogList,
  AttributeList,
  ElementList,
  metahubsDashboard 
} from '@universo/metahubs-frontend'

// Импорт i18n ресурсов
import { metahubsTranslations } from '@universo/metahubs-frontend'

// Использование в маршрутах
<Route path="/metahubs" element={<MetahubList />} />
<Route path="/metahub/:id/board" element={<MetahubBoard />} />
<Route path="/metahub/:id/hubs" element={<HubList />} />
<Route path="/metahub/:id/hub/:hubId/catalogs" element={<CatalogList />} />
<Route path="/metahub/:id/catalogs" element={<CatalogList />} />
<Route path="/metahub/:id/catalog/:catalogId/attributes" element={<AttributeList />} />
<Route path="/metahub/:id/catalog/:catalogId/elements" element={<ElementList />} />
```

## Архитектура

### Четырёхуровневая модель сущностей
```
Metahub (верхнеуровневая организационная единица)
  └── Hub (контейнер данных)
        └── CatalogHub (связь N:M)
              └── Catalog (определение схемы)
                    ├── Attribute (определения полей)
                    └── Element (записи данных)
```

### Ключевые концепции
- **Метахабы**: Организационные единицы верхнего уровня, обеспечивающие полную изоляцию данных
- **Хабы**: Контейнеры контента внутри метахабов для организации каталогов
- **Каталоги**: Переиспользуемые определения схем, которые могут принадлежать нескольким хабам (связь N:M)
- **Атрибуты**: Определения полей внутри каталогов (имя, тип, обязательность, порядок)
- **Элементы**: Записи данных, хранящиеся как JSONB в соответствии со схемой атрибутов каталога

### Стратегия изоляции данных
- Полное разделение между метахабами — отсутствие видимости между ними
- Все операции поддерживают контекст метахаба через URL-маршрутизацию
- Фронтенд и бэкенд валидация предотвращают создание сиротских сущностей
- Ролевой контроль доступа для разрешений метахабов

## Структура файлов

```
packages/metahubs-frontend/base/
├── src/
│   ├── api/              # Функции API клиента
│   │   ├── metahubs.ts   # CRUD операции метахабов
│   │   ├── hubs.ts       # Управление хабами
│   │   ├── catalogs.ts   # Операции с каталогами
│   │   ├── attributes.ts # Операции с атрибутами
│   │   ├── elements.ts   # Операции с элементами
│   │   ├── templates.ts  # Список шаблонов
│   │   └── queryKeys.ts  # Ключи React Query
│   ├── domains/
│   │   ├── layouts/      # Домен управления макетами
│   │   │   ├── ui/
│   │   │   │   └── ColumnsContainerEditorDialog.tsx  # DnD редактор колонок
│   │   │   └── index.ts
│   │   └── migrations/   # Домен гарда миграций
│   │       ├── api/      # API статуса и применения миграций
│   │       ├── hooks/    # Хук useMetahubMigrationsStatus
│   │       ├── ui/
│   │       │   └── MetahubMigrationGuard.tsx         # Компонент-гард маршрутов
│   │       └── index.ts
│   ├── hooks/            # Пользовательские React хуки
│   │   ├── mutations.ts  # useMutation хуки
│   │   └── index.ts      # Экспорт хуков
│   ├── i18n/             # Интернационализация
│   │   └── locales/      # Языковые файлы (en, ru)
│   ├── pages/            # Основные компоненты страниц
│   │   ├── MetahubList.tsx
│   │   ├── MetahubBoard.tsx
│   │   ├── HubList.tsx
│   │   ├── CatalogList.tsx
│   │   ├── AttributeList.tsx
│   │   └── ElementList.tsx
│   ├── menu-items/       # Конфигурация навигации
│   ├── types/            # Определения TypeScript
│   ├── utils/            # Вспомогательные функции
│   └── index.ts          # Экспорты пакета
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
// - Карточки статистики (хабы, каталоги, участники)
// - Интерактивная визуализация данных
```

### HubList
Компонент для управления хабами внутри метахаба:

```tsx
import { HubList } from '@universo/metahubs-frontend'

// Функции:
// - CRUD операции с хабами
// - Отображение количества каталогов
// - Кодовое имя с транслитерацией
```

### CatalogList
Компонент для управления каталогами (в контексте хаба или глобально):

```tsx
import { CatalogList } from '@universo/metahubs-frontend'

// Функции:
// - Двойной режим: в контексте хаба или всего метахаба
// - Управление связями N:M с хабами
// - Отображение количества атрибутов и элементов
```

### AttributeList / ElementList
Компоненты для управления данными каталога:

```tsx
import { AttributeList, ElementList } from '@universo/metahubs-frontend'

// Функции:
// - Упорядочивание атрибутов (drag & drop)
// - Динамические формы элементов на основе атрибутов
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

### `useMetahubHubs(metahubId)`

Общий хук для получения списка хабов с консистентным кэшированием (staleTime: 5 мин). Все List-компоненты используют один React Query key для автоматической дедупликации.

### `mapBaseVlcFields(entity, locale)`

Извлекает VLC-строки для стандартной тройки codename/name/description. Используется как building block в domain-specific `toXxxDisplay()` converter-функциях в `displayConverters.ts`.

### `fetchAllPaginatedItems(fetchFn, params)`

Рекурсивный пагинатор, который получает все страницы и возвращает единый `PaginatedResponse`.

---
*Часть [Universo Platformo](../../../README-RU.md) - Пакетная бизнес-платформа*
