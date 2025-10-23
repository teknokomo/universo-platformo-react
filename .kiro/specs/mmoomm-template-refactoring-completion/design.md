# Design Document

## Overview

Данный документ описывает архитектурное решение для завершения рефакторинга MMOOMM шаблона в системе потоковой публикации PlayCanvas. Решение направлено на создание модульной архитектуры, исправление критических ошибок Colyseus API и обеспечение удобного пользовательского интерфейса для выбора режима игры.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Publish Frontend (UI)                        │
├─────────────────────────────────────────────────────────────────┤
│  PlayCanvas Publication Interface                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Technology    │  │   Game Mode     │  │   Settings      │ │
│  │   Selector      │  │   Selector      │  │   Panel         │ │
│  │   [PlayCanvas]  │  │ ○ Single Player │  │   Host: [____]  │ │
│  │                 │  │ ○ Multiplayer   │  │   Port: [____]  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                Template Engine (Builder)                        │
├─────────────────────────────────────────────────────────────────┤
│  PlayCanvasMMOOMMBuilderV2 (Lightweight Coordinator)           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Mode Detection & Delegation                    │ │
│  │  if (options.gameMode === 'multiplayer')                   │ │
│  │    → MultiplayerBuilder.build()                            │ │
│  │  else                                                       │ │
│  │    → SinglePlayerBuilder.build()                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              @universo/template-mmoomm Package                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ SinglePlayer    │  │ Multiplayer     │  │ Shared          │ │
│  │ Builder         │  │ Builder         │  │ Components      │ │
│  │                 │  │                 │  │                 │ │
│  │ • Standard      │  │ • Auth Screen   │  │ • HandlerMgr    │ │
│  │   PlayCanvas    │  │ • Colyseus      │  │ • UPDL Proc     │ │
│  │ • UPDL Objects  │  │   Integration   │  │ • HTML Gen      │ │
│  │ • Ship Controls │  │ • Sync Logic    │  │ • Script Gen    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Generated Output                             │
├─────────────────────────────────────────────────────────────────┤
│  Single Player HTML          │  Multiplayer HTML                │
│  ┌─────────────────────────┐  │  ┌─────────────────────────────┐ │
│  │ • PlayCanvas Engine     │  │  │ • PlayCanvas Engine         │ │
│  │ • Game Scene            │  │  │ • Colyseus Client           │ │
│  │ • Ship Controls         │  │  │ • Auth Screen               │ │
│  │ • UPDL Objects          │  │  │ • Game Scene + Sync         │ │
│  │ • No Network Code       │  │  │ • UPDL Objects              │ │
│  └─────────────────────────┘  │  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. UI Layer (Publish Frontend)
- **PlayCanvasPublicationSettings.jsx**: Новый компонент для настроек публикации
- **GameModeSelector**: Селектор режима игры (Single/Multiplayer)
- **ColyseusSettings**: Панель настроек сервера (хост, порт)

#### 2. Builder Layer (Template Engine)
- **PlayCanvasMMOOMMBuilder**: Легковесный координатор (< 100 строк, без версионности)
- **Mode Detection**: Определение режима на основе `BuildOptions`
- **Builder Delegation**: Делегирование к соответствующему билдеру

#### 3. Template Package (@universo/template-mmoomm)
- **SinglePlayerBuilder**: Обработка одиночного режима
- **MultiplayerBuilder**: Обработка многопользовательского режима
- **HandlerManager**: Переиспользование UPDL обработчиков
- **Shared Components**: Общие компоненты и утилиты

## Components and Interfaces

### Core Interfaces

```typescript
// Build Options Extension
interface BuildOptions {
  gameMode?: 'singleplayer' | 'multiplayer'
  multiplayer?: {
    serverHost?: string
    serverPort?: number
    roomName?: string
  }
  // ... existing options
}

// Handler Manager Interface
interface IHandlerManager {
  processForSinglePlayer(flowData: IFlowData): ProcessedGameData
  processForMultiplayer(flowData: IFlowData): MultiplayerGameData
}

// Builder Interface
interface ITemplateBuilder {
  build(flowData: IFlowData, options: BuildOptions): Promise<string>
  canHandle(flowData: IFlowData): boolean
  getTemplateInfo(): TemplateConfig
}
```

### UI Components

**Важно**: Наши приложения в `packages/` используют React с TypeScript (TSX), но основной фронт Flowise использует React с JavaScript (JSX). Для совместимости создаем JSX-файлы:

```typescript
// GameModeSelector.jsx (JSX для совместимости с Flowise)
interface GameModeSelectorProps {
  value: 'singleplayer' | 'multiplayer'
  onChange: (mode: 'singleplayer' | 'multiplayer') => void
  disabled?: boolean
}

// ColyseusSettings.jsx (JSX для совместимости с Flowise)
interface ColyseusSettingsProps {
  settings: {
    serverHost: string
    serverPort: number
    roomName: string
  }
  onChange: (settings: ColyseusSettingsProps['settings']) => void
  visible: boolean
}

// PlayCanvasPublicationSettings.jsx (основной компонент интеграции)
interface PlayCanvasPublicationSettingsProps {
  gameMode: 'singleplayer' | 'multiplayer'
  colyseusSettings: ColyseusSettings
  onGameModeChange: (mode: string) => void
  onColyseusSettingsChange: (settings: ColyseusSettings) => void
}
```

**Архитектурное решение**: Dual build (CommonJS + ESM) в пакетах `packages/` обеспечивает совместимость с основным Flowise UI, который ожидает JSX компоненты.

### Template Package Structure

```
@universo/template-mmoomm/
├── src/
│   ├── playcanvas/                     # PlayCanvas-специфичный функционал
│   │   ├── builders/
│   │   │   ├── SinglePlayerBuilder.ts      # SP режим
│   │   │   ├── MultiplayerBuilder.ts       # MP режим
│   │   │   └── PlayCanvasMMOOMMBuilder.ts  # Главный билдер
│   │   ├── handlers/
│   │   │   ├── HandlerManager.ts           # Менеджер обработчиков
│   │   │   ├── EntityHandler/              # Существующие обработчики
│   │   │   ├── ComponentHandler/
│   │   │   └── shared/                     # Общие утилиты
│   │   ├── generators/
│   │   │   ├── HTMLGenerator.ts            # Генерация HTML
│   │   │   ├── ScriptGenerator.ts          # Генерация JS
│   │   │   └── ColyseusGenerator.ts        # Colyseus интеграция
│   │   └── multiplayer/
│   │       ├── ColyseusClient.ts           # Браузерный клиент
│   │       ├── AuthScreen.ts               # Экран авторизации
│   │       └── NetworkManager.ts           # Сетевые утилиты
│   ├── common/                         # Общий функционал для всех технологий
│   │   ├── types.ts                    # Общие типы
│   │   └── utils.ts                    # Общие утилиты
│   └── index.ts                        # Главный экспорт (PlayCanvas по умолчанию)
```

**Примечание**: Структура подготовлена для будущего расширения на другие технологии (A-Frame, Babylon.js и т.д.) через добавление соответствующих папок `aframe/`, `babylonjs/` и т.д.

## Data Models

### Flow Data Processing

```typescript
// Processed Game Data (Single Player)
interface ProcessedGameData {
  entities: ComponentSnapshotMap[]
  spaces: SpaceData[]
  components: ComponentData[]
  actions: ActionData[]
  events: EventData[]
}

// Multiplayer Game Data (extends ProcessedGameData)
interface MultiplayerGameData extends ProcessedGameData {
  networkEntities: NetworkEntity[]
  playerSpawnPoint: Transform
  authScreenData: AuthScreenData
  serverConfig: ColyseusServerConfig
}

// Network Entity
interface NetworkEntity {
  id: EntityId
  type: 'ship' | 'station' | 'asteroid' | 'gate'
  transform: Transform
  visual: Visual
  networked: boolean
}

// Auth Screen Data
interface AuthScreenData {
  collectName: boolean
  title: string
  description: string
  placeholder: string
}
```

### Configuration Models

```typescript
// Colyseus Configuration
interface ColyseusServerConfig {
  host: string
  port: number
  roomName: string
  protocol: 'ws' | 'wss'
}

// Template Configuration
interface MMOOMMTemplateConfig extends TemplateConfig {
  supportedModes: ('singleplayer' | 'multiplayer')[]
  defaultMode: 'singleplayer' | 'multiplayer'
  colyseusVersion: string
  playcanvasVersion: string
}
```

## Error Handling

### Error Types and Recovery

```typescript
// Error Classification
enum MMOOMMErrorType {
  BUILD_ERROR = 'BUILD_ERROR',
  COLYSEUS_ERROR = 'COLYSEUS_ERROR',
  UPDL_PROCESSING_ERROR = 'UPDL_PROCESSING_ERROR',
  TEMPLATE_ERROR = 'TEMPLATE_ERROR'
}

// Error Handling Strategy
interface ErrorHandlingStrategy {
  // Graceful degradation for network errors
  handleColyseusError(error: Error): string // Returns fallback HTML
  
  // UPDL processing fallbacks
  handleUPDLError(error: Error): ProcessedGameData // Returns default data
  
  // Template generation fallbacks
  handleTemplateError(error: Error): string // Returns error scene
}
```

### Fallback Mechanisms

1. **Colyseus Connection Failure**: Отображение экрана ошибки с инструкциями
2. **UPDL Processing Error**: Использование объектов по умолчанию
3. **Template Generation Error**: Генерация минимальной сцены с сообщением об ошибке
4. **Build System Error**: Откат к предыдущей рабочей версии

## Testing Strategy

### Unit Testing

```typescript
// Builder Testing
describe('PlayCanvasMMOOMMBuilder', () => {
  it('should delegate to SinglePlayerBuilder for singleplayer mode')
  it('should delegate to MultiplayerBuilder for multiplayer mode')
  it('should handle invalid flow data gracefully')
  it('should preserve backward compatibility')
})

// Handler Manager Testing
describe('HandlerManager', () => {
  it('should process UPDL nodes consistently between SP/MP modes')
  it('should handle missing entities gracefully')
  it('should preserve entity transforms from UPDL')
})

// Colyseus Integration Testing
describe('ColyseusIntegration', () => {
  it('should generate correct client code for Colyseus 0.16.x')
  it('should handle connection failures gracefully')
  it('should sync player positions correctly')
})
```

### Integration Testing

```typescript
// End-to-End Testing
describe('MMOOMM Template E2E', () => {
  it('should build single player game from UPDL flow')
  it('should build multiplayer game with auth screen')
  it('should preserve all UPDL entities in generated game')
  it('should handle mode switching in UI')
})

// Performance Testing
describe('Performance', () => {
  it('should build templates within acceptable time limits')
  it('should generate HTML within size limits')
  it('should not leak memory during repeated builds')
})
```

### Browser Testing

```typescript
// Client-Side Testing
describe('Generated Game Client', () => {
  it('should load PlayCanvas engine successfully')
  it('should connect to Colyseus server (multiplayer mode)')
  it('should handle player input correctly')
  it('should display UPDL entities correctly')
  it('should work in major browsers (Chrome, Firefox, Safari, Edge)')
})
```

## Security Considerations

### Input Validation

1. **UPDL Flow Validation**: Проверка структуры и содержимого UPDL данных
2. **User Input Sanitization**: Очистка имен игроков и пользовательского ввода
3. **Server Configuration**: Валидация настроек Colyseus сервера
4. **XSS Prevention**: Экранирование всех пользовательских данных в HTML

### Network Security

1. **WebSocket Security**: Использование WSS в продакшене
2. **Rate Limiting**: Ограничение частоты подключений и сообщений
3. **Input Validation**: Проверка всех сообщений от клиентов
4. **Authentication**: Базовая аутентификация через имя игрока

### Code Security

```typescript
// Input Sanitization
function sanitizePlayerName(name: string): string {
  return name
    .trim()
    .slice(0, 32)
    .replace(/[<>\"'&]/g, '')
    .replace(/\s+/g, ' ')
}

// HTML Escaping
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Server URL Validation
function validateServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['ws:', 'wss:'].includes(parsed.protocol)
  } catch {
    return false
  }
}
```

## Performance Optimization

### Build Performance

1. **Lazy Loading**: Загрузка модулей по требованию
2. **Caching**: Кэширование результатов обработки UPDL
3. **Code Splitting**: Разделение кода на SP/MP части
4. **Tree Shaking**: Удаление неиспользуемого кода

### Runtime Performance

1. **Conditional Loading**: Загрузка только необходимых скриптов
2. **Asset Optimization**: Минификация и сжатие ресурсов
3. **Memory Management**: Правильная очистка ресурсов
4. **Network Optimization**: Оптимизация сетевого трафика

### Monitoring and Metrics

```typescript
// Performance Metrics
interface PerformanceMetrics {
  buildTime: number
  htmlSize: number
  scriptSize: number
  loadTime: number
  memoryUsage: number
}

// Monitoring Interface
interface IPerformanceMonitor {
  startBuild(): void
  endBuild(): PerformanceMetrics
  trackError(error: Error): void
  trackUsage(feature: string): void
}
```

## Migration Strategy

### Phase 1: Critical Fixes (Week 1)
1. Исправление ошибок сборки TypeScript
2. Обновление Colyseus API до 0.16.x
3. Переименование `packages/multiplayer-srv` → `packages/multiplayer-colyseus-srv`
4. Базовая функциональность template-mmoomm пакета

### Phase 2: UI Integration (Week 2)
1. Создание JSX компонентов выбора режима (совместимость с основным Flowise UI)
2. Интеграция в интерфейс публикации PlayCanvas
3. Сохранение настроек в главном ENV файле `packages/flowise-server/.env`

### Phase 3: Architecture Refactoring (Week 3)
1. Рефакторинг PlayCanvasMMOOMMBuilder (цель: <300 строк)
2. Создание HandlerManager с переиспользованием UPDL обработчиков
3. Полный перенос MMOOMM функционала в `packages/template-mmoomm/src/playcanvas/`

### Phase 4: Testing and Polish (Week 4)
1. Комплексное тестирование (важно: полная пересборка `pnpm build` в корне)
2. Исправление багов и оптимизация
3. Документация и примеры

**Важное замечание о сборке**: В данном монорепозитории при сборке отдельного приложения `pnpm build --filter app-name` можно только проверить основные ошибки. Полные изменения, внесенные в отдельное приложение/пакет, применятся только после полной пересборки проекта `pnpm build`, выполненной в корне проекта.

### Backward Compatibility Plan

```typescript
// Legacy Support Interface
interface ILegacySupport {
  // Поддержка старых BuildOptions
  migrateBuildOptions(oldOptions: any): BuildOptions
  
  // Поддержка старых методов
  generateHTML(content: any, options?: any): string
  
  // Предупреждения о deprecated методах
  warnDeprecated(method: string): void
}
```

## Deployment Considerations

### Environment Configuration

Все глобальные настройки, включая Colyseus, содержатся в главном ENV файле `packages/flowise-server/.env`:

```bash
############################################################################################################
########################################### MULTIPLAYER ################################################
############################################################################################################

# Enable Colyseus multiplayer server (true/false)
ENABLE_MULTIPLAYER_SERVER=true

# Colyseus server port (default: 2567)
MULTIPLAYER_SERVER_PORT=2567

# Colyseus server host (default: localhost)
MULTIPLAYER_SERVER_HOST=localhost

# Production settings (example)
# MULTIPLAYER_SERVER_HOST=game.universo.pro
# MULTIPLAYER_SERVER_PORT=443
# COLYSEUS_DEBUG=false
```

**Архитектурное решение**: Централизованное управление конфигурацией через главный ENV файл обеспечивает единую точку настройки для всех компонентов системы.

### Rollback Strategy

1. **Feature Flags**: Возможность отключения новой функциональности
2. **Version Pinning**: Закрепление версий зависимостей
3. **Graceful Degradation**: Откат к старой версии при ошибках
4. **Monitoring**: Отслеживание ошибок и производительности

## Architecture Decisions Summary

### 1. Модульная структура template-mmoomm
- **Решение**: Полный перенос MMOOMM функционала из `publish-frt` в отдельный пакет `@universo/template-mmoomm`
- **Обоснование**: Разделение ответственности - в `publish-frt` остаются только общие настройки публикации и шаблон квиза
- **Структура**: PlayCanvas-специфичный код в `src/playcanvas/` для будущего расширения на другие технологии

### 2. Переименование multiplayer-srv
- **Решение**: `packages/multiplayer-srv` → `packages/multiplayer-colyseus-srv`
- **Обоснование**: Явное указание на использование Colyseus, подготовка к поддержке других мультиплеерных технологий
- **Альтернатива**: Создание структуры `/colyseus/` внутри существующего пакета

### 3. Совместимость с Flowise UI
- **Решение**: Создание JSX компонентов для интеграции с основным Flowise UI
- **Обоснование**: Основной фронт Flowise использует JSX, наши пакеты - TSX
- **Реализация**: Dual build (CJS/ESM) в пакетах для обеспечения совместимости

### 4. Централизованная конфигурация
- **Решение**: Все настройки Colyseus в главном ENV файле `packages/flowise-server/.env`
- **Обоснование**: Единая точка конфигурации для всех компонентов системы
- **Преимущества**: Упрощение развертывания и управления настройками

### 5. Рефакторинг без версионности
- **Решение**: Использование `PlayCanvasMMOOMMBuilder` без суффикса "V2"
- **Обоснование**: Проект в стадии разработки, версионность внутри кода излишня
- **Подход**: Прямая замена существующего функционала

This design provides a comprehensive solution for completing the MMOOMM template refactoring while maintaining backward compatibility, ensuring robust error handling, and preparing the architecture for future expansion to other technologies.