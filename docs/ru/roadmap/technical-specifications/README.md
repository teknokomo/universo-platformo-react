# Технические спецификации Universo Platformo

## Краткое описание

Комплексные технические требования и спецификации для реализации целевой архитектуры Universo Platformo, включая дизайн базы данных, API спецификации, требования безопасности и целевые показатели производительности.

## Содержание

-   [Общие технические требования](#общие-технические-требования)
-   [Архитектура системы](#архитектура-системы)
-   [Спецификации производительности](#спецификации-производительности)
-   [Требования безопасности](#требования-безопасности)
-   [Стандарты разработки](#стандарты-разработки)

## Общие технические требования

### Технологический стек

#### Frontend

-   **Framework**: React 18+ с TypeScript 5.0+
-   **UI Library**: Material-UI v5 с кастомной темой Universo
-   **State Management**: Redux Toolkit + RTK Query
-   **Build Tool**: Vite 4+ с оптимизацией для production
-   **Testing**: Jest + React Testing Library + Cypress E2E
-   **Code Quality**: ESLint + Prettier + Husky pre-commit hooks

#### Backend

-   **Runtime**: Node.js 18+ LTS
-   **Framework**: Express.js 4.18+ с TypeScript
-   **API Documentation**: OpenAPI 3.0 + Swagger UI
-   **Validation**: Joi для валидации входных данных
-   **Testing**: Jest + Supertest для интеграционных тестов
-   **Process Manager**: PM2 для production deployment

#### Database & Storage

-   **Primary Database**: Supabase (PostgreSQL 15+)
-   **Caching**: Redis 7+ для сессий и кэширования
-   **File Storage**: Supabase Storage для ассетов
-   **Search**: PostgreSQL Full-Text Search + GIN индексы
-   **Backup**: Автоматические ежедневные бэкапы с 30-дневным хранением

#### DevOps & Infrastructure

-   **Package Manager**: PNPM 8+ workspaces
-   **Containerization**: Docker + Docker Compose
-   **CI/CD**: GitHub Actions с автоматическим тестированием
-   **Monitoring**: Prometheus + Grafana + AlertManager
-   **Logging**: Winston + ELK Stack (Elasticsearch, Logstash, Kibana)

### Системные требования

#### Минимальные требования сервера

-   **CPU**: 4 cores, 2.4 GHz
-   **RAM**: 8 GB
-   **Storage**: 100 GB SSD
-   **Network**: 1 Gbps
-   **OS**: Ubuntu 22.04 LTS или CentOS 8+

#### Рекомендуемые требования сервера

-   **CPU**: 8 cores, 3.0 GHz
-   **RAM**: 32 GB
-   **Storage**: 500 GB NVMe SSD
-   **Network**: 10 Gbps
-   **OS**: Ubuntu 22.04 LTS

#### Требования к клиенту

-   **Browser**: Chrome 100+, Firefox 100+, Safari 15+, Edge 100+
-   **JavaScript**: ES2022 поддержка
-   **WebGL**: 2.0 для PlayCanvas интеграции
-   **WebRTC**: Для real-time мультиплеера
-   **Local Storage**: 50 MB для кэширования

## Архитектура системы

### Микросервисная архитектура

#### Принципы проектирования

1. **Single Responsibility**: Каждый сервис отвечает за одну бизнес-область
2. **Database per Service**: Изолированные схемы данных
3. **API First**: Все взаимодействия через REST API
4. **Stateless**: Сервисы не хранят состояние между запросами
5. **Fault Tolerance**: Graceful degradation при отказах

#### Паттерны взаимодействия

**Синхронное взаимодействие (REST API)**:

```typescript
interface APIResponse<T> {
    success: boolean
    data?: T
    error?: {
        code: string
        message: string
        details?: any
    }
    metadata: {
        requestId: string
        timestamp: number
        version: string
        service: string
    }
}

interface PaginatedResponse<T> extends APIResponse<T[]> {
    pagination: {
        page: number
        limit: number
        total: number
        hasNext: boolean
        hasPrev: boolean
    }
}
```

**Асинхронное взаимодействие (Event Bus)**:

```typescript
interface DomainEvent {
    id: string
    type: string
    aggregateId: string
    aggregateType: string
    version: number
    timestamp: number
    data: any
    metadata: {
        correlationId: string
        causationId?: string
        userId?: string
        source: string
    }
}

interface EventHandler {
    eventType: string
    handler: (event: DomainEvent) => Promise<void>
    retryPolicy: {
        maxRetries: number
        backoffMs: number
        exponentialBackoff: boolean
    }
}
```

### API Gateway спецификации

#### Маршрутизация

```yaml
api_gateway:
    version: '1.0'
    base_url: 'https://api.universo-platformo.com'

    routes:
        - path: '/api/v1/auth/*'
          service: 'auth-enhanced-srv'
          timeout: 5000
          rate_limit: '100/minute'
          auth_required: false

        - path: '/api/v1/resources/*'
          service: 'resources-srv'
          timeout: 3000
          rate_limit: '200/minute'
          auth_required: true

        - path: '/api/v1/ships/*'
          service: 'ships-srv'
          timeout: 3000
          rate_limit: '150/minute'
          auth_required: true

        - path: '/api/v1/economy/*'
          service: 'economy-srv'
          timeout: 5000
          rate_limit: '100/minute'
          auth_required: true

        - path: '/api/v1/corporations/*'
          service: 'corporations-srv'
          timeout: 3000
          rate_limit: '50/minute'
          auth_required: true

    middleware:
        - cors
        - helmet
        - rate_limiter
        - request_logger
        - auth_validator
        - request_id_generator
```

#### Аутентификация и авторизация

```typescript
interface JWTPayload {
    sub: string // User ID
    email: string
    role: 'user' | 'developer' | 'admin'
    permissions: string[]
    gameAccounts: {
        [worldId: string]: {
            playerId: string
            corporationId?: string
            roles: string[]
        }
    }
    iat: number
    exp: number
    iss: string
}

interface AuthMiddleware {
    validateToken(token: string): Promise<JWTPayload>
    checkPermission(permission: string, context?: any): boolean
    refreshToken(refreshToken: string): Promise<string>
}
```

## Спецификации производительности

### Целевые показатели

#### API Performance

-   **Response Time**:
    -   95% запросов < 100ms
    -   99% запросов < 200ms
    -   99.9% запросов < 500ms
-   **Throughput**:
    -   5000+ RPS на сервис
    -   50000+ RPS через API Gateway
-   **Availability**: 99.95% uptime (4.38 часов простоя в год)

#### Database Performance

-   **Query Response Time**:
    -   Simple queries < 10ms
    -   Complex queries < 100ms
    -   Aggregation queries < 500ms
-   **Connection Pool**:
    -   Min: 10 connections
    -   Max: 100 connections
    -   Idle timeout: 30 seconds

#### Real-time Performance

-   **WebSocket Latency**: < 25ms для игровых событий
-   **Event Processing**: < 50ms от публикации до доставки
-   **Concurrent Users**: 10,000+ одновременных игроков на мир
-   **Large Battles**: Поддержка сражений с 1000+ кораблей
-   **Economic Operations**: 100,000+ торговых операций в час

### Мониторинг и метрики

#### Application Metrics

```typescript
interface ApplicationMetrics {
    http: {
        requests_total: Counter
        request_duration_seconds: Histogram
        requests_in_flight: Gauge
    }
    database: {
        connections_active: Gauge
        query_duration_seconds: Histogram
        queries_total: Counter
    }
    business: {
        active_players: Gauge
        trades_completed: Counter
        resources_mined: Counter
        corporations_created: Counter
    }
}
```

#### Health Checks

```typescript
interface HealthCheck {
    service: string
    status: 'healthy' | 'degraded' | 'unhealthy'
    timestamp: number
    checks: {
        database: HealthStatus
        redis: HealthStatus
        external_apis: HealthStatus
        disk_space: HealthStatus
        memory_usage: HealthStatus
    }
}

interface HealthStatus {
    status: 'pass' | 'warn' | 'fail'
    message?: string
    details?: any
}
```

## Требования безопасности

### Аутентификация и авторизация

#### Multi-factor Authentication (MFA)

-   **Обязательно для**: Администраторов, лидеров корпораций
-   **Опционально для**: Обычных пользователей
-   **Методы**: TOTP (Google Authenticator), SMS, Email

#### Role-Based Access Control (RBAC)

```typescript
interface Permission {
    resource: string
    action: 'create' | 'read' | 'update' | 'delete'
    conditions?: {
        ownership?: boolean
        corporationMembership?: boolean
        worldAccess?: string[]
    }
}

interface Role {
    name: string
    permissions: Permission[]
    inherits?: string[] // Наследование от других ролей
}

// Примеры ролей
const roles: Role[] = [
    {
        name: 'player',
        permissions: [
            { resource: 'ships', action: 'read', conditions: { ownership: true } },
            { resource: 'resources', action: 'update', conditions: { ownership: true } }
        ]
    },
    {
        name: 'corporation_leader',
        inherits: ['player'],
        permissions: [
            { resource: 'corporation', action: 'update', conditions: { corporationMembership: true } },
            { resource: 'corporation_members', action: 'create' }
        ]
    }
]
```

### Защита данных

#### Шифрование

-   **В покое**: AES-256 для чувствительных данных
-   **В передаче**: TLS 1.3 для всех соединений
-   **Ключи**: Ротация каждые 90 дней
-   **Пароли**: bcrypt с cost factor 12

#### Валидация и санитизация

```typescript
interface ValidationSchema {
    [field: string]: {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array'
        required?: boolean
        min?: number
        max?: number
        pattern?: RegExp
        sanitize?: boolean
        custom?: (value: any) => boolean
    }
}

// Пример схемы валидации
const createShipSchema: ValidationSchema = {
    name: {
        type: 'string',
        required: true,
        min: 3,
        max: 50,
        pattern: /^[a-zA-Z0-9\s-_]+$/,
        sanitize: true
    },
    shipType: {
        type: 'string',
        required: true,
        custom: (value) => ['miner', 'trader', 'explorer', 'fighter'].includes(value)
    }
}
```

### Защита от атак

#### Rate Limiting

```typescript
interface RateLimitConfig {
    windowMs: number // Временное окно в миллисекундах
    max: number // Максимальное количество запросов
    message: string // Сообщение при превышении лимита
    standardHeaders: boolean // Включить стандартные заголовки
    legacyHeaders: boolean // Включить legacy заголовки
}

const rateLimits = {
    auth: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 попыток входа за 15 минут
    api: { windowMs: 60 * 1000, max: 100 }, // 100 запросов в минуту
    trading: { windowMs: 60 * 1000, max: 10 }, // 10 торговых операций в минуту
    messaging: { windowMs: 60 * 1000, max: 20 } // 20 сообщений в минуту
}
```

#### Input Validation

-   **SQL Injection**: Параметризованные запросы, ORM
-   **XSS**: Санитизация HTML, CSP заголовки
-   **CSRF**: CSRF токены, SameSite cookies
-   **Path Traversal**: Валидация путей файлов

#### Audit Logging

```typescript
interface AuditLog {
    id: string
    timestamp: number
    userId?: string
    action: string
    resource: string
    resourceId?: string
    ipAddress: string
    userAgent: string
    success: boolean
    details?: any
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

// Примеры событий для аудита
const auditEvents = [
    'user.login',
    'user.logout',
    'user.password_change',
    'corporation.created',
    'corporation.member_added',
    'trade.completed',
    'ship.purchased',
    'admin.user_banned'
]
```

## Стандарты разработки

### Code Style и Quality

#### TypeScript Configuration

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "node",
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true,
        "noImplicitReturns": true,
        "noFallthroughCasesInSwitch": true,
        "noUncheckedIndexedAccess": true,
        "exactOptionalPropertyTypes": true
    }
}
```

#### ESLint Configuration

```json
{
    "extends": ["@typescript-eslint/recommended", "@typescript-eslint/recommended-requiring-type-checking", "prettier"],
    "rules": {
        "@typescript-eslint/no-unused-vars": "error",
        "@typescript-eslint/explicit-function-return-type": "warn",
        "@typescript-eslint/no-explicit-any": "warn",
        "prefer-const": "error",
        "no-var": "error"
    }
}
```

### Testing Standards

#### Unit Testing

-   **Coverage**: Минимум 80% для новых функций
-   **Framework**: Jest + Testing Library
-   **Mocking**: Минимальное использование моков
-   **Naming**: Описательные имена тестов

#### Integration Testing

-   **API Testing**: Supertest для REST API
-   **Database Testing**: Тестовая база данных
-   **E2E Testing**: Cypress для критических путей пользователя

#### Performance Testing

-   **Load Testing**: Artillery.js для нагрузочного тестирования
-   **Stress Testing**: Постепенное увеличение нагрузки до отказа
-   **Benchmark Testing**: Сравнение производительности версий

### Documentation Standards

#### API Documentation

-   **Format**: OpenAPI 3.0 спецификация
-   **Examples**: Примеры запросов и ответов
-   **Error Codes**: Документированные коды ошибок
-   **Versioning**: Семантическое версионирование API

#### Code Documentation

-   **JSDoc**: Для всех публичных функций и классов
-   **README**: Для каждого пакета/приложения
-   **Architecture Decision Records (ADR)**: Для важных архитектурных решений

## Связанные страницы

-   [UI/UX Спецификации](ui-ux-specifications.md)
-   [Приложения MMOOMM](../target-architecture/mmoomm-apps.md)
-   [План реализации](../implementation-plan/README.md)
-   [Текущая архитектура](../current-architecture/README.md)
-   [Целевая архитектура](../target-architecture/README.md)

## Статус спецификаций

-   [x] Определение технологического стека
-   [x] Архитектурные принципы
-   [x] Требования производительности
-   [x] Стандарты безопасности
-   [/] Детализация API спецификаций
-   [ ] Создание тестовых сценариев

---

_Последнее обновление: 5 августа 2025_
