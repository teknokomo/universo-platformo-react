# @universo/admin-frontend

> ✨ **Современный пакет** - React 18 с TypeScript и Material-UI

Фронтенд-приложение для админ-панели с функциями управления глобальными пользователями.

## Информация о пакете

- **Версия**: 0.1.0
- **Тип**: React Frontend Package (Modern)
- **Фреймворк**: React 18 + TypeScript + Material-UI
- **Система сборки**: tsdown (dual build - CJS + ESM)

## Ключевые возможности

### 👥 Управление глобальными пользователями
- **Список**: Таблица с пагинацией, поиском и фильтрацией
- **Назначение ролей**: Выдача ролей `Superuser`, `User` или пользовательских глобальных ролей по email
- **Обновление ролей**: Изменение ролей и добавление комментариев
- **Отзыв доступа**: Удаление глобального доступа у пользователей

### 🎨 Пользовательский интерфейс
- **Интеграция с Material-UI**: Современные компоненты с единым дизайном
- **Табличный и карточный вид**: Переключение между режимами отображения
- **Чипы ролей**: Цветовая индикация ролей
- **Диалоги подтверждения**: Безопасное удаление с подтверждением

### 🔧 Технические особенности
- **TanStack Query**: Оптимистичные обновления и кэширование
- **Интернационализация**: Английский и русский переводы
- **Редактирование codename**: Формы ролей используют одно каноническое локализованное поле codename
- **Типобезопасность**: Полная типизация TypeScript

## Установка

```bash
# Сборка пакета
pnpm --filter @universo/admin-frontend build

# Режим разработки
pnpm --filter @universo/admin-frontend dev
```

## Использование

### Компоненты страниц

```tsx
import { AdminAccess, AdminBoard } from '@universo/admin-frontend'

// В роутах
<Route path="/admin/access" element={<AdminAccess />} />
<Route path="/admin/board" element={<AdminBoard />} />
```

### React Query хуки

```tsx
import { useIsSuperadmin, useGrantGlobalRole } from '@universo/admin-frontend'

function MyComponent() {
    const isSuperadmin = useIsSuperadmin()
    const grantMutation = useGrantGlobalRole()
    
    const handleGrant = () => {
        grantMutation.mutate({
            email: 'user@example.com',
            role: 'User',
            comment: 'Доступ выдан для ревью проекта'
        })
    }
}
```

### Интеграция i18n

```tsx
// Импорт и регистрация переводов
import '@universo/admin-frontend/i18n'

// Использование переводов
const { t } = useTranslation('admin')
t('board.title') // "Панель администрирования"
```

## API-слой

### Ключи запросов

```typescript
import { adminQueryKeys } from '@universo/admin-frontend'

// Доступные ключи
adminQueryKeys.globalUsersList(params)  // Список с пагинацией
adminQueryKeys.globalUsersMe()          // Роль текущего пользователя
adminQueryKeys.globalUsersStats()       // Статистика для дашборда
```

### API-клиент

```typescript
import { createAdminApi } from '@universo/admin-frontend'

const adminApi = createAdminApi(axiosInstance)

// Методы
adminApi.listGlobalUsers(params)
adminApi.getMyGlobalRole()
adminApi.grantGlobalRole(data)
adminApi.updateGlobalRole(id, data)
adminApi.revokeGlobalRole(id)
```

## Структура файлов

```
packages/admin-frontend/base/
├── src/
│   ├── api/
│   │   ├── adminApi.ts        # API-клиент с пагинацией
│   │   ├── apiClient.ts       # Axios-инстанс
│   │   └── queryKeys.ts       # Ключи TanStack Query
│   ├── hooks/
│   │   ├── useGlobalRole.ts   # Хуки состояния ролей
│   │   └── index.ts
│   ├── pages/
│   │   ├── AdminAccess.tsx    # Страница управления пользователями
│   │   ├── AdminBoard.tsx     # Страница дашборда
│   │   └── MemberActions.tsx  # Обработчики действий
│   ├── types/
│   │   └── index.ts           # TypeScript-интерфейсы
│   ├── i18n/
│   │   ├── en.json            # Английские переводы
│   │   └── ru.json            # Русские переводы
│   └── index.ts               # Экспорты пакета
├── dist/                       # Собранные файлы
└── package.json
```

## Зависимости

| Пакет | Версия | Назначение |
|-------|--------|------------|
| `@tanstack/react-query` | catalog | Загрузка данных и кэширование |
| `@mui/material` | catalog | UI-компоненты |
| `axios` | catalog | HTTP-клиент |
| `react-i18next` | catalog | Интернационализация |

## Peer-зависимости

Этот пакет ожидает следующие зависимости от хост-приложения:

```json
{
    "react": ">=18",
    "react-dom": ">=18",
    "react-router-dom": ">=6"
}
```

## Связанные пакеты

- `@universo/admin-backend` - Backend API для админ-панели
- `@universo/auth-frontend` - Хуки аутентификации
- `@universo/template-mui` - Общие UI-компоненты
- `@universo/types` - Общие TypeScript-типы
