# Фаза 1: MVP Universo MMOOMM (v0.22.0-alpha)

## Краткое описание

Первая фаза реализации дорожной карты Universo Platformo, направленная на создание минимально жизнеспособного продукта (MVP) для Universo MMOOMM с базовыми игровыми механиками: системой ресурсов, управлением кораблями и экономикой между мирами.

## Содержание

-   [Цели и задачи](#цели-и-задачи)
-   [Приоритетные приложения](#приоритетные-приложения)
-   [Технические требования](#технические-требования)
-   [План разработки](#план-разработки)
-   [Критерии готовности](#критерии-готовности)

## Цели и задачи

### Основная цель

Создать функционирующий MVP космического MMO с базовыми игровыми механиками, демонстрирующий потенциал платформы Universo Platformo для создания сложных игровых приложений.

### Ключевые задачи

1. **Реализация системы ресурсов** с реалистичной физикой материалов
2. **Создание системы управления кораблями** с базовой кастомизацией
3. **Внедрение экономической системы** с валютой Inmo между тремя мирами
4. **Интеграция с PlayCanvas** для 3D визуализации
5. **Обеспечение стабильной работы** всех компонентов

### Бизнес-ценность

-   **Демонстрация возможностей**: Показать потенциал UPDL для создания сложных приложений
-   **Привлечение пользователей**: Создать интересный игровой опыт
-   **Техническая валидация**: Проверить архитектурные решения
-   **Основа для развития**: Заложить фундамент для будущих функций

## Приоритетные приложения

### 1. Resources System (resources-frt/srv)

**Приоритет**: Критический
**Время разработки**: 4 недели
**Команда**: 2 разработчика (1 frontend, 1 backend)

#### Функциональные требования

**Frontend (resources-frt)**:

-   Интерфейс инвентаря с отображением веса/объема
-   Калькулятор плотности материалов
-   Система передачи ресурсов между локациями
-   Визуализация типов материалов

**Backend (resources-srv)**:

-   API управления инвентарем
-   Расчеты физических свойств материалов
-   Валидация ограничений по весу/объему
-   Система логов перемещения ресурсов

#### 16 типов материалов

```typescript
interface MaterialType {
    id: string
    name: string
    density: number // кг/м³
    baseValue: number // базовая стоимость в Inmo
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
    uses: string[]
}

const materials: MaterialType[] = [
    { id: 'hydrogen', name: 'Водород', density: 0.09, baseValue: 1, rarity: 'common', uses: ['топливо'] },
    { id: 'helium', name: 'Гелий', density: 0.18, baseValue: 2, rarity: 'common', uses: ['охлаждение'] },
    { id: 'carbon', name: 'Углерод', density: 2267, baseValue: 5, rarity: 'common', uses: ['конструкции'] },
    { id: 'oxygen', name: 'Кислород', density: 1.43, baseValue: 3, rarity: 'common', uses: ['жизнеобеспечение'] },
    { id: 'silicon', name: 'Кремний', density: 2329, baseValue: 8, rarity: 'uncommon', uses: ['электроника'] },
    { id: 'iron', name: 'Железо', density: 7874, baseValue: 10, rarity: 'uncommon', uses: ['конструкции'] },
    { id: 'nickel', name: 'Никель', density: 8908, baseValue: 15, rarity: 'uncommon', uses: ['сплавы'] },
    { id: 'copper', name: 'Медь', density: 8960, baseValue: 12, rarity: 'uncommon', uses: ['проводка'] },
    { id: 'silver', name: 'Серебро', density: 10490, baseValue: 50, rarity: 'rare', uses: ['электроника'] },
    { id: 'gold', name: 'Золото', density: 19300, baseValue: 100, rarity: 'rare', uses: ['премиум компоненты'] },
    { id: 'platinum', name: 'Платина', density: 21450, baseValue: 200, rarity: 'epic', uses: ['катализаторы'] },
    { id: 'uranium', name: 'Уран', density: 19050, baseValue: 500, rarity: 'epic', uses: ['ядерное топливо'] },
    { id: 'titanium', name: 'Титан', density: 4506, baseValue: 80, rarity: 'rare', uses: ['легкие конструкции'] },
    { id: 'aluminum', name: 'Алюминий', density: 2700, baseValue: 6, rarity: 'uncommon', uses: ['легкие компоненты'] },
    { id: 'lithium', name: 'Литий', density: 534, baseValue: 25, rarity: 'rare', uses: ['батареи'] },
    { id: 'rare_earth', name: 'Редкоземельные', density: 7000, baseValue: 300, rarity: 'legendary', uses: ['спецтехнологии'] }
]
```

#### API спецификация

```typescript
// GET /api/v1/resources/inventory/:playerId
interface InventoryResponse {
    playerId: string
    locations: {
        [locationId: string]: {
            type: 'ship' | 'station' | 'storage'
            name: string
            materials: MaterialStack[]
            capacity: {
                maxMass: number
                maxVolume: number
                currentMass: number
                currentVolume: number
            }
        }
    }
}

// POST /api/v1/resources/transfer
interface TransferRequest {
    fromLocation: string
    toLocation: string
    materials: {
        materialId: string
        quantity: number
    }[]
}
```

### 2. Ships Management (ships-frt/srv)

**Приоритет**: Высокий
**Время разработки**: 3 недели
**Команда**: 2 разработчика (1 frontend, 1 backend)

#### Функциональные требования

**Frontend (ships-frt)**:

-   Интерфейс флота игрока
-   Базовый конфигуратор кораблей
-   Система назначения кораблей на задачи
-   Мониторинг состояния кораблей

**Backend (ships-srv)**:

-   API управления кораблями
-   Система конфигураций и модулей
-   Расчеты производительности
-   Базовая система повреждений

#### Типы кораблей

```typescript
interface ShipType {
    id: string
    name: string
    category: 'miner' | 'trader' | 'explorer' | 'fighter'
    baseStats: {
        cargoCapacity: number // м³
        speed: number // единиц/сек
        durability: number // очки прочности
        energyCapacity: number // единицы энергии
    }
    moduleSlots: {
        engine: number
        cargo: number
        utility: number
        weapon?: number
    }
}

const shipTypes: ShipType[] = [
    {
        id: 'basic_miner',
        name: 'Базовый Майнер',
        category: 'miner',
        baseStats: { cargoCapacity: 100, speed: 50, durability: 100, energyCapacity: 200 },
        moduleSlots: { engine: 1, cargo: 2, utility: 1 }
    },
    {
        id: 'light_trader',
        name: 'Легкий Торговец',
        category: 'trader',
        baseStats: { cargoCapacity: 200, speed: 80, durability: 80, energyCapacity: 150 },
        moduleSlots: { engine: 1, cargo: 3, utility: 1 }
    }
]
```

### 3. Economy System (economy-frt/srv)

**Приоритет**: Высокий
**Время разработки**: 3 недели
**Команда**: 2 разработчика (1 frontend, 1 backend)

#### Функциональные требования

**Frontend (economy-frt)**:

-   Интерфейс кошелька Inmo
-   Калькулятор курсов между мирами
-   История транзакций
-   Базовая торговая аналитика

**Backend (economy-srv)**:

-   API управления балансами
-   Система межмировых переводов
-   Динамическое ценообразование
-   Экономическая аналитика

#### Экономические системы миров

```typescript
interface WorldEconomy {
    worldId: 'kubio' | 'konkordo' | 'triumfo'
    characteristics: {
        primaryIndustry: string
        demandMultipliers: { [materialId: string]: number }
        supplyMultipliers: { [materialId: string]: number }
        volatility: number // 0-1, влияет на колебания цен
        tradingFee: number // комиссия за торговлю
    }
}

const worldEconomies: WorldEconomy[] = [
    {
        worldId: 'kubio',
        characteristics: {
            primaryIndustry: 'Тяжелая промышленность',
            demandMultipliers: { iron: 1.5, titanium: 1.3, aluminum: 1.2 },
            supplyMultipliers: { carbon: 1.2, silicon: 0.8 },
            volatility: 0.3,
            tradingFee: 0.02
        }
    },
    {
        worldId: 'konkordo',
        characteristics: {
            primaryIndustry: 'Высокие технологии',
            demandMultipliers: { rare_earth: 2.0, platinum: 1.8, gold: 1.5 },
            supplyMultipliers: { hydrogen: 1.1, helium: 1.1 },
            volatility: 0.5,
            tradingFee: 0.01
        }
    },
    {
        worldId: 'triumfo',
        characteristics: {
            primaryIndustry: 'Торговый центр',
            demandMultipliers: {}, // нейтральный спрос
            supplyMultipliers: {}, // нейтральное предложение
            volatility: 0.1,
            tradingFee: 0.005
        }
    }
]
```

## Технические требования

### Архитектурные принципы

1. **Микросервисная архитектура**: Каждое приложение как независимый сервис
2. **API-first подход**: Все взаимодействия через REST API
3. **Workspace пакеты**: Переиспользование кода между frontend и backend
4. **TypeScript**: Строгая типизация для всех компонентов

### Технологический стек

-   **Frontend**: React 18+ + TypeScript + Material-UI
-   **Backend**: Node.js + Express + TypeScript
-   **Database**: Supabase (PostgreSQL)
-   **Real-time**: Supabase Realtime для игровых событий
-   **Build**: Vite для frontend, tsc для backend
-   **Testing**: Jest + React Testing Library

### Интеграция с PlayCanvas

```typescript
interface PlayCanvasIntegration {
    resourceVisualization: {
        materialModels: string[] // 3D модели материалов
        inventoryUI: string // UI компоненты инвентаря
        transferAnimations: string[] // анимации передачи ресурсов
    }
    shipVisualization: {
        shipModels: { [shipType: string]: string }
        customizationUI: string
        movementSystem: string
    }
    economyVisualization: {
        tradingUI: string
        marketGraphs: string
        transactionEffects: string[]
    }
}
```

## План разработки

### Неделя 1-2: Инфраструктура и Resources System

**Задачи**:

-   Настройка workspace структуры для новых приложений
-   Создание базовой архитектуры resources-frt/srv
-   Реализация API для управления материалами
-   Создание UI компонентов инвентаря
-   Добавить каталог ресурсов с версиями и BOM (draft → publish), валидация DAG

**Deliverables**:

-   Рабочий API для ресурсов
-   Базовый интерфейс инвентаря
-   Система расчета плотности материалов
-   Базовая модель ResourceVersion + BOM

### Неделя 3-4: Ships System и ECS Entities (база)

**Задачи**:

-   Создание архитектуры ships-frt/srv
-   Реализация API управления кораблями
-   Интеграция с системой ресурсов
-   Создание UI управления флотом
-   Ввести `entities-srv` (MVP): сущности (Entity) + компонентная модель (Component JSONB)
-   Endpoints: instantiate (по ResourceVersion), move/update-state, get/tree

**Deliverables**:

-   API управления кораблями
-   Интерфейс флота
-   Базовая система конфигурации кораблей
-   Базовые операции ECS: создание сущности из версии ресурса, чтение/перемещение

### Неделя 5-6: Economy System и визуальные состояния

**Задачи**:

-   Создание архитектуры economy-frt/srv
-   Реализация системы валюты Inmo
-   Создание межмировой экономики
-   Интеграция с системами ресурсов и кораблей
-   Добавить компоненты: Visual (варианты по состояниям), Health/Integrity (пороги), публикация событий в шаблон PlayCanvas

**Deliverables**:

-   API экономической системы
-   Интерфейс кошелька и торговли
-   Система динамического ценообразования
-   Визуальное переключение состояний (целый/поврежденный) на основе компонент

### Неделя 7-8: Интеграция и тестирование

**Задачи**:

-   Интеграция всех систем
-   Обновление PlayCanvas шаблона MMOOMM
-   Комплексное тестирование
-   Оптимизация производительности

**Deliverables**:

-   Полностью интегрированный MVP
-   Обновленный PlayCanvas шаблон
-   Документация API
-   Результаты тестирования

### Неделя 9-10: Полировка и релиз

**Задачи**:

-   Исправление найденных багов
-   UI/UX улучшения
-   Подготовка релизной документации
-   Развертывание на staging и production

**Deliverables**:

-   Готовый к релизу MVP
-   Полная документация
-   Релизные заметки

## Критерии готовности

### Функциональные критерии

-   [ ] **Система ресурсов**: Все 16 типов материалов реализованы с корректной физикой; ресурсные версии и BOM (draft→publish)
-   [ ] **ECS**: Создание сущностей из ResourceVersion; компоненты Transform/Visual/Health; операции move/update-state
-   [ ] **Управление кораблями**: Минимум 2 типа кораблей с базовой кастомизацией
-   [ ] **Экономика**: Функционирующая валюта Inmo между 3 мирами
-   [ ] **Интеграция**: Все системы работают совместно без критических ошибок
-   [ ] **PlayCanvas**: Обновленный шаблон поддерживает новые механики и визуальные состояния

### Технические критерии

-   [ ] **API Coverage**: 100% покрытие API документацией
-   [ ] **Test Coverage**: Минимум 80% покрытие тестами для критических функций
-   [ ] **Performance**: Время отклика API < 200ms для 95% запросов
-   [ ] **Stability**: Отсутствие критических багов в течение недели тестирования
-   [ ] **Security**: Все API защищены авторизацией

### Пользовательские критерии

-   [ ] **Usability**: Интуитивно понятные интерфейсы для всех основных функций
-   [ ] **Responsiveness**: Адаптивный дизайн для разных размеров экрана
-   [ ] **Feedback**: Четкая обратная связь для всех пользовательских действий
-   [ ] **Error Handling**: Понятные сообщения об ошибках
-   [ ] **Help**: Базовая справочная информация для новых пользователей

### Бизнес-критерии

-   [ ] **Demo Ready**: Готовность для демонстрации потенциальным пользователям
-   [ ] **Scalability**: Архитектура поддерживает будущее расширение
-   [ ] **Maintainability**: Код легко поддерживается и расширяется
-   [ ] **Documentation**: Полная техническая и пользовательская документация

## Риски и митигация

### Технические риски

**Риск**: Сложность интеграции между системами
**Митигация**: Раннее создание API контрактов и mock сервисов

**Риск**: Производительность PlayCanvas интеграции
**Митигация**: Регулярное тестирование производительности и оптимизация

**Риск**: Сложность экономических расчетов
**Митигация**: Пошаговая реализация с простыми алгоритмами сначала

### Временные риски

**Риск**: Превышение временных рамок
**Митигация**: Еженедельные ретроспективы и корректировка планов

**Риск**: Недооценка сложности задач
**Митигация**: Буферное время в планах и приоритизация критических функций

## Связанные страницы

-   [План реализации](README.md)
-   [Фаза 2: Базовые системы](phase-2-core.md)
-   [Приложения MMOOMM](../target-architecture/mmoomm-apps.md)
-   [Технические спецификации](../technical-specifications/README.md)

## Статус выполнения

-   [x] Планирование архитектуры
-   [x] Определение требований
-   [x] Создание технических спецификаций
-   [ ] Начало разработки
-   [ ] Реализация MVP

---

_Последнее обновление: 5 августа 2025_
