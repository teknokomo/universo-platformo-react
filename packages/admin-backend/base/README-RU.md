# @universo/admin-backend

> 🏗️ **Современный пакет** - Архитектура TypeScript-first с Express.js, SQL-first persistence и Zod

Бэкенд-сервис для управления глобальными администраторами (суперадмин и супермодератор) с RBAC-системой.

## Информация о пакете

- **Версия**: 0.1.0
- **Тип**: Backend-сервис (TypeScript)
- **Статус**: ✅ Активная разработка
- **Архитектура**: Modern с Express.js + SQL-first persistence helper-модулями + Zod валидация

## Ключевые возможности

### 🔐 RBAC-система
- **Глобальные роли**: superadmin, supermoderator с настраиваемыми правами
- **Уровни доступа**: 'view' (только чтение) и 'manage' (полный доступ)
- **Метаданные ролей**: Локализованные названия, цвета и описания

### 🛡️ Безопасность
- Управление через переменную окружения (`GLOBAL_ADMIN_ENABLED`)
- Middleware для проверки ролей на уровне запроса
- Защита от SQL-инъекций через параметризованные запросы
- Интеграция с RLS через PostgreSQL-функции

### 📊 База данных
- SQL-first store-модули в схеме `admin`
- PostgreSQL с JSONB для локализованного контента
- PostgreSQL-функции переиспользуются для согласованных проверок доступа и прав

## API-справочник

### Эндпоинты глобальных пользователей

```http
GET    /api/v1/admin/global-users          # Список глобальных пользователей (view)
GET    /api/v1/admin/global-users/me       # Получить глобальную роль текущего пользователя
GET    /api/v1/admin/global-users/stats    # Статистика для дашборда
POST   /api/v1/admin/global-users          # Назначить глобальную роль (manage)
PUT    /api/v1/admin/global-users/:id      # Обновить роль/комментарий (manage)
DELETE /api/v1/admin/global-users/:id      # Отозвать глобальный доступ (manage)
```

### Эндпоинты ролей

```http
GET    /api/v1/admin/roles                 # Список всех ролей
GET    /api/v1/admin/roles/global          # Список ролей с глобальным доступом
```

## Использование

### Интеграция с Express

```typescript
import { createGlobalUsersRoutes, createGlobalAccessService } from '@universo/admin-backend'
import { createKnexExecutor, getKnex } from '@universo/database'

const globalAccessService = createGlobalAccessService({ getDbExecutor: () => createKnexExecutor(getKnex()) })
const globalUsersRoutes = createGlobalUsersRoutes({ globalAccessService })

app.use('/api/v1/admin/global-users', globalUsersRoutes)
```

### Проверка доступа в других модулях

```typescript
import { createGlobalAccessService } from '@universo/admin-backend'
import { createKnexExecutor, getKnex } from '@universo/database'

const globalAccessService = createGlobalAccessService({ getDbExecutor: () => createKnexExecutor(getKnex()) })

// В вашем guard'е доступа
const hasAccess = await globalAccessService.canAccessAdmin(userId)
if (hasAccess) {
    // Пропустить проверку владельца для глобальных админов
}
```

## Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `GLOBAL_ADMIN_ENABLED` | Включить/выключить админ-панель | `false` |

## Схема базы данных

### admin.roles

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | UUID | Первичный ключ |
| name | VARCHAR(50) | Уникальный идентификатор роли |
| display_name | JSONB | Локализованные названия `{"en": "...", "ru": "..."}` |
| has_global_access | BOOLEAN | Предоставляет доступ ко всей платформе |
| is_system | BOOLEAN | Защита от удаления |

### admin.user_roles

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | UUID | Первичный ключ |
| user_id | UUID | Ссылка на auth.users |
| role_id | UUID | Ссылка на admin.roles |
| granted_by | UUID | Админ, назначивший роль |
| comment | TEXT | Примечания к назначению |

## Архитектура

### SQL-first паттерн доступа

Этот модуль использует SQL-first сервисы и нейтральные DB-контракты:

- **DbExecutor / DbSession** для всех запросов на уровне роутов и сервисов
- **Raw SQL** для PostgreSQL-функций, таких как `admin.is_superuser()` и `admin.has_permission()`
- **Legacy compatibility wrappers** только там, где другие пакеты всё ещё импортируют исторические helper'ы

Такой дизайн гарантирует, что проверки прав в коде приложения точно соответствуют database-level permission functions.

## Устранение неполадок

### Список ролей зависает при прямом переходе

- **Симптом**: При прямом переходе или перезагрузке `/admin/instance/:id/roles` интерфейс остаётся на скелетонах, а в Network висят `GET /api/v1/admin/roles`.
- **Причина**: Проверки guard выполнялись вне request-scoped DB session, конкурировали за соединения пула и иногда работали после освобождения request context.
- **Решение**: Использовать request `DbSession` для проверок доступа и прав, а к pool-level `DbExecutor` переходить только при отсутствии активного request context. Схема БД не менялась.

## Структура файлов

```
packages/admin-backend/base/
├── src/
│   ├── guards/
│   │   └── ensureGlobalAccess.ts
│   ├── persistence/           # SQL-first query helper-модули для ролей/settings/locales/instances
│   ├── routes/
│   │   └── globalUsersRoutes.ts
│   ├── schemas/
│   │   └── index.ts           # Zod-схемы валидации
│   ├── services/
│   │   └── globalAccessService.ts
│   └── index.ts               # Экспорты пакета
└── package.json
```

## Зависимости

| Пакет | Версия | Назначение |
|-------|--------|------------|
| `express` | ^4.18.2 | HTTP-сервер |
| `zod` | ^3.25.76 | Валидация схем |
| `http-errors` | catalog | Обработка HTTP-ошибок |

## Связанные пакеты

- `@universo/admin-frontend` - Фронтенд UI для админ-панели
- `@universo/auth-backend` - Аутентификация и guard'ы доступа
- `@universo/types` - Общие TypeScript-типы
