# Publish Server (AR.js MVP)

Минимальное серверное приложение для публикации AR.js сцен на основе UPDL-узлов, интегрируемое с основным сервером Flowise.

## Функциональность MVP

Модуль предоставляет API для:

-   Публикации AR.js приложений через потоковую генерацию UPDL-сцен
-   Извлечения данных UPDL-сцены для AR.js рендеринга

## Структура проекта (MVP)

```
apps/publish-srv/base/
└─ src/
   ├─ controllers/       # Контроллер AR.js публикаций
   ├─ routes/            # Маршруты API
   ├─ interfaces/        # TypeScript интерфейсы для UPDL
   ├─ middlewares/       # Обработчик ошибок
   ├─ utils/             # Логгер
   ├─ server.ts          # Инициализация маршрутов
   └─ index.ts           # Точка входа и экспорт
```

## REST API (MVP)

### Эндпоинты:

-   `POST /api/v1/publish/arjs` - Создать публикацию AR.js (потоковая генерация)
-   `GET /api/v1/publish/arjs/public/:publicationId` - Получить данные публикации AR.js
-   `GET /api/v1/publish/arjs/stream/:chatflowId` - Прямой запрос к UPDL-сцене

### Примеры:

#### Публикация AR.js:

```bash
POST /api/v1/publish/arjs
{
  "chatflowId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
  "generationMode": "streaming",
  "isPublic": true,
  "projectName": "UPDL+AR.js"
}
```

#### Получение данных сцены:

```bash
GET /api/v1/publish/arjs/public/778d565f-e9cc-4dd8-b8ef-7a097ecb18f3
```

## Интеграция с Flowise

Модуль интегрируется с основным Flowise-сервером:

1. Экспортирует функцию `initializePublishServer` для добавления маршрутов
2. Использует `utilBuildUPDLflow` из основного сервера для генерации сцен

## Процесс публикации AR.js

1. Пользователь создает Chatflow с UPDL-узлами (Сцена, Объект и т.д.)
2. В интерфейсе нажимает "Публикация и экспорт" → "AR.js" → "Сделать публичным"
3. Получает ссылку формата `/p/:chatflowId`
4. По этой ссылке фронтенд запрашивает данные сцены и отображает AR.js приложение

## Демо-режим

Демо-режим реализован только на стороне фронтенда (компонент `ARJSPublisher.jsx`) через константу `DEMO_MODE = true/false`. В демо-режиме фронтенд не отправляет запросы к API, а использует предопределенные ссылки.

## Зависимости

-   **Основной сервер Flowise**: публикация интегрируется с ним
-   **Функция `utilBuildUPDLflow`**: строит UPDL-сцену из узлов чатфлоу

---

_Universo Platformo | AR.js Publisher_
