# Фронтенд аутентификации (@universo/auth-frt)

Современный React-пакет аутентификации, предоставляющий безопасные, переиспользуемые примитивы аутентификации для экосистемы Universo Platformo. С защитой CSRF, механизмами автоматических повторов и полной интеграцией с Material-UI.

## Обзор

Этот пакет предоставляет полное решение аутентификации, которое заменяет устаревшую аутентификацию на основе сессий современной аутентификацией на основе токенов. Включает React-компоненты, хуки и API-клиенты, разработанные для продакшн-уровня безопасности и пользовательского опыта.

## Ключевые возможности

- **Безопасный API-клиент**: Клиент на основе Axios с управлением CSRF-токенами и поддержкой cookies
- **Управление сессиями**: React-хуки для состояния аутентификации и жизненного цикла сессий
- **Обработка ошибок**: Централизованная обработка 401 ошибок с автоматическими редиректами
- **Компоненты Material-UI**: Готовые формы аутентификации с настраиваемым стилем
- **TypeScript в первую очередь**: Полная типобезопасность с комплексными определениями TypeScript
- **Логика повторов**: Интеллектуальный механизм повторов для временных сетевых сбоев
- **Опыт разработчика**: Отладочное логирование и обнаружение синглтонов для разработки

## Архитектура

### Поток аутентификации
```
1. Клиент запрашивает CSRF-токен → Сервер валидирует → Токен сохранен в sessionStorage
2. Все API-запросы включают CSRF-токен → Сервер валидирует → Ответ/Редирект
3. 401 ошибки запускают автоматический выход → Редирект на /auth с путем возврата
4. Обновление сессии поддерживает состояние аутентификации между сессиями браузера
```

### Основные компоненты
- **AuthProvider**: Провайдер контекста для глобального состояния аутентификации
- **AuthClient**: Настроенный экземпляр Axios с перехватчиками
- **AuthView**: Полнофункциональный интерфейс аутентификации Material-UI
- **LoginForm**: Минимальный управляемый компонент формы
- **useAuthError**: Хук централизованной обработки ошибок

## Структура

```
src/
├── components/
│   ├── AuthView.tsx           # Полный интерфейс аутентификации Material-UI
│   └── LoginForm.tsx          # Минимальный управляемый компонент формы
├── hooks/
│   ├── useSession.ts          # Хук управления сессиями
│   └── useAuthError.ts        # Централизованная обработка 401 ошибок
├── providers/
│   └── authProvider.tsx       # Провайдер контекста React
├── api/
│   └── client.ts              # Клиент Axios с защитой CSRF
└── index.ts                   # Экспорты пакета
```

## Компоненты и хуки

### AuthProvider
Провайдер контекста React, который глобально управляет состоянием аутентификации.

```tsx
import { createAuthClient, AuthProvider } from '@universo/auth-frt'

const authClient = createAuthClient({ 
  baseURL: `${window.location.origin}/api/v1` 
})

<AuthProvider client={authClient}>
  <App />
</AuthProvider>
```

**Возможности:**
- Автоматическое восстановление сессии при загрузке приложения
- Централизованные методы входа/выхода
- Состояния загрузки и обработка ошибок
- Предупреждения разработки для дублирующих экземпляров

### AuthView (Material-UI)
Полнофункциональный интерфейс аутентификации с режимами входа/регистрации.

```tsx
import { AuthView } from '@universo/auth-frt'

<AuthView
  labels={{
    welcomeBack: "Добро пожаловать",
    register: "Создать аккаунт",
    email: "Email",
    password: "Пароль",
    loginButton: "Войти",
    registerButton: "Зарегистрироваться",
    // ... больше меток
  }}
  onLogin={async (email, password) => {
    await authClient.post('auth/login', { email, password })
  }}
  onRegister={async (email, password) => {
    await authClient.post('auth/register', { email, password })
  }}
  errorMapper={(error) => translateError(error)}
/>
```

**Возможности:**
- Переключение между режимами входа/регистрации  
- Интеграция с Material-UI TextField с иконками
- Комплексная обработка и отображение ошибок
- Настраиваемый стиль с slots/slotProps
- Состояния загрузки с индикаторами прогресса

### LoginForm (Минимальный)
Легковесный управляемый компонент формы для пользовательских реализаций.

```tsx
import { LoginForm } from '@universo/auth-frt'

<LoginForm
  client={authClient}
  labels={{ 
    submit: 'Войти', 
    submitting: 'Выполняется вход…' 
  }}
  onSuccess={(user) => console.log('Вошел:', user)}
  onError={(message) => showToast(message)}
/>
```

### Хук useSession
Управляет состоянием сессии и предоставляет методы аутентификации.

```tsx
import { useSession } from '@universo/auth-frt'

const { user, loading, error, refresh, logout } = useSession({ 
  client: authClient,
  fetchOnMount: true 
})

// Данные текущего пользователя
console.log(user) // { id: string, email: string } | null

// Ручное обновление сессии
await refresh()

// Выход с очисткой
await logout()
```

### Хук useAuthError
Централизованная обработка 401 ошибок с автоматическими редиректами.

```tsx
import { useAuthError } from '@universo/auth-frt'

const { handleAuthError } = useAuthError()

try {
  await api.get('/protected-resource')
} catch (error) {
  if (handleAuthError(error)) {
    return // 401 ошибка была обработана автоматически
  }
  // Обработать другие ошибки вручную
  setLocalError(error)
}
```

**Поведение:**
- Обнаруживает 401 Unauthorized ответы
- Автоматически выходит из аутентифицированных пользователей
- Редиректит на `/auth` с путем возврата
- Сохраняет текущее местоположение для редиректа после входа

### Хук useAuth
Доступ к контексту аутентификации из любого компонента.

```tsx
import { useAuth } from '@universo/auth-frt'

const { user, isAuthenticated, login, logout, client } = useAuth()

if (!isAuthenticated) {
  return <LoginPrompt />
}

return <AuthenticatedContent user={user} />
```

## Возможности API-клиента

### Защита CSRF
Автоматическое получение и включение CSRF-токена в запросы.

```typescript
const client = createAuthClient({ 
  baseURL: '/api/v1',
  csrfPath: 'auth/csrf',  // По умолчанию
  csrfStorageKey: 'up.auth.csrf'  // По умолчанию
})

// Все запросы автоматически включают заголовок X-CSRF-Token
await client.post('protected-endpoint', data)
```

### Логика повторов
Интеллектуальный механизм повторов для временных сбоев.

- **Повторяемые методы**: GET, HEAD, OPTIONS
- **Повторяемые коды состояния**: 503 Service Unavailable, 504 Gateway Timeout
- **Максимальные попытки**: 4 повтора с экспоненциальной отсрочкой
- **Соблюдение Retry-After**: Учитывает заголовки retry-after сервера

### Поддержка Cookie
Автоматическая обработка cookie для постоянства сессий.

```typescript
// Все запросы включают withCredentials: true
// Cookie автоматически отправляются и принимаются
const client = createAuthClient({ baseURL: '/api/v1' })
```

## Разработка

### Предварительные требования
- Node.js 18+
- Среда рабочего пространства PNPM  
- Peer-зависимости Material-UI

### Команды
```bash
# Установить зависимости (из корня проекта)
pnpm install

# Собрать пакет (двойной вывод CJS/ESM)
pnpm --filter @universo/auth-frt build

# Режим разработки с отслеживанием
pnpm --filter @universo/auth-frt dev

# Проверить TypeScript
pnpm --filter @universo/auth-frt lint
```

### Вывод сборки
- **CommonJS**: `dist/index.js` + `dist/index.d.ts`  
- **ES Модули**: `dist/index.mjs` + `dist/index.d.ts`
- **TypeScript**: Включены полные определения типов

### Возможности разработки
- **Отладочное логирование**: Комплексное логирование в консоль для потока аутентификации
- **Обнаружение синглтонов**: Предупреждения для дублирующих экземпляров пакета
- **Boundaries ошибок**: Грациозная обработка ошибок в разработке и продакшене

## Примеры интеграции

### Полная настройка приложения
```tsx
// App.tsx
import { createAuthClient, AuthProvider, useAuth } from '@universo/auth-frt'
import { Routes, Route, Navigate } from 'react-router-dom'

const authClient = createAuthClient({ 
  baseURL: process.env.REACT_APP_API_URL 
})

function App() {
  return (
    <AuthProvider client={authClient}>
      <AppRoutes />
    </AuthProvider>
  )
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) return <LoadingScreen />
  
  return (
    <Routes>
      <Route path="/auth" element={
        isAuthenticated ? <Navigate to="/" /> : <AuthPage />
      } />
      <Route path="/*" element={
        isAuthenticated ? <AuthenticatedApp /> : <Navigate to="/auth" />
      } />
    </Routes>
  )
}
```

### Защищенная обертка API
```tsx
// api/client.ts
import { createAuthClient } from '@universo/auth-frt'

export const apiClient = createAuthClient({
  baseURL: `${window.location.origin}/api/v1`
})

// Все запросы автоматически включают CSRF-токены и обрабатывают 401 ошибки
export const api = {
  users: {
    list: () => apiClient.get('/users'),
    create: (data) => apiClient.post('/users', data),
    update: (id, data) => apiClient.put(`/users/${id}`, data)
  }
}
```

### Пользовательское отображение ошибок
```tsx
// utils/errorMapper.ts
export const translateError = (error: string): string => {
  const errorMap: Record<string, string> = {
    'Invalid credentials': 'Email или пароль неверны',
    'User not found': 'Аккаунт с таким email не найден',
    'Email already exists': 'Аккаунт с таким email уже существует'
  }
  
  return errorMap[error] || error
}

// Использование в компоненте
<AuthView 
  onLogin={handleLogin}
  onRegister={handleRegister}
  errorMapper={translateError}
  labels={authLabels}
/>
```

## Соображения безопасности

### Защита CSRF
- Токены получены с эндпойнта `/auth/csrf`
- Хранятся в sessionStorage (не localStorage)
- Автоматически включены во все запросы
- Недействительные токены запускают повторное получение (статус 419)

### Управление сессиями  
- HTTP-only cookie рекомендованы для продакшена
- Автоматическое обновление сессии при загрузке приложения
- Безопасный выход с очисткой на стороне сервера
- Сохранение пути возврата для пользовательского опыта

### Обработка ошибок
- 401 ошибки запускают автоматический выход
- Чувствительные детали ошибок скрыты в продакшене
- Комплексное логирование для отладки
- Грациозная деградация для сетевых сбоев

## Руководство по миграции

### От устаревшей аутентификации
Пакет предоставляет полную замену устаревшей аутентификации Flowise:

**Старый паттерн:**
```tsx
// Подход устаревшего LoginDialog
const [loginOpen, setLoginOpen] = useState(false)

useEffect(() => {
  if (apiError?.response?.status === 401) {
    setLoginOpen(true)
  }
}, [apiError])

<LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
```

**Новый паттерн:**
```tsx
// Современный подход useAuthError
const { handleAuthError } = useAuthError()

useEffect(() => {
  if (apiError && !handleAuthError(apiError)) {
    setLocalError(apiError)
  }
}, [apiError, handleAuthError])
```

### Шаги интеграции
1. **Заменить AuthProvider**: Обернуть приложение новым `AuthProvider`
2. **Обновить API-клиенты**: Использовать `createAuthClient` вместо простого axios
3. **Заменить LoginDialog**: Использовать компоненты `AuthView` или `LoginForm`
4. **Обновить обработку ошибок**: Заменить ручную обработку 401 на `useAuthError`
5. **Удалить устаревший код**: Удалить старые компоненты и логику аутентификации

## Связанная документация

- [Бэкенд сервиса аутентификации](../../auth-srv/base/README-RU.md)
- [Пакет API-клиента](../../universo-api-client/README-RU.md)
- [Шаблон Material-UI](../../universo-template-mui/base/README-RU.md)
- [Архитектура аутентификации](../../../docs/ru/universo-platformo/README.md)

---

**Universo Platformo | Пакет фронтенда аутентификации**
