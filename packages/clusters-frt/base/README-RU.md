# @universo/clusters-frt

> 🏗️ **Современный пакет** - TypeScript-first архитектура с двойной системой сборки

## Обзор

Фронтенд-приложение для управления кластерами, доменами и ресурсами в экосистеме Universo Platformo. Clusters Frontend предоставляет комплексные UI-процессы для управления трёхуровневой архитектурой Кластеры → Домены → Ресурсы с полной изоляцией данных и безопасностью.

## Информация о пакете

- **Пакет**: `@universo/clusters-frt`
- **Версия**: `0.1.0`
- **Тип**: React Frontend Package (Modern)
- **Фреймворк**: React 18 + TypeScript + Material-UI
- **Система сборки**: tsdown (двойная сборка - CJS + ESM)
- **Тестирование**: Vitest + React Testing Library

## Ключевые функции

### 🌍 Управление кластерами
- **Иерархическая организация**: Трёхуровневая архитектура (Кластеры → Домены → Ресурсы)
- **Полная изоляция данных**: Ресурсы и домены из разных кластеров полностью разделены
- **Ролевой доступ**: Пользовательские роли и разрешения для контроля доступа к кластерам
- **Контекстная навигация**: Навигация с учётом кластера с хлебными крошками и сохранением сайдбара

### 🎨 Пользовательский интерфейс
- **Интеграция Material-UI**: Согласованные UI-компоненты с современной системой дизайна
- **Адаптивный дизайн**: Оптимизирован для настольных и мобильных устройств
- **Табличное и карточное представление**: Гибкое отображение данных с пагинацией и поиском
- **Диалоговые формы**: Модальные формы для создания и редактирования ресурсов

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
pnpm --filter @universo/clusters-frt build

# Запустить в режиме разработки
pnpm --filter @universo/clusters-frt dev
```

### Интеграция
```tsx
// Импорт компонентов в ваше React-приложение
import { ClusterList, ClusterBoard, clustersDashboard } from '@universo/clusters-frt'

// Импорт i18n ресурсов
import { clustersTranslations } from '@universo/clusters-frt'

// Использование в маршрутах
<Route path="/clusters" element={<ClusterList />} />
<Route path="/cluster/:id/board" element={<ClusterBoard />} />
```

## Архитектура

### Трёхуровневая модель данных
- **Кластеры**: Организационные единицы верхнего уровня, обеспечивающие полную изоляцию данных
- **Домены**: Логические группировки внутри кластеров (например, "Веб-сервисы", "Мобильные приложения")
- **Ресурсы**: Отдельные активы, принадлежащие конкретным доменам внутри кластеров

### Стратегия изоляции данных
- Полное разделение между кластерами - отсутствие видимости между ними
- Все операции поддерживают контекст кластера через URL-маршрутизацию
- Фронтенд и бэкенд валидация предотвращают создание сиротских ресурсов
- Ролевой контроль доступа для разрешений кластеров

## Использование

### Базовые компоненты
```tsx
import { ClusterList, ClusterBoard } from '@universo/clusters-frt'

// Список кластеров с возможностями управления
function ClustersPage() {
  return <ClusterList />
}

// Панель управления и аналитика кластера
function ClusterBoardPage() {
  return <ClusterBoard />
}
```

### Интеграция API
```tsx
import { useApi } from '@universo/clusters-frt/hooks'
import * as clustersApi from '@universo/clusters-frt/api'

function ClusterData() {
  const { data: clusters, isLoading } = useApi(
    clustersApi.getClusters
  )
  
  if (isLoading) return <div>Загрузка...</div>
  return <div>Найдено {clusters?.length} кластеров</div>
}
```

### Интеграция меню
```tsx
import { clustersDashboard } from '@universo/clusters-frt'

// Добавить в навигационное меню
const menuItems = [
  ...otherMenuItems,
  clustersDashboard
]
```

## Структура файлов

```
packages/clusters-frt/base/
├── src/
│   ├── api/              # Функции API клиента
│   │   ├── clusters.ts   # CRUD операции кластеров
│   │   ├── domains.ts     # Управление доменами
│   │   ├── resources.ts     # Операции с ресурсами
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
│   │   ├── ClusterList.tsx   # Основной компонент списка
│   │   ├── ClusterBoard.tsx  # Компонент панели управления
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

### ClusterList
Основной компонент для отображения и управления кластерами:

```tsx
import { ClusterList } from '@universo/clusters-frt'

// Функции:
// - Пагинированный табличный вид с функцией поиска
// - Операции создания, редактирования, удаления
// - Ролевой контроль доступа
// - Отзывчивый дизайн с Material-UI
// - Поддержка интернационализации
```

### ClusterBoard  
Компонент панели управления для аналитики кластеров:

```tsx
import { ClusterBoard } from '@universo/clusters-frt'

// Функции:
// - Специфичная для кластера панель управления
// - Аналитика и статистика
// - Интерактивная визуализация данных
// - Контекстно-зависимая навигация
```

## Интеграция API

### Базовые операции API
```typescript
import * as clustersApi from '@universo/clusters-frt/api'

// Получить все кластеры
const clusters = await clustersApi.getClusters()

// Получить конкретный кластер
const cluster = await clustersApi.getCluster(id)

// Создать новый кластер
const newCluster = await clustersApi.createCluster({
  name: 'Мой кластер',
  description: 'Описание кластера'
})

// Обновить кластер
const updated = await clustersApi.updateCluster(id, data)

// Удалить кластер
await clustersApi.deleteCluster(id)
```

### Операции в контексте кластера
```typescript
// Получить домены для конкретного кластера
const domains = await clustersApi.getClusterDomains(clusterId)

// Получить ресурсы для конкретного кластера  
const resources = await clustersApi.getClusterResources(clusterId)

// Связать домен с кластером
await clustersApi.addDomainToCluster(clusterId, domainId)
```

### Интеграция React Query
```typescript
import { useQuery } from '@tanstack/react-query'
import { clustersQueryKeys } from '@universo/clusters-frt/api'

function useClusters() {
  return useQuery({
    queryKey: clustersQueryKeys.all,
    queryFn: clustersApi.getClusters
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
- **Трёхуровневая модель**: Кластеры → Домены → Ресурсы
- **Изоляция данных**: Строгие границы контекста между кластерами
- **React Query**: Централизованная загрузка и кэширование данных
- **Material-UI**: Согласованное использование библиотеки компонентов

#### Управление контекстом
```typescript
// Всегда поддерживать контекст кластера
const clusterContext = useClusterContext()
const domains = useDomains(clusterContext.id)
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
import { ClusterList } from '../ClusterList'

test('отображает список кластеров', () => {
  render(<ClusterList />)
  expect(screen.getByText('Кластеры')).toBeInTheDocument()
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
feat(clusters): добавить функцию поиска
fix(api): обработка пустого ответа
docs(readme): обновить руководство по установке
```

## Связанные пакеты
- [`@universo/clusters-srv`](../../clusters-srv/base/README.md) - Бэкенд сервис
- [`@universo/template-mui`](../../universo-template-mui/base/README.md) - UI компоненты
- [`@universo/types`](../../universo-types/base/README.md) - Общие типы

---
*Часть [Universo Platformo](../../../README-RU.md) - Комплексная платформа управления кластерами*
