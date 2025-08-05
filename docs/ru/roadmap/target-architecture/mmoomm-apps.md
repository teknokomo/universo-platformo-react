# Приложения Universo MMOOMM

## Краткое описание

Детальное описание специализированных приложений для реализации игровых механик Universo MMOOMM - космического MMO с экономической системой, основанной на добыче ресурсов, торговле между мирами и корпоративных взаимодействиях.

## Содержание

-   [Игровые механики](#игровые-механики)
-   [Социальные системы](#социальные-системы)
-   [Технические системы](#технические-системы)
-   [Интеграция с PlayCanvas](#интеграция-с-playcanvas)
-   [Архитектура данных](#архитектура-данных)

## Игровые механики

Приложения, реализующие основные игровые механики Universo MMOOMM:

-   **resources-frt/srv**: Система ресурсов с 16 типами материалов
-   **ships-frt/srv**: Управление кораблями и флотом
-   **economy-frt/srv**: Экономика с валютой Inmo
-   **mining-frt/srv**: Промышленный лазерный майнинг
-   **stations-frt/srv**: Космические станции и производство
-   **navigation-frt/srv**: Навигация между мирами
-   **security-frt/srv**: Система безопасности пространства
-   **combat-frt/srv**: PvP боевая система
-   **skills-frt/srv**: Система навыков и прогрессии
-   **sovereignty-frt/srv**: Территориальные войны и контроль систем
-   **industry-frt/srv**: Производство и промышленность
-   **wormhole-srv**: Системы червоточин

### Resources Management System

#### resources-frt

**Назначение**: Фронтенд управления ресурсами и инвентарем

**Ключевые функции**:

-   Отображение инвентаря с весом/объемом
-   Управление 16 типами материалов
-   Калькулятор плотности и массы
-   Интерфейс передачи ресурсов между кораблями/станциями

**Технические детали**:

```typescript
interface ResourceInventory {
    playerId: string
    location: {
        type: 'ship' | 'station' | 'storage'
        id: string
    }
    materials: MaterialStack[]
    totalMass: number
    totalVolume: number
    capacity: {
        maxMass: number
        maxVolume: number
    }
}

interface MaterialStack {
    materialType: MaterialType
    quantity: number
    mass: number
    volume: number
}
```

#### resources-srv

**Назначение**: Бэкенд системы ресурсов с реалистичной физикой

**Ключевые функции**:

-   API управления инвентарем
-   Расчеты плотности материалов
-   Валидация физических ограничений
-   Система логов перемещения ресурсов

**16 типов материалов**:

1. **Hydrogen** (0.09 кг/м³) - Топливо для двигателей
2. **Helium** (0.18 кг/м³) - Охлаждающий агент
3. **Carbon** (2267 кг/м³) - Конструкционный материал
4. **Oxygen** (1.43 кг/м³) - Системы жизнеобеспечения
5. **Silicon** (2329 кг/м³) - Электроника и процессоры
6. **Iron** (7874 кг/м³) - Основной конструкционный металл
7. **Nickel** (8908 кг/м³) - Сплавы и покрытия
8. **Copper** (8960 кг/м³) - Электропроводка
9. **Silver** (10490 кг/м³) - Высокотехнологичная электроника
10. **Gold** (19300 кг/м³) - Премиум компоненты
11. **Platinum** (21450 кг/м³) - Катализаторы и двигатели
12. **Uranium** (19050 кг/м³) - Ядерное топливо
13. **Titanium** (4506 кг/м³) - Легкие прочные конструкции
14. **Aluminum** (2700 кг/м³) - Легкие компоненты
15. **Lithium** (534 кг/м³) - Батареи и энергохранилища
16. **Rare Earth** (7000 кг/м³) - Специализированные технологии

### Economy System

#### economy-frt

**Назначение**: Фронтенд экономической системы

**Ключевые функции**:

-   Отображение курсов валют между мирами
-   Интерфейс обмена Inmo
-   Калькулятор прибыльности торговых маршрутов
-   История транзакций и аналитика

#### economy-srv

**Назначение**: Бэкенд валюты Inmo и экономических операций

**Ключевые функции**:

-   Управление балансами Inmo
-   Динамическое ценообразование
-   Межмировые переводы
-   Экономическая аналитика

**Экономические системы миров**:

```typescript
interface WorldEconomy {
    worldId: 'kubio' | 'konkordo' | 'triumfo'
    baseCurrency: 'inmo'
    exchangeRates: {
        [materialType: string]: number // Inmo за единицу материала
    }
    marketVolatility: number // Коэффициент волатильности цен
    tradeVolume: number // Объем торговли за период
}

// Kubio - Промышленный мир (высокий спрос на металлы)
// Konkordo - Технологический мир (высокий спрос на редкие элементы)
// Triumfo - Торговый мир (стабильные цены, низкие комиссии)
```

### Ships & Navigation System

#### ships-frt

**Назначение**: Фронтенд управления кораблями

**Ключевые функции**:

-   Интерфейс флота игрока
-   Конфигуратор кораблей
-   Система модификаций и улучшений
-   Мониторинг состояния и ремонта

#### ships-srv

**Назначение**: Бэкенд флота и кастомизации кораблей

**Ключевые функции**:

-   API управления кораблями
-   Система конфигураций и модулей
-   Расчеты производительности
-   Система повреждений и ремонта

**Типы кораблей**:

```typescript
interface ShipConfiguration {
    shipId: string
    shipType: 'miner' | 'trader' | 'explorer' | 'fighter'
    modules: {
        engine: EngineModule
        cargoHold: CargoModule
        miningLaser?: MiningModule
        shields?: ShieldModule
        weapons?: WeaponModule[]
    }
    performance: {
        speed: number
        cargoCapacity: number
        miningEfficiency?: number
        combatRating?: number
    }
}
```

#### navigation-frt / navigation-srv

**Назначение**: Система навигации между мирами

**Ключевые функции**:

-   Интерфейс звездных врат
-   Планирование маршрутов
-   Расчет времени и стоимости перелетов
-   Система исследования новых систем

### Stations & Mining System

#### stations-frt / stations-srv

**Назначение**: Космические станции и производство

**Ключевые функции**:

-   Строительство и модификация станций
-   Производственные цепочки
-   Система найма NPC рабочих
-   Управление энергией и ресурсами

#### mining-frt / mining-srv

**Назначение**: Промышленный лазерный майнинг

**Ключевые функции**:

-   Система автонаведения лазеров (50-100 единиц дальности)
-   Визуализация красных лазерных лучей
-   3-секундные циклы добычи
-   Автоматизированная симуляция сбора дронами

**Механика майнинга**:

```typescript
interface MiningOperation {
    shipId: string
    targetAsteroid: {
        id: string
        position: Vector3
        composition: MaterialComposition
        remainingMass: number
    }
    laserConfiguration: {
        power: number // Мощность лазера (влияет на скорость добычи)
        range: number // Дальность (50-100 единиц)
        efficiency: number // Эффективность добычи (0-1)
    }
    cycleTime: 3000 // 3 секунды на цикл
    autoTargeting: boolean
    droneCollection: boolean
}
```

### Security & Combat System

#### security-frt / security-srv

**Назначение**: Система безопасности пространства

**Ключевые функции**:

-   Классификация зон безопасности (High-sec, Low-sec, Null-sec)
-   Система CONCORD (космическая полиция)
-   Автоматическое наказание за агрессию в безопасных зонах
-   Система статуса безопасности игроков

**Зоны безопасности**:

```typescript
interface SecurityZone {
    zoneId: string
    securityLevel: number // 1.0 (High-sec) to 0.0 (Null-sec)
    concordResponse: {
        enabled: boolean
        responseTime: number // секунды до прибытия CONCORD
        punishment: 'ship_destruction' | 'security_status_loss' | 'none'
    }
    restrictions: {
        pvpAllowed: boolean
        podKilling: boolean
        structureDestruction: boolean
    }
}

const securityZones = {
    highSec: { securityLevel: 1.0, concordResponse: { enabled: true, responseTime: 5 } },
    lowSec: { securityLevel: 0.4, concordResponse: { enabled: false, responseTime: 0 } },
    nullSec: { securityLevel: 0.0, concordResponse: { enabled: false, responseTime: 0 } }
}
```

#### combat-frt / combat-srv

**Назначение**: PvP боевая система

**Ключевые функции**:

-   Система целеуказания и атаки
-   Расчет урона и защиты
-   Система потери кораблей при уничтожении
-   Механика подов (escape pods)
-   Система войн между корпорациями

**Боевая механика**:

```typescript
interface CombatSystem {
    targeting: {
        maxTargets: number
        lockTime: number // время захвата цели
        range: number // дальность захвата
    }
    weapons: {
        type: 'laser' | 'projectile' | 'missile' | 'hybrid'
        damage: DamageProfile
        range: number
        tracking: number // способность попадать по быстрым целям
        cycleTime: number
    }
    defense: {
        shields: ShieldSystem
        armor: ArmorSystem
        hull: HullSystem
    }
    destruction: {
        shipLoss: boolean // корабль уничтожается навсегда
        podEscape: boolean // игрок может спастись в поде
        lootDrop: LootTable // что выпадает с уничтоженного корабля
    }
}
```

### Skills & Progression System

#### skills-frt / skills-srv

**Назначение**: Система навыков и прогрессии персонажа

**Ключевые функции**:

-   Обучение навыков в реальном времени
-   Очередь обучения навыков
-   Влияние навыков на игровые механики
-   Система имплантов для ускорения обучения

**Система навыков**:

```typescript
interface SkillSystem {
    skill: {
        id: string
        name: string
        category: 'combat' | 'mining' | 'trading' | 'industry' | 'social'
        maxLevel: number // обычно 5
        trainingMultiplier: number // сложность обучения
        prerequisites: SkillRequirement[]
    }
    training: {
        activeSkill?: string
        queue: TrainingQueueItem[]
        trainingRate: number // очки навыков в час
        implants: ImplantBonus[] // бонусы от имплантов
    }
    effects: {
        [skillId: string]: {
            level: number
            bonuses: SkillBonus[]
        }
    }
}

interface SkillBonus {
    type: 'damage' | 'mining_yield' | 'trading_margin' | 'ship_speed'
    value: number // процентный бонус за уровень
    target: string // на что влияет
}
```

### Sovereignty & Territorial Warfare

#### sovereignty-frt / sovereignty-srv

**Назначение**: Территориальные войны и контроль систем

**Ключевые функции**:

-   Захват и удержание территорий
-   Система влияния и контроля
-   Орбитальные структуры (аналог skyhooks из EVE)
-   Улучшения суверенитета
-   Механики войн альянсов

**Система суверенитета**:

```typescript
interface SovereigntySystem {
    systemId: string
    controllingAlliance?: string
    influenceLevel: number // 0-100%
    structures: {
        sovereigntyHub?: SovereigntyHub
        orbitalSkyhooks: OrbitalSkyhook[]
        defensiveStructures: DefensiveStructure[]
    }
    upgrades: {
        militaryIndex: number
        industrialIndex: number
        strategicIndex: number
    }
    contestation: {
        isContested: boolean
        attackingAlliance?: string
        contestationLevel: number
        vulnerabilityWindow: TimeWindow
    }
}

interface SovereigntyHub {
    id: string
    health: number
    reinforcementTimer?: Date
    upgrades: SovereigntyUpgrade[]
    resources: {
        power: number // энергия от звезд и планет
        workforce: number // рабочая сила
        reagents: number // реагенты для топлива
    }
}

interface OrbitalSkyhook {
    id: string
    planetId: string
    resourceType: 'power' | 'workforce' | 'reagents'
    extractionRate: number
    health: number
    vulnerableToHacking: boolean
    pirateBlockadeRisk: number
}
```

### Industry & Manufacturing

#### industry-frt / industry-srv

**Назначение**: Производство и промышленность

**Ключевые функции**:

-   Производственные линии и фабрики
-   Исследования и разработки
-   Система чертежей (blueprints)
-   Управление цепочками поставок
-   Переработка ресурсов

**Система производства**:

```typescript
interface ManufacturingSystem {
    blueprints: {
        [itemId: string]: Blueprint
    }
    productionLines: ProductionLine[]
    research: {
        materialEfficiency: ResearchProject[]
        timeEfficiency: ResearchProject[]
        invention: InventionProject[]
    }
    supplyChains: SupplyChain[]
}

interface Blueprint {
    id: string
    itemProduced: string
    materials: MaterialRequirement[]
    productionTime: number
    skillRequirements: SkillRequirement[]
    facilityRequirements: FacilityType[]
    researchLevel: {
        materialEfficiency: number // 0-10%
        timeEfficiency: number // 0-20%
    }
}

interface ProductionLine {
    id: string
    stationId: string
    blueprintId: string
    status: 'idle' | 'running' | 'paused' | 'completed'
    startTime: Date
    completionTime: Date
    inputMaterials: MaterialStack[]
    outputItems: ItemStack[]
}
```

### Wormhole Systems

#### wormhole-srv

**Назначение**: Системы червоточин

**Ключевые функции**:

-   Динамические соединения между системами
-   Уникальные правила и ресурсы
-   Механики исследования
-   NPC Sleeper-ы (спящие)
-   Нестабильные соединения

**Система червоточин**:

```typescript
interface WormholeSystem {
    id: string
    class: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' // классы сложности
    connections: WormholeConnection[]
    anomalies: WormholeAnomaly[]
    sleeperSites: SleeperSite[]
    effects: WormholeEffect[]
    massLimit: number
    jumpLimit: number
}

interface WormholeConnection {
    id: string
    sourceSystem: string
    destinationSystem: string
    stability: number // 0-100%
    massUsed: number
    timeRemaining: number // часы до коллапса
    size: 'small' | 'medium' | 'large' | 'capital'
}

interface SleeperSite {
    id: string
    difficulty: 'easy' | 'medium' | 'hard' | 'extreme'
    rewards: {
        salvage: SalvageItem[]
        blueprintChance: number
        iskValue: number
    }
    npcs: SleeperNPC[]
}
```

## Социальные системы

### Corporations System

#### corporations-frt / corporations-srv

**Назначение**: Корпорации и организации игроков

**Ключевые функции**:

-   Создание и управление корпорациями
-   Иерархия ролей и прав доступа
-   Корпоративные активы и финансы
-   Система налогов и дивидендов

**Структура корпорации**:

```typescript
interface Corporation {
    id: string
    name: string
    description: string
    foundedDate: Date
    headquarters: {
        worldId: string
        stationId?: string
    }
    members: CorporationMember[]
    assets: {
        inmoBalance: number
        ships: string[]
        stations: string[]
        resources: ResourceInventory
    }
    roles: CorporationRole[]
}

interface CorporationRole {
    name: string
    permissions: {
        canInviteMembers: boolean
        canManageAssets: boolean
        canAccessCorporateHangars: boolean
        canDeclareWar: boolean
        canMakeDiplomacy: boolean
    }
}
```

### Diplomacy System

#### diplomacy-frt / diplomacy-srv

**Назначение**: Дипломатические отношения

**Ключевые функции**:

-   Система союзов и враждебности
-   Переговоры и договоры
-   Объявление войн и перемирий
-   Дипломатическая репутация

### Trading System

#### trading-frt / trading-srv

**Назначение**: Продвинутая торговая система

**Ключевые функции**:

-   Торговые платформы и аукционы
-   Система контрактов
-   Логистика и доставка
-   Рыночная аналитика и прогнозы

**Расширенная торговая система**:

```typescript
interface TradingSystem {
    marketOrders: {
        buyOrders: MarketOrder[]
        sellOrders: MarketOrder[]
        priceHistory: PricePoint[]
        volume24h: number
    }
    contracts: {
        courier: CourierContract[] // доставка грузов
        auction: AuctionContract[] // аукционы предметов
        exchange: ExchangeContract[] // обмен предметами
        loan: LoanContract[] // займы между игроками
    }
    regionalMarkets: {
        [regionId: string]: RegionalMarket
    }
}

interface MarketOrder {
    id: string
    playerId: string
    itemId: string
    quantity: number
    price: number
    orderType: 'buy' | 'sell'
    duration: number // дни до истечения
    minVolume: number // минимальный объем для исполнения
    stationId: string // где размещен ордер
}

interface CourierContract {
    id: string
    issuer: string
    reward: number
    collateral: number
    volume: number
    startLocation: string
    endLocation: string
    expiration: Date
    items: ContractItem[]
}
```

## Технические системы

### Enhanced Authentication

#### auth-enhanced-frt / auth-enhanced-srv

**Назначение**: Расширенная система авторизации

**Ключевые функции**:

-   Интеграция игровых и платформенных аккаунтов
-   Единый вход (SSO) между системами
-   Верификация личности для корпораций
-   Система репутации и доверия

**Архитектура авторизации**:

```typescript
interface UniversoUser {
    platformAccount: {
        id: string
        email: string
        role: 'user' | 'developer' | 'admin'
    }
    gameAccounts: {
        [worldId: string]: {
            playerId: string
            characterName: string
            reputation: number
            corporationId?: string
        }
    }
    verificationStatus: {
        emailVerified: boolean
        phoneVerified: boolean
        identityVerified: boolean // Для корпоративных лидеров
    }
}
```

### Multiplayer System

#### multiplayer-frt / multiplayer-srv

**Назначение**: Реальное время мультиплеер

**Ключевые функции**:

-   Синхронизация позиций кораблей
-   Обработка столкновений и взаимодействий
-   Система инстансов и зон
-   Оптимизация сетевого трафика

**Сетевая архитектура**:

```typescript
interface MultiplayerState {
    worldId: string
    players: {
        [playerId: string]: {
            position: Vector3
            rotation: Quaternion
            shipId: string
            status: 'online' | 'mining' | 'trading' | 'combat'
            lastUpdate: number
        }
    }
    entities: {
        asteroids: AsteroidState[]
        stations: StationState[]
        npcs: NPCState[]
    }
}
```

### Security & Monitoring

#### security-frt / security-srv

**Назначение**: Безопасность и защита от читов

**Ключевые функции**:

-   Детекция читов и эксплойтов
-   Система банов и предупреждений
-   Мониторинг подозрительной активности
-   Защита экономики от манипуляций

## Интеграция с UPDL узлами

### Детальная схема маппинга

Каждый высокоуровневый UPDL узел соответствует определенным приложениям и игровым механикам:

```typescript
interface UPDLServiceMapping {
    Space: {
        services: ['navigation-srv', 'stations-srv', 'security-srv', 'sovereignty-srv', 'wormhole-srv']
        description: 'Игровые миры, зоны безопасности и пространственные системы'
        gameLogic: {
            worlds: ['kubio', 'konkordo', 'triumfo']
            securityZones: ['high-sec', 'low-sec', 'null-sec']
            starGates: 'межмировые переходы'
            stations: 'космические базы и аванпосты'
            sovereignty: 'территориальный контроль систем'
            wormholes: 'динамические соединения между системами'
        }
    }
    Entity: {
        services: ['ships-srv', 'resources-srv', 'mining-srv', 'industry-srv']
        description: 'Игровые объекты и сущности'
        gameLogic: {
            ships: 'корабли игроков и NPC'
            asteroids: 'астероиды для добычи'
            resources: 'материалы и предметы'
            structures: 'станции и сооружения'
            factories: 'производственные объекты'
            blueprints: 'чертежи для производства'
        }
    }
    Component: {
        services: ['ships-srv', 'stations-srv', 'skills-srv']
        description: 'Компоненты и модули объектов'
        gameLogic: {
            shipModules: 'двигатели, оружие, щиты'
            stationModules: 'производственные линии'
            skillBonuses: 'бонусы от навыков'
            implants: 'импланты персонажа'
        }
    }
    Event: {
        services: ['multiplayer-srv', 'combat-srv', 'trading-srv']
        description: 'Игровые события и триггеры'
        gameLogic: {
            combatEvents: 'атаки, уничтожения, урон'
            tradeEvents: 'сделки, контракты, аукционы'
            socialEvents: 'войны, альянсы, дипломатия'
            systemEvents: 'респавн ресурсов, NPC активность'
        }
    }
    Action: {
        services: ['combat-srv', 'trading-srv', 'diplomacy-srv', 'mining-srv', 'industry-srv', 'sovereignty-srv']
        description: 'Действия игроков и системы'
        gameLogic: {
            playerActions: 'атака, добыча, торговля, перемещение'
            corporateActions: 'объявление войны, создание альянса'
            economicActions: 'размещение ордеров, заключение контрактов'
            industrialActions: 'производство, исследования'
            sovereigntyActions: 'захват территорий, развертывание структур'
            wormholeActions: 'исследование, прохождение через червоточины'
        }
    }
    Data: {
        services: ['resources-srv', 'economy-srv', 'analytics-enhanced-srv']
        description: 'Игровые данные и метрики'
        gameLogic: {
            gameState: 'состояние игрового мира'
            playerData: 'прогресс, навыки, репутация'
            economicData: 'цены, объемы торговли'
            analytics: 'метрики поведения игроков'
        }
    }
    Universo: {
        services: ['workflow-engine-srv', 'node-registry-srv', 'security-srv']
        description: 'Глобальные правила и конфигурация'
        gameLogic: {
            gameRules: 'правила PvP, экономики, прогрессии'
            balancing: 'баланс кораблей, оружия, навыков'
            worldSettings: 'настройки миров и зон'
            systemConfig: 'конфигурация серверов и сервисов'
        }
    }
}
```

### Workflow Integration

```typescript
interface UPDLWorkflow {
    nodes: UPDLNode[]
    connections: NodeConnection[]
    gameLogic: CompiledGameLogic
    services: ServiceDependency[]
}

interface CompiledGameLogic {
    // Space узлы компилируются в конфигурацию миров
    worldConfig: WorldConfiguration[]
    // Entity узлы создают объекты в игре
    entitySpawns: EntitySpawnRule[]
    // Component узлы определяют свойства объектов
    componentDefinitions: ComponentDefinition[]
    // Event узлы создают триггеры
    eventHandlers: EventHandler[]
    // Action узлы определяют доступные действия
    actionDefinitions: ActionDefinition[]
    // Data узлы настраивают хранение данных
    dataSchemas: DataSchema[]
    // Universo узлы задают глобальные правила
    globalRules: GlobalRule[]
}
```

## Интеграция с PlayCanvas

### Template Engine Integration

Все MMOOMM приложения интегрируются с PlayCanvas через расширенный Template Engine:

```typescript
interface MMOOMMTemplate {
    name: 'universo-mmoomm'
    version: string
    gameLogic: {
        resourceSystem: ResourceSystemConfig
        economySystem: EconomySystemConfig
        shipsSystem: ShipsSystemConfig
        multiplayerSystem: MultiplayerSystemConfig
    }
    assets: {
        ships: ShipAsset[]
        stations: StationAsset[]
        materials: MaterialAsset[]
        ui: UIAsset[]
    }
    scripts: {
        clientScripts: ClientScript[]
        serverScripts: ServerScript[]
    }
}
```

### Real-time Synchronization

```typescript
class PlayCanvasMMOOMMClient {
    private supabase: SupabaseClient
    private gameState: MultiplayerState

    async syncPlayerPosition(position: Vector3, rotation: Quaternion) {
        await this.supabase.from('player_positions').upsert({
            player_id: this.playerId,
            world_id: this.worldId,
            x: position.x,
            y: position.y,
            z: position.z,
            qx: rotation.x,
            qy: rotation.y,
            qz: rotation.z,
            qw: rotation.w,
            timestamp: Date.now()
        })
    }

    subscribeToWorldEvents() {
        this.supabase
            .channel(`world:${this.worldId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'world_events'
                },
                this.handleWorldEvent.bind(this)
            )
            .subscribe()
    }
}
```

## Архитектура данных

### Схемы базы данных

```sql
-- Игровые миры и игроки
CREATE SCHEMA universo_worlds;
CREATE TABLE universo_worlds.players (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    world_id VARCHAR(50),
    character_name VARCHAR(100),
    position_x DECIMAL(15,6),
    position_y DECIMAL(15,6),
    position_z DECIMAL(15,6),
    current_ship_id UUID,
    inmo_balance DECIMAL(15,2),
    reputation INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ресурсы и материалы
CREATE SCHEMA universo_resources;
CREATE TABLE universo_resources.material_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100),
    density_kg_m3 DECIMAL(10,2),
    base_value_inmo DECIMAL(10,2),
    rarity_factor DECIMAL(3,2)
);

-- Корабли и флот
CREATE SCHEMA universo_ships;
CREATE TABLE universo_ships.ships (
    id UUID PRIMARY KEY,
    player_id UUID REFERENCES universo_worlds.players(id),
    ship_type VARCHAR(50),
    name VARCHAR(100),
    configuration JSONB,
    current_world VARCHAR(50),
    position_x DECIMAL(15,6),
    position_y DECIMAL(15,6),
    position_z DECIMAL(15,6),
    health_percentage DECIMAL(5,2) DEFAULT 100.00
);

-- Корпорации
CREATE SCHEMA universo_corporations;
CREATE TABLE universo_corporations.corporations (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE,
    description TEXT,
    founded_date TIMESTAMP DEFAULT NOW(),
    headquarters_world VARCHAR(50),
    inmo_treasury DECIMAL(15,2) DEFAULT 0
);
```

## Связанные страницы

-   [Базовые приложения платформы](core-platform-apps.md)
-   [Дизайн микросервисов](microservices-design.md)
-   [Фаза 1: MVP](../implementation-plan/phase-1-mvp.md)
-   [Технические спецификации](../technical-specifications/README.md)

## Статус разработки

-   [x] Проектирование игровых механик
-   [x] Определение архитектуры данных
-   [/] Создание технических спецификаций
-   [ ] Начало разработки MVP
-   [ ] Интеграция с PlayCanvas

---

_Последнее обновление: 5 августа 2025_
