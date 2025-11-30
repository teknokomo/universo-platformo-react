# @universo/flowise-chatmessage-srv

Backend package for ChatMessage and Feedback functionality with Dependency Injection pattern.

## Overview

This package provides entities, migrations, services, controllers, and routes for managing chat messages and feedback in Flowise.

## Features

- **ChatMessage Entity**: Full TypeORM entity for chat messages with all columns
- **ChatMessageFeedback Entity**: Entity for message feedback (thumbs up/down)
- **Consolidated Migration**: Single migration creating both tables with all columns
- **DI-based Services**: `createChatMessagesService()` and `createFeedbackService()`
- **DI-based Controllers**: `createChatMessagesController()` and `createFeedbackController()`
- **DI-based Routers**: `createChatMessagesRouter()` and `createFeedbackRouter()`

## Installation

```bash
pnpm add @universo/flowise-chatmessage-srv
```

## Usage

### Using Entities

```typescript
import { ChatMessage, ChatMessageFeedback } from '@universo/flowise-chatmessage-srv'
```

### Using Services with DI

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

### Using Routes with DI

```typescript
import {
    createChatMessagesController,
    createChatMessagesRouter,
    createFeedbackController,
    createFeedbackRouter
} from '@universo/flowise-chatmessage-srv'

// Create controller with service
const chatMessagesController = createChatMessagesController({
    chatMessagesService,
    canvasService: { getCanvasById: async (id) => { /* ... */ } },
    getAppServer: () => appServer,
    utilGetChatMessage: async (params) => { /* ... */ },
    aMonthAgo: () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
})

// Create router with controller
const chatMessagesRouter = createChatMessagesRouter({ chatMessagesController })

// Use in Express app
app.use('/canvas-messages', chatMessagesRouter)
```

## API Reference

### Services

#### `createChatMessagesService(config)`

Creates a chat messages service with the following methods:
- `createChatMessage(data)` - Create a new chat message
- `getChatMessages(params)` - Get messages with filters
- `removeChatMessages(options)` - Remove messages by filters
- `removeChatMessagesByIds(options)` - Remove messages by IDs
- `abortChatMessage(chatId, canvasId)` - Abort a streaming message

#### `createFeedbackService(config)`

Creates a feedback service with the following methods:
- `getAllFeedback(canvasId, chatId?, sortOrder?, startDate?, endDate?)` - Get all feedback
- `createFeedback(body)` - Create new feedback
- `updateFeedback(id, body)` - Update feedback

### Entities

#### `ChatMessage`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| role | varchar | Message role (user/assistant/api) |
| canvas_id | uuid | Canvas ID |
| content | text | Message content |
| sourceDocuments | text | Source documents JSON |
| usedTools | text | Used tools JSON |
| fileAnnotations | text | File annotations JSON |
| agentReasoning | text | Agent reasoning JSON |
| fileUploads | text | File uploads JSON |
| artifacts | text | Artifacts JSON |
| action | text | Action JSON |
| chatType | varchar | Chat type (INTERNAL/EXTERNAL/STICKY_NOTE) |
| chatId | varchar | Chat ID |
| memoryType | varchar | Memory type |
| sessionId | varchar | Session ID |
| leadEmail | text | Lead email |
| followUpPrompts | text | Follow-up prompts JSON |
| createdDate | timestamp | Creation date |

#### `ChatMessageFeedback`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| canvas_id | uuid | Canvas ID |
| chatId | varchar | Chat ID |
| messageId | varchar | Message ID (unique) |
| rating | varchar | Rating (THUMBS_UP/THUMBS_DOWN) |
| content | text | Feedback content |
| createdDate | timestamp | Creation date |

## License

SEE LICENSE IN LICENSE-Flowise.md
