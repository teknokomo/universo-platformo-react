# UPDLProcessor

UPDLProcessor — это основной утилитарный класс в `@universo-platformo/utils`, который конвертирует сырые данные потоков из Flowise в структурированные представления UPDL (Universal Platform Definition Language).

## Обзор

UPDLProcessor служит мостом между основанными на графах данными потоков Flowise и структурированным форматом UPDL, используемым билдерами шаблонов. Он обрабатывает как одиночные пространства, так и мультисценные потоки, предоставляя согласованный интерфейс для всех систем шаблонов.

## Архитектура

### Конвейер обработки

```
Сырые данные потока (JSON) → UPDLProcessor → Структура UPDL → Билдеры шаблонов
```

Процессор следует этому конвейеру:

1. **Парсинг данных потока**: Конвертация JSON строки в структуру узлов/рёбер
2. **Анализ структуры**: Обнаружение паттернов одиночного пространства vs мультисцены
3. **Построение UPDL**: Создание соответствующего представления UPDL
4. **Возврат результата**: Предоставление структурированных данных билдерам шаблонов

### Обнаружение мультисцен

Процессор автоматически обнаруживает мультисценные структуры, анализируя соединения узлов Space:

- **Одиночное пространство**: Один узел Space или несколько несоединённых Spaces
- **Мультисцена**: Несколько узлов Space, соединённых в цепочку

## Справочник API

### Основные методы

#### `processFlowData(flowDataString: string)`

Обрабатывает сырые данные потока и возвращает структурированное представление UPDL.

**Параметры**:
- `flowDataString`: JSON строка, содержащая данные потока Flowise

**Возвращает**:
```typescript
{
  updlSpace?: IUPDLSpace,      // Для потоков одиночного пространства
  multiScene?: IUPDLMultiScene  // Для мультисценных потоков
}
```

**Пример**:
```typescript
import { UPDLProcessor } from '@universo-platformo/utils'

const result = UPDLProcessor.processFlowData(flowDataString)

if (result.multiScene) {
  // Обработка мультисценного потока
  console.log(`Найдено ${result.multiScene.totalScenes} сцен`)
} else if (result.updlSpace) {
  // Обработка потока одиночного пространства
  console.log(`Найдено ${result.updlSpace.entities.length} сущностей`)
}
```

### Вспомогательные методы

#### `analyzeSpaceChain(nodes, edges)`

Анализирует соединения узлов Space для построения мультисценной структуры.

#### `getConnectedNodes(spaceId, nodes, edges)`

Получает все узлы, соединённые с конкретным узлом Space.

#### `buildUPDLSpaceFromNodes(nodes, edges)`

Строит одиночное пространство UPDL из данных узлов/рёбер.

## Структуры данных

### Структура одиночного пространства

```typescript
interface IUPDLSpace {
  id: string
  name: string
  entities: IUPDLEntity[]
  objects: IUPDLObject[]
  components: IUPDLComponent[]
  events: IUPDLEvent[]
  actions: IUPDLAction[]
  datas: IUPDLData[]
}
```

### Мультисценная структура

```typescript
interface IUPDLMultiScene {
  totalScenes: number
  scenes: IUPDLScene[]
}

interface IUPDLScene {
  spaceId: string
  spaceData: IUPDLSpace
  dataNodes: IUPDLData[]
  objectNodes: IUPDLObject[]
  isLast: boolean
  order: number
}
```

## Паттерны использования

### Интеграция с билдером шаблонов

Билдеры шаблонов используют UPDLProcessor для конвертации данных потоков:

```typescript
class MyTemplateBuilder {
  async buildFromFlowData(flowDataString: string) {
    // Обработка данных потока
    const result = UPDLProcessor.processFlowData(flowDataString)
    
    // Создание структуры данных потока
    const flowData: IFlowData = {
      flowData: flowDataString,
      updlSpace: result.updlSpace,
      multiScene: result.multiScene
    }
    
    // Сборка шаблона
    return this.build(flowData)
  }
}
```

### Обработка мультисцен

Для мультисценных потоков итерируйте по сценам:

```typescript
if (result.multiScene) {
  result.multiScene.scenes.forEach((scene, index) => {
    console.log(`Сцена ${index}: ${scene.spaceId}`)
    console.log(`Сущности: ${scene.spaceData.entities.length}`)
    console.log(`Узлы данных: ${scene.dataNodes.length}`)
  })
}
```

## Обработка типов узлов

### Обработка сущностей

Сущности конвертируются из узлов Entity Flowise:

```typescript
// Вход: узел Entity Flowise
{
  id: "Entity_0",
  data: {
    name: "Entity",
    inputs: {
      entityType: "ship",
      transform: { position: { x: 0, y: 2, z: 0 } }
    }
  }
}

// Выход: сущность UPDL
{
  id: "Entity_0",
  data: {
    entityType: "ship",
    transform: { position: { x: 0, y: 2, z: 0 } }
  }
}
```

### Обработка компонентов

Компоненты прикрепляются к сущностям через отношения рёбер:

```typescript
// Ребро: Component_0 → Entity_0
// Результат: Component_0 прикреплён к Entity_0
```

### Обработка данных

Узлы данных обрабатываются отдельно и группируются по сценам:

```typescript
// Пример данных квиза
{
  id: "Data_0",
  dataType: "question",
  content: "Какая столица Франции?",
  isCorrect: false
}
```

## Обработка отношений рёбер

Процессор поддерживает отношения рёбер между узлами:

### Отношения сущность-компонент

```typescript
// Ребро: Component → Entity
// Результат: компонент прикреплён к сущности
entity.components.push(component)
```

### Отношения событие-действие

```typescript
// Ребро: Action → Event
// Результат: действие прикреплено к событию
event.actions.push(action)
```

### Отношения пространство-узел

```typescript
// Ребро: Node → Space
// Результат: узел принадлежит пространству
space.entities.push(entity)
```

## Обработка ошибок

Процессор включает надёжную обработку ошибок:

```typescript
try {
  const result = UPDLProcessor.processFlowData(flowDataString)
  // Обработка результата
} catch (error) {
  console.error('Ошибка UPDLProcessor:', error)
  // Соответствующая обработка ошибки
}
```

## Соображения производительности

### Большие потоки

Для больших потоков с множеством узлов:

- Обработка оптимизирована для сложности O(n)
- Использование памяти масштабируется линейно с количеством узлов
- Обработка рёбер использует эффективные структуры Map

### Кэширование

Рассмотрите кэширование обработанных результатов для повторного использования:

```typescript
const cache = new Map<string, any>()

function getCachedResult(flowDataString: string) {
  const hash = hashString(flowDataString)
  if (cache.has(hash)) {
    return cache.get(hash)
  }
  
  const result = UPDLProcessor.processFlowData(flowDataString)
  cache.set(hash, result)
  return result
}
```

## Руководство по миграции

### С локальных реализаций

При миграции с локальных реализаций UPDLProcessor:

1. **Обновите импорты**:
   ```typescript
   // До
   import { UPDLProcessor } from './common/UPDLProcessor'
   
   // После
   import { UPDLProcessor } from '@universo-platformo/utils'
   ```

2. **Обновите типы**:
   ```typescript
   // До
   import { IUPDLSpace } from './types'
   
   // После
   import { IUPDLSpace } from '@universo-platformo/types'
   ```

3. **Удалите локальные файлы**: Удалите локальные реализации UPDLProcessor

### Совместимость API

Централизованный UPDLProcessor поддерживает совместимость API с предыдущими реализациями, обеспечивая плавную миграцию.

## Лучшие практики

### Валидация входных данных

Всегда валидируйте данные потока перед обработкой:

```typescript
if (!flowDataString || typeof flowDataString !== 'string') {
  throw new Error('Неверные данные потока')
}
```

### Проверка результата

Проверяйте структуру результата перед использованием:

```typescript
const result = UPDLProcessor.processFlowData(flowDataString)

if (!result.updlSpace && !result.multiScene) {
  throw new Error('Не найдена валидная структура UPDL')
}
```

### Восстановление после ошибок

Реализуйте изящное восстановление после ошибок:

```typescript
try {
  return UPDLProcessor.processFlowData(flowDataString)
} catch (error) {
  console.warn('UPDLProcessor не удался, используется резервный вариант')
  return createFallbackStructure()
}
```
