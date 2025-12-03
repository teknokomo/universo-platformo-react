# @universo/api-client

> 🚀 TypeScript API клиент для Universo Platformo

## Информация о пакете

| Поле | Значение |
|------|----------|
| **Имя пакета** | `@universo/api-client` |
| **Версия** | Смотрите `package.json` |
| **Тип** | TypeScript-first (API клиент) |
| **Сборка** | Двойная сборка (CommonJS + ESM) |
| **Назначение** | Централизованный, типобезопасный клиент для всех вызовов backend API |

## 🚀 Ключевые возможности

- ✅ **TypeScript** - Полная типобезопасность для API запросов и ответов
- ✅ **Class-based API** - Современная, расширяемая архитектура
- ✅ **TanStack Query интеграция** - Встроенные ключи запросов для кэширования
- ✅ **Аутентификация** - Построена на @universo/auth-frontend с CSRF поддержкой
- ✅ **Обработка ошибок** - Автоматический редирект 401, логика повторов
- ✅ **Tree-shakeable** - Только то, что используете

## Установка

```bash
pnpm add @universo/api-client
```

## Использование

### Базовое использование

```typescript
import { createUniversoApiClient } from '@universo/api-client'

// Создание экземпляра клиента
const api = createUniversoApiClient({ baseURL: '/api/v1' })

// Использование async/await
const canvases = await api.canvases.getCanvases(unikId, spaceId)
```

### С TanStack Query

```typescript
import { useQuery } from '@tanstack/react-query'
import { createUniversoApiClient, canvasQueryKeys } from '@universo/api-client'

const api = createUniversoApiClient({ baseURL: '/api/v1' })

function CanvasList({ unikId, spaceId }) {
  const { data, isLoading, error } = useQuery({
    queryKey: canvasQueryKeys.list(unikId, spaceId),
    queryFn: () => api.canvases.getCanvases(unikId, spaceId),
    enabled: !!unikId && !!spaceId,
  })

  if (isLoading) return <div>Загрузка...</div>
  if (error) return <div>Ошибка: {error.message}</div>

  return (
    <div>
      {data.canvases.map(canvas => (
        <div key={canvas.id}>{canvas.name}</div>
      ))}
    </div>
  )
}
```

### Доступные API

В настоящее время реализованы:

- **canvases** - Управление Canvas/Chatflow
  - `getCanvases()` - Получить список всех canvas
  - `getCanvas()` - Получить один canvas
  - `createCanvas()` - Создать новый canvas
  - `updateCanvas()` - Обновить canvas
  - `deleteCanvas()` - Удалить canvas
  - `duplicateCanvas()` - Дублировать canvas
  - `exportCanvas()` - Экспортировать canvas
  - `importCanvas()` - Импортировать canvas
  - `reorderCanvases()` - Изменить порядок canvas

Больше API скоро...

## Разработка

```bash
# Сборка пакета
pnpm build

# Режим наблюдения
pnpm dev

# Линтинг
pnpm lint
```

## Миграция со старого API

Старый паттерн (flowise-ui):
```javascript
import canvasesApi from '@/api/canvases'

const response = await canvasesApi.getCanvases(unikId, spaceId)
const canvases = response.data
```

Новый паттерн:
```typescript
import { api } from '@/api/client' // или создать экземпляр

const canvases = await api.canvases.getCanvases(unikId, spaceId)
// Ответ уже распакован (.data)
```

## Вклад в разработку

При вкладе в этот пакет:

1. Следуйте лучшим практикам TypeScript и поддерживайте строгую типизацию
2. Добавляйте тесты для новых методов API или клиентов
3. Обновляйте документацию EN и RU
4. Обеспечьте обратную совместимость с существующими интеграциями
5. Следуйте стандартам кодирования проекта

## Связанная документация

- [Документация основных приложений](../README-RU.md)
- [Publishing Frontend](../publish-frontend/base/README-RU.md)
- [Universo Types](../universo-types/README-RU.md)
-   [Документация AR.js](https://ar-js-org.github.io/AR.js-Docs/)
-   [Справочник API PlayCanvas](https://api.playcanvas.com/)

## Лицензия

MIT