# @universo/organizations-frt

> 🏗️ **Современный пакет** - TypeScript-first архитектура с двойной системой сборки

## Обзор

Фронтенд-приложение для управления организациями, отделами и должностями в экосистеме Universo Platformo. Organizations Frontend предоставляет комплексные UI-процессы для управления трёхуровневой архитектурой Организации → Отделы → Должности с полной изоляцией данных и безопасностью.

## Информация о пакете

- **Пакет**: `@universo/organizations-frt`
- **Версия**: `0.1.0`
- **Тип**: React Frontend Package (Modern)
- **Фреймворк**: React 18 + TypeScript + Material-UI
- **Система сборки**: tsdown (двойная сборка - CJS + ESM)
- **Тестирование**: Vitest + React Testing Library

## Ключевые функции

### 🌍 Управление организациями
- **Иерархическая организация**: Трёхуровневая архитектура (Организации → Отделы → Должности)
- **Полная изоляция данных**: Должности и отделы из разных организаций полностью разделены
- **Ролевой доступ**: Пользовательские роли и разрешения для контроля доступа к организациям
- **Контекстная навигация**: Навигация с учётом организации с хлебными крошками и сохранением сайдбара

### 🎨 Пользовательский интерфейс
- **Интеграция Material-UI**: Согласованные UI-компоненты с современной системой дизайна
- **Адаптивный дизайн**: Оптимизирован для настольных и мобильных устройств
- **Табличное и карточное представление**: Гибкое отображение данных с пагинацией и поиском
- **Диалоговые формы**: Модальные формы для создания и редактирования должностей

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
pnpm --filter @universo/organizations-frt build

# Запустить в режиме разработки
pnpm --filter @universo/organizations-frt dev
```

### Интеграция
```tsx
// Импорт компонентов в ваше React-приложение
import { OrganizationList, OrganizationBoard, organizationsDashboard } from '@universo/organizations-frt'

// Импорт i18n должностей
import { organizationsTranslations } from '@universo/organizations-frt'

// Использование в маршрутах
<Route path="/organizations" element={<OrganizationList />} />
<Route path="/organizations/:id/board" element={<OrganizationBoard />} />
```

## Архитектура

### Трёхуровневая модель данных
- **организации**: Организационные единицы верхнего уровня, обеспечивающие полную изоляцию данных
- **отделы**: Логические группировки внутри организаций (например, "Веб-сервисы", "Мобильные приложения")
- **должности**: Отдельные активы, принадлежащие конкретным отделам внутри организаций

### Стратегия изоляции данных
- Полное разделение между организациями - отсутствие видимости между ними
- Все операции поддерживают контекст организации через URL-маршрутизацию
- Фронтенд и бэкенд валидация предотвращают создание сиротских должностей
- Ролевой контроль доступа для разрешений организаций

## Использование

### Базовые компоненты
```tsx
import { OrganizationList, OrganizationBoard } from '@universo/organizations-frt'

// Список организаций с возможностями управления
function OrganizationsPage() {
  return <OrganizationList />
}

// Панель управления и аналитика организации
function OrganizationBoardPage() {
  return <OrganizationBoard />
}
```

### Интеграция API
```tsx
import { useApi } from '@universo/organizations-frt/hooks'
import * as organizationsApi from '@universo/organizations-frt/api'

function OrganizationData() {
  const { data: organizations, isLoading } = useApi(
    organizationsApi.getOrganizations
  )
  
  if (isLoading) return <div>Загрузка...</div>
  return <div>Найдено {organizations?.length} организаций</div>
}
```

### Интеграция меню
```tsx
import { organizationsDashboard } from '@universo/organizations-frt'

// Добавить в навигационное меню
const menuItems = [
  ...otherMenuItems,
  organizationsDashboard
]
```

## Структура файлов

```
packages/organizations-frt/base/
├── src/
│   ├── api/              # Функции API клиента
│   │   ├── organizations.ts   # CRUD операции организаций
│   │   ├── departments.ts     # Управление отделами
│   │   ├── positions.ts     # Операции с должностями
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
│   │   ├── OrganizationList.tsx   # Основной компонент списка
│   │   ├── OrganizationBoard.tsx  # Компонент панели управления
│   │   └── OrganizationActions.ts # Определения действий
│   ├── menu-items/       # Конфигурация навигации
│   │   └── organizationDashboard.ts
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

### OrganizationList
Основной компонент для отображения и управления организациями:

```tsx
import { OrganizationList } from '@universo/organizations-frt'

// Функции:
// - Пагинированный табличный вид с функцией поиска
// - Операции создания, редактирования, удаления
// - Ролевой контроль доступа
// - Отзывчивый дизайн с Material-UI
// - Поддержка интернационализации
```

### OrganizationBoard  
Компонент панели управления для аналитики организаций:

```tsx
import { OrganizationBoard } from '@universo/organizations-frt'

// Функции:
// - Специфичная для организации панель управления
// - Аналитика и статистика
// - Интерактивная визуализация данных
// - Контекстно-зависимая навигация
```

## Интеграция API

### Базовые операции API
```typescript
import * as organizationsApi from '@universo/organizations-frt/api'

// Получить все организации
const organizations = await organizationsApi.getOrganizations()

// Получить конкретную организацию
const organization = await organizationsApi.getOrganization(id)

// Создать новую организацию
const newCluster = await organizationsApi.createOrganization({
  name: 'Моя организация',
  description: 'Описание организации'
})

// Обновить организацию
const updated = await organizationsApi.updateOrganization(id, data)

// Удалить организацию
await organizationsApi.deleteOrganization(id)
```

### Операции в контексте организации
```typescript
// Получить отделы для конкретной организации
const departments = await organizationsApi.getOrganizationDepartments(organizationId)

// Получить должности для конкретной организации  
const positions = await organizationsApi.getOrganizationPositions(organizationId)

// Связать отдел с организацией
await organizationsApi.addDepartmentToOrganization(organizationId, departmentId)
```

### Интеграция React Query
```typescript
import { useQuery } from '@tanstack/react-query'
import { organizationsQueryKeys } from '@universo/organizations-frt/api'

function useOrganizations() {
  return useQuery({
    queryKey: organizationsQueryKeys.all,
    queryFn: organizationsApi.getOrganizations
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
- **Трёхуровневая модель**: организации → отделы → должности
- **Изоляция данных**: Строгие границы контекста между организациями
- **React Query**: Централизованная загрузка и кэширование данных
- **Material-UI**: Согласованное использование библиотеки компонентов

#### Управление контекстом
```typescript
// Всегда поддерживать контекст организации
const organizationContext = useOrganizationContext()
const departments = useDepartments(organizationContext.id)
```

#### Валидация форм
```typescript
// Валидация обязательных полей
const positionSchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().min(1), // Обязательно - нет пустой опции
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
import { OrganizationList } from '../OrganizationList'

test('отображает список организаций', () => {
  render(<OrganizationList />)
  expect(screen.getByText('организации')).toBeInTheDocument()
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
feat(organizations): добавить функцию поиска
fix(api): обработка пустого ответа
docs(readme): обновить руководство по установке
```

## Связанные пакеты
- [`@universo/organizations-srv`](../organizations-srv/base/README.md) - Бэкенд сервис
- [`@universo/template-mui`](../universo-template-mui/base/README.md) - UI компоненты
- [`@universo/types`](../universo-types/base/README.md) - Общие типы

---
*Часть [Universo Platformo](../../../README-RU.md) - Комплексная платформа управления организациями*
