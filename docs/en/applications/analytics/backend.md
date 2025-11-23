# `packages/analytics-srv` — Analytics System Backend — [Status: Planned]

> **📋 Notice**: This documentation describes the planned backend component of the analytics system. The module is in the design stage.

## Purpose

Backend service for collecting, processing, and providing analytical data on quiz performance, user engagement, and interaction metrics.

## Role in Architecture

-   Aggregation and processing of data from `leads` and `quiz_results` tables
-   RESTful API for retrieving analytical metrics
-   Integration with Supabase database via TypeORM
-   Row-level security (RLS) for data isolation

## Key Features (Planned)

### Data Management

-   **Metrics Aggregation**: Real-time KPI and statistics calculation
-   **Event Store**: Storing user interaction events
-   **Historical Data**: Archiving and access to historical metrics
-   **Data Export**: API for exporting data in various formats

### API Endpoints

#### Get Quiz Metrics

```
GET /api/v1/analytics/quiz/:quizId/metrics
Query: {
  startDate: string,
  endDate: string,
  aggregation: 'day' | 'week' | 'month'
}

Response: {
  totalAttempts: number,
  completionRate: number,
  averageScore: number,
  timeSpent: number
}
```

#### Get User Metrics

```
GET /api/v1/analytics/user/:userId/metrics
Query: {
  startDate: string,
  endDate: string
}

Response: {
  quizzesCompleted: number,
  averageScore: number,
  totalTimeSpent: number,
  lastActivity: timestamp
}
```

#### Export Data

```
POST /api/v1/analytics/export
Body: {
  format: 'csv' | 'json' | 'xlsx',
  filters: {
    quizId?: string,
    userId?: string,
    dateRange: { start: string, end: string }
  }
}

Response: {
  downloadUrl: string,
  expiresAt: timestamp
}
```

## Integration

### Database

-   **TypeORM**: Type-safe database operations
-   **Supabase**: PostgreSQL database with RLS policies
-   **Migrations**: Schema management through TypeORM migrations

### External Services

-   **flowise-server**: Integration with main server
-   **auth-srv**: User authentication and authorization
-   **Cache**: Redis for caching aggregated data

## Security

-   **RLS Policies**: Users only see their own data
-   **JWT Tokens**: Token-based authentication
-   **Input Validation**: Protection against SQL injections
-   **Rate Limiting**: Protection against API abuse

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm --filter analytics-srv dev

# Build for production
pnpm --filter analytics-srv build
```

### Testing

```bash
# Run unit tests
pnpm --filter analytics-srv test

# Run integration tests
pnpm --filter analytics-srv test:integration

# Linting
pnpm --filter analytics-srv lint
```

## Roadmap

### Phase 1: Basic Functionality
- ⏳ Aggregation of core metrics (attempts, completions, scores)
- ⏳ RESTful API for reading metrics
- ⏳ Supabase integration

### Phase 2: Advanced Analytics
- ⏳ Cohort analysis
- ⏳ Conversion funnels
- ⏳ A/B testing

### Phase 3: Scaling
- ⏳ Redis caching
- ⏳ Query optimization
- ⏳ Large data volume support

## See Also

- [Analytics Frontend](./frontend.md) - Frontend component of analytics system
- [Analytics README](./README.md) - Analytics system overview
