# Analytics Frontend (`@universo/analytics-frt`)

> **📋 Notice**: This documentation is being adapted for Universo Platformo.

## Overview

Frontend-only module for quiz analytics and engagement metrics. There is no backend package - it uses data from other modules.

## Technology Stack

- React 18 + TypeScript + Material-UI v5
- Chart.js / Recharts (visualization)
- React Query
- i18next (EN/RU)

## Main Components

- **AnalyticsDashboard**: Main analytics dashboard
- **QuizMetricsChart**: Quiz metrics charts
- **EngagementStats**: Engagement statistics
- **UserActivityTimeline**: Activity timeline

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

## Related Documentation

- [Analytics Overview](README.md)
- [Publish System](../publish/README.md) (data source)
