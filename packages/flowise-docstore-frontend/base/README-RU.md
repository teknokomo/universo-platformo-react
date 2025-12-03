# @flowise/docstore-frontend

Фронтенд-пакет для управления хранилищами документов и векторными хранилищами в Universo Platformo.

## Обзор

Этот пакет предоставляет React-компоненты для управления хранилищами документов, включая:
- CRUD-операции для хранилищ документов
- Настройка загрузчиков документов
- Управление чанками и предварительный просмотр
- Интеграция с векторными хранилищами
- Отслеживание истории операций upsert

## Установка

```bash
pnpm add @flowise/docstore-frontend
```

## Зависимости

Пакет требует следующие зависимости:
- `@flowise/template-mui` - UI-компоненты и тема
- `@universo/api-client` - API-клиент для связи с бэкендом
- `@universo/i18n` - Поддержка интернационализации

## Использование

### Импорт компонентов

```jsx
import {
    DocumentStore,
    DocumentStoreDetail,
    AddDocStoreDialog,
    VectorStoreDialog
} from '@flowise/docstore-frontend'
```

### Импорт ресурсов i18n

```jsx
import { registerDocstoreI18n } from '@flowise/docstore-frontend/i18n'

// Добавление переводов в ваш экземпляр i18n
registerDocstoreI18n()
```

### Прямой импорт страниц

```jsx
// Главная страница хранилища документов
import DocumentStore from '@flowise/docstore-frontend/pages/docstore'

// Диалоги векторного хранилища
import VectorStoreDialog from '@flowise/docstore-frontend/pages/vectorstore/VectorStoreDialog'
```

## Компоненты

### Компоненты хранилища документов

| Компонент | Описание |
|-----------|----------|
| `DocumentStore` | Главная страница списка хранилищ |
| `DocumentStoreDetail` | Детальный просмотр хранилища |
| `AddDocStoreDialog` | Диалог добавления/редактирования |
| `DeleteDocStoreDialog` | Диалог подтверждения удаления |
| `DocStoreAPIDialog` | Диалог настройки API |
| `DocStoreInputHandler` | Обработчик ввода |
| `DocumentLoaderListDialog` | Диалог выбора загрузчика |
| `DocumentStoreStatus` | Компонент индикатора статуса |
| `ExpandedChunkDialog` | Диалог просмотра деталей чанка |
| `LoaderConfigPreviewChunks` | Предпросмотр чанков в конфигурации |
| `ShowStoredChunks` | Отображение сохранённых чанков |
| `UpsertHistoryDetailsDialog` | Детали истории upsert |
| `UpsertHistorySideDrawer` | Боковая панель истории upsert |
| `VectorStoreConfigure` | Конфигурация векторного хранилища |
| `VectorStoreQuery` | Интерфейс запросов к векторному хранилищу |

### Компоненты векторного хранилища

| Компонент | Описание |
|-----------|----------|
| `VectorStoreDialog` | Основной диалог векторного хранилища |
| `VectorStorePopUp` | Всплывающее окно для действий |
| `UpsertHistoryDialog` | Диалог истории upsert |
| `UpsertResultDialog` | Диалог отображения результатов |

## Интернационализация

Пакет включает переводы для:
- Английский (`en`)
- Русский (`ru`)

Ключи переводов организованы в пространствах имён `document-store` и `vector-store`.

## Структура

```
src/
├── i18n/
│   ├── index.ts          # Конфигурация i18n
│   └── locales/
│       ├── en.json       # Английские переводы
│       └── ru.json       # Русские переводы
├── pages/
│   ├── docstore/         # Страницы хранилища документов
│   │   ├── index.jsx     # Главная страница списка
│   │   └── ...           # Другие компоненты
│   └── vectorstore/      # Страницы векторного хранилища
│       ├── VectorStoreDialog.jsx
│       └── ...           # Другие компоненты
└── index.js              # Главные экспорты
```

## Связанные пакеты

- `@flowise/docstore-backend` - Бэкенд-сервис для хранилищ документов
- `@flowise/template-mui` - Общие UI-компоненты
- `@universo/api-client` - API-клиент

## Лицензия

СМ. ЛИЦЕНЗИЮ В LICENSE-Flowise.md
