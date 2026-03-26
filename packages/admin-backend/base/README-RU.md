# @universo/admin-backend

> 🏗️ **Современный пакет** - Архитектура TypeScript-first с Express.js, SQL-first persistence и Zod

Бэкенд-сервис для управления глобальным администрированием с системными ролями, редактируемыми пользовательскими ролями и SQL-first RBAC.

## Информация о пакете

- **Версия**: 0.1.0
- **Тип**: Backend-сервис (TypeScript)
- **Статус**: ✅ Активная разработка
- **Архитектура**: Modern с Express.js + SQL-first persistence helper-модулями + Zod валидация

## Ключевые возможности

### 🔐 RBAC-система
- **Системные роли**: `Superuser`, `Registered` и `User`, а также редактируемые пользовательские глобальные роли
- **Модель прав**: правила subject/action с wildcard-поддержкой и локализованными метаданными ролей
- **Метаданные ролей**: Локализованные названия, цвета и описания

### 🛡️ Безопасность
- Управление через переменную окружения (`GLOBAL_ADMIN_ENABLED`)
- Middleware для проверки ролей на уровне запроса
- Защита от SQL-инъекций через параметризованные запросы
- Интеграция с RLS через PostgreSQL-функции
- Authenticated DB sessions могут просматривать через helper SQL functions только собственные admin permissions и roles; привилегированные cross-user чтения остаются backend/bootstrap-потокам

### 📊 База данных
- SQL-first store-модули в схеме `admin`
- PostgreSQL с JSONB для локализованного контента
- PostgreSQL-функции переиспользуются для согласованных проверок доступа и прав

## API-справочник

### Эндпоинты глобальных пользователей

```http
GET    /api/v1/admin/global-users                # Список глобальных пользователей (read)
GET    /api/v1/admin/global-users/me             # Сводка по глобальным ролям текущего пользователя
POST   /api/v1/admin/global-users/create-user    # Создать auth user и назначить стартовые роли
PUT    /api/v1/admin/global-users/:memberId/roles # Полностью заменить набор ролей пользователя
PATCH  /api/v1/admin/global-users/:memberId      # Legacy-обёртка для старого single-role API
DELETE /api/v1/admin/global-users/:memberId      # Снять с пользователя все глобальные роли
```

### Эндпоинты дашборда

```http
GET    /api/v1/admin/dashboard/stats       # Общая статистика для admin/metapanel
```

### Эндпоинты ролей

```http
GET    /api/v1/admin/roles                 # Список всех ролей
GET    /api/v1/admin/roles/global          # Список ролей с глобальным доступом
POST   /api/v1/admin/roles/:id/copy        # Скопировать существующую роль в новую редактируемую роль
```

## Использование

### Интеграция с Express

```typescript
import {
  createAuthUserProvisioningService,
  createGlobalUsersRoutes,
  createGlobalAccessService
} from '@universo/admin-backend'
import { getPermissionService } from '@universo/auth-backend'
import { createKnexExecutor, getKnex } from '@universo/database'
import { createClient } from '@supabase/supabase-js'

const globalAccessService = createGlobalAccessService({ getDbExecutor: () => createKnexExecutor(getKnex()) })
const permissionService = getPermissionService()
const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const provisioningService = createAuthUserProvisioningService({
  getDbExecutor: () => createKnexExecutor(getKnex()),
  globalAccessService,
  supabaseAdmin
})
const globalUsersRoutes = createGlobalUsersRoutes({ globalAccessService, permissionService, provisioningService })

app.use('/api/v1/admin/global-users', globalUsersRoutes)
```

Для прямого создания пользователей из админ-панели через `POST /create-user` используйте общий provisioning service.
Так startup bootstrap и admin-side create-user будут идти через один rollback-safe pipeline.

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

### admin.cat_roles

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | UUID | Первичный ключ |
| codename | JSONB | Канонический VLC-payload codename, сохраняемый как `codename JSONB` |
| name | JSONB | Локализованное отображаемое имя роли |
| description | JSONB | Локализованное описание роли |
| color | VARCHAR(7) | Цвет для UI |
| is_superuser | BOOLEAN | Эксклюзивная системная роль с полным доступом |
| is_system | BOOLEAN | Защита от удаления |

### admin.rel_user_roles

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | UUID | Первичный ключ |
| user_id | UUID | Ссылка на auth.users |
| role_id | UUID | Ссылка на admin.cat_roles |
| granted_by | UUID | Админ, назначивший роль |
| comment | TEXT | Примечания к назначению |

## Архитектура

### SQL-first паттерн доступа

Этот модуль использует SQL-first сервисы и нейтральные DB-контракты:

- **DbExecutor / DbSession** для всех запросов на уровне роутов и сервисов
- **Raw SQL** для PostgreSQL-функций, таких как `admin.is_superuser()` и `admin.has_permission()`
- **Legacy compatibility wrappers** только там, где другие пакеты всё ещё импортируют исторические helper'ы

Такой дизайн гарантирует, что проверки прав в коде приложения точно соответствуют database-level permission functions.

### Определение платформенной схемы

Форма схемы admin декларирована в `src/platform/systemAppDefinition.ts` в виде
манифеста `SystemAppDefinition`. Манифест перечисляет каждую бизнес-таблицу, поле,
тип данных и FK-ссылку, которые должны существовать в PostgreSQL-схеме `admin`.

При запуске сервера платформа сравнивает `targetBusinessTables` из манифеста
с последним записанным снимком миграции и применяет только необходимые DDL-
изменения. Писать SQL-миграции вручную не нужно — добавьте или удалите поля
в манифесте и перезапустите сервер.

См. [Жизненный цикл миграций системных приложений](../../../docs/ru/architecture/system-app-migration-lifecycle.md)
и [Обновление схем системных приложений](../../../docs/ru/guides/updating-system-app-schemas.md)
для полного описания процесса.

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
