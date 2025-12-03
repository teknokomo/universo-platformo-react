# @universo/campaigns-frontend

> 🏗️ **Современный пакет** - TypeScript-first архитектура с двойной системой сборки

## Обзор

Фронтенд-приложение для управления кампаниями, мероприятиями и активностями в экосистеме Universo Platformo. campaigns Frontend предоставляет комплексные UI-процессы для управления трёхуровневой архитектурой кампании → мероприятия → активности с полной изоляцией данных и безопасностью.

## Информация о пакете

- **Пакет**: `@universo/campaigns-frontend`
- **Версия**: `0.1.0`
- **Тип**: React Frontend Package (Modern)
- **Фреймворк**: React 18 + TypeScript + Material-UI
- **Система сборки**: tsdown (двойная сборка - CJS + ESM)
- **Тестирование**: Vitest + React Testing Library

## Ключевые функции

### 🌍 Управление кампаниями
- **Иерархическая организация**: Трёхуровневая архитектура (кампании → мероприятия → активности)
- **Полная изоляция данных**: активности и мероприятия из разных кампаний полностью разделены
- **Ролевой доступ**: Пользовательские роли и разрешения для контроля доступа к кампаниам
- **Контекстная навигация**: Навигация с учётом кампании с хлебными крошками и сохранением сайдбара

### 🎨 Пользовательский интерфейс
- **Интеграция Material-UI**: Согласованные UI-компоненты с современной системой дизайна
- **Адаптивный дизайн**: Оптимизирован для настольных и мобильных устройств
- **Табличное и карточное представление**: Гибкое отображение данных с пагинацией и поиском
- **Диалоговые формы**: Модальные формы для создания и редактирования активностей

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
pnpm --filter @universo/campaigns-frontend build

# Запустить в режиме разработки
pnpm --filter @universo/campaigns-frontend dev
```

### Интеграция
```tsx
// Импорт компонентов в ваше React-приложение
import { CampaignList, CampaignBoard, campaignsDashboard } from '@universo/campaigns-frontend'

// Импорт i18n активностей
import { campaignsTranslations } from '@universo/campaigns-frontend'

// Использование в маршрутах
<Route path="/campaigns" element={<CampaignList />} />
<Route path="/campaign/:id/board" element={<CampaignBoard />} />
```

## Архитектура

### Трёхуровневая модель данных
- **кампании**: Организационные единицы верхнего уровня, обеспечивающие полную изоляцию данных
- **мероприятия**: Логические группировки внутри кампаний (например, "Веб-сервисы", "Мобильные приложения")
- **активности**: Отдельные активы, принадлежащие конкретным мероприятиам внутри кампаний

### Стратегия изоляции данных
- Полное разделение между кампаниями - отсутствие видимости между ними
- Все операции поддерживают контекст кампании через URL-маршрутизацию
- Фронтенд и бэкенд валидация предотвращают создание сиротских активностей
- Ролевой контроль доступа для разрешений кампаний

## Использование

### Базовые компоненты
```tsx
import { CampaignList, CampaignBoard } from '@universo/campaigns-frontend'

// Список кампаний с возможностями управления
function CampaignsPage() {
  return <CampaignList />
}

// Панель управления и аналитика кампании
function CampaignBoardPage() {
  return <CampaignBoard />
}
```

### Интеграция API
```tsx
import { useApi } from '@universo/campaigns-frontend/hooks'
import * as campaignsApi from '@universo/campaigns-frontend/api'

function CampaignData() {
  const { data: campaigns, isLoading } = useApi(
    campaignsApi.getCampaigns
  )
  
  if (isLoading) return <div>Загрузка...</div>
  return <div>Найдено {campaigns?.length} кампаний</div>
}
```

### Интеграция меню
```tsx
import { campaignsDashboard } from '@universo/campaigns-frontend'

// Добавить в навигационное меню
const menuItems = [
  ...otherMenuItems,
  campaignsDashboard
]
```

## Структура файлов

```
packages/campaigns-frontend/base/
├── src/
│   ├── api/              # Функции API клиента
│   │   ├── campaigns.ts   # CRUD операции кампаний
│   │   ├── events.ts     # Управление мероприятиями
│   │   ├── activities.ts     # Операции с активностями
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
│   │   ├── CampaignList.tsx   # Основной компонент списка
│   │   ├── CampaignBoard.tsx  # Компонент панели управления
│   │   └── CampaignActions.ts # Определения действий
│   ├── menu-items/       # Конфигурация навигации
│   │   └── campaignDashboard.ts
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

### CampaignList
Основной компонент для отображения и управления кампаниями:

```tsx
import { CampaignList } from '@universo/campaigns-frontend'

// Функции:
// - Пагинированный табличный вид с функцией поиска
// - Операции создания, редактирования, удаления
// - Ролевой контроль доступа
// - Отзывчивый дизайн с Material-UI
// - Поддержка интернационализации
```

### CampaignBoard  
Компонент панели управления для аналитики кампаний:

```tsx
import { CampaignBoard } from '@universo/campaigns-frontend'

// Функции:
// - Специфичная для кампании панель управления
// - Аналитика и статистика
// - Интерактивная визуализация данных
// - Контекстно-зависимая навигация
```

## Интеграция API

### Базовые операции API
```typescript
import * as campaignsApi from '@universo/campaigns-frontend/api'

// Получить все кампании
const campaigns = await campaignsApi.getCampaigns()

// Получить конкретную кампанию
const campaign = await campaignsApi.getCampaign(id)

// Создать новую кампанию
const newCampaign = await campaignsApi.createCampaign({
  name: 'Моя кампания',
  description: 'Описание кампании'
})

// Обновить кампанию
const updated = await campaignsApi.updateCampaign(id, data)

// Удалить кампанию
await campaignsApi.deleteCampaign(id)
```

### Операции в контексте кампании
```typescript
// Получить мероприятия для конкретной кампании
const events = await campaignsApi.getCampaignEvents(campaignId)

// Получить активности для конкретной кампании  
const activities = await campaignsApi.getCampaignActivities(campaignId)

// Связать мероприятие с кампанией
await campaignsApi.addEventToCampaign(campaignId, eventId)
```

### Интеграция React Query
```typescript
import { useQuery } from '@tanstack/react-query'
import { campaignsQueryKeys } from '@universo/campaigns-frontend/api'

function useCampaigns() {
  return useQuery({
    queryKey: campaignsQueryKeys.all,
    queryFn: campaignsApi.getCampaigns
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
- **Трёхуровневая модель**: кампании → мероприятия → активности
- **Изоляция данных**: Строгие границы контекста между кампаниями
- **React Query**: Централизованная загрузка и кэширование данных
- **Material-UI**: Согласованное использование библиотеки компонентов

#### Управление контекстом
```typescript
// Всегда поддерживать контекст кампании
const campaignContext = useCampaignContext()
const events = useEvents(campaignContext.id)
```

#### Валидация форм
```typescript
// Валидация обязательных полей
const activitySchema = z.object({
  name: z.string().min(1),
  eventId: z.string().min(1), // Обязательно - нет пустой опции
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
import { CampaignList } from '../CampaignList'

test('отображает список кампаний', () => {
  render(<CampaignList />)
  expect(screen.getByText('кампании')).toBeInTheDocument()
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
feat(Campaigns): добавить функцию поиска
fix(api): обработка пустого ответа
docs(readme): обновить руководство по установке
```

## Связанные пакеты
- [`@universo/campaigns-backend`](../../campaigns-backend/base/README.md) - Бэкенд сервис
- [`@universo/template-mui`](../../universo-template-mui/base/README.md) - UI компоненты
- [`@universo/types`](../../universo-types/base/README.md) - Общие типы

---
*Часть [Universo Platformo](../../../README-RU.md) - Комплексная платформа управления кампаниями*
