# Система компонентов

Система компонентов в шаблонах MMOOMM обеспечивает модульный подход к функциональности сущностей. Компоненты могут быть прикреплены к сущностям через интерфейс Chatflow и обрабатываются через полный конвейер данных для обеспечения правильного применения конфигурации.

## Обзор

Система компонентов обрабатывает данные компонентов через структурированный конвейер:

1. **Интерфейс Chatflow** - Пользователь настраивает свойства компонентов
2. **UPDLProcessor** - Обрабатывает и проверяет данные компонентов
3. **ComponentHandler** - Генерирует код компонентов
4. **Интеграция с сущностями** - Компоненты прикрепляются к сущностям без конфликтов

## Типы компонентов

### Торговый компонент

Обеспечивает функциональность торговли между сущностями с настраиваемой дальностью взаимодействия.

**Свойства:**
- `interactionRange`: Расстояние для торговых взаимодействий (по умолчанию: 15 единиц)
- `pricePerTon`: Стоимость за тонну ресурсов (по умолчанию: 10 кредитов)
- `acceptedResources`: Массив принимаемых типов ресурсов

**Пример конфигурации:**
```json
{
  "componentType": "trading",
  "interactionRange": 1600,
  "pricePerTon": 25,
  "acceptedResources": ["asteroidMass", "platinum", "gold"]
}
```

### Компонент добычи

Позволяет добывать ресурсы из сущностей с настраиваемыми свойствами.

**Свойства:**
- `resourceType`: Тип добываемого ресурса (по умолчанию: "asteroidMass")
- `maxYield`: Максимальная добыча ресурса (рассчитывается из масштаба сущности)
- `hardness`: Фактор сложности добычи (по умолчанию: 1)
- `asteroidVolume`: Физический объем для расчетов плотности

### Компонент рендеринга

Управляет визуальным внешним видом и рендерингом модели.

**Свойства:**
- `modelType`: Тип 3D модели ("sphere", "box", "cylinder")
- `material`: Свойства материала (цвет, текстура, блеск)
- `visible`: Состояние видимости (по умолчанию: true)

### Компонент оружия

Обеспечивает боевые возможности и возможности добычи.

**Свойства:**
- `weaponType`: Тип оружия ("laser", "projectile")
- `damage`: Урон за попадание (по умолчанию: 1)
- `range`: Максимальная эффективная дальность
- `cooldownTime`: Время между выстрелами (по умолчанию: 2000мс)

## Конвейер обработки данных

### 1. Конфигурация Chatflow

Пользователи настраивают свойства компонентов в интерфейсе Chatflow:

```json
{
  "componentType": "trading",
  "interactionRange": 1600,
  "pricePerTon": 25
}
```

### 2. Обработка UPDLProcessor

UPDLProcessor передает все поля ComponentNode в структуру данных компонента:

```typescript
// ИСПРАВЛЕНО: Включить все поля ComponentNode в component.data
const component = {
  id: node.id,
  data: {
    componentType: inputs.componentType,
    // Все специфичные для компонента поля включены
    interactionRange: Number(inputs.interactionRange) || 15,
    pricePerTon: Number(inputs.pricePerTon) || 10,
    // ... другие поля
  }
}
```

### 3. Обработка ComponentHandler

ComponentHandler использует правильный источник данных для генерации компонентов:

```typescript
// ИСПРАВЛЕНО: Использовать component.data вместо component.data?.properties
const componentData = component.data || {}
const componentType = componentData.componentType

// Генерировать код компонента с правильным доступом к данным
return this.generateComponentCode(componentType, componentData)
```

### 4. Интеграция с сущностями

Компоненты прикрепляются к сущностям перед логикой типа сущности для предотвращения конфликтов:

```typescript
// Прикрепленные компоненты (выполняются первыми для разрешения переопределений UPDL)
${components.map((c: any) => this.componentHandler.attach(c, 'entity')).join('\n')}

// Специфичная настройка типа сущности (выполняется после компонентов)
${this.generateEntityTypeLogic(entityType, entityId)}
```

## Примеры конфигурации компонентов

### Торговая станция с большой дальностью

```json
{
  "entityType": "station",
  "components": [
    {
      "componentType": "trading",
      "interactionRange": 1600,
      "pricePerTon": 15,
      "acceptedResources": ["asteroidMass", "platinum"]
    },
    {
      "componentType": "render",
      "modelType": "box",
      "material": {
        "color": [0.2, 0.8, 0.2],
        "emissive": [0.1, 0.4, 0.1]
      }
    }
  ]
}
```

### Большой добываемый астероид

```json
{
  "entityType": "asteroid",
  "transform": {
    "scale": [4, 4, 4]
  },
  "components": [
    {
      "componentType": "mineable",
      "resourceType": "platinum",
      "hardness": 3,
      "asteroidVolume": 64
    }
  ]
}
```

### Боевой корабль

```json
{
  "entityType": "ship",
  "components": [
    {
      "componentType": "weapon",
      "weaponType": "laser",
      "damage": 2,
      "range": 100,
      "cooldownTime": 1500
    },
    {
      "componentType": "inventory",
      "maxWeight": 1000,
      "maxVolume": 50
    }
  ]
}
```

## Система приоритетов компонентов

### Порядок выполнения

1. **Прикрепление компонентов** - Компоненты прикрепляются первыми
2. **Логика типа сущности** - Логика типа сущности выполняется после компонентов
3. **Предотвращение переопределения** - Типы сущностей проверяют существующие настройки компонентов

### Пример предотвращения переопределения

```typescript
// Тип сущности станция соблюдает настройки торгового компонента
if (!entity.tradingPost) {
  // Создавать торговый пост по умолчанию только если нет торгового компонента
  entity.tradingPost = {
    interactionRange: 15, // Значение по умолчанию
    // ... другие значения по умолчанию
  }
}
```

## Лучшие практики

### Конфигурация компонентов

1. **Явные значения**: Всегда указывайте свойства компонентов явно
2. **Разумные дальности**: Используйте подходящие дальности взаимодействия для игрового баланса
3. **Типы ресурсов**: Убедитесь, что типы ресурсов соответствуют доступным материалам
4. **Производительность**: Учитывайте влияние на производительность больших дальностей взаимодействия

### Проверка данных

1. **Проверка типов**: Убедитесь, что числовые значения правильно преобразованы
2. **Резервные значения по умолчанию**: Предоставьте разумные значения по умолчанию для отсутствующих свойств
3. **Ограничения дальности**: Проверьте, что дальности находятся в разумных пределах

### Рекомендации по интеграции

1. **Компоненты первыми**: Настраивайте компоненты перед логикой типа сущности
2. **Избежание конфликтов**: Предотвращайте переопределение настроек компонентов типами сущностей
3. **Согласованное именование**: Используйте согласованные имена свойств в компонентах

## Устранение неполадок

### Распространенные проблемы

**Свойства компонентов не применяются**
- Проверьте, что UPDLProcessor передает все поля ComponentNode
- Убедитесь, что ComponentHandler использует правильный источник данных (`component.data`)
- Проверьте, что логика типа сущности не переопределяет настройки компонентов

**Дальность взаимодействия не работает**
- Подтвердите числовое преобразование в UPDLProcessor
- Проверьте, что ComponentHandler правильно обрабатывает дальность
- Убедитесь, что тип сущности соблюдает конфигурацию компонента

**Конфликты компонентов**
- Проверьте порядок выполнения (компоненты перед типами сущностей)
- Реализуйте предотвращение переопределения в логике типа сущности
- Используйте условную логику для проверки существующих компонентов

### Отладочная информация

Включите отладку компонентов:

```typescript
console.log('[Component] Processing:', {
  componentType,
  componentData,
  entityId
});
```

## Техническая реализация

### Расположение файлов

- **UPDLProcessor**: `src/builders/common/UPDLProcessor.ts`
- **ComponentHandler**: `src/builders/templates/mmoomm/playcanvas/handlers/ComponentHandler/index.ts`
- **Типы компонентов**: `src/builders/templates/mmoomm/playcanvas/handlers/ComponentHandler/componentTypes/`

### Ключевые функции

- `UPDLProcessor.processComponentNodes()` - Обработка данных компонентов
- `ComponentHandler.attach()` - Генерация кода компонентов
- `generateComponentCode()` - Логика компонентов для конкретных типов

## Связанные системы

- [Система Transform для сущностей](entity-transform-system.md) - Позиционирование и масштабирование сущностей
- [Торговая система](trading-system.md) - Реализация торгового компонента
- [Система ресурсов](resource-system.md) - Интеграция компонента добычи
