# @universo/flowise-assistants-backend

Бэкенд-пакет для домена Assistants в Universo Platformo (извлечён из flowise-server).

## Обзор

Этот пакет предоставляет:
- **Сущность Assistant**: TypeORM-сущность со связью с Unik
- **Сервис Assistants**: CRUD-операции + интеграция с OpenAI
- **Роутер Assistants**: Express-роутер с паттерном DI
- **Миграция**: Консолидированная миграция для таблицы assistant

## Установка

```bash
pnpm add @universo/flowise-assistants-backend
```

## Использование

```typescript
import {
    createAssistantsService,
    createAssistantsController,
    createAssistantsRouter,
    Assistant,
    assistantsMigrations
} from '@universo/flowise-assistants-backend'

// Создание сервиса с DI
const assistantsService = createAssistantsService({
    getDataSource: () => dataSource,
    decryptCredentialData: async (data) => decrypt(data),
    telemetry: telemetryService,
    metrics: metricsProvider
})

// Создание контроллера
const assistantsController = createAssistantsController({ assistantsService })

// Создание роутера
const assistantsRouter = createAssistantsRouter({ assistantsController })

// Подключение роутера
app.use('/assistants', assistantsRouter)
```

## Экспорты

- `Assistant` - TypeORM-сущность
- `IAssistant`, `AssistantType` - TypeScript-типы
- `assistantsMigrations` - Массив миграций
- `createAssistantsService` - Фабрика сервиса
- `createAssistantsController` - Фабрика контроллера
- `createAssistantsRouter` - Фабрика роутера

## Зависимости

- `typeorm` - ORM для базы данных
- `@universo/uniks-backend` - Связь с сущностью Unik
- `@universo/flowise-credentials-backend` - Сущность Credential для OpenAI
