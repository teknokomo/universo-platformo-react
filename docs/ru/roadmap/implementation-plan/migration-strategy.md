# Стратегия миграции

## Краткое описание

Комплексная стратегия миграции от текущей монолитной архитектуры Universo Platformo (6 приложений на базе Flowise) к целевой микросервисной архитектуре (20+ независимых сервисов).

## Содержание

- [Принципы миграции](#принципы-миграции)
- [Этапы миграции](#этапы-миграции)
- [Граф зависимостей](#граф-зависимостей)
- [Стратегия данных](#стратегия-данных)
- [Управление рисками](#управление-рисками)

## Принципы миграции

### Основные принципы

1. **Постепенная миграция**: Поэтапное извлечение сервисов без остановки работы
2. **Обратная совместимость**: Поддержка старых API во время переходного периода
3. **Rollback готовность**: Возможность отката на любом этапе
4. **Zero downtime**: Миграция без простоя сервиса
5. **Data integrity**: Сохранение целостности данных

### Стратегические подходы

#### Strangler Fig Pattern
```typescript
interface StranglerFigMigration {
    phase: 'preparation' | 'parallel_run' | 'cutover' | 'cleanup';
    oldService: {
        name: string;
        status: 'active' | 'deprecated' | 'retired';
        trafficPercentage: number;
    };
    newService: {
        name: string;
        status: 'development' | 'testing' | 'production';
        trafficPercentage: number;
    };
    migrationRules: {
        routingRules: RoutingRule[];
        dataSync: DataSyncRule[];
        rollbackTriggers: RollbackTrigger[];
    };
}
```

#### Database per Service
```typescript
interface DatabaseMigration {
    sourceSchema: string;
    targetSchemas: {
        [serviceName: string]: {
            schema: string;
            tables: string[];
            migrationScript: string;
        };
    };
    sharedData: {
        tables: string[];
        accessPattern: 'read_only' | 'event_sourcing' | 'api_gateway';
    };
}
```

## Этапы миграции

### Этап 1: Подготовка инфраструктуры (4 недели)

#### Цели
- Настройка CI/CD для микросервисов
- Создание мониторинга и логирования
- Подготовка контейнеризации

#### Задачи

**Неделя 1-2: DevOps инфраструктура**
```yaml
infrastructure_setup:
  containerization:
    - docker_setup
    - docker_compose_development
    - kubernetes_cluster_preparation
  
  ci_cd:
    - github_actions_workflows
    - automated_testing_pipeline
    - deployment_automation
  
  monitoring:
    - prometheus_setup
    - grafana_dashboards
    - alertmanager_configuration
```

**Неделя 3-4: Сервисная инфраструктура**
```yaml
service_infrastructure:
  api_gateway:
    - nginx_or_traefik_setup
    - rate_limiting
    - authentication_middleware
  
  service_discovery:
    - consul_or_kubernetes_dns
    - health_checks
    - load_balancing
  
  data_infrastructure:
    - database_per_service_setup
    - redis_cluster
    - message_queue_setup
```

### Этап 2: Извлечение простых сервисов (6 недель)

#### Приоритет извлечения (по сложности)

1. **analytics-frontend** → `analytics-enhanced-backend` (Неделя 1-2)
2. **profile-backend** → `profile-backend` микросервис (Неделя 3-4)
3. **profile-frontend** → обновление для работы с новым API (Неделя 5-6)

#### Пример миграции: Analytics Service

```typescript
// Этап 1: Создание нового сервиса
interface AnalyticsServiceMigration {
    step1_create_service: {
        repository: 'analytics-enhanced-backend';
        database: 'analytics_db';
        api_endpoints: [
            'GET /api/v1/analytics/events',
            'POST /api/v1/analytics/events',
            'GET /api/v1/analytics/reports'
        ];
    };
    
    step2_data_migration: {
        source_tables: ['analytics_events', 'user_interactions'];
        migration_script: 'migrate_analytics_data.sql';
        validation_queries: string[];
    };
    
    step3_traffic_routing: {
        initial_percentage: 10;
        increment_schedule: '10% каждые 2 дня';
        rollback_triggers: ['error_rate > 5%', 'latency > 500ms'];
    };
}
```

### Этап 3: Извлечение сложных сервисов (8 недель)

#### Порядок извлечения

1. **publish-backend** → `template-engine-backend` + `publish-backend` (Неделя 1-4)
2. **publish-frontend** → обновление для новых API (Неделя 5-6)
3. **Flowise core** → `workflow-engine-backend` + `node-registry-backend` (Неделя 7-8)

#### Пример миграции: Template Engine

```typescript
interface TemplateEngineMigration {
    complexity: 'high';
    dependencies: ['node-registry-backend', 'file-storage'];
    
    migration_phases: {
        phase1_extract_templates: {
            duration: '2 weeks';
            tasks: [
                'extract_template_definitions',
                'create_template_api',
                'migrate_template_storage'
            ];
        };
        
        phase2_extract_engine: {
            duration: '2 weeks';
            tasks: [
                'extract_compilation_logic',
                'create_generation_api',
                'integrate_with_templates'
            ];
        };
    };
    
    rollback_strategy: {
        checkpoints: ['after_phase1', 'after_phase2'];
        rollback_time: '< 30 minutes';
        data_backup: 'automated_daily';
    };
}
```

### Этап 4: Извлечение UPDL системы (10 недель)

#### Самый сложный компонент

```typescript
interface UPDLSystemMigration {
    complexity: 'critical';
    business_impact: 'high';
    
    decomposition: {
        node_registry_srv: {
            responsibility: 'Управление определениями узлов';
            duration: '3 weeks';
            dependencies: [];
        };
        
        workflow_engine_srv: {
            responsibility: 'Выполнение Chatflow';
            duration: '4 weeks';
            dependencies: ['node-registry-backend'];
        };
        
        updl_frontend: {
            responsibility: 'Визуальный редактор';
            duration: '3 weeks';
            dependencies: ['node-registry-backend', 'workflow-engine-backend'];
        };
    };
    
    migration_strategy: {
        approach: 'big_bang_with_fallback';
        reason: 'Слишком тесная связанность компонентов';
        fallback_plan: 'Полный откат к монолиту за 1 час';
    };
}
```

## Граф зависимостей

### Зависимости между приложениями

```mermaid
graph TD
    A[analytics-frontend] --> B[packages/flowise-components]
    C[profile-frontend] --> B
    C --> D[profile-backend]
    E[publish-frontend] --> B
    E --> F[publish-backend]
    F --> G[packages/flowise-core-backend/base]
    D --> G
    H[updl] --> B
    H --> I[packages/flowise-core-frontend/base]
    
    subgraph "Новые сервисы"
        J[analytics-enhanced-backend]
        K[profile-backend-new]
        L[template-engine-backend]
        M[workflow-engine-backend]
        N[node-registry-backend]
    end
    
    A -.-> J
    D -.-> K
    F -.-> L
    H -.-> M
    H -.-> N
```

### Порядок миграции по зависимостям

```typescript
interface MigrationOrder {
    wave1_independent: {
        services: ['analytics-enhanced-backend'];
        duration: '2 weeks';
        risk: 'low';
    };
    
    wave2_simple_dependencies: {
        services: ['profile-backend'];
        duration: '2 weeks';
        risk: 'low';
        depends_on: [];
    };
    
    wave3_moderate_dependencies: {
        services: ['template-engine-backend', 'publish-backend'];
        duration: '4 weeks';
        risk: 'medium';
        depends_on: ['profile-backend'];
    };
    
    wave4_complex_dependencies: {
        services: ['node-registry-backend', 'workflow-engine-backend'];
        duration: '6 weeks';
        risk: 'high';
        depends_on: ['template-engine-backend'];
    };
}
```

## Стратегия данных

### Текущая схема базы данных

```sql
-- Монолитная база данных
CREATE SCHEMA public;

-- Пользователи (используется всеми сервисами)
CREATE TABLE profiles (
    id UUID PRIMARY KEY,
    email VARCHAR(255),
    display_name VARCHAR(100),
    -- используется: profile-backend, analytics-frontend, updl
);

-- UPDL потоки (используется updl, publish-backend)
CREATE TABLE updl_flows (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    flow_data JSONB,
    -- используется: updl, publish-backend
);

-- Опубликованные приложения (используется publish-backend, analytics-frontend)
CREATE TABLE published_apps (
    id UUID PRIMARY KEY,
    flow_id UUID REFERENCES updl_flows(id),
    -- используется: publish-backend, analytics-frontend
);
```

### Целевая схема микросервисов

```sql
-- Схема для каждого сервиса
CREATE SCHEMA profiles_service;
CREATE TABLE profiles_service.users (
    id UUID PRIMARY KEY,
    email VARCHAR(255),
    display_name VARCHAR(100)
);

CREATE SCHEMA analytics_service;
CREATE TABLE analytics_service.events (
    id UUID PRIMARY KEY,
    user_id UUID, -- ссылка через API
    event_data JSONB
);

CREATE SCHEMA workflow_service;
CREATE TABLE workflow_service.flows (
    id UUID PRIMARY KEY,
    owner_id UUID, -- ссылка через API
    flow_definition JSONB
);
```

### Стратегия миграции данных

```typescript
interface DataMigrationStrategy {
    approach: 'event_sourcing' | 'dual_write' | 'bulk_migration';
    
    event_sourcing: {
        description: 'Все изменения через события';
        use_for: ['user_profiles', 'workflow_changes'];
        implementation: {
            event_store: 'supabase_realtime';
            replay_capability: true;
            snapshot_frequency: 'daily';
        };
    };
    
    dual_write: {
        description: 'Запись в старую и новую БД одновременно';
        use_for: ['analytics_events', 'published_apps'];
        duration: '2-4 weeks per service';
        validation: 'continuous_comparison';
    };
    
    bulk_migration: {
        description: 'Единовременная миграция';
        use_for: ['static_reference_data'];
        downtime: '< 1 hour';
        rollback_time: '< 15 minutes';
    };
}
```

## Управление рисками

### Идентифицированные риски

#### Высокие риски

1. **Потеря данных при миграции**
   - Вероятность: Средняя
   - Воздействие: Критическое
   - Митигация: Автоматические бэкапы, тестирование миграции

2. **Нарушение работы UPDL системы**
   - Вероятность: Высокая
   - Воздействие: Критическое
   - Митигация: Поэтапная миграция, fallback план

3. **Производительность новых сервисов**
   - Вероятность: Средняя
   - Воздействие: Высокое
   - Митигация: Нагрузочное тестирование, мониторинг

#### Средние риски

1. **Сложность интеграции**
   - Митигация: API-first подход, контракты
2. **Увеличение операционной сложности**
   - Митигация: Автоматизация, мониторинг
3. **Временные затраты**
   - Митигация: Буферное время, приоритизация

### План управления рисками

```typescript
interface RiskManagementPlan {
    monitoring: {
        metrics: [
            'service_availability',
            'response_times',
            'error_rates',
            'data_consistency'
        ];
        alerts: {
            critical: 'immediate_notification';
            warning: 'daily_summary';
        };
    };
    
    rollback_procedures: {
        service_level: {
            trigger: 'error_rate > 5% for 5 minutes';
            action: 'route_traffic_to_old_service';
            time: '< 5 minutes';
        };
        
        system_level: {
            trigger: 'multiple_service_failures';
            action: 'full_rollback_to_monolith';
            time: '< 30 minutes';
        };
    };
    
    communication_plan: {
        stakeholders: ['development_team', 'operations', 'users'];
        channels: ['slack', 'email', 'status_page'];
        frequency: 'real_time_during_migration';
    };
}
```

### Критерии успеха миграции

```typescript
interface MigrationSuccessCriteria {
    technical: {
        zero_data_loss: true;
        performance_maintained: 'response_time < 200ms';
        availability: 'uptime > 99.9%';
        rollback_capability: 'tested_and_verified';
    };
    
    business: {
        feature_parity: 'all_existing_features_work';
        user_experience: 'no_degradation';
        development_velocity: 'maintained_or_improved';
    };
    
    operational: {
        monitoring_coverage: '100%';
        automated_deployment: 'fully_automated';
        documentation: 'complete_and_current';
    };
}
```

## Связанные страницы

- [План реализации](README.md)
- [Фаза 1: MVP](phase-1-mvp.md)
- [Текущая архитектура](../current-architecture/README.md)
- [Целевая архитектура](../target-architecture/README.md)

## Статус миграции

- [x] Стратегия миграции определена
- [x] Граф зависимостей создан
- [x] План управления рисками разработан
- [ ] Подготовка инфраструктуры
- [ ] Начало миграции

---
*Последнее обновление: 5 августа 2025*
