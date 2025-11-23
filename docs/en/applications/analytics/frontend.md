# Analytics Frontend (`@universo/analytics-frt`)

> **📋 Notice**: This documentation is being adapted for Universo Platformo.

## Overview

Frontend-only  for   and metrics .  backend  -   from  .

## Technology Stack

- React 18 + TypeScript + Material-UI v5
- Chart.js / Recharts (visualization)
- React Query
- i18next (EN/RU)

## Main Components

- **AnalyticsDashboard**:   
- **QuizMetricsChart**:  metrics 
- **EngagementStats**:  
- **UserActivityTimeline**:   

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
