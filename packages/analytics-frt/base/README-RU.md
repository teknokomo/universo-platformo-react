# Фронтенд аналитики (@universo/analytics-frt)

React-пакет для отображения комплексной аналитики квизов и отслеживания лидов в экосистеме Universo Platformo.

## Обзор

Фронтенд аналитики предоставляет детальную информацию о производительности квизов, вовлеченности участников и данных сбора лидов. Он бесшовно интегрируется с архитектурой space-canvas платформы Universo для предоставления контекстной аналитики в образовательных и бизнес-приложениях.

## Ключевые возможности

- **Комплексная панель аналитики**: Визуальные карточки метрик с показателями общего количества участников, средними/максимальными баллами и общими очками
- **Управление лидами**: Детальные данные участников с контактной информацией и отслеживанием завершения
- **Иерархическая навигация по данным**: Рабочий процесс выбора Пространство → Холст → Квиз для организованного доступа к данным
- **Поиск и фильтрация в реальном времени**: Динамическая фильтрация участников по имени или email
- **Поддержка нескольких языков**: Полная интеграция i18n с переводами на английский и русский языки
- **Адаптивный дизайн**: Компоненты Material-UI, оптимизированные для настольных и мобильных устройств
- **Визуализация данных**: Интерактивные табличные представления с сортировкой и комплексными профилями участников

## Архитектура

### Поток данных
```
Unik → Пространства → Холсты → Аналитика квизов → Данные лидов
```

### Основные компоненты

- **Analytics.jsx**: Главный компонент панели управления с карточками метрик и таблицей участников
- **Селекторы пространств/холстов**: Иерархическая навигация для выбора квиза
- **Карточки метрик**: Визуальное отображение KPI с использованием Material-UI Cards и иконок Tabler
- **Таблица лидов**: Детальные данные участников с поиском и возможностями фильтрации

### Точки интеграции

- **@flowise/template-mui**: UI компоненты (MainCard, ViewHeader, хук useApi)
- **@universo/api-client**: Современный API клиент для данных пространств/холстов
- **@flowise/store**: Интеграция Redux для глобального управления состоянием
- **Legacy leadsApi**: Прямое получение данных лидов (планируется миграция)

## Структура

```
src/
├── pages/
│   ├── Analytics.jsx          # Главный компонент панели аналитики
│   └── __tests__/
│       └── Analytics.test.tsx # Комплексные тесты компонента
├── i18n/                      # Модуль интернационализации
│   ├── index.ts              # Экспорты переводов и утилиты
│   └── locales/
│       ├── en/main.json      # Английские переводы
│       └── ru/main.json      # Русские переводы
└── index.ts                   # Точка входа пакета
```

## Интеграция с API

### Современные API клиенты
```typescript
// Данные пространств (через @universo/api-client)
const spacesApi = api.spaces
const spaces = await spacesApi.getSpaces(unikId)
const canvases = await spacesApi.getCanvases(unikId, spaceId)

// Данные лидов (устаревший API - запланирована миграция)
const leads = await leadsApi.getCanvasLeads(canvasId)
```

### Обработка данных
```typescript
// Вычисление аналитики с обратной совместимостью
const resolveLeadPoints = (lead) => {
  if (typeof lead?.points === 'number') return lead.points
  if (lead?.phone) {
    const pts = parseInt(lead.phone, 10)
    if (!isNaN(pts)) return pts
  }
  return 0
}

const calculateAnalytics = (leadsData) => ({
  totalLeads: leadsData.length,
  averagePoints: Math.round((totalPoints / validLeads.length) * 100) / 100,
  maxPoints: Math.max(...points),
  totalPoints: points.reduce((a, b) => a + b, 0)
})
```

## Использование компонента

### В основном приложении
```jsx
// Конфигурация маршрута (flowise-template-mui)
const Analytics = Loadable(lazy(() => import('@universo/analytics-frt/pages/Analytics')))

// Регистрация i18n (flowise-ui)
import '@universo/analytics-frt/i18n'
```

### Автономный импорт
```typescript
import { AnalyticsPage } from '@universo/analytics-frt'

// С утилитами переводов
import { analyticsTranslations, getAnalyticsTranslations } from '@universo/analytics-frt/i18n'
```

## Разработка

### Предварительные требования
- Node.js 18+
- Среда PNPM workspace
- Доступ к API платформы Universo

### Команды
```bash
# Установка зависимостей (из корня проекта)
pnpm install

# Сборка пакета
pnpm --filter @universo/analytics-frt build

# Режим разработки с горячей перезагрузкой
pnpm --filter @universo/analytics-frt dev

# Запуск тестов
pnpm --filter @universo/analytics-frt test

# Проверка кода
pnpm --filter @universo/analytics-frt lint
```

### Стратегия тестирования

Пакет включает комплексные тесты, покрывающие:
- **Интеграцию API**: Мокированные ответы для данных пространств, холстов и лидов
- **Вычисление метрик**: Обратная совместимость с сопоставлением полей points/phone
- **Рендеринг компонентов**: Полный рендеринг панели управления с реальными сценариями данных
- **Взаимодействия пользователя**: Выбор пространства/холста и рабочие процессы фильтрации данных

### Заметки по разработке

- **Миграция устаревшего API**: Данные лидов все еще используют устаревший `leadsApi` - планируется миграция на `@universo/api-client`
- **Обработка ошибок**: Комплексные границы ошибок и состояния загрузки для устойчивости в продакшене
- **Производительность**: Эффективное управление состоянием с паттерном хука useApi предотвращает ненужные повторные рендеры
- **Доступность**: Полные ARIA метки и семантическая HTML структура для программ чтения с экрана

## Интернационализация

### Структура переводов
```json
{
  "analytics": {
    "title": "Аналитика квизов",
    "metrics": {
      "totalParticipants": "Всего участников",
      "averageScore": "Средний балл"
    },
    "table": {
      "name": "Имя",
      "email": "Email",
      "points": "Баллы"
    }
  }
}
```

### Использование в компонентах
```jsx
const { t } = useTranslation(['analytics'])

return (
  <Typography variant="h4">
    {t('title')} {/* Рендерит: "Аналитика квизов" */}
  </Typography>
)
```

## Модели данных

### Структура данных лида
```typescript
interface Lead {
  name?: string
  email?: string
  phone?: string
  points?: number          // Предпочтительное поле
  createdDate: string
  canvasId?: string
  canvasid?: string       // Устаревшее поле
}
```

### Метрики аналитики
```typescript
interface AnalyticsMetrics {
  totalLeads: number
  averagePoints: number
  maxPoints: number
  totalPoints: number
}
```

## Связанная документация

- [Архитектура платформы Universo](../../../docs/ru/universo-platformo/README.md)
- [Компоненты Flowise Template MUI](../../flowise-template-mui/base/README.md)
- [Интеграция API клиента](../../universo-api-client/README.md)
- [Пакет фронтенда пространств](../../spaces-frt/base/README.md)

---

**Universo Platformo | Пакет фронтенда аналитики**
