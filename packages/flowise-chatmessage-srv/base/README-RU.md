# @universo/flowise-chatmessage-srv

Backend пакет для функциональности ChatMessage и Feedback с паттерном Dependency Injection.

## Обзор

Этот пакет предоставляет сущности, миграции, сервисы, контроллеры и маршруты для управления сообщениями чата и обратной связью в Flowise.

## Возможности

- **ChatMessage Entity**: Полная TypeORM сущность для сообщений чата со всеми колонками
- **ChatMessageFeedback Entity**: Сущность для обратной связи (лайк/дизлайк)
- **Консолидированная миграция**: Единая миграция, создающая обе таблицы со всеми колонками
- **DI-сервисы**: `createChatMessagesService()` и `createFeedbackService()`
- **DI-контроллеры**: `createChatMessagesController()` и `createFeedbackController()`
- **DI-маршруты**: `createChatMessagesRouter()` и `createFeedbackRouter()`

## Установка

```bash
pnpm add @universo/flowise-chatmessage-srv
```

## Использование

### Использование сущностей

```typescript
import { ChatMessage, ChatMessageFeedback } from '@universo/flowise-chatmessage-srv'
```

### Использование сервисов с DI

```typescript
import { createChatMessagesService, createFeedbackService } from '@universo/flowise-chatmessage-srv'

const chatMessagesService = createChatMessagesService({
    getDataSource: () => dataSource,
    removeFilesFromStorage: async (canvasId, chatId) => { /* ... */ },
    clearSessionMemory: async (nodes, componentNodes, chatId, dataSource, sessionId, memoryType) => { /* ... */ },
    getAbortController: () => abortControllerPool,
    getQueueManager: () => queueManager,
    isQueueMode: () => process.env.MODE === 'QUEUE',
    logger: console
})

const feedbackService = createFeedbackService({
    getDataSource: () => dataSource,
    canvasService: { getCanvasById: async (id) => { /* ... */ } },
    lunaryClient: { trackFeedback: (messageId, data) => { /* ... */ } }
})
```

### Использование маршрутов с DI

```typescript
import {
    createChatMessagesController,
    createChatMessagesRouter,
    createFeedbackController,
    createFeedbackRouter
} from '@universo/flowise-chatmessage-srv'

// Создание контроллера с сервисом
const chatMessagesController = createChatMessagesController({
    chatMessagesService,
    canvasService: { getCanvasById: async (id) => { /* ... */ } },
    getAppServer: () => appServer,
    utilGetChatMessage: async (params) => { /* ... */ },
    aMonthAgo: () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
})

// Создание маршрута с контроллером
const chatMessagesRouter = createChatMessagesRouter({ chatMessagesController })

// Использование в Express приложении
app.use('/canvas-messages', chatMessagesRouter)
```

## API Справочник

### Сервисы

#### `createChatMessagesService(config)`

Создает сервис сообщений чата со следующими методами:
- `createChatMessage(data)` - Создать новое сообщение
- `getChatMessages(params)` - Получить сообщения с фильтрами
- `removeChatMessages(options)` - Удалить сообщения по фильтрам
- `removeChatMessagesByIds(options)` - Удалить сообщения по ID
- `abortChatMessage(chatId, canvasId)` - Прервать стриминговое сообщение

#### `createFeedbackService(config)`

Создает сервис обратной связи со следующими методами:
- `getAllFeedback(canvasId, chatId?, sortOrder?, startDate?, endDate?)` - Получить всю обратную связь
- `createFeedback(body)` - Создать обратную связь
- `updateFeedback(id, body)` - Обновить обратную связь

### Сущности

#### `ChatMessage`

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid | Первичный ключ |
| role | varchar | Роль сообщения (user/assistant/api) |
| canvas_id | uuid | ID холста |
| content | text | Содержимое сообщения |
| sourceDocuments | text | Исходные документы JSON |
| usedTools | text | Использованные инструменты JSON |
| fileAnnotations | text | Аннотации файлов JSON |
| agentReasoning | text | Рассуждения агента JSON |
| fileUploads | text | Загруженные файлы JSON |
| artifacts | text | Артефакты JSON |
| action | text | Действие JSON |
| chatType | varchar | Тип чата (INTERNAL/EXTERNAL/STICKY_NOTE) |
| chatId | varchar | ID чата |
| memoryType | varchar | Тип памяти |
| sessionId | varchar | ID сессии |
| leadEmail | text | Email лида |
| followUpPrompts | text | Последующие подсказки JSON |
| createdDate | timestamp | Дата создания |

#### `ChatMessageFeedback`

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid | Первичный ключ |
| canvas_id | uuid | ID холста |
| chatId | varchar | ID чата |
| messageId | varchar | ID сообщения (уникальный) |
| rating | varchar | Рейтинг (THUMBS_UP/THUMBS_DOWN) |
| content | text | Содержимое обратной связи |
| createdDate | timestamp | Дата создания |

## Лицензия

SEE LICENSE IN LICENSE-Flowise.md
