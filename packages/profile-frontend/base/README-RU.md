# @universo/profile-frontend

> 🏗️ **Современный пакет** - TypeScript-first архитектура с двойной системой сборки (CJS + ESM)

React фронтенд для управления профилем пользователя и аутентификации в Universo Platformo.

## Информация о пакете

- **Версия**: 0.1.0
- **Тип**: Frontend React Package (TypeScript)
- **Статус**: ✅ Активная разработка
- **Архитектура**: Современная с двойной системой сборки (CJS + ESM)

## Ключевые функции

### Управление профилем пользователя
- **Данные профиля**: Отображение и редактирование ника, имени, фамилии пользователя
- **Обновления email**: Безопасное изменение адреса электронной почты через Supabase auth
- **Управление паролями**: Безопасные обновления пароля с проверкой текущего пароля
- **Валидация в реальном времени**: Клиентская валидация форм с немедленной обратной связью

### Безопасность и аутентификация
- **Интеграция JWT токенов**: Аутентификация Bearer токеном с автоматическим обновлением
- **Проверка текущего пароля**: Обязательная проверка перед изменением пароля
- **Безопасная API коммуникация**: Все запросы аутентифицированы и зашифрованы
- **Валидация ввода**: Комплексная клиентская и серверная валидация

### Пользовательский опыт
- **Интернационализация**: Поддержка нескольких языков (английский/русский)
- **Адаптивный дизайн**: Мобильно-дружественные компоненты Material-UI
- **Состояния загрузки**: Визуальные индикаторы для всех асинхронных операций
- **Обработка ошибок**: Комплексные сообщения об ошибках с локализацией
- **Обратная связь об успехе**: Четкие сообщения подтверждения для успешных операций

## Установка

```bash
# Установка из корня workspace
pnpm install

# Сборка пакета
pnpm --filter @universo/profile-frontend build
```

## Структура файлов

```
packages/profile-frontend/base/
├── src/
│   ├── i18n/              # Интернационализация
│   │   └── locales/       # Языковые файлы (en, ru)
│   ├── pages/             # React компоненты страниц
│   │   ├── Profile.jsx    # Основной компонент управления профилем
│   │   └── __tests__/     # Тесты компонентов
│   └── index.ts           # Экспорты пакета
├── dist/                  # Скомпилированный вывод (CJS, ESM, types)
├── package.json
├── tsconfig.json
├── tsdown.config.ts       # Конфигурация сборки
├── vitest.config.ts       # Конфигурация тестов
├── README.md              # Английская документация
└── README-RU.md           # Данный файл
```

## Использование

### Интеграция базового компонента
```tsx
import { ProfilePage } from '@universo/profile-frontend'

// Использование в React приложении
function UserProfileRoute() {
  return <ProfilePage />
}
```

### Интеграция с роутером
```tsx
import { Routes, Route } from 'react-router-dom'
import { ProfilePage } from '@universo/profile-frontend'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/profile" element={<ProfilePage />} />
    </Routes>
  )
}
```

### Требуется аутентификация
```tsx
import { ProfilePage } from '@universo/profile-frontend'
import { useAuth } from '@universo/auth-frontend'

function ProtectedProfile() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <div>Пожалуйста, войдите в систему для просмотра профиля</div>
  }

  return <ProfilePage />
}
```

## Интеграция API

### Эндпоинты данных профиля
```http
# Получить профиль пользователя
GET /api/v1/profile/:userId
Authorization: Bearer <jwt_token>

# Обновить информацию профиля
PUT /api/v1/profile/:userId
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "nickname": "newNickname",
  "first_name": "Иван",
  "last_name": "Иванов"
}
```

### Эндпоинты аутентификации
```http
# Обновить email пользователя
PUT /api/v1/auth/email
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "email": "new@example.com"
}

# Обновить пароль пользователя
PUT /api/v1/auth/password
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "currentPassword": "старыйПароль123",
  "newPassword": "новыйБезопасныйПароль456"
}
```

### Обработка ответов
```typescript
// Обработка API ответов с правильным управлением ошибками
const handleApiResponse = async (response: Response) => {
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Операция не удалась')
  }

  return data
}

// Пример использования
try {
  const response = await fetch('/api/v1/profile/123', {
    headers: { Authorization: `Bearer ${token}` }
  })
  const result = await handleApiResponse(response)
  console.log('Данные профиля:', result.data)
} catch (error) {
  console.error('Не удалось загрузить профиль:', error.message)
}
```

## Архитектура компонентов

### Структура страницы профиля
```tsx
// Структура основного компонента Profile
const Profile = () => {
  // Управление состоянием
  const [profile, setProfile] = useState({
    nickname: '',
    first_name: '',
    last_name: ''
  })

  // Интеграция аутентификации
  const { user, getAccessToken } = useAuth()
  const { t } = useTranslation('profile')

  // Секции формы
  return (
    <MainCard title={t('title')}>
      <ProfileSection />
      <EmailSection />
      <PasswordSection />
    </MainCard>
  )
}
```

### Валидация форм
```typescript
// Логика клиентской валидации
const validateProfile = (data) => {
  const errors = {}

  if (!data.nickname?.trim()) {
    errors.nickname = 'Никнейм обязателен'
  }

  if (data.email && !/\S+@\S+\.\S+/.test(data.email)) {
    errors.email = 'Некорректный формат email'
  }

  if (data.newPassword && data.newPassword.length < 6) {
    errors.password = 'Пароль должен содержать минимум 6 символов'
  }

  return { isValid: Object.keys(errors).length === 0, errors }
}
```

## Разработка

### Предварительные требования
- Node.js 22.22.2 recommended (>=22.6.0 required)
- pnpm 10.x
- TypeScript 5+

### Доступные скрипты
```bash
# Разработка
pnpm build              # Сборка для продакшена (двойная CJS/ESM)
pnpm build:watch        # Сборка в режиме наблюдения
pnpm dev                # Разработка с TypeScript watch

# Тестирование
pnpm test               # Запуск тестового набора Vitest
pnpm lint               # Запуск ESLint

# Проверка типов
pnpm type-check         # Проверка компиляции TypeScript
```

### Система сборки
Данный пакет использует `tsdown` для двойного вывода сборки:
- **CommonJS**: `dist/index.js` (для совместимости с устаревшими системами)
- **ES Modules**: `dist/index.mjs` (для современных сборщиков)
- **Типы**: `dist/index.d.ts` (объявления TypeScript)

### Процесс разработки
```bash
# Запуск режима разработки
pnpm --filter @universo/profile-frontend dev

# В другом терминале, запуск тестов
pnpm --filter @universo/profile-frontend test

# Сборка для продакшена
pnpm --filter @universo/profile-frontend build
```

## Тестирование

### Структура тестов
```
src/
├── pages/
│   ├── Profile.jsx
│   └── __tests__/
│       └── Profile.test.tsx
└── setupTests.ts
```

### Подход к тестированию
```typescript
// Пример теста компонента
import { render, screen, fireEvent } from '@testing-library/react'
import { Profile } from '../Profile'

describe('Profile Component', () => {
  test('отображает поля формы профиля', () => {
    render(<Profile />)

    expect(screen.getByLabelText(/никнейм/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /обновить/i })).toBeInTheDocument()
  })

  test('валидирует обязательные поля', async () => {
    render(<Profile />)

    const submitButton = screen.getByRole('button', { name: /обновить/i })
    fireEvent.click(submitButton)

    expect(await screen.findByText(/никнейм обязателен/i)).toBeInTheDocument()
  })
})
```

### Запуск тестов
```bash
pnpm test                    # Запуск всех тестов
pnpm test -- --watch         # Режим наблюдения
pnpm test -- --coverage      # С отчетом покрытия
```

## Соображения безопасности

### Поток аутентификации
- **Управление JWT токенами**: Автоматическое обновление и валидация токенов
- **Безопасная API коммуникация**: Все запросы используют HTTPS с Bearer токенами
- **Проверка текущего пароля**: Требуется для изменения пароля
- **Санитизация ввода**: Клиентская валидация предотвращает XSS атаки

### Защита данных
- **Обработка чувствительных данных**: Пароли никогда не хранятся в состоянии компонентов
- **Безопасная передача**: Все данные шифруются при передаче
- **Изоляция пользователей**: Каждый пользователь может получить доступ только к своим данным профиля
- **Информация об ошибках**: Сообщения об ошибках не раскрывают чувствительную системную информацию

## Требования для интеграции

### Необходимые зависимости
```typescript
// Необходимые peer dependencies
import { useAuth } from '@universo/auth-frontend'
import { useTranslation } from '@universo/i18n'
import { MainCard } from '@universo/template-mui'
```

### Конфигурация окружения
```bash
# Необходимые API эндпоинты
REACT_APP_API_BASE_URL=https://api.example.com
REACT_APP_PROFILE_ENDPOINT=/api/v1/profile
REACT_APP_AUTH_ENDPOINT=/api/v1/auth
```

## Конфигурация

### Конфигурация TypeScript
Пакет использует строгую конфигурацию TypeScript:
- Включены строгие проверки null
- Нет неявных типов any
- Строгие типы функций
- Включены все строгие опции компилятора

### Конфигурация сборки
```typescript
// tsdown.config.ts
export default {
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true
}
```

## Участие в разработке

### Стиль кода
- Следуйте конфигурации ESLint
- Используйте TypeScript для новых компонентов
- Следуйте лучшим практикам React
- Пишите комплексные тесты

### Процесс Pull Request
1. Создайте feature ветку от `main`
2. Реализуйте изменения с тестами
3. Обновите документацию
4. Отправьте PR с описанием

## Связанные пакеты
- [`@universo/profile-backend`](../../profile-backend/base/README-RU.md) - Бэкенд сервис профилей
- [`@universo/auth-frontend`](../../auth-frontend/base/README-RU.md) - Фронтенд аутентификации
- [`@universo/i18n`](../../universo-i18n/base/README-RU.md) - Интернационализация

---
*Часть [Universo Platformo](../../../README-RU.md) - Пакетная бизнес-платформа*
