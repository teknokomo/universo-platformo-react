# Документация общих компонентов

Эта директория содержит общие шаблоны и утилиты, используемые в обработчиках MMOOMM для обеспечения консистентности и устранения дублирования кода.

## Обзор

Общие компоненты предоставляют переиспользуемые реализации для общих игровых механик, которые используются несколькими типами UPDL узлов. Эти компоненты следуют принципу DRY (Don't Repeat Yourself) и обеспечивают единый источник истины для основной функциональности.

### Доступные компоненты

-   **Система инвентаря**: Управление ресурсами и грузом для космических сущностей
-   **Системы корабля**: Полная функциональность корабля включая движение, камеру и лазерную добычу
-   **Будущие компоненты**: Заполнитель для дополнительных общих систем

## Система инвентаря

Система инвентаря обеспечивает комплексные возможности управления ресурсами для геймплея космической MMO, поддерживая механики майнинга, торговли, крафтинга и управления грузом.

### Назначение

Система инвентаря служит основой для ресурсного геймплея в шаблоне MMOOMM:

-   **Операции майнинга**: Хранение ресурсов, собранных при добыче астероидов
-   **Торговые механики**: Управление грузом для торговли на станциях
-   **Системы крафтинга**: Обработка материалов для производства предметов
-   **Квестовые системы**: Отслеживание квестовых предметов и доставок
-   **Управление топливом**: Мониторинг расходуемых ресурсов

### Архитектура

Система инвентаря использует подход общего шаблона с настраиваемыми опциями для поддержки различных случаев использования:

```typescript
// Основной интерфейс
interface InventorySystem {
    maxCapacity: number // Максимальная вместимость хранилища (м³)
    currentLoad: number // Текущая загрузка груза (м³)
    items: Record<string, number> // Тип предмета → количество
    addItem(itemType: string, amount: number): boolean
    removeItem(itemType: string, amount: number): boolean
    getCapacityInfo(): CapacityInfo
    getItemList?(): ItemInfo[] // Опционально для интеграции с HUD
}
```

### Справочник API

#### `createInventorySystem(maxCapacity, currentLoad, includeItemList)`

Создает объект системы инвентаря для прямого использования в JavaScript.

**Параметры:**

-   `maxCapacity: number` - Максимальная вместимость груза в кубических метрах (по умолчанию: 20)
-   `currentLoad: number` - Начальная загрузка груза в кубических метрах (по умолчанию: 0)
-   `includeItemList: boolean` - Включать ли метод getItemList для интеграции с HUD (по умолчанию: false)

**Возвращает:** `InventorySystem` - Настроенный объект инвентаря

**Пример:**

```typescript
const shipInventory = createInventorySystem(50, 0, true)
shipInventory.addItem('asteroidMass', 1.5)
```

#### `generateInventoryCode(maxCapacity, currentLoad, includeItemList, includeLogging, includeEvents)`

Генерирует строку JavaScript кода для интеграции системы инвентаря в шаблоны.

**Параметры:**

-   `maxCapacity: number` - Максимальная вместимость груза в кубических метрах (по умолчанию: 20)
-   `currentLoad: number` - Начальная загрузка груза в кубических метрах (по умолчанию: 0)
-   `includeItemList: boolean` - Включить метод getItemList (по умолчанию: false)
-   `includeLogging: boolean` - Включить логирование в консоль для операций (по умолчанию: false)
-   `includeEvents: boolean` - Включить события app.fire для обновления UI (по умолчанию: false)

**Возвращает:** `string` - JavaScript код для объекта инвентаря

**Пример:**

```typescript
const code = generateInventoryCode(20, 0, true, true, true)
// Генерирует полнофункциональный инвентарь с логированием и событиями
```

### Паттерны интеграции

#### Поток UPDL компонента

Когда обрабатывается UPDL узел компонента с типом "inventory":

```
UPDL Component Node (inventory)
  ↓
EntityHandler.processEntity()
  ↓
componentHandler.attach(component, 'entity')
  ↓
attachments/inventory.ts
  ↓
generateInventoryCode() → entity.inventory = { ... }
```

#### Использование автономного компонента

Для независимой обработки компонентов:

```
ComponentHandler.process()
  ↓
components/inventory.ts
  ↓
generateInventoryCode() → const inventoryComponent = { ... }
```

#### Интеграция с сущностью корабля

Прямая интеграция в типы сущностей:

```typescript
// В ship.ts
entity.inventory = createInventorySystem(20, 0, true)
```

### Примеры использования

#### Базовое присоединение (attachments/inventory.ts)

```typescript
import { generateInventoryCode } from '../../shared/inventoryTemplate'

export default function inventoryAttachment(component: any, entityVar: string): string {
    const maxCapacity = component.data?.maxCapacity || 20
    const currentLoad = component.data?.currentLoad || 0

    return `
    // Attach inventory component ${component.id}
    ${entityVar}.inventory = ${generateInventoryCode(maxCapacity, currentLoad, false)};
    `
}
```

#### Полнофункциональный компонент (components/inventory.ts)

```typescript
import { generateInventoryCode } from '../../shared/inventoryTemplate'

export default function inventory(id: string, props: any): string {
    const maxCapacity = props.maxCapacity || 20
    const currentLoad = props.currentLoad || 0

    return `
    // Inventory component for space ships
    const inventoryComponent = ${generateInventoryCode(maxCapacity, currentLoad, true, true, true)};
    
    console.log('[MMO Component] Inventory component ${id} ready');
    `
}
```

#### Интеграция с сущностью корабля (ship.ts)

```typescript
// Ship inventory system
entity.inventory = {
    maxCapacity: 20, // м³
    currentLoad: 0,
    items: {}
    // ... методы из общего шаблона
}
```

### Интеграция с игровыми механиками

#### Интеграция с системой майнинга

```javascript
// Лазерный майнинг добавляет ресурсы в инвентарь
if (entity.inventory.addItem('asteroidMass', resourceAmount)) {
    console.log('[LaserSystem] Collected ' + resourceAmount + ' asteroidMass')

    // Обновить HUD если доступен
    if (window.SpaceHUD) {
        window.SpaceHUD.updateShipStatus(entity)
    }
}
```

#### Интеграция с торговой системой

```javascript
// Торговля на станции удаляет предметы и добавляет валюту
if (ship.inventory.removeItem('asteroidMass', amount)) {
    playerData.inmo += amount * pricePerTon
    console.log('[Trading] Sold ' + amount + ' asteroidMass for ' + amount * pricePerTon + ' Inmo')
}
```

#### Интеграция с HUD

```javascript
// Отображение статуса груза в UI
const cargo = ship.inventory?.getCapacityInfo() || { current: 0, max: 20 }
document.getElementById('ship-cargo').textContent = cargo.current.toFixed(1) + '/' + cargo.max + ' м³'
```

### Расширение системы

#### Добавление новых типов предметов

Система поддерживает любой тип предмета на основе строк:

```javascript
inventory.addItem('crystals', 5)
inventory.addItem('fuel', 10.5)
inventory.addItem('laserCannon', 1)
inventory.addItem('questItem_dataCore', 1)
```

#### Пользовательская логика вместимости

Переопределение проверки вместимости для специальных предметов:

```javascript
// Пример: Квестовые предметы не учитываются в вместимости
addItem(itemType, amount) {
    if (itemType.startsWith('quest_')) {
        this.items[itemType] = (this.items[itemType] || 0) + amount;
        return true;
    }
    // Стандартная логика вместимости
    if (this.currentLoad + amount <= this.maxCapacity) {
        // ... стандартная реализация
    }
}
```

#### Интеграция событий

Система поддерживает события PlayCanvas app для обновления UI:

```javascript
// Автоматически срабатывает при includeEvents: true
app.fire('cargo:changed', this.currentLoad, this.maxCapacity)

// Прослушивание событий в UI компонентах
app.on('cargo:changed', (current, max) => {
    updateCargoDisplay(current, max)
})
```

### Устранение неполадок

#### Распространенные проблемы

**Инвентарь не найден на сущности:**

-   Убедитесь, что UPDL компонент с типом "inventory" подключен к Entity
-   Проверьте, что attachments/inventory.ts правильно импортирован в ComponentHandler

**Ошибки превышения вместимости:**

-   Проверьте, что maxCapacity правильно установлен в данных UPDL компонента
-   Убедитесь, что система майнинга соблюдает ограничения вместимости

**HUD не обновляется:**

-   Убедитесь, что includeItemList: true для сущностей, которым нужна интеграция с HUD
-   Проверьте, что SpaceHUD доступен в глобальной области видимости

**События не срабатывают:**

-   Установите includeEvents: true в вызовах generateInventoryCode
-   Убедитесь, что PlayCanvas app доступен в глобальной области видимости

#### Отладочная информация

Включите логирование, установив includeLogging: true:

```javascript
// Будет выводить подробные логи операций
[Inventory] Added 1.5 asteroidMass - Load: 1.5/20
[Inventory] Cannot add 25 asteroidMass - Insufficient space
[Inventory] Removed 1.5 asteroidMass - Load: 0/20
```

## Системы корабля

Системы корабля обеспечивают комплексную функциональность космического корабля для шаблона MMOOMM, включая управление движением, следование камеры и возможности лазерной добычи.

### Назначение

Системы корабля служат основой для геймплея космического корабля в шаблоне MMOOMM:

-   **Управление движением**: Физическое и резервное движение с кватернионным вращением
-   **Следование камеры**: Плавное отслеживание камеры с учетом вращения
-   **Лазерная добыча**: Промышленная лазерная добыча с машиной состояний и автонаведением
-   **Модульный дизайн**: Каждая система может использоваться независимо или вместе

### Архитектура

Системы корабля используют модульный подход с тремя основными компонентами в `shipSystems/`:

#### Шаблон контроллера корабля

-   **Файл**: `shipControllerTemplate.ts`
-   **Назначение**: Управление движением и вращением с физическим резервом
-   **Ключевые особенности**: Управление WASD+QZ, кватернионное вращение, предотвращение блокировки карданного подвеса

#### Шаблон контроллера камеры

-   **Файл**: `cameraControllerTemplate.ts`
-   **Назначение**: Плавное следование камеры с отслеживанием вращения корабля
-   **Ключевые особенности**: Жесткое крепление, плавная интерполяция, защита от NaN

#### Шаблон лазерной добычи

-   **Файл**: `laserMiningTemplate.ts`
-   **Назначение**: Промышленная лазерная добыча с машиной состояний
-   **Ключевые особенности**: Автонаведение, 3-секундные циклы, интеграция с инвентарем

### Пример использования

```typescript
import { generateShipControllerCode } from '../../shared/shipSystems/shipControllerTemplate';
import { generateCameraControllerCode } from '../../shared/shipSystems/cameraControllerTemplate';
import { generateLaserMiningCode } from '../../shared/shipSystems/laserMiningTemplate';

// Полная сущность корабля со всеми системами
entity.shipController = ${generateShipControllerCode(10, 60, 500, false, true)};
entity.cameraController = ${generateCameraControllerCode(15, 4.0, false, true)};
entity.laserSystem = ${generateLaserMiningCode(75, 3000, 1.5, false, true)};
```

### Преимущества

-   **Сокращение кода**: Ship.ts сокращен с 894 строк до 84 строк (сокращение на 90.6%)
-   **Поддерживаемость**: Единый источник истины для каждой системы корабля
-   **Переиспользуемость**: Системы могут использоваться в разных типах сущностей
-   **Консистентность**: Стандартизированные интерфейсы и поведение

## Будущие общие компоненты

Эта директория предназначена для размещения дополнительных общих компонентов по мере развития шаблона MMOOMM:

-   **Оружейные системы**: Общие механики лазеров и снарядов
-   **Физические утилиты**: Общие физические расчеты и ограничения
-   **Сетевые компоненты**: Помощники синхронизации мультиплеера
-   **UI компоненты**: Переиспользуемые элементы интерфейса

Каждый новый общий компонент должен следовать тому же паттерну:

1. Определение TypeScript интерфейса
2. Фабричная функция для runtime объектов
3. Функция генерации кода для шаблонов
4. Комплексная документация с примерами
