# `packages/updl` — UPDL Frontend — [Статус: MVP]

Frontend модуль с определениями нод для создания универсальных 3D/AR/VR пространств.

## Назначение

Предоставляет набор определений специализированных нод для редактора Flowise, позволяющих создавать высокоуровневые описания 3D-пространств.

## Ключевые возможности

- **7 основных нод**: Space, Entity, Component, Event, Action, Data, Universo
- **Интеграция с Flowise**: Через механизм NodesPool
- **Поддержка технологий**: AR.js, PlayCanvas и других через систему публикации
- **Интернационализация**: Полная i18n поддержка (EN/RU)
- **TypeScript-first**: Полная типизация интерфейсов
- **Чистая архитектура**: Только определения нод, без логики экспорта

## Структура нод

### Основные типы UPDL нод

| Нода | Назначение | Ключевые поля |
|------|------------|---------------|
| **Space** | Контейнеры сцен/экранов | id, type (root/module/block), settings |
| **Entity** | Позиционированный объект/актор | transform, tags |
| **Component** | Добавляет данные/поведение к Entity | type, props |
| **Event** | Триггер (OnStart, OnClick, OnTimer) | eventType, source |
| **Action** | Исполнитель (Move, PlaySound, SetData) | actionType, target, params |
| **Data** | Хранилище значений (Local/Space/Global) | key, scope, value |
| **Universo** | Шлюз в глобальную сеть Kiberplano | transports, discovery, security |

### Цепочка взаимодействия

Типичная сцена: **Entity** содержит **Component** для визуала/поведения → **Event** триггерит **Action** при условиях → Логика определена через `Entity → Component → Event → Action`.

## Примеры использования

### Создание простой сцены

```javascript
// Пример UPDL структуры
{
  "Space": {
    "id": "main-scene",
    "type": "root",
    "entities": [
      {
        "Entity": {
          "id": "player",
          "transform": { "position": [0, 1.6, 0] },
          "components": [
            { "Component": { "type": "camera" } },
            { "Component": { "type": "movement" } }
          ]
        }
      }
    ]
  }
}
```

### Определение события и действия

```javascript
{
  "Event": {
    "eventType": "OnClick",
    "source": "button-entity",
    "actions": [
      {
        "Action": {
          "actionType": "PlaySound",
          "target": "audio-entity",
          "params": { "sound": "click.wav" }
        }
      }
    ]
  }
}
```

## Архитектура коннекторов

### Правила подключения нод

1. **Входные коннекторы**: Определяются в массиве `inputs` родительской ноды. Значение `type` должно совпадать с `name` дочерней ноды.

```typescript
this.inputs = [
    {
        label: 'Entity',
        name: 'entity',
        type: 'UPDLEntity', // Совпадает с name дочерней ноды
        list: true
    }
];
```

2. **Выходные коннекторы**: Для стандартного выходного коннектора оставьте массив `outputs` пустым — Flowise сгенерирует его автоматически.

```typescript
this.outputs = []; // Автоматический выходной коннектор
```

3. **Терминальные ноды**: Для нод без подключений (например, `ActionNode`) оба массива пустые.

```typescript
this.inputs = [];
this.outputs = [];
```

## Сборка и тестирование

### Процесс сборки

1. **Компиляция TypeScript**: `.ts` → `.js`
2. **Gulp задачи**: Копирование статических ресурсов (SVG иконки) в `dist/`

### Доступные команды

```bash
pnpm clean                    # Очистка dist/
pnpm build --filter updl      # Полная сборка
pnpm --filter updl dev        # Режим разработки с watch
pnpm --filter updl lint       # Проверка кода
pnpm --filter updl test       # Запуск Vitest тестов
```

### Тестирование

Vitest-тесты валидируют:
- Порты нод Flowise
- Флаги lead-collection
- Соответствие коннекторов документации

## Технологии

- **TypeScript**: Полная типизация
- **Flowise API**: Определения нод
- **i18next**: Интернационализация
- **Vitest**: Unit-тестирование
- **Gulp**: Копирование ресурсов

## Интеграция

### Загрузка в Flowise

UPDL интегрируется через механизм `NodesPool` из директории `dist/nodes`:

```javascript
// Flowise автоматически загружает ноды из:
packages/updl/dist/nodes/
```

### Система публикации

Логика экспорта пространств обрабатывается отдельно:
- **Сборщики пространств**: `publish-frt`, `space-builder-frt`
- **Экспорт в технологии**: AR.js, PlayCanvas через publish систему
- **API клиенты**: Не требуются для определений нод

## Фокус модуля

Этот модуль **намеренно сосредоточен только на определениях нод**:

- ✅ Определения UPDL нод
- ✅ Интерфейсы TypeScript
- ✅ i18n переводы
- ✅ Статические ресурсы (иконки)
- ❌ Логика сборки пространств
- ❌ Логика экспорта в технологии
- ❌ API клиенты
- ❌ Управление состоянием

Это разделение обеспечивает оптимальную архитектуру и поддерживаемость.

## См. также

- [Publish Frontend](../publish/frontend.md) - Система публикации
- [Space Builder](../space-builder/frontend.md) - AI генерация пространств
- [UPDL README](./README.md) - Общее описание системы
