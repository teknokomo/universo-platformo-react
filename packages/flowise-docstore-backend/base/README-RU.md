# @flowise/docstore-backend

Backend сервис для управления Document Store в Universo Platformo.

## Обзор

Этот пакет предоставляет backend сервисы для:
- **Управление Document Store** - CRUD операции для хранилищ документов
- **Операции с чанками** - Управление чанками документов с пагинацией
- **Управление загрузчиками** - Добавление, удаление и обработка загрузчиков документов
- **Конфигурация Vector Store** - Управление конфигурациями vector store, embedding и record manager

## Архитектура

Пакет использует паттерн **Dependency Injection (DI)** для всех сервисов:

```typescript
import { DataSource } from 'typeorm'
import {
    createDocumentStoreService,
    createChunkService,
    createLoaderService,
    createVectorStoreConfigService,
    DocstoreServiceDependencies,
    consoleLogger
} from '@flowise/docstore-backend'

// Создание зависимостей
const deps: DocstoreServiceDependencies = {
    dataSource: myDataSource, // TypeORM DataSource
    logger: consoleLogger     // или ваш кастомный логгер
}

// Создание сервисов
const documentStoreService = createDocumentStoreService(deps)
const chunkService = createChunkService(deps)
const loaderService = createLoaderService(deps)
const vectorStoreConfigService = createVectorStoreConfigService(deps)
```

## Сервисы

### DocumentStoreService

Основные CRUD операции для document stores:

```typescript
// Создание нового document store
const newStore = await documentStoreService.createDocumentStore(store)

// Получение всех document stores (с опциональной фильтрацией по unikId)
const stores = await documentStoreService.getAllDocumentStores(unikId)

// Получение конкретного document store
const store = await documentStoreService.getDocumentStoreById(storeId, unikId)

// Обновление document store
const updated = await documentStoreService.updateDocumentStore(store, updates)

// Удаление document store
const result = await documentStoreService.deleteDocumentStore(storeId, unikId)

// Обновление отслеживания использования document store
await documentStoreService.updateDocumentStoreUsage(canvasId, storeId, unikId)
```

### ChunkService

Операции с чанками документов:

```typescript
// Получение всех file chunks
const allChunks = await chunkService.getAllDocumentFileChunks()

// Получение чанков с пагинацией
const response = await chunkService.getDocumentStoreFileChunks(storeId, docId, pageNo)

// Удаление конкретного чанка
const result = await chunkService.deleteDocumentStoreFileChunk(storeId, docId, chunkId)

// Редактирование содержимого и метаданных чанка
const result = await chunkService.editDocumentStoreFileChunk(storeId, docId, chunkId, content, metadata)
```

### LoaderService

Операции с загрузчиками документов:

```typescript
// Удаление загрузчика из document store
const store = await loaderService.deleteLoaderFromDocumentStore(storeId, docId)

// Сохранение обрабатываемого загрузчика (устанавливает статус SYNCING)
const loader = await loaderService.saveProcessingLoader(data)
```

### VectorStoreConfigService

Операции с конфигурациями vector store:

```typescript
// Сохранение конфигураций vector store, embedding и record manager
const store = await vectorStoreConfigService.saveVectorStoreConfig(data, isStrictSave)

// Обновление только конфигурации vector store
const store = await vectorStoreConfigService.updateVectorStoreConfigOnly(data)
```

## Сущности базы данных

Пакет экспортирует три TypeORM сущности:

- **DocumentStore** - Основная сущность document store
- **DocumentStoreFileChunk** - Сущность file chunk
- **UpsertHistory** - Отслеживание истории upsert

### Регистрация сущностей

Зарегистрируйте сущности и миграции в вашем основном приложении:

```typescript
import { docstoreEntities, docstoreMigrations } from '@flowise/docstore-backend'

const dataSource = new DataSource({
    // ... ваша конфигурация
    entities: [...docstoreEntities, ...otherEntities],
    migrations: [...docstoreMigrations, ...otherMigrations]
})
```

## Обработка ошибок

Пакет предоставляет консистентную обработку ошибок:

```typescript
import { InternalFlowiseError, getErrorMessage } from '@flowise/docstore-backend'

try {
    const store = await documentStoreService.getDocumentStoreById(storeId)
} catch (error) {
    if (error instanceof InternalFlowiseError) {
        console.log(error.statusCode, error.message)
    }
}
```

## Зависимости

Этот пакет требует:
- `typeorm` ^0.3.20
- `http-status-codes` ^2.3.0
- `uuid` ^9.0.1

## Функции Universo Platformo

Этот пакет включает специфичные для Universo Platformo функции:
- **Фильтрация по Unik** - Все запросы поддерживают фильтрацию по `unikId` для мультитенантной безопасности
- **Связь с Unik** - Сущность DocumentStore имеет связь ManyToOne с сущностью Unik

## Лицензия

MIT
