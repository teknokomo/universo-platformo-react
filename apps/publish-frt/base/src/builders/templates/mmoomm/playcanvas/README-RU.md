# Шаблон MMOOMM PlayCanvas

Шаблон MMOOMM (Massive Multiplayer Online Object Mining Management) предоставляет комплексную космическую MMO-среду, построенную на PlayCanvas Engine 2.9.0. Этот шаблон демонстрирует продвинутые игровые механики, включая промышленный лазерный майнинг, физический космический полет и управление инвентарем в реальном времени.

## Обзор

Шаблон MMOOMM преобразует узлы UPDL (Universal Platform Definition Language) в полнофункциональный космический MMO-опыт. Игроки управляют космическими кораблями, оснащенными промышленными системами лазерного майнинга, навигируют через астероидные поля и управляют грузом в постоянной виртуальной вселенной.

### Ключевые возможности

-   **Промышленная система лазерного майнинга**: Автонаведение лазера с 3-секундными циклами
-   **Продвинутая система сущностей**: Корабли, астероиды, станции, врата с сетевыми возможностями
-   **Физический полет**: 6DOF движение с реалистичной космической физикой
-   **Управление инвентарем в реальном времени**: Комплексная система управления ресурсами с общими шаблонами
-   **Интерактивный HUD**: Прогресс майнинга, статус груза и системные индикаторы
-   **Модульная архитектура**: Дизайн с приоритетом шаблонов и специализированными обработчиками

## Архитектура

### Структура шаблона

```
mmoomm/playcanvas/
├── PlayCanvasBuilder.ts           # Высокоуровневый PlayCanvas билдер
├── PlayCanvasMMOOMMBuilder.ts     # Реализация шаблона MMOOMM
├── config.ts                      # Конфигурация шаблона
├── handlers/                      # Процессоры узлов UPDL
│   ├── ActionHandler/             # Модуль обработки Action
│   ├── ComponentHandler/          # Обработка Component (components/, attachments/)
│   ├── DataHandler/               # Модуль обработки Data
│   ├── EntityHandler/             # Обработка Entity (entityTypes/)
│   │   ├── entityTypes/           # Специализированные реализации сущностей
│   │   │   ├── ship.ts            # Игровой космический корабль с лазерным майнингом
│   │   │   ├── asteroid.ts        # Добываемые астероидные объекты
│   │   │   ├── station.ts         # Торговые и стыковочные сооружения
│   │   │   ├── gate.ts            # Межсистемная телепортация
│   │   │   ├── player.ts          # Сетевые сущности игроков
│   │   │   ├── interactive.ts     # Объекты пользовательского взаимодействия
│   │   │   ├── vehicle.ts         # Альтернативные сущности движения
│   │   │   └── static.ts          # Объекты окружения
│   │   └── utils.ts               # Утилиты сущностей
│   ├── EventHandler/              # Модуль обработки Event
│   ├── SpaceHandler/              # Модуль обработки Space
│   ├── UniversoHandler/           # Модуль обработки Universo
│   ├── shared/                    # Общие компоненты и утилиты
│   │   ├── inventoryTemplate.ts   # Общий шаблон системы инвентаря
│   │   ├── README.md              # Подробная документация общих компонентов
│   │   └── README-RU.md           # Русская документация
│   └── index.ts                   # Экспорт обработчиков
├── scripts/                       # Система скриптов PlayCanvas
│   ├── BaseScript.ts              # Абстрактный базовый класс
│   ├── RotatorScript.ts           # Скрипт анимации поворота
│   └── index.ts                   # Экспорт модуля скриптов
└── index.ts                       # Экспорт MMOOMM PlayCanvas
```

### Система обработчиков

Шаблон MMOOMM использует модульную систему обработчиков, где каждый тип узла UPDL имеет выделенный процессор:

-   **SpaceHandler**: Обрабатывает узлы Space для MMO-сред (root, region, instance)
-   **EntityHandler**: Управляет созданием сущностей со специализированными типами для космического геймплея
-   **ComponentHandler**: Обрабатывает присоединение компонентов и переопределения UPDL
-   **EventHandler**: Обрабатывает события в реальном времени и сетевое взаимодействие
-   **ActionHandler**: Управляет сетевыми действиями и взаимодействиями игроков
-   **DataHandler**: Обрабатывает синхронизацию данных между клиентами
-   **UniversoHandler**: Управляет настройкой сетевого шлюза и протоколами

### Общие компоненты

Шаблон MMOOMM включает общие компоненты, которые предоставляют переиспользуемые реализации для общих игровых механик, обеспечивая консистентность и устраняя дублирование кода между обработчиками.

#### Система инвентаря

**Система инвентаря** - это комплексное решение для управления ресурсами, которое поддерживает:

-   **Операции майнинга**: Хранение ресурсов, собранных при добыче астероидов (asteroidMass, crystals и т.д.)
-   **Торговые механики**: Управление грузом для торговли на станциях с отслеживанием вместимости
-   **Системы крафтинга**: Обработка материалов для производства предметов и улучшения оборудования
-   **Квестовые системы**: Отслеживание квестовых предметов и доставок без ограничений вместимости
-   **Управление топливом**: Мониторинг расходуемых ресурсов для операций корабля

**Ключевые возможности:**

-   Настраиваемые ограничения вместимости (по умолчанию: грузовой отсек 20м³)
-   Поддержка любых типов предметов на основе строк
-   Опциональное логирование и интеграция событий для обновления UI
-   Подход общих шаблонов устраняет дублирование кода
-   Интеграция с узлами UPDL Component и типами Entity

**Паттерны использования:**

-   **UPDL компоненты**: Автоматическое присоединение через `attachments/inventory.ts`
-   **Интеграция Entity**: Прямая интеграция в ship.ts и другие типы сущностей
-   **Автономные компоненты**: Независимая обработка через `components/inventory.ts`

Для подробной технической документации, справочника API и примеров интеграции см. [Документацию общих компонентов](./handlers/shared/README-RU.md).

## Система сущностей

### Доступные типы сущностей

#### Ship

Управляемый игроком космический корабль с комплексными системами:

-   **Система лазерного майнинга**: Промышленный лазер с автонаведением и машиной состояний
-   **Управление инвентарем**: Грузовой отсек 20м³ с отслеживанием вместимости в реальном времени
-   **Интеграция физики**: Обнаружение столкновений, динамика твердых тел
-   **Контроллер камеры**: Камера от третьего лица, следующая за движением корабля
-   **Система движения**: Управление WASD+QZ с механикой полета 6DOF

#### Asteroid

Добываемые объекты с извлечением ресурсов:

-   **Ресурсная отдача**: Настраиваемые количества ресурсов (по умолчанию 1.5м³ за цикл)
-   **Механика разрушения**: Астероиды уничтожаются при полной добыче
-   **Система столкновений**: Ray-casting для валидации лазерного нацеливания
-   **Визуальная обратная связь**: Изменения материала во время процесса майнинга

#### Station

Торговые посты и стыковочные сооружения:

-   **Система коммерции**: Торговля ресурсами и управление грузом
-   **Механика стыковки**: Протоколы взаимодействия корабль-станция
-   **Обмен инвентарем**: Возможности массовой передачи груза

#### Gate

Порталы межсистемной телепортации:

-   **Система телепортации**: Мгновенное путешествие между локациями
-   **Сетевая синхронизация**: Управление состоянием портала для нескольких клиентов
-   **Контроль доступа**: Использование портала на основе разрешений

### Возможности сущностей

-   **Модульная архитектура**: Каждый тип сущности имеет выделенную логику в директории `entityTypes/`
-   **Интеграция компонентов**: Бесшовная интеграция с узлами UPDL Component
-   **Сетевая поддержка**: Встроенные сетевые возможности для мультиплеерных сценариев
-   **Интеграция физики**: Обнаружение столкновений, динамика твердых тел, пространственные отношения
-   **Управление памятью**: Автоматическая очистка и управление ссылками

## Система лазерного майнинга

### Архитектура системы

Система лазерного майнинга реализует сложную машину состояний с четырьмя основными состояниями:

1. **Idle**: Состояние по умолчанию, ожидание активации
2. **Targeting**: Сканирование валидных целей в радиусе действия
3. **Mining**: Активное извлечение ресурсов с визуальным лазерным лучом
4. **Collecting**: Сбор ресурсов и интеграция с инвентарем

### Техническая реализация

#### Машина состояний

```javascript
laserSystem: {
    state: 'idle',           // Текущее состояние системы
    currentTarget: null,     // Активная цель майнинга
    miningStartTime: 0,      // Временная метка начала цикла майнинга
    cycleProgress: 0,        // Прогресс майнинга (0-1)
    laserBeam: null         // Визуальная сущность лазерного луча
}
```

#### Конфигурация

-   **Максимальный радиус**: 75 единиц (оптимальное расстояние нацеливания)
-   **Длительность майнинга**: 3000мс (3-секундные циклы)
-   **Ресурсная отдача**: 1.5м³ за успешный цикл майнинга
-   **Визуальные эффекты**: Красный эмиссивный лазерный луч с анимацией затухания

#### Обнаружение целей

-   **Валидация радиуса**: Цели должны быть в радиусе 75 единиц
-   **Прямая видимость**: Ray-casting валидация для четкого нацеливания
-   **Алгоритм приоритета**: Выбор цели на основе расстояния и угла
-   **Автонаведение**: Автоматическое обнаружение и отслеживание целей

### Точки интеграции

Лазерная система интегрируется с множественными игровыми системами:

-   **SpaceControls**: Активация клавишей пробела запускает лазерную систему
-   **MMOEntities**: Глобальный реестр сущностей для сканирования целей
-   **SpaceHUD**: Отображение прогресса майнинга и статуса в реальном времени
-   **Система инвентаря**: Автоматический сбор и хранение ресурсов
-   **Система физики**: Ray-casting для валидации целей

## Игровые механики

### Рабочий процесс майнинга

1. **Активация**: Игрок нажимает клавишу пробела для активации лазерной системы
2. **Обнаружение цели**: Система сканирует астероиды в радиусе 75 единиц
3. **Включение лазера**: Появляется визуальный лазерный луч, соединяющий корабль с целью
4. **Извлечение ресурсов**: 3-секундный цикл майнинга с индикацией прогресса
5. **Сбор**: Ресурсы автоматически добавляются в инвентарь корабля
6. **Завершение цикла**: Система возвращается в состояние ожидания для следующей активации

### Система движения

-   **6DOF полет**: Полная свобода движения в шести степенях в 3D пространстве
-   **Управление WASD**: Движение вперед/назад и боковое движение
-   **Управление QZ**: Вертикальное движение (вверх/вниз)
-   **Интеграция физики**: Реалистичный импульс и инерция
-   **Следящая камера**: Камера от третьего лица поддерживает оптимальный угол обзора

### Управление инвентарем

-   **Грузовая вместимость**: Максимальная вместимость хранения 20м³
-   **Отслеживание в реальном времени**: Мониторинг вместимости в реальном времени и отображение процентов
-   **Управление предметами**: Поддержка множественных типов ресурсов
-   **Защита от переполнения**: Майнинг отключается при заполнении грузового отсека

## Конфигурация

### Конфигурация шаблона

Шаблон MMOOMM настраивается через `config.ts`:

```typescript
export const MMOOMMTemplateConfig: TemplateConfig = {
    id: 'mmoomm',
    name: 'playcanvasTemplates.mmoomm.name',
    description: 'playcanvasTemplates.mmoomm.description',
    version: '0.1.0',
    technology: 'playcanvas',
    supportedNodes: ['Space', 'Entity', 'Component', 'Event', 'Action', 'Data', 'Universo'],
    features: [
        'playcanvas-2.9.0',
        'networking',
        'real-time-sync',
        'multi-user',
        'universo-gateway',
        'websocket-protocol',
        'mmoomm-systems',
        'script-system',
        'modular-scripts'
    ]
}
```

### Использование

```typescript
import { PlayCanvasBuilder } from './builders'

const builder = new PlayCanvasBuilder()
const result = await builder.buildFromFlowData(flowDataString, {
    projectName: 'Демо космического майнинга',
    templateId: 'mmoomm'
})

console.log(result.html) // Сгенерированный HTML PlayCanvas
```

## Разработка

### Добавление новых типов сущностей

1. Создайте новый файл сущности в директории `entityTypes/`
2. Реализуйте специфичную для сущности логику и системы
3. Зарегистрируйте тип сущности в маппинге `ENTITY_GENERATORS`
4. Добавьте сетевую поддержку при необходимости

### Расширение игровых механик

1. Модифицируйте существующую логику сущностей в соответствующих файлах `entityTypes/`
2. Обновите обработку в соответствующих модулях обработчиков
3. Интегрируйте с существующими системами (HUD, инвентарь, физика)
4. Протестируйте мультиплеерную синхронизацию при необходимости

### Интеграция системы скриптов

Шаблон включает простую систему скриптов для переиспользуемых поведений:

```typescript
import { RotatorScript } from './scripts'

// Создание скрипта поворота для демо-объектов
const rotator = RotatorScript.createDefault()
```

## Технические требования

-   **PlayCanvas Engine**: Версия 2.9.0 или выше
-   **Поддержка браузеров**: Современные браузеры с поддержкой WebGL
-   **Сетевой протокол**: WebSocket для мультиплеера в реальном времени
-   **Память**: Оптимизировано для эффективного управления сущностями

## Будущие улучшения

-   **Торговая система**: Расширенная коммерция между станциями
-   **Мультиплеерная сеть**: Синхронизация игроков в реальном времени
-   **Продвинутый майнинг**: Множественные типы лазеров и стратегии майнинга
-   **Контроль территории**: Принадлежащие игрокам станции и ресурсные претензии
-   **Система квестов**: Прогрессия геймплея на основе миссий

---

_Universo Platformo | Документация шаблона MMOOMM PlayCanvas_
