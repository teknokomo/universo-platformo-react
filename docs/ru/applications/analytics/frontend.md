# Analytics Frontend (`@universo/analytics-frt`)

> **📋 Уведомление**: Данная документация адаптируется для Universo Platformo.

## Обзор

Frontend-only модуль для аналитики викторин и метрик вовлеченности. Нет backend пакета - использует данные из других модулей.

## Технологический стек

- React 18 + TypeScript + Material-UI v5
- Chart.js / Recharts (визуализация)
- React Query
- i18next (EN/RU)

## Основные компоненты

- **AnalyticsDashboard**: Главная панель аналитики
- **QuizMetricsChart**: Графики метрик викторин
- **EngagementStats**: Статистика вовлеченности
- **UserActivityTimeline**: Временная шкала активности

## Hooks

```typescript
const { metrics, isLoading } = useAnalytics({
  startDate,
  endDate,
  filters
});
```

## Metrics Types

```typescript
interface QuizMetrics {
  totalQuizzes: number;
  completionRate: number;
  averageScore: number;
  timeSpent: number;
}
```

## Связанная документация

- [Analytics Overview](README.md)
- [Publish System](../publish/README.md) (data source)
