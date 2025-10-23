# 📦 publish-frt

> Front-end пакет для публикации и экспорта AR/VR контента в Universo Platformo

## 🎯 Описание

Пакет `publish-frt` предоставляет UI компоненты и логику для публикации интерактивного контента, созданного в Universo Platformo. Поддерживает экспорт в различные форматы и технологии:

- **AR.js** - WebAR публикация для мобильных устройств
- **PlayCanvas** - 3D публикация с поддержкой multiplayer

## 📁 Структура проекта

```
packages/publish-frt/
├── base/
│   ├── src/
│   │   ├── api/              # API клиенты и Query Key Factory
│   │   │   ├── queryKeys.ts  # Централизованное управление ключами кэша
│   │   │   └── index.ts
│   │   ├── components/       # Переиспользуемые компоненты
│   │   ├── features/         # Функциональные модули
│   │   │   ├── arjs/         # AR.js publisher и exporter
│   │   │   └── playcanvas/   # PlayCanvas publisher
│   │   ├── hooks/            # Custom React hooks
│   │   ├── types/            # TypeScript типы
│   │   └── utils/            # Утилиты
│   ├── package.json
│   └── tsconfig.json
└── README-RU.md
```

## 🚀 Технологический стек

### Core Technologies
- **React 18** - UI framework
- **TypeScript** - Type safety
- **TanStack Query v5** (React Query) - Server state management
- **Material-UI** - UI components

### Data Fetching Architecture
- **Global QueryClient** - Single source of truth для всего приложения
- **Query Key Factory** - Централизованное управление ключами кэша
- **Automatic Request Deduplication** - Предотвращение дублирующихся запросов
- **Smart Retry Policy** - Интеллектуальная обработка ошибок

## 📚 Архитектурные паттерны

### 1. TanStack Query Integration

Пакет использует **TanStack Query v5** для управления server state, следуя официальным best practices.

#### Ключевые принципы:

✅ **Single Global QueryClient** - Один QueryClient на всё приложение
```javascript
// packages/flowise-ui/src/index.jsx
const queryClient = createGlobalQueryClient()

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

✅ **Query Key Factory** - Централизованное управление ключами
```typescript
// packages/publish-frt/base/src/api/queryKeys.ts
import { publishQueryKeys } from '@/api/queryKeys'

// Использование в компонентах
const { data } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
  queryFn: fetchCanvas
})
```

✅ **Declarative useQuery()** вместо imperative fetchQuery()
```javascript
// ❌ НЕ ДЕЛАЙ ТАК (императивный, нет дедупликации)
useEffect(() => {
  const data = await queryClient.fetchQuery({ /* ... */ })
}, [dependencies])

// ✅ ДЕЛАЙ ТАК (декларативный, автоматическая дедупликация)
const { data, isLoading } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
  queryFn: fetchCanvas,
  enabled: !!unikId
})
```

### 2. Query Key Factory Pattern

#### Что это?

Query Key Factory - централизованная система управления ключами кэша TanStack Query.

#### Зачем нужно?

1. **Type Normalization** - предотвращает cache mismatches
2. **Consistency** - единая точка управления ключами
3. **Easy Invalidation** - простая инвалидация кэша
4. **TypeScript Support** - автокомплит и type safety

#### Пример использования:

```typescript
import { publishQueryKeys, invalidatePublishQueries } from '@packages/publish-frt/base/src/api'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// 1. Получение данных с использованием Query Key Factory
const MyComponent = ({ unikId, canvasId }) => {
  const { data: canvas } = useQuery({
    queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
    queryFn: async () => {
      const response = await PublicationApi.getCanvasById(unikId, canvasId)
      return response?.data
    }
  })

  return <div>{canvas?.name}</div>
}

// 2. Инвалидация кэша после мутации
const MyMutation = () => {
  const queryClient = useQueryClient()

  const handleSave = async () => {
    await saveCanvas()
    
    // Инвалидировать все canvas queries
    invalidatePublishQueries.canvas(queryClient, canvasId)
  }
}
```

#### Доступные ключи:

| Функция | Описание | Пример ключа |
|---------|----------|--------------|
| `publishQueryKeys.all` | Все publish queries | `['publish']` |
| `publishQueryKeys.canvas()` | Все canvas queries | `['publish', 'canvas']` |
| `publishQueryKeys.canvasByUnik(unikId, canvasId)` | Canvas по unikId и canvasId | `['publish', 'canvas', 'unik123', 'canvas456']` |
| `publishQueryKeys.links()` | Все publication links | `['publish', 'links']` |
| `publishQueryKeys.linksByTechnology(tech)` | Links по технологии | `['publish', 'links', 'arjs']` |
| `publishQueryKeys.linksByVersion(tech, flowId, versionId)` | Links по версии | `['publish', 'links', 'arjs', '123', 'v1']` |

### 3. Hybrid Approach: useQuery + useQueryClient

**Правильный паттерн использования:**

```javascript
const MyPublisher = ({ flow }) => {
  // 1. Get queryClient для императивных операций
  const queryClient = useQueryClient()
  
  // 2. useQuery для данных компонента (АВТОМАТИЧЕСКАЯ дедупликация)
  const { data: canvasData } = useQuery({
    queryKey: publishQueryKeys.canvasByUnik(unikId, flow?.id),
    queryFn: async () => await PublicationApi.getCanvasById(unikId, flow.id),
    enabled: !!flow?.id,
    staleTime: 5 * 60 * 1000 // 5 минут
  })
  
  // 3. queryClient.fetchQuery для callbacks (on-demand fetching)
  const loadPublishLinks = useCallback(async () => {
    const records = await queryClient.fetchQuery({
      queryKey: publishQueryKeys.linksByVersion('arjs', flow.id, versionId),
      queryFn: fetchLinks
    })
    return records
  }, [queryClient, flow.id, versionId])
  
  // 4. Инвалидация кэша после мутаций
  const handlePublish = async () => {
    await publishCanvas()
    invalidatePublishQueries.linksByTechnology(queryClient, 'arjs')
  }
}
```

**Почему это работает:**
- `useQuery()` - декларативный, автоматическая дедупликация между компонентами
- `queryClient.fetchQuery()` - императивный, on-demand fetching в callbacks
- Оба паттерна валидны и дополняют друг друга

### 4. Configuration Best Practices

#### QueryClient Configuration

```javascript
// packages/flowise-ui/src/config/queryClient.js
export const createGlobalQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,        // 5 минут - снижает API calls
        gcTime: 30 * 60 * 1000,          // 30 минут - memory management
        refetchOnWindowFocus: false,      // Предотвращает лишние refetch
        retry: (failureCount, error) => {
          // Не ретраим: 401, 403, 404, 429
          if ([401, 403, 404, 429].includes(error?.response?.status)) {
            return false
          }
          // Ретраим 5xx ошибки до 2 раз
          if (error?.response?.status >= 500) {
            return failureCount < 2
          }
          return false
        }
      }
    }
  })
```

#### Component Best Practices

```javascript
// ✅ Правильно: computed values через useMemo
const resolvedVersionGroupId = useMemo(() => {
  if (normalizedVersionGroupId) return normalizedVersionGroupId
  if (canvasData) return FieldNormalizer.normalizeVersionGroupId(canvasData)
  return null
}, [normalizedVersionGroupId, canvasData])

// ✅ Правильно: условная загрузка через enabled
const { data } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
  queryFn: fetchCanvas,
  enabled: !!unikId && !!canvasId  // Не запускать query без ID
})

// ✅ Правильно: обработка loading и error states
const { data, isLoading, isError, error } = useQuery({ /* ... */ })

if (isLoading) return <CircularProgress />
if (isError) return <Alert severity="error">{error.message}</Alert>
```

## 🔧 API Reference

### publishQueryKeys

Экспортируется из `@packages/publish-frt/base/src/api`

```typescript
import { publishQueryKeys } from '@packages/publish-frt/base/src/api'

// Canvas queries
publishQueryKeys.all                    // ['publish']
publishQueryKeys.canvas()               // ['publish', 'canvas']
publishQueryKeys.canvasById(id)         // ['publish', 'canvas', id]
publishQueryKeys.canvasByUnik(uId, cId) // ['publish', 'canvas', uId, cId]

// Links queries
publishQueryKeys.links()                           // ['publish', 'links']
publishQueryKeys.linksByTechnology(tech)           // ['publish', 'links', tech]
publishQueryKeys.linksByFlow(tech, flowId)         // ['publish', 'links', tech, flowId]
publishQueryKeys.linksByVersion(tech, fId, vId)    // ['publish', 'links', tech, fId, vId]

// Templates queries
publishQueryKeys.templates()                // ['publish', 'templates']
publishQueryKeys.templatesByTechnology(tech) // ['publish', 'templates', tech]

// Versions queries
publishQueryKeys.versions()              // ['publish', 'versions']
publishQueryKeys.versionsByGroup(vgId)   // ['publish', 'versions', vgId]
```

### invalidatePublishQueries

Helper функции для инвалидации кэша:

```typescript
import { invalidatePublishQueries } from '@packages/publish-frt/base/src/api'

const queryClient = useQueryClient()

// Инвалидировать все publish queries
invalidatePublishQueries.all(queryClient)

// Инвалидировать все links
invalidatePublishQueries.links(queryClient)

// Инвалидировать links по технологии
invalidatePublishQueries.linksByTechnology(queryClient, 'arjs')

// Инвалидировать canvas
invalidatePublishQueries.canvas(queryClient, canvasId)

// Инвалидировать templates
invalidatePublishQueries.templates(queryClient)

// Инвалидировать versions
invalidatePublishQueries.versions(queryClient)
```

## 🐛 Debugging

### React Query DevTools

В development mode доступны React Query DevTools:

```javascript
// Автоматически включены в packages/flowise-ui/src/index.jsx
{process.env.NODE_ENV === 'development' && (
  <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
)}
```

**Как использовать:**
1. Открыть DevTools (правый нижний угол)
2. Найти query по ключу
3. Проверить статус (fresh/stale/fetching/error)
4. Посмотреть fetch count (должен быть 1, не 10+)

### Common Issues

#### Problem: Дублирующиеся запросы
```
❌ Symptom: Видишь 10+ одинаковых HTTP requests в Network tab
✅ Solution: Используй useQuery() вместо fetchQuery() в useEffect
```

#### Problem: Cache mismatches
```
❌ Symptom: Данные не обновляются после мутации
✅ Solution: Используй publishQueryKeys для consistency ключей
```

#### Problem: 429 Rate Limiting
```
❌ Symptom: Получаешь 429 Too Many Requests
✅ Solution: useQuery() автоматически дедуплицирует запросы
```

## 📝 Migration Guide

### From fetchQuery to useQuery

**До (anti-pattern):**
```javascript
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  const fetchData = async () => {
    const result = await queryClient.fetchQuery({ /* ... */ })
    setData(result)
    setLoading(false)
  }
  fetchData()
}, [canvasId])
```

**После (best practice):**
```javascript
const { data, isLoading } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
  queryFn: fetchCanvas,
  enabled: !!canvasId
})
```

**Преимущества:**
- ✅ -40 строк кода
- ✅ Автоматическая дедупликация
- ✅ Нет ручного управления состоянием
- ✅ Декларативный подход

## 🚀 Development

### Установка зависимостей
```bash
pnpm install
```

### Сборка
```bash
# Собрать только publish-frt
pnpm --filter publish-frt build

# Собрать publish-frt + flowise-ui
pnpm --filter publish-frt build && pnpm --filter flowise-ui build
```

### Линтинг
```bash
pnpm --filter publish-frt lint
pnpm --filter publish-frt lint --fix
```

## 📖 Дополнительные ресурсы

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Query Key Factory Pattern](https://tkdodo.eu/blog/effective-react-query-keys)

## 📄 License

MIT License - see LICENSE file for details
