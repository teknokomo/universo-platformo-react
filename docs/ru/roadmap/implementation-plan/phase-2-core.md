# Фаза 2: Базовые системы (v0.25.0-beta)

## Краткое описание

Вторая фаза реализации дорожной карты Universo Platformo, направленная на создание социальных и технических систем, включая корпорации, расширенную авторизацию и мультиплеер в реальном времени.

## Содержание

-   [Цели и задачи](#цели-и-задачи)
-   [Приоритетные приложения](#приоритетные-приложения)
-   [Технические требования](#технические-требования)
-   [План разработки](#план-разработки)
-   [Критерии готовности](#критерии-готовности)

## Цели и задачи

### Основная цель

Создать полнофункциональную социальную и техническую инфраструктуру для поддержки сложных многопользовательских взаимодействий в Universo MMOOMM.

### Ключевые задачи

1. **Реализация системы корпораций** с иерархией ролей и управлением активами
2. **Создание расширенной авторизации** с интеграцией игровых и платформенных аккаунтов
3. **Внедрение мультиплеера** с синхронизацией в реальном времени
4. **Обеспечение безопасности** и защиты от читов
5. **Масштабирование до 5000+ игроков** одновременно

### Бизнес-ценность

-   **Социальное взаимодействие**: Создание основы для корпоративных отношений
-   **Техническая надежность**: Обеспечение стабильной работы при высокой нагрузке
-   **Безопасность**: Защита от мошенничества и читов
-   **Готовность к Beta**: Подготовка к публичному тестированию

## Приоритетные приложения

### 1. Corporations System (corporations-frontend/srv)

**Приоритет**: Критический
**Время разработки**: 6 недель
**Команда**: 3 разработчика (1 frontend, 1 backend, 1 DevOps)

#### Функциональные требования

**Frontend (corporations-frontend)**:

-   Интерфейс создания и управления корпорациями
-   Система ролей и прав доступа
-   Управление корпоративными активами
-   Дипломатический интерфейс

**Backend (corporations-backend)**:

-   API управления корпорациями
-   Система иерархии ролей
-   Управление корпоративными финансами
-   Система логов корпоративных действий

#### Структура корпорации

```typescript
interface Corporation {
    id: string
    name: string
    ticker: string // короткое название (3-5 символов)
    description: string
    foundedDate: Date
    headquarters: {
        worldId: string
        stationId?: string
    }
    members: CorporationMember[]
    assets: CorporationAssets
    diplomacy: DiplomaticRelations
    settings: CorporationSettings
}

interface CorporationMember {
    playerId: string
    joinDate: Date
    roles: string[]
    title?: string
    lastActive: Date
    contributionScore: number
}

interface CorporationRole {
    id: string
    name: string
    permissions: {
        // Управление членами
        canInviteMembers: boolean
        canKickMembers: boolean
        canPromoteMembers: boolean

        // Финансы
        canAccessWallet: boolean
        canWithdrawFunds: boolean
        canSetTaxes: boolean

        // Активы
        canAccessHangars: boolean
        canMoveAssets: boolean
        canSellAssets: boolean

        // Дипломатия
        canDeclareWar: boolean
        canMakeAlliances: boolean
        canSetStandings: boolean

        // Администрирование
        canEditDescription: boolean
        canManageRoles: boolean
        canDisbandCorp: boolean
    }
}
```

#### Модель активов корпорации

```typescript
interface CorporationAssets {
    inmoBalance: number
    ships: CorporationShip[]
    stations: CorporationStation[]
    resources: ResourceInventory
    contracts: CorporationContract[]
}
```

#### Спецификация API

```typescript
// POST /api/v1/corporations
interface CreateCorporationRequest {
    name: string
    ticker: string
    description: string
    headquarters: {
        worldId: string
        stationId?: string
    }
}

// POST /api/v1/corporations/:corpId/members
interface InviteMemberRequest {
    playerId: string
    message?: string
    initialRoles?: string[]
}

// PUT /api/v1/corporations/:corpId/members/:playerId/roles
interface UpdateMemberRolesRequest {
    roles: string[]
    reason?: string
}
```

### 2. Enhanced Authentication (auth-enhanced-frontend/srv)

**Приоритет**: Высокий
**Время разработки**: 4 недели
**Команда**: 2 разработчика (1 backend, 1 security specialist)

#### Функциональные требования

**Frontend (auth-enhanced-frontend)**:

-   Единый интерфейс входа (SSO)
-   Управление игровыми аккаунтами
-   Настройки безопасности
-   Двухфакторная аутентификация

**Backend (auth-enhanced-backend)**:

-   Интеграция с Supabase Auth
-   Управление игровыми сессиями
-   Система ролей и разрешений
-   Аудит безопасности

#### Архитектура авторизации

```typescript
interface UniversoUser {
    // Платформенный аккаунт
    platformAccount: {
        id: string
        email: string
        emailVerified: boolean
        role: 'user' | 'developer' | 'moderator' | 'admin'
        createdAt: Date
        lastLogin: Date
    }

    // Игровые аккаунты
    gameAccounts: {
        [worldId: string]: {
            playerId: string
            characterName: string
            corporationId?: string
            securityStatus: number // -10.0 to +5.0
            skillPoints: number
            reputation: PlayerReputation
            createdAt: Date
            lastActive: Date
        }
    }

    // Верификация
    verification: {
        emailVerified: boolean
        phoneVerified: boolean
        identityVerified: boolean // для лидеров корпораций
        twoFactorEnabled: boolean
    }

    // Настройки безопасности
    security: {
        loginHistory: LoginRecord[]
        suspiciousActivity: SecurityAlert[]
        ipWhitelist?: string[]
        sessionTimeout: number
    }
}

interface PlayerReputation {
    [factionId: string]: {
        standing: number // -10.0 to +10.0
        lastUpdate: Date
    }
}

interface LoginRecord {
    timestamp: Date
    ipAddress: string
    userAgent: string
    location?: string
    success: boolean
    failureReason?: string
}
```

### 3. Multiplayer System (multiplayer-colyseus-backend)

**Приоритет**: Критический
**Статус**: ✅ **ЗАВЕРШЕНО** - Полный мультиплеерный сервер на базе Colyseus реализован
**Время разработки**: 8 недель (завершено)
**Команда**: 4 разработчика (2 backend, 1 frontend, 1 DevOps)

#### Функциональные требования

**Frontend (multiplayer-frontend)**:

-   Интерфейс списка игроков онлайн
-   Система чата и коммуникаций
-   Отображение активности других игроков
-   Уведомления о событиях

**Backend (multiplayer-backend)**:

-   WebSocket сервер для real-time коммуникации
-   Система синхронизации позиций
-   Обработка игровых событий
-   Система инстансов и зон

#### Архитектура мультиплеера

```typescript
interface MultiplayerState {
    worldId: string
    instanceId: string
    players: {
        [playerId: string]: PlayerState
    }
    entities: {
        ships: ShipState[]
        asteroids: AsteroidState[]
        stations: StationState[]
        npcs: NPCState[]
    }
    events: GameEvent[]
    lastUpdate: number
}

interface PlayerState {
    playerId: string
    characterName: string
    position: Vector3
    rotation: Quaternion
    velocity: Vector3
    currentShip: {
        shipId: string
        shipType: string
        health: number
        energy: number
        status: 'idle' | 'mining' | 'trading' | 'combat' | 'traveling'
    }
    corporationId?: string
    securityStatus: number
    lastUpdate: number
}

interface GameEvent {
    id: string
    type: 'player_joined' | 'player_left' | 'ship_destroyed' | 'resource_mined' | 'trade_completed'
    timestamp: number
    data: any
    affectedPlayers: string[]
    worldId: string
    instanceId: string
}
```

#### Real-time Communication

```typescript
interface WebSocketMessage {
    type: 'position_update' | 'game_event' | 'chat_message' | 'system_notification'
    timestamp: number
    senderId?: string
    data: any
}

interface PositionUpdate {
    playerId: string
    position: Vector3
    rotation: Quaternion
    velocity: Vector3
    timestamp: number
}

interface ChatMessage {
    id: string
    senderId: string
    senderName: string
    channel: 'local' | 'corporation' | 'alliance' | 'private'
    message: string
    timestamp: number
    recipients?: string[]
}
```

## Технические требования

### Архитектурные принципы

1. **Event-driven Architecture**: Асинхронная коммуникация через события
2. **Horizontal Scaling**: Возможность горизонтального масштабирования
3. **Fault Tolerance**: Устойчивость к отказам компонентов
4. **Security First**: Безопасность как приоритет архитектуры

### Технологический стек

-   **Real-time**: Supabase Realtime + WebSocket
-   **Caching**: Redis для сессий и кэширования
-   **Message Queue**: Redis Pub/Sub для событий
-   **Monitoring**: Prometheus + Grafana
-   **Logging**: Winston + ELK Stack

### Производительность

```typescript
interface PerformanceTargets {
    concurrentUsers: 5000 // одновременных игроков
    responseTime: {
        api: 100 // ms для 95% запросов
        websocket: 25 // ms латентность
        database: 50 // ms для запросов
    }
    throughput: {
        apiRequests: 10000 // RPS
        websocketMessages: 50000 // сообщений/сек
        gameEvents: 100000 // событий/сек
    }
    availability: 99.9 // % uptime
}
```

## План разработки

### Неделя 1-3: Corporations System - Основа

**Задачи**:

-   Создание архитектуры corporations-frontend/srv
-   Реализация базового API корпораций
-   Система ролей и разрешений
-   Интерфейс создания корпораций

**Deliverables**:

-   API создания и управления корпорациями
-   Система ролей
-   Базовый интерфейс корпораций

### Неделя 4-6: Corporations System - Расширенные функции

**Задачи**:

-   Корпоративные активы и финансы
-   Дипломатическая система
-   Система логов и аудита
-   Интеграция с существующими системами

**Deliverables**:

-   Полнофункциональная система корпораций
-   Дипломатический интерфейс
-   Система управления активами

### Неделя 7-10: Enhanced Authentication

**Задачи**:

-   Интеграция с Supabase Auth
-   Система игровых аккаунтов
-   Двухфакторная аутентификация
-   Аудит безопасности

**Deliverables**:

-   Единая система авторизации
-   Интеграция игровых и платформенных аккаунтов
-   Система безопасности

### Неделя 11-18: Multiplayer System

**Задачи**:

-   WebSocket сервер
-   Система синхронизации
-   Обработка игровых событий
-   Система чата

**Deliverables**:

-   Real-time мультиплеер
-   Система коммуникаций
-   Синхронизация игрового состояния

### Неделя 19-20: Интеграция и тестирование

**Задачи**:

-   Интеграция всех систем
-   Нагрузочное тестирование
-   Оптимизация производительности
-   Подготовка к Beta релизу

**Deliverables**:

-   Полностью интегрированная система
-   Результаты нагрузочных тестов
-   Beta-ready версия

## Критерии готовности

### Функциональные критерии

-   [ ] **Корпорации**: Полнофункциональная система с ролями и активами
-   [ ] **Авторизация**: Единый вход и управление аккаунтами
-   [ ] **Мультиплеер**: Стабильная синхронизация 1000+ игроков
-   [ ] **Безопасность**: Защита от основных типов атак
-   [ ] **Производительность**: Соответствие целевым показателям

### Технические критерии

-   [ ] **Scalability**: Горизонтальное масштабирование сервисов
-   [ ] **Monitoring**: Полный мониторинг всех компонентов
-   [ ] **Testing**: 90%+ покрытие тестами критических функций
-   [ ] **Documentation**: Полная техническая документация
-   [ ] **Security**: Прохождение security audit

### Пользовательские критерии

-   [ ] **UX**: Интуитивные интерфейсы для всех функций
-   [ ] **Performance**: Отзывчивые интерфейсы без задержек
-   [ ] **Reliability**: Стабильная работа без критических сбоев
-   [ ] **Communication**: Эффективная система коммуникаций

## Связанные страницы

-   [Фаза 1: MVP](phase-1-mvp.md)
-   [Фаза 3: Продвинутые функции](phase-3-advanced.md)
-   [План реализации](README.md)
-   [Технические спецификации](../technical-specifications/README.md)

## Статус выполнения

-   [x] Планирование архитектуры
-   [x] Определение требований
-   [x] Начало разработки (создан базовый пакет типов)
-   [ ] Реализация корпораций
-   [ ] Реализация авторизации
-   [ ] Реализация мультиплеера

---

_Последнее обновление: 5 августа 2025_
