# Publication Frontend (publish-frt)

Frontend для системы публикации в Universo Platformo, поддерживающий AR.js и PlayCanvas.

См. также: Создание новых пакетов/Packages (лучшие практики)

- ../../../docs/ru/universo-platformo/shared-guides/creating-apps.md
## Миграция UI-компонентов (октябрь 2024)

Этот пакет консолидирует все UI компоненты **"Publish & Export"** из различных частей монорепозитория в одно место. Миграция улучшает поддерживаемость, устраняет рассеянные экземпляры QueryClient, вызывающие 429 штормы запросов, и предоставляет единую точку входа для всех интерфейсов, связанных с публикацией.

### Детали миграции

**Мигрировано из:** `packages/flowise-ui/src/views/publish/` и `packages/flowise-ui/src/views/canvases/`  
**Дата миграции:** октябрь 2024  
**Всего мигрировано файлов:** 14 файлов компонентов

#### Структура мигрированных компонентов

```
src/features/
├─ dialog/              # Компоненты диалогов публикации (из canvases/)
│  ├─ APICodeDialog.jsx       # Главный диалог публикации (1031 строка)
│  ├─ Configuration.jsx       # Настройки режима отображения
│  ├─ EmbedChat.jsx           # Генератор кода для встраивания чата
│  └─ index.ts                # Barrel exports
├─ chatbot/             # Компоненты публикации чатбота (из publish/bots/)
│  ├─ ChatBotSettings.jsx     # UI конфигурации чатбота
│  ├─ BaseBot.jsx             # Базовый компонент отображения бота
│  ├─ BaseBotSettings.jsx     # Настройки базового бота
│  ├─ BotRouter.jsx           # Логика маршрутизации бота
│  ├─ ChatBotViewer.jsx       # Компонент просмотра бота
│  ├─ embed/
│  │  ├─ BaseBotEmbed.jsx    # Код встраивания базового бота
│  │  ├─ ChatBotEmbed.jsx    # Код встраивания чатбота
│  │  └─ index.ts            # Экспорты embed
│  └─ index.ts                # Экспорты чатбота
└─ api/                 # Компоненты совместного использования API (из publish/)
   ├─ APIShare.jsx            # Интерфейс совместного использования API
   ├─ PythonCode.jsx          # Генератор Python кода
   ├─ JavaScriptCode.jsx      # Генератор JavaScript кода
   ├─ LinksCode.jsx           # Генератор кода ссылок
   └─ index.ts                # Экспорты API
```

### Критическое исправление архитектуры: единый QueryClient

**Обнаруженная проблема:** Несколько экземпляров QueryClient в `ARJSPublisher`, `PlayCanvasPublisher` и отдельных издателях вызывали условия гонки и ошибки 429 (Слишком много запросов).

**Реализованное решение:** Единый глобальный `QueryClient` теперь создается в корне UI (`packages/flowise-ui/src/index.jsx`). Все функции публикации используют этот общий клиент напрямую, устраняя избыточные провайдеры и штормы сетевых запросов.

#### Глобальный провайдер QueryClient

**Расположение:** `packages/flowise-ui/src/index.jsx`

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: true,
      refetchOnWindowFocus: false
    }
  }
})

root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
```

**Использование:** Все диалоги и компоненты, связанные с публикацией, теперь полагаются на глобальный `QueryClient`, предоставляемый в корне UI. Больше нет выделенного обертки `PublishDialog.tsx` или отдельного `PublishQueryProvider`.

```typescript
// Пример использования главного компонента диалога публикации
import APICodeDialog from '../features/dialog/APICodeDialog'

// QueryClientProvider теперь настроен в корне приложения, поэтому вы можете использовать диалоги публикации напрямую:

<APICodeDialog
  show={showDialog}
  type={dialogType}
  data={dialogData}
  onConfirm={handleConfirm}
  onCancel={handleCancel}
/>
```

### Миграция локализации

Все ключи i18n, связанные с публикацией, мигрированы из `packages/flowise-ui/src/i18n/locales/{en,ru}/views/canvases.json` в `packages/publish-frt/base/src/i18n/locales/{en,ru}/main.json`.

**Новая секция i18n:** `apiCodeDialog`

**Мигрированные ключи:**
- `noAuthorization`, `addNewKey`, `chooseApiKey`, `apiEndpoint`
- `shareAPI`, `configuration`, `embed`, `viewInBrowser`
- `publish`, `unpublish`, `publishing`, `unpublishing`
- `pythonCode`, `javascriptCode`, `links`
- И все подключи для каждой секции

### Экспорты пакета

**Точка входа:** `src/index.ts`

```typescript
// Компоненты диалогов (мигрировано из canvases/)
export { default as APICodeDialog } from './features/dialog/APICodeDialog'
export { default as Configuration } from './features/dialog/Configuration'
export { default as EmbedChat } from './features/dialog/EmbedChat'

// Компоненты чатбота (мигрировано из publish/bots/)
export { default as ChatBotSettings } from './features/chatbot/ChatBotSettings'
export { default as BaseBot } from './features/chatbot/BaseBot'
export { default as BaseBotSettings } from './features/chatbot/BaseBotSettings'
export { default as BotRouter } from './features/chatbot/BotRouter'
export { default as ChatBotViewer } from './features/chatbot/ChatBotViewer'

// Компоненты встраивания чатбота
export { default as BaseBotEmbed } from './features/chatbot/embed/BaseBotEmbed'
export { default as ChatBotEmbed } from './features/chatbot/embed/ChatBotEmbed'

// API компоненты (мигрировано из publish/)
export { default as APIShare } from './features/api/APIShare'
export { default as PythonCode } from './features/api/PythonCode'
export { default as JavaScriptCode } from './features/api/JavaScriptCode'
export { default as LinksCode } from './features/api/LinksCode'

// Существующие издатели
export { ARJSPublisher } from './features/arjs/ARJSPublisher'
export { PlayCanvasPublisher } from './features/playcanvas/PlayCanvasPublisher'
```

**Конфигурация Package.json:**

```json
{
  "main": "dist/publish-frt/base/src/index.js",
  "module": "dist/publish-frt/base/src/index.js",
  "exports": {
    ".": {
      "import": "./dist/publish-frt/base/src/index.js",
      "require": "./dist/publish-frt/base/src/index.js"
    }
  }
}
```

### Ограничения MVP и будущая работа

#### Текущее состояние (MVP)

**Стратегия импорта:** Сохранены импорты `@/`, указывающие на `flowise-ui` для стабильности:
```javascript
// Текущий подход в мигрированных файлах
import { useTranslation } from 'react-i18next'
import '@/views/canvases/CanvasHeader.css'
import { SyntaxHighlighter, CodeBlock } from '@/ui-components/SyntaxHighlighter'
```

**Вывод сборки:** TypeScript компилируется в CommonJS (согласно `tsconfig.json`), Gulp копирует статические ресурсы.

#### Известные проблемы

1. **Несовместимость CommonJS/ESM:** Прямые импорты компонентов `publish-frt` в `flowise-ui` не работают из-за того, что Vite ожидает ESM, а TypeScript производит CommonJS.
   - **Влияние:** Пока нельзя использовать `import { PublishDialog } from 'publish-frt'` в основном UI
   - **Обходной путь:** Сохранить оригинальные импорты (`@/views/canvases/APICodeDialog`) на данный момент

2. **Миграция импортов отложена:** Полное преобразование из импортов `@/` в пути рабочего пространства (`@universo/...`) отложено на будущую итерацию.

#### Будущие улучшения

- [ ] Преобразовать компиляцию TypeScript в ESM (обновить целевой модуль `tsconfig.json`)
- [ ] Мигрировать все внутренние импорты `@/` на пути рабочего пространства
- [ ] Включить прямые импорты `publish-frt` в `flowise-ui`
- [ ] Удалить оригинальные файлы из `packages/flowise-ui` после подтверждения стабильности
- [ ] Тестирование производительности подхода с единым QueryClient
- [ ] Интеграционные тесты для диалога публикации из UI

### Метрики успеха миграции

✅ **Статус сборки:** И `publish-frt`, и `flowise-ui` собираются успешно  
✅ **Исправление QueryClient:** Множественные экземпляры QueryClient устранены  
✅ **Организация кода:** Все UI компоненты публикации в одном месте  
✅ **Локализация:** Полная миграция i18n для английского и русского  
✅ **Экспорты:** Все компоненты доступны через barrel exports  

### Рекомендации по тестированию

1. **Ручное тестирование:**
   - Откройте любой canvas и вызовите диалог "Publish & Export"
   - Проверьте, что все вкладки (API, Configuration, Embed) работают корректно
   - Протестируйте AR.js и PlayCanvas издатели
   - Убедитесь в отсутствии ошибок 429 во время операций публикации

2. **Мониторинг производительности:**
   - Отслеживайте количество запросов во время операций публикации
   - Проверьте поведение единого QueryClient в DevTools браузера
   - Проверьте уменьшение дублирующих запросов

3. **Регрессионное тестирование:**
   - Убедитесь, что существующие рабочие процессы публикации продолжают работать
   - Протестируйте все опции конфигурации (маркеры, библиотеки, режимы отображения)
   - Проверьте генерацию публичных ссылок и просмотр

---

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

---

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

---

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

---

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

---

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

---

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

---

## 📖 Дополнительные ресурсы

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Query Key Factory Pattern](https://tkdodo.eu/blog/effective-react-query-keys)

---

## 📄 License

MIT License - see LICENSE file for details

---
## Структура проекта

Проект следует единой структуре приложений в монорепозитории:

```
packages/publish-frt/base/
├─ package.json
├─ tsconfig.json
├─ gulpfile.ts
└─ src/
   ├─ assets/              # Статические файлы (изображения, шрифты, иконки)
   │  ├─ icons/            # SVG иконки для компонентов и UI
   │  ├─ images/           # Изображения для элементов UI
   │  └─ libs/             # Локальные библиотеки для регионов с блокировкой CDN
   │     ├─ aframe/        # Версии библиотеки A-Frame
   │     └─ arjs/          # Версии библиотеки AR.js
   ├─ api/                 # HTTP клиенты для взаимодействия с backend
   │  ├─ common.ts         # Базовые API утилиты (auth, парсинг URL, base URL)
   │  ├─ index.ts          # Центральный модуль экспорта API
   │  └─ publication/      # API клиенты для публикации
   │     ├─ PublicationApi.ts        # Базовый API публикации для всех технологий
   │     ├─ ARJSPublicationApi.ts    # API публикации специфичный для AR.js
   │     ├─ PlayCanvasPublicationApi.ts # API публикации специфичный для PlayCanvas
   │     ├─ StreamingPublicationApi.ts # API потоковой публикации
   │     └─ index.ts       # Экспорты API публикации с алиасами совместимости
   ├─ builders/            # Билдеры UPDL для целевых платформ с template-first архитектурой
   │  ├─ common/           # Общая инфраструктура билдеров
   │  │  ├─ AbstractTemplateBuilder.ts # Абстрактный базовый класс для всех шаблонов
   │  │  ├─ BaseBuilder.ts           # Базовый класс билдера для высокоуровневых билдеров
   │  │  ├─ BuilderRegistry.ts       # Реестр для управления высокоуровневыми билдерами
   │  │  ├─ TemplateRegistry.ts      # Реестр для управления реализациями шаблонов
   │  │  ├─ types.ts                 # Общие типы и интерфейсы
   │  │  └─ setup.ts                 # Настройка регистрации билдеров и шаблонов
   │  │  # Примечание: UPDLProcessor теперь импортируется из @universo-platformo/utils
   │  ├─ templates/        # Организация template-first (НОВАЯ АРХИТЕКТУРА)
   │  │  ├─ quiz/          # Шаблон Quiz для образовательного контента
   │  │  │  └─ arjs/       # Реализация шаблона quiz для AR.js
   │  │  │     ├─ ARJSBuilder.ts         # Высокоуровневый билдер AR.js
   │  │  │     ├─ ARJSQuizBuilder.ts     # Реализация шаблона quiz
   │  │  │     ├─ config.ts              # Конфигурация шаблона quiz
   │  │  │     ├─ handlers/              # Процессоры UPDL нод для quiz
   │  │  │     │  ├─ ActionHandler.ts    # Action node processing
   │  │  │     │  ├─ CameraHandler.ts    # Camera node processing
   │  │  │     │  ├─ ComponentHandler.ts # Component node processing
   │  │  │     │  ├─ DataHandler.ts      # Data/Questions processing
   │  │  │     │  ├─ EntityHandler.ts    # Entity node processing
   │  │  │     │  ├─ EventHandler.ts     # Event node processing
   │  │  │     │  ├─ LightHandler.ts     # Light node processing
   │  │  │     │  ├─ ObjectHandler.ts    # Object node processing
   │  │  │     │  ├─ SpaceHandler.ts     # Space node processing
   │  │  │     │  ├─ UniversoHandler.ts  # Universo node processing
   │  │  │     │  └─ index.ts            # Handlers export
   │  │  │     ├─ utils/                 # Template-specific utilities
   │  │  │     │  └─ SimpleValidator.ts  # Validation utilities
   │  │  │     └─ index.ts               # Quiz AR.js exports
   │  │  └─ (external)     # MMOOMM moved to external package: @universo/template-mmoomm
   │  └─ index.ts          # Main builders export
   ├─ components/          # Presentation React components
   ├─ features/            # Functional modules for different technologies
   │  ├─ arjs/             # AR.js components and logic
   │  └─ playcanvas/       # PlayCanvas components and logic
   ├─ pages/               # Page components
   │  ├─ public/           # Public pages (ARViewPage, PlayCanvasViewPage)
   │  └─ ...
   └─ index.ts             # Entry point
```

**Система типов**: UPDL типы импортируются из пакета `@universo/publish-srv`, обеспечивая централизованные определения типов и согласованность между frontend и backend компонентами.

## Publication Links: Workflow and Data Model

The publication system supports two link types and Base58 short slugs:

- Group link: points to the "active" version within a version group. Public URL prefix: `/p/{slug}`.
- Version link: points to a specific immutable version UUID. Public URL prefix: `/b/{slug}`.

Key fields:

- `versionGroupId`: required for group links (server can fallback from flow data when absent).
- `targetType`: `group` or `version`.
- `slug`: Base58-encoded short id (generated on the server).

Client API: use the unified `PublishLinksApi` to list/create/update links. When creating a group link, pass the normalized `versionGroupId`.

## Normalizing versionGroupId on the client

Backend may return either `versionGroupId` or legacy `version_group_id`. To avoid scattered fallbacks, the frontend uses a tiny utility:

- `src/utils/fieldNormalizer.ts` exports `FieldNormalizer.normalizeVersionGroupId(flow)` returning a string or undefined.

In AR.js/PlayCanvas publishers, use it before creating or listing links so that `PublishLinksApi` receives a consistent value.

Notes:

- This is a non-breaking addition; consumers using old fields continue to work.
- Prefer using `PublishLinksApi` over any legacy per-tech API imports.

## Замечания о безопасности/надёжности (MVP)

Серверные улучшения были добавлены без изменения публичных контрактов:

- Ограничение скорости для publish маршрутов (write/read уровни)
- Минимальная DTO валидация для создания/обновления link payload
- Санированные сообщения об ошибках в production

Влияние на frontend:

- Передавайте только необходимые поля (`unikId`, `canvasId`/`spaceId` если применимо, `versionGroupId` для group links).
- Обрабатывайте 400 ответы, показывая лаконичную ошибку валидации пользователю.

## Управление серверным состоянием и повторные попытки

Начиная с октября 2025 UI публикации использует **TanStack Query** для управления серверным состоянием:

- `PublishQueryProvider` (см. `src/providers/PublishQueryProvider.tsx`) размещает общий `QueryClient` с разумными настройками по умолчанию (`staleTime` 30 с, `gcTime` 5 мин, повторы только для 5xx).
- AR.js и PlayCanvas издатели запрашивают `/publish/links` и `/canvases/:id` через `queryClient.fetchQuery`, что исключает параллельные повторные запросы и кеширует полученные данные.
- Для пользовательских повторных попыток показано уведомление с кнопкой «Retry», которое инвалидирует связанные ключи (`publish/canvas`, `publish/links/*`) и перезапускает загрузку.

Серверные лимитеры теперь отправляют `Retry-After`, `X-RateLimit-*`. Клиент уважает эти заголовки и больше не пытается повторять запросы агрессивно. При необходимости можно расширить стратегию, добавив собственный `QueryCache` или очереди, но для MVP достаточно встроенных возможностей TanStack Query + наглядных ошибок.

## Критическая архитектура: рендеринг AR.js на основе Iframe

**ВАЖНО**: AR.js контент должен рендериться с использованием подхода iframe для правильной загрузки библиотек и выполнения скриптов.

### Почему Iframe необходим

Библиотеки AR.js (A-Frame и AR.js) требуют правильного контекста выполнения скриптов, который `dangerouslySetInnerHTML` в React не может предоставить:

-   **Изоляция скриптов**: Iframe создает изолированный контекст выполнения для AR.js скриптов
-   **Загрузка библиотек**: Обеспечивает правильную загрузку внешних/локальных JavaScript библиотек
-   **Совместимость с браузерами**: Предотвращает конфликты с виртуальным DOM React
-   **Безопасность**: Изолирует AR.js/PlayCanvas код от основного контекста приложения

### Паттерн реализации (ARViewPage.tsx, PlayCanvasViewPage.tsx)

```typescript
// ❌ НЕПРАВИЛЬНО: dangerouslySetInnerHTML (скрипты не выполняются)
;<div dangerouslySetInnerHTML={{ __html: html }} />

// ✅ ПРАВИЛЬНО: подход iframe (полное выполнение скриптов)
const iframe = document.createElement('iframe')
iframe.style.width = '100%'
iframe.style.height = '100%'
iframe.style.border = 'none'
container.appendChild(iframe)

const iframeDoc = iframe.contentDocument
iframeDoc.open()
iframeDoc.write(html) // AR.js HTML с тегами <script>
iframeDoc.close()
```

### Интеграция статических библиотек

Frontend работает с локальными библиотеками AR.js, обслуживаемыми непосредственно главным сервером Flowise:

#### Конфигурация сервера (packages/flowise-server/src/index.ts)

```typescript
// Статические ресурсы обслуживаются главным сервером Flowise
const publishFrtAssetsPath = path.join(__dirname, '../../../packages/publish-frt/base/dist/assets')
this.app.use('/assets', express.static(publishFrtAssetsPath))
```

#### Источники библиотек

-   **Локальный (Kiberplano)**: `/assets/libs/aframe/1.7.1/aframe.min.js` - обслуживается главным сервером
-   **Официальный (CDN)**: `https://aframe.io/releases/1.7.1/aframe.min.js` - внешний CDN

#### Преимущества

-   **Решение блокировки CDN**: Локальные библиотеки работают в регионах с ограничениями
-   **Единый сервер**: Не нужен отдельный сервер статических файлов
-   **Производительность**: Прямая раздача из главного экземпляра Flowise
-   **Обслуживание**: Библиотеки упакованы с frontend дистрибутивом

## Архитектура билдеров на основе шаблонов

Система билдеров была переработана в **модульную архитектуру на основе шаблонов**. Это обеспечивает максимальную гибкость и расширяемость для преобразования UPDL пространств на разные целевые платформы (AR.js, PlayCanvas и т.д.).

#### Ключевые компоненты

-   **`AbstractTemplateBuilder`**: Новый абстрактный базовый класс, который должны расширять все шаблоны (например, для AR.js квизов, PlayCanvas сцен). Он предоставляет общую функциональность, такую как управление библиотеками и обертывание структуры документа.
-   **`TemplateRegistry`**: Центральный реестр для управления и создания экземпляров различных билдеров шаблонов.
-   **`ARJSBuilder`**: Высокоуровневый билдер, который теперь действует как контроллер. Он определяет требуемый шаблон и делегирует весь процесс сборки соответствующему билдеру шаблона из реестра.
-   **`ARJSQuizBuilder`**: Конкретная реализация шаблона для генерации AR.js HTML квизов. Содержит собственный набор `Handlers` для обработки различных UPDL нод.
-   **`PlayCanvasMMOOMMBuilder` (внешний)**: Предоставляется `@universo/template-mmoomm` для генерации PlayCanvas MMOOMM сцен с MMO-специфичной функциональностью.
-   **`Handlers`**: Специализированные процессоры для различных типов UPDL нод теперь инкапсулированы внутри каждого шаблона (например, `builders/templates/quiz/arjs/handlers/`). MMOOMM handlers теперь находятся внутри `@universo/template-mmoomm`. Это делает каждый шаблон самодостаточным, сохраняя `publish-frt` компактным.

#### Архитектура Template-First

Новая архитектура организует код **сначала по шаблону, затем по технологии**:

```
builders/templates/
├─ quiz/                    # Шаблон образовательного квиза
│  └─ arjs/                 # Реализация AR.js
│     ├─ ARJSBuilder.ts     # Высокоуровневый контроллер
│     ├─ ARJSQuizBuilder.ts # Реализация шаблона
│     └─ handlers/          # Quiz-специфичные процессоры
└─ (external)               # MMO игровой шаблон перемещен в @universo/template-mmoomm
```

#### Особенности

-   **Максимальная расширяемость**: Легко добавлять новые целевые платформы (например, Three.js), создавая новую реализацию шаблона под существующими папками шаблонов.
-   **Переиспользование шаблонов**: Один и тот же шаблон (например, `quiz`) может поддерживать несколько технологий (AR.js, PlayCanvas и т.д.) с общей абстрактной логикой.
-   **Четкое разделение ответственности**: Высокоуровневые билдеры - простые контроллеры, в то время как реализации шаблонов содержат всю специфичную логику.
-   **Самодостаточные шаблоны**: Каждый шаблон объединяет свою собственную логику, обработчики и необходимые библиотеки, предотвращая конфликты.
-   **Типобезопасность**: Полная поддержка TypeScript с надежными интерфейсами (`ITemplateBuilder`, `TemplateConfig`).
-   **Общая функциональность**: Общая логика, такая как разрешение источников библиотек и обертывание HTML документа, обрабатывается абстрактным базовым классом, уменьшая дублирование кода.
-   **Готовность к будущему**: Архитектура поддерживает неограниченные комбинации шаблонов и технологий.

#### Недавние улучшения

-   **Рефакторинг PlayCanvasViewPage**: Использует `TemplateRegistry` для динамического выбора шаблона через `config.templateId`. MMOOMM билдер предоставляется `@universo/template-mmoomm`.
-   **Флаг ENABLE_BACKEND_FETCH**: Добавлен feature flag (по умолчанию: false) для опциональной загрузки данных из backend. При отключении компонент ожидает данные через props, улучшая безопасность и надежность.
-   **Эксклюзивная логика публикации**: Исправлена логика в `PublicationApi.savePublicationSettings()` для воздействия только на поддерживаемые технологии (`chatbot`, `arjs`, `playcanvas`) и предотвращения случайной модификации несвязанных свойств конфигурации.
-   **Улучшение локализации**: Добавлены недостающие ключи перевода `publish.playcanvas.loading` для улучшенной многоязычной поддержки.


#### Использование AR.js Builder

```typescript
import { ARJSBuilder } from './builders'

const builder = new ARJSBuilder()

// Сборка с использованием шаблона 'quiz' по умолчанию
const result = await builder.buildFromFlowData(flowDataString, {
    projectName: 'My AR Experience',
    markerType: 'preset',
    markerValue: 'hiro',
    libraryConfig: {
        arjs: { version: '3.4.7', source: 'kiberplano' },
        aframe: { version: '1.7.1', source: 'official' }
    }
})

// Или указать другой шаблон если доступен
const anotherResult = await builder.buildFromFlowData(flowDataString, {
    templateId: 'another-template'
    // ... другие опции
})

console.log(result.html) // Сгенерированный AR.js HTML
console.log(result.metadata) // Метаданные сборки
```

### Использование PlayCanvas Builder

```typescript
import { PlayCanvasBuilder } from './builders'

const builder = new PlayCanvasBuilder()
const result = await builder.buildFromFlowData(flowDataString, {
    projectName: 'MMOOMM Demo',
    templateId: 'mmoomm'
})

console.log(result.html) // PlayCanvas HTML
```

### Система скриптов PlayCanvas

The MMOOMM template includes a simple scripts system for reusable PlayCanvas behaviors:

```typescript
import { RotatorScript, getDefaultRotatorScript } from './scripts'

// Создать скрипт вращения
const rotator = RotatorScript.createDefault()

// Получить rotator по умолчанию для demo режима
const defaultRotator = getDefaultRotatorScript()
```

#### Ключевые особенности

-   **Простая архитектура**: Чистая, минимальная реализация для MVP
-   **Типобезопасность**: Полная поддержка TypeScript
-   **Модульный дизайн**: Скрипты организованы как отдельные модули
-   **Интеграция с demo**: Обеспечивает плавные анимации для demo режимов

#### Встроенные скрипты

-   **RotatorScript**: Простая анимация вращения вокруг оси Y для demo куба

Система скриптов обеспечивает плавную анимацию вращения для красного куба по умолчанию в demo режиме, извлеченную из главного билдера для лучшей организации кода.

### Шаблон Universo MMOOMM

Шаблон `mmoomm` предоставляет полнофункциональную космическую MMO среду с продвинутой игровой механикой:

#### Основные функции

-   **Промышленная лазерная система добычи**: Автонаведение лазерной добычи с 3-секундными циклами и интеграцией с инвентарем
-   **Управление космическим кораблем**: Движение WASD+QZ с физической моделью полета
-   **Управление инвентарем**: Грузовой отсек 20м³ с отслеживанием вместимости в реальном времени
-   **Система сущностей**: Корабли, астероиды, станции и порталы с сетевыми возможностями
-   **HUD в реальном времени**: Прогресс добычи, статус груза и системные индикаторы

#### Игровая механика

-   **Добыча**: Целевые астероиды в радиусе 75 единиц, добыча 1.5м³ ресурсов за цикл
-   **Движение**: Полное 6DOF движение корабля с следящей камерой
-   **Физика**: Обнаружение столкновений, динамика твердого тела и реалистичная космическая физика

Выберите **PlayCanvas MMOOMM Template** в конфигурации или передайте `templateId: 'mmoomm'` при использовании билдера.
Опубликуйте проект и откройте публичную ссылку, чтобы исследовать полнофункциональную MMO среду.

**Подробная документация:** Шаблон MMOOMM PlayCanvas предоставляется внешним пакетом `@universo/template-mmoomm`.

### Система типов сущностей

Шаблон MMOOMM включает комплексную систему сущностей со специализированными типами для космического MMO геймплея:

#### Доступные типы сущностей

-   **Ship**: Космический корабль под управлением игрока с системой лазерной добычи, инвентарем и физикой
-   **Asteroid**: Добываемые объекты с выходом ресурсов и механикой разрушения
-   **Station**: Торговые посты и стыковочные сооружения для коммерции
-   **Gate**: Телепортационные порталы для межсистемных путешествий
-   **Player**: Сетевые сущности игроков для поддержки мультиплеера
-   **Interactive**: Объекты с пользовательским поведением взаимодействия
-   **Vehicle**: Альтернативные сущности движения с другой физикой
-   **Static**: Неинтерактивные объекты окружения

#### Возможности сущностей

-   **Модульная архитектура**: Каждый тип сущности имеет выделенную логику в директории `entityTypes/`
-   **Интеграция компонентов**: Сущности работают без проблем с UPDL Component нодами
-   **Сетевая поддержка**: Встроенные сетевые возможности для мультиплеерных сценариев
-   **Интеграция физики**: Обнаружение столкновений, динамика твердого тела и пространственные отношения
-   **Управление памятью**: Автоматическая очистка и управление ссылками

## Архитектура обработки UPDL

Frontend теперь включает независимые возможности обработки UPDL через класс `UPDLProcessor`, устраняя зависимости от backend утилит.

### Ключевые компоненты

-   **UPDLProcessor**: Центральный класс для обработки UPDL flow (мигрирован из `packages/flowise-server/src/utils/buildUPDLflow.ts`)
-   **Импорт типов**: UPDL типы импортированы из пакета `@universo/publish-srv`
-   **Независимость Frontend**: Полная обработка UPDL на frontend без зависимостей от backend

### Возможности

-   **Анализ Flow**: Идентифицирует UPDL ноды и конечные ноды
-   **Обработка цепочек Space**: Обрабатывает многопространственные сценарии и последовательности сцен
-   **Интеграция данных**: Обрабатывает Data ноды, подключенные к Spaces
-   **Отношения объектов**: Отображает Object ноды на Data ноды
-   **Типобезопасность**: Полная поддержка TypeScript с централизованными определениями типов

### Использование

```typescript
import { UPDLProcessor } from './builders/common/UPDLProcessor'
import { IUPDLSpace, IUPDLMultiScene } from '@universo/publish-srv'

const result = UPDLProcessor.processFlowData(flowDataString)
if (result.multiScene) {
    // Обработка многопространственного сценария
} else if (result.updlSpace) {
    // Обработка одиночного пространства
}
```

## Система конфигурации библиотек

Выбираемые пользователем источники библиотек для AR.js и A-Frame для решения проблем блокировки CDN.

### Как это работает

Пользователи могут выбирать источники библиотек через UI:

1. **Конфигурация AR.js**:

    - Версия: В настоящее время поддерживается 3.4.7
    - Источник: "Официальный сервер" (CDN) или "Сервер Kiberplano" (локальный)

2. **Конфигурация A-Frame**:
    - Версия: В настоящее время поддерживается 1.7.1
    - Источник: "Официальный сервер" (CDN) или "Сервер Kiberplano" (локальный)

### Источники библиотек

-   **Официальный сервер**: Внешние CDN источники

    -   A-Frame: `https://aframe.io/releases/1.7.1/aframe.min.js`
    -   AR.js: `https://raw.githack.com/AR-js-org/AR.js/3.4.7/aframe/build/aframe-ar.js`

-   **Сервер Kiberplano**: Локальный сервер (решает блокировку CDN)
    -   A-Frame: `/assets/libs/aframe/1.7.1/aframe.min.js`
    -   AR.js: `/assets/libs/arjs/3.4.7/aframe-ar.js`

### Хранение конфигурации

Настройки библиотек хранятся в Supabase `chatbotConfig.arjs.libraryConfig`:

```json
{
    "arjs": {
        "libraryConfig": {
            "arjs": { "version": "3.4.7", "source": "kiberplano" },
            "aframe": { "version": "1.7.1", "source": "official" }
        }
    }
}
```

### Преимущества

-   **Решает блокировку CDN**: Пользователи в регионах с ограничениями могут использовать локальные библиотеки
-   **Выбор пользователя**: Каждый пользователь решает свой предпочтительный источник библиотек
-   **Постоянные настройки**: Конфигурация сохраняется для каждого canvas
-   **Обратная совместимость**: Существующие flows продолжают работать с настройками по умолчанию
-   **Будущая расширяемость**: Легко добавлять новые версии библиотек

## Интеграция с Backend

Приложение поддерживает модульную архитектуру с четким разделением между frontend и backend компонентами.

### Текущая архитектура

-   **Frontend обработка**: Обработка UPDL flow выполняется классом `UPDLProcessor` на frontend
-   **API коммуникация**: Взаимодействие с backend исключительно через REST API с использованием клиентов из директории `api/`
-   **Совместное использование типов**: UPDL типы централизованы в пакете `@universo/publish-srv` и импортируются frontend
-   **Сервисный слой**: Backend предоставляет `FlowDataService` для управления данными flow
-   **Независимость**: Нет прямых импортов из `packages/flowise-server` - полная модульная независимость

### Рабочий процесс обработки Flow

1. **Frontend Request**: User initiates publication through `ARJSPublisher` or `PlayCanvasPublisher` component.
2. **API Call**: Frontend sends request to `/api/v1/publish/arjs` (or other tech-specific endpoint).
3. **Backend Processing**: `FlowDataService` retrieves flow data from Flowise database.
4. **Frontend Processing**: `UPDLProcessor` analyzes and converts flow data to UPDL structures.
5. **Builder Generation**: The high-level builder (`ARJSBuilder`, `PlayCanvasBuilder`) delegates the build process to a registered template builder (e.g., `ARJSQuizBuilder`, `PlayCanvasMMOOMMBuilder`), which converts the UPDL space to the target format.
6. **Result**: Generated content served through public URLs with iframe rendering.

### Преимущества миграции

-   **Performance**: Frontend processing reduces backend load
-   **Modularity**: Clear separation of concerns between frontend and backend
-   **Type Safety**: Centralized type definitions prevent inconsistencies
-   **Scalability**: Frontend can handle complex UPDL processing independently
-   **Maintenance**: Simplified architecture with fewer cross-package dependencies

### Интеграция с системой ботов

This frontend application is closely integrated with the main bots publication system located in `packages/flowise-ui/src/views/publish/bots/`:

-   **Configuration Integration**: The AR.js publisher is accessible through the main publication interface in the bots system
-   **Shared Publication State**: Publication settings are stored in Supabase using the same `chatbotConfig` structure as the main bots system
-   **Technology-Specific Configuration**: AR.js and PlayCanvas settings are stored in their respective blocks (`arjs`, `playcanvas`) within `chatbotConfig`, maintaining separation from chatbot settings.
-   **API Route Consistency**: Uses the same Flowise API routes (`/api/v1/uniks/{unikId}/canvases/{canvasId}`) as the main system

### Интеграция с Supabase

Publication state persistence is handled through Supabase integration:

-   **Multi-Technology Structure**: Settings stored in `chatbotConfig` field with structure `{"chatbot": {...}, "arjs": {...}, "playcanvas": {...}}`
-   **Independent Publication States**: Each technology (chatbot, AR.js, PlayCanvas) has its own `isPublic` flag.
-   **Exclusive Publication**: The system ensures only one technology can be public at a time. If one is enabled, all others are automatically disabled.
-   **Auto-save Functionality**: Settings automatically saved when parameters change
-   **State Restoration**: Previous settings restored when component mounts
-   **Global Publication Status**: Overall `isPublic` flag set to true if any technology is public

#### Эксклюзивная логика публикации

The system implements exclusive publication: only one technology can be public at a time.
When enabling publication for one technology (AR.js, PlayCanvas, Chatbot),
all other technologies are automatically disabled. This ensures clear content delivery
and prevents conflicts between different publication modes.

## Основные компоненты

-   `UPDLProcessor` - Central class for UPDL flow processing (migrated from backend)
-   `ARJSPublisher` - Component for AR.js project streaming publication with Supabase integration
-   `ARJSExporter` - Demo component for AR.js code export
-   `ARViewPage` - Page component for AR space viewing using iframe approach
-   `ARJSBuilder` - The high-level controller that delegates to the template system.
-   `ARJSQuizBuilder` - A concrete template implementation for AR.js quizzes.
-   `PlayCanvasPublisher` - Component for PlayCanvas publication settings.
-   `PlayCanvasBuilder` - Builder for PlayCanvas HTML output with template support.
-   `PlayCanvasViewPage` - Page component for viewing PlayCanvas scenes.
-   `PlayCanvasMMOOMMBuilder` - A concrete template implementation for the Universo MMOOMM project with:
    -   Industrial laser mining system with auto-targeting and state machine
    -   Comprehensive entity system (ships, asteroids, stations, gates)
    -   Physics-based space flight mechanics and inventory management
    -   Real-time HUD with mining progress and cargo status
-   `PlayCanvas Scripts System` - Simple system for reusable PlayCanvas behaviors:
    -   `BaseScript` - Abstract base class for PlayCanvas scripts
    -   `RotatorScript` - Simple Y-axis rotation animation script

## Архитектура API

The application uses a modular API architecture organized into layers:

#### Основные API утилиты (`api/common.ts`)

-   `getAuthHeaders()` - Authentication token management from localStorage
-   `getCurrentUrlIds()` - Extract unikId and canvasId from URL
-   `getApiBaseUrl()` - Dynamic API base URL resolution

#### Слой Publication API (`api/publication/`)

-   **`PublicationApi`** - Base class for publication functionality across all technologies. Manages multi-technology settings in `chatbotConfig`.
-   **`ARJSPublicationApi`** - AR.js specific publication settings management (extends PublicationApi)
-   **`PlayCanvasPublicationApi`** - PlayCanvas specific publication settings management (extends PublicationApi)
-   **`StreamingPublicationApi`** - Real-time content generation and streaming publication

#### Особенности интеграции API

-   **Multi-Technology Support**: Publication API designed to support AR.js, PlayCanvas, Chatbot, and future technologies
-   **Supabase Integration**: Persistent storage using `chatbotConfig` structure with technology-specific blocks
-   **Backward Compatibility**: Includes compatibility aliases (`CanvasesApi`, `ARJSPublishApi`) for seamless migration
-   **Proper Authentication**: Uses correct Flowise routes with `unikId` and `x-request-from: internal` headers
-   **Circular Dependency Prevention**: Clean architecture with `common.ts` utilities to prevent import cycles

## Создание AR.js квизов с UPDL

AR quizzes are built using a chain of UPDL **Space** nodes. Each space may include **Data** nodes with questions. A question can have multiple **Data** answer nodes connected to it. Correct answers are marked with `isCorrect`, and answer nodes can also define `enablePoints` and `pointsValue` for the scoring system. Each answer node may be linked to an **Object** node that appears when the answer is selected.

Spaces can form a sequence via their `nextSpace` connection to create multi‑question quizzes. A space with no Data nodes can collect user info (`collectName`, `collectEmail`, `collectPhone`) and save it to Supabase leads. The final space in a chain can enable `showPoints` to display the participant score. Participant scores are now persisted in the dedicated `lead.points` integer column (the previous temporary storage in `lead.phone` is no longer used).

High‑level nodes are connected in a chain: **Entity** holds **Components**, components can raise **Events**, and events run **Actions**. This relationship `Entity → Component → Event → Action` describes interactive behaviour used by builders such as PlayCanvas MMOOMM.

## Рабочий процесс

The implementation uses streaming generation for AR.js from UPDL nodes with persistent configuration:

1. Settings are automatically loaded from Supabase when component mounts
2. User configures project parameters (title, marker, library sources) - settings auto-saved
3. User toggles "Make Public" - triggers publication and saves state to Supabase
4. The `ARJSPublisher` component sends a POST request to `/api/v1/publish/arjs` with the `canvasId` and selected options
5. The backend `PublishController.publishARJS` handler returns a response with `publicationId` and publication metadata
6. When accessing the public URL (`/p/{publicationId}`), the `PublicFlowView` component is rendered, which then determines the technology and renders the appropriate viewer (`ARViewPage` or `PlayCanvasViewPage`).
7. The page component makes a GET request to `/api/v1/publish/arjs/public/:publicationId` (or similar for other techs), which returns flow data from the backend.
8. The `UPDLProcessor` analyzes the flow data and converts it to UPDL structures on the frontend.
9. The appropriate Builder system (`ARJSBuilder`, `PlayCanvasBuilder`) converts the UPDL space to renderable elements using the correct template.
10. **Critical**: Generated HTML is rendered in an iframe for proper script execution and library loading.

## Настройка и разработка

To run the project:

```bash
pnpm run dev
```

To build:

```bash
pnpm run build
```

## Процесс сборки

The build process involves two steps:

1. **TypeScript Compilation**: Compiles TypeScript files to JavaScript
2. **Gulp Tasks**: Copies static assets (SVG, PNG, JSON, CSS, JS libraries) to the dist folder

### Доступные скрипты

-   `pnpm clean` - Clean the dist directory
-   `pnpm build` - Build the package (TypeScript + Gulp)
-   `pnpm dev` - Watch mode for development
-   `pnpm lint` - Lint the source code

### Задачи Gulp

The Gulp process copies all static files (SVG, PNG, JPG, JSON, CSS, JS) from the source directories to the dist folder, preserving the directory structure. This ensures that assets and local libraries are available at runtime.

## Зависимости

Make sure to install dependencies from the root of the project using:

```bash
pnpm install
```

## Разработка

When adding new components or pages, follow these practices:

1. Create components in the appropriate directory
2. Use TypeScript interfaces for props and state
3. Add appropriate static assets to the same folder (they will be copied during build)
4. Implement internationalization support using the i18n system
5. **For AR.js content**: Always use iframe approach for proper script execution

## Демо-режим

For testing and demonstration, the `ARJSPublisher` component has a DEMO_MODE that can be activated by setting the constant `DEMO_MODE = true`. In this mode:

1. Template selection is displayed (currently only one demo template "Quiz")
2. No real API requests are made during publication
3. A fixed publication URL is provided
4. All UI interactions work, but without actual server operations
5. Supabase integration is disabled

## Текущие ограничения

-   No support for offline mode or space caching for reuse
-   No optimization for mobile devices
-   The Export tab is a demo only, without full HTML/ZIP export functionality

---

_Universo Platformo | Publication Frontend Module_

## Режим AR-обоев (без маркера)

The AR.js exporter now supports a markerless "wallpaper" display mode for quizzes.

### Что это делает

-   Renders a safe animated background behind the quiz UI without requiring a physical marker.
-   Uses an animated wireframe sphere placed in the camera as a lightweight AR‑style backdrop.

### Изменения UI (ARJSPublisher)

-   New selector: `AR Display Type` with options `AR‑wallpaper` and `Standard marker`.
-   When `AR‑wallpaper` is selected:
    -   Marker selector and marker preview are hidden.
    -   A new selector appears: `Wallpaper type` (currently `standard`).
    -   Publication instructions switch to markerless instructions.
-   Disabled technologies in the main mode selector are now visually dimmed (Babylon.js, A‑Frame) for clarity.

### Постоянство

Settings are saved per space to Supabase in `chatbotConfig.arjs`:

```json
{
    "arjs": {
        "isPublic": true,
        "projectTitle": "My AR Quiz",
        "generationMode": "streaming",
        "arDisplayType": "wallpaper",
        "wallpaperType": "standard",
        "libraryConfig": {
            "arjs": { "version": "3.4.7", "source": "official" },
            "aframe": { "version": "1.7.1", "source": "official" }
        }
    }
}
```

### Поведение Builder

-   `ARJSQuizBuilder` renders without `<a-marker>` when `arDisplayType = 'wallpaper'`.
-   Adds an animated wireframe sphere as background; rotation duration set to `90000ms` (slower, smoother motion).
-   Quiz UI overlays remain unchanged.

### Рендеринг публичного просмотра

-   `ARViewPage` retrieves `renderConfig` from the public API and forwards it to `ARJSBuilder.buildFromFlowData`:

```json
{
    "renderConfig": {
        "arDisplayType": "wallpaper",
        "wallpaperType": "standard",
        "markerType": "preset", // present for legacy
        "markerValue": "hiro" // present for legacy
    }
}
```

-   Fallbacks preserve legacy marker behavior when `renderConfig` is missing.

---

## 📖 Additional Resources

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Query Key Factory Pattern](https://tkdodo.eu/blog/effective-react-query-keys)

---

## 📄 License

MIT License - see LICENSE file for details

