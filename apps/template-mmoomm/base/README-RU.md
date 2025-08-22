# @universo/template-mmoomm

Система шаблонов MMOOMM для генерации PlayCanvas приложений с поддержкой одиночного и многопользовательского режимов.

## Возможности

- **Поддержка двух режимов**: Одиночный и многопользовательский (Colyseus) режимы игры
- **Интеграция с UPDL**: Обработка данных UPDL потоков в игровые объекты
- **Модульная архитектура**: Отдельные билдеры для разных режимов игры
- **Поддержка TypeScript**: Полная типобезопасность с dual build (CommonJS + ESM)
- **Интеграция с PlayCanvas**: Генерация полных PlayCanvas приложений

## Установка

```bash
pnpm add @universo/template-mmoomm
```

## Использование

### Базовое использование

```typescript
import { PlayCanvasMMOOMMBuilder } from '@universo/template-mmoomm'

const builder = new PlayCanvasMMOOMMBuilder()
const html = await builder.build(flowData, {
  gameMode: 'singleplayer'
})
```

### Многопользовательский режим

```typescript
import { PlayCanvasMMOOMMBuilder } from '@universo/template-mmoomm'

const builder = new PlayCanvasMMOOMMBuilder()
const html = await builder.build(flowData, {
  gameMode: 'multiplayer',
  multiplayer: {
    serverHost: 'localhost',
    serverPort: 2567,
    roomName: 'game_room'
  }
})
```

## Справочник API

### PlayCanvasMMOOMMBuilder

Основной класс билдера, который делегирует задачи соответствующим билдерам для конкретных режимов.

#### Методы

- `build(flowData: IFlowData, options: BuildOptions): Promise<string>`
- `canHandle(flowData: IFlowData): boolean`
- `getTemplateInfo(): TemplateConfig`

### BuildOptions

Опции конфигурации для сборки шаблонов.

```typescript
interface BuildOptions {
  gameMode?: 'singleplayer' | 'multiplayer'
  multiplayer?: {
    serverHost?: string
    serverPort?: number
    roomName?: string
  }
}
```

## Архитектура

Пакет структурирован для поддержки множественных 3D технологий:

```
src/
├── playcanvas/          # PlayCanvas-специфичная реализация
│   ├── builders/        # Билдеры для конкретных режимов
│   ├── handlers/        # Обработчики UPDL
│   ├── generators/      # Генераторы HTML/Script
│   └── multiplayer/     # Интеграция с Colyseus
├── common/              # Общие утилиты и типы
└── index.ts             # Основные экспорты
```

## Разработка

### Сборка

```bash
pnpm build              # Сборка всех форматов (CJS, ESM, Types)
pnpm build:cjs          # Сборка только CommonJS
pnpm build:esm          # Сборка только ES Modules
pnpm build:types        # Сборка только TypeScript деклараций
```

### Режим разработки

```bash
pnpm dev                # Режим наблюдения для разработки
```

## Лицензия

MIT