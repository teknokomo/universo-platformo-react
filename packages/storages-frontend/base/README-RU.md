# @universo/storages-frontend

> 🏗️ **Современный пакет** - TypeScript-first архитектура с двойной системой сборки

## Обзор

Фронтенд-приложение для управления хранилищами, контейнерами и слотами в экосистеме Universo Platformo. storages Frontend предоставляет комплексные UI-процессы для управления трёхуровневой архитектурой хранилища → контейнеры → слоты с полной изоляцией данных и безопасностью.

## Информация о пакете

- **Пакет**: `@universo/storages-frontend`
- **Версия**: `0.1.0`
- **Тип**: React Frontend Package (Modern)
- **Фреймворк**: React 18 + TypeScript + Material-UI
- **Система сборки**: tsdown (двойная сборка - CJS + ESM)
- **Тестирование**: Vitest + React Testing Library

## Ключевые функции

### 🌍 Управление хранилищами
- **Иерархическая организация**: Трёхуровневая архитектура (хранилища → контейнеры → слоты)
- **Полная изоляция данных**: слоты и контейнеры из разных хранилищов полностью разделены
- **Ролевой доступ**: Пользовательские роли и разрешения для контроля доступа к хранилищам
- **Контекстная навигация**: Навигация с учётом хранилища с хлебными крошками и сохранением сайдбара

### 🎨 Пользовательский интерфейс
- **Интеграция Material-UI**: Согласованные UI-компоненты с современной системой дизайна
- **Адаптивный дизайн**: Оптимизирован для настольных и мобильных устройств
- **Табличное и карточное представление**: Гибкое отображение данных с пагинацией и поиском
- **Диалоговые формы**: Модальные формы для создания и редактирования слотов

### 🔧 Технические функции
- **TypeScript-First**: Полная реализация на TypeScript со строгой типизацией
- **Интеграция React Query**: Продвинутая загрузка данных и кэширование
- **Интернационализация**: Английские и русские переводы с i18next
- **Валидация форм**: Комплексная валидация с обработкой ошибок
- **Интеграция API**: RESTful API клиент с аутентификацией

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
pnpm --filter @universo/storages-frontend build

# Запустить в режиме разработки
pnpm --filter @universo/storages-frontend dev
```

### Интеграция
```tsx
// Импорт компонентов в ваше React-приложение
import { StorageList, StorageBoard, storagesDashboard } from '@universo/storages-frontend'

// Импорт i18n слотов
import { storagesTranslations } from '@universo/storages-frontend'

// Использование в маршрутах
<Route path="/storages" element={<StorageList />} />
<Route path="/storages/:id/board" element={<StorageBoard />} />
```

## Архитектура

### Трёхуровневая модель данных
- **хранилища**: Организационные единицы верхнего уровня, обеспечивающие полную изоляцию данных
- **контейнеры**: Логические группировки внутри хранилищов (например, "Веб-сервисы", "Мобильные приложения")
- **слоты**: Отдельные активы, принадлежащие конкретным контейнерам внутри хранилищов

### Стратегия изоляции данных
- Полное разделение между хранилищами - отсутствие видимости между ними
- Все операции поддерживают контекст хранилища через URL-маршрутизацию
- Фронтенд и бэкенд валидация предотвращают создание сиротских слотов
- Ролевой контроль доступа для разрешений хранилищов

## Использование

### Базовые компоненты
```tsx
import { StorageList, StorageBoard } from '@universo/storages-frontend'

// Список хранилищов с возможностями управления
function StoragesPage() {
  return <StorageList />
}

// Панель управления и аналитика хранилища
function StorageBoardPage() {
  return <StorageBoard />
}
```

### Интеграция API
```tsx
import { useApi } from '@universo/storages-frontend/hooks'
import * as storagesApi from '@universo/storages-frontend/api'

function ClusterData() {
  const { data: storages, isLoading } = useApi(
    storagesApi.getStorages
  )
  
  if (isLoading) return <div>Загрузка...</div>
  return <div>Найдено {storages?.length} хранилищов</div>
}
```

### Интеграция меню
```tsx
import { storagesDashboard } from '@universo/storages-frontend'

// Добавить в навигационное меню
const menuItems = [
  ...otherMenuItems,
  storagesDashboard
]
```

## Структура файлов

```
packages/storages-frontend/base/
├── src/
│   ├── api/              # Функции API клиента
│   │   ├── storages.ts   # CRUD операции хранилищов
│   │   ├── containers.ts     # Управление контейнерами
│   │   ├── slots.ts     # Операции с слотами
│   │   └── queryKeys.ts    # Ключи React Query
│   ├── hooks/            # Пользовательские React хуки
│   │   ├── useApi.ts       # Хук интеграции API
│   │   └── index.ts        # Экспорт хуков
│   ├── i18n/             # Интернационализация
│   │   ├── locales/        # Языковые файлы (en, ru)
│   │   │   ├── en.json     # Английские переводы
│   │   │   └── ru.json     # Русские переводы
│   │   └── index.ts        # Конфигурация i18n
│   ├── pages/            # Основные компоненты страниц
│   │   ├── StorageList.tsx   # Основной компонент списка
│   │   ├── StorageBoard.tsx  # Компонент панели управления
│   │   └── ClusterActions.ts # Определения действий
│   ├── menu-items/       # Конфигурация навигации
│   │   └── clusterDashboard.ts
│   ├── types/            # Определения TypeScript
│   │   ├── index.ts        # Основные экспорты типов
│   │   └── types.ts        # Определения типов
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

### StorageList
Основной компонент для отображения и управления хранилищами:

```tsx
import { StorageList } from '@universo/storages-frontend'

// Функции:
// - Пагинированный табличный вид с функцией поиска
// - Операции создания, редактирования, удаления
// - Ролевой контроль доступа
// - Отзывчивый дизайн с Material-UI
// - Поддержка интернационализации
```

### StorageBoard  
Компонент панели управления для аналитики хранилищов:

```tsx
import { StorageBoard } from '@universo/storages-frontend'

// Функции:
// - Специфичная для хранилища панель управления
// - Аналитика и статистика
// - Интерактивная визуализация данных
// - Контекстно-зависимая навигация
```

## Интеграция API

### Базовые операции API
```typescript
import * as storagesApi from '@universo/storages-frontend/api'

// Получить все хранилища
const storages = await storagesApi.getStorages()

// Получить конкретный хранилищ
const storage = await storagesApi.getStorage(id)

// Создать новый хранилищ
const newStorage = await storagesApi.createCluster({
  name: 'Мой хранилищ',
  description: 'Описание хранилища'
})

// Обновить хранилищ
const updated = await storagesApi.updateStorage(id, data)

// Удалить хранилищ
await storagesApi.deleteStorage(id)
```

### Операции в контексте хранилища
```typescript
// Получить контейнеры для конкретного хранилища
const containers = await storagesApi.getStorageDomains(clusterId)

// Получить слоты для конкретного хранилища  
const slots = await storagesApi.getStorageResources(clusterId)

// Связать контейнер с хранилищом
await storagesApi.addDomainToCluster(clusterId, domainId)
```

### Интеграция React Query
```typescript
import { useQuery } from '@tanstack/react-query'
import { clustersQueryKeys } from '@universo/storages-frontend/api'

function useClusters() {
  return useQuery({
    queryKey: clustersQueryKeys.all,
    queryFn: storagesApi.getStorages
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

### Рекомендации по разработке

#### Архитектурные паттерны
- **Трёхуровневая модель**: хранилища → контейнеры → слоты
- **Изоляция данных**: Строгие границы контекста между хранилищами
- **React Query**: Централизованная загрузка и кэширование данных
- **Material-UI**: Согласованное использование библиотеки компонентов

#### Управление контекстом
```typescript
// Всегда поддерживать контекст хранилища
const clusterContext = useClusterContext()
const containers = useDomains(clusterContext.id)
```

#### Валидация форм
```typescript
// Валидация обязательных полей
const resourceSchema = z.object({
  name: z.string().min(1),
  domainId: z.string().min(1), // Обязательно - нет пустой опции
  description: z.string().optional()
})
```

## Тестирование

### Структура тестов
```
src/
├── __tests__/
│   ├── components/
│   ├── hooks/
│   ├── api/
│   └── utils/
└── vitest.config.ts
```

### Подход к тестированию
```typescript
// Тестирование компонентов с React Testing Library
import { render, screen } from '@testing-library/react'
import { StorageList } from '../StorageList'

test('отображает список хранилищов', () => {
  render(<StorageList />)
  expect(screen.getByText('хранилища')).toBeInTheDocument()
})
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
feat(storages): добавить функцию поиска
fix(api): обработка пустого ответа
docs(readme): обновить руководство по установке
```

## Связанные пакеты
- [`@universo/storages-backend`](../storages-backend/base/README.md) - Бэкенд сервис
- [`@universo/template-mui`](../universo-template-mui/base/README.md) - UI компоненты
- [`@universo/types`](../universo-types/base/README.md) - Общие типы

---
*Часть [Universo Platformo](../../../README-RU.md) - Комплексная платформа управления хранилищами*
