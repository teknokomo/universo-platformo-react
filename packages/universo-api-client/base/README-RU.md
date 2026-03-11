# @universo/api-client

TypeScript API client package для frontend-интеграций Universo Platformo.

## Роль пакета

Этот пакет централизует создание аутентифицированного HTTP-клиента для
frontend-кода и даёт типизированные точки входа для текущих экспортируемых
групп API.

## Текущая экспортируемая поверхность

Сейчас пакет экспортирует:

- `createUniversoApiClient` и типы `UniversoApiClient`.
- Дефолтный экземпляр `api`, созданный через общий helper базового API URL.
- `AttachmentsApi` вместе с `attachmentsQueryKeys`.
- `ConfigApi` вместе с `configQueryKeys`.
- `FeedbackApi` вместе с `feedbackQueryKeys`.
- `createValidationApi` вместе с типами ответов валидации.
- Общие query-key exports и package-level типы.

## Важная оговорка о зрелости

Поверхность пакета шире, чем предполагал старый canvases-only README, но не все
экспортируемые группы API сейчас одинаково зрелые.

`validation.checkValidation(unikId, canvasId)` — самый явный конкретный метод
в текущей кодовой базе. `AttachmentsApi`, `ConfigApi` и `FeedbackApi` уже
экспортируются как типизированные точки интеграции и пространства query keys,
но их реализация на уровне методов пока намеренно остаётся минимальной.

## Установка

```bash
pnpm add @universo/api-client
```

## Базовое использование

```typescript
import { createUniversoApiClient } from '@universo/api-client'

const api = createUniversoApiClient({ baseURL: '/api/v1' })

const result = await api.validation.checkValidation(unikId, canvasId)
console.log(result.data)
```

## Поведение клиента

Внутренний HTTP-клиент создаётся через `@universo/auth-frontend`, поэтому он
согласован с текущим поведением репозитория по сессиям, CSRF и 401-редиректам.

Возвращаемый объект клиента также раскрывает `$client` на случай, если вам нужен базовый аутентифицированный экземпляр axios напрямую.

## Разработка

```bash
pnpm --filter @universo/api-client build
pnpm --filter @universo/api-client test
pnpm --filter @universo/api-client lint
```

## Связанная документация

- [Индекс пакетов](../../README-RU.md)
- [Core Frontend](../../universo-core-frontend/base/README-RU.md)
- [Auth Frontend](../../auth-frontend/base/README-RU.md)
- [REST Docs](../../universo-rest-docs/README-RU.md)

## License

Omsk Open License
