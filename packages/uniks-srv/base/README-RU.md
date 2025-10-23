# Uniks Server (uniks-srv)

Бекенд workspace-пакет для функциональности управления рабочими пространствами в экосистеме Universo Platformo.

> Обновление Q3 2025: Добавлена выделенная схема Postgres `uniks` с RLS, расширенная ролевая модель (`owner|admin|editor|member`), гибридная аутентификация Passport.js + Supabase (сессии + валидация токена), переход с Supabase REST на TypeORM репозитории.

## Обзор

Uniks Server - это бекенд workspace-пакет (`@universo/uniks-srv`), который предоставляет функциональность управления рабочими пространствами. Он обрабатывает CRUD операции с рабочими пространствами, управление участниками и интегрируется с основным сервером Flowise для предоставления workspace-специфичной маршрутизации.

## Ключевые возможности

- **Workspace CRUD**: Репозитории TypeORM (таблица `uniks.uniks`)
- **Управление участниками**: Ролевая модель с жёстким перечислением
- **Расширенные роли**: `owner`, `admin`, `editor`, `member` (вместо прежних owner/member)
- **Гибридная аутентификация**: Passport.js сессии + Supabase токены
- **RLS защита**: Политики Postgres на основе членства
- **Кэш членства**: На уровне запроса (минимизация повторных запросов)
- **Безопасные роуты**: Централизованная проверка доступа
- **Типобезопасность**: Строгие enum/union типы + runtime guard'ы

## Структура

```
src/
├── routes/         # Express роуты для операций с Uniks
│   └── uniksRoutes.ts  # Основной роутер с CRUD эндпоинтами
├── database/       # Файлы, связанные с базой данных
│   ├── entities/   # Определения TypeORM сущностей
│   └── migrations/ # Файлы миграций PostgreSQL
├── types/          # TypeScript декларации типов
│   └── flowiseRoutes.d.ts  # Декларации внешних модулей
└── index.ts        # Точка входа пакета
```

## API эндпоинты (обновлено)

### Управление рабочими пространствами

- `GET /uniks` – Рабочие пространства, доступные пользователю (требуется членство)
- `POST /uniks` – Создание (создатель получает роль `owner`)
- `GET /uniks/:id` – Детали (любой участник)
- `PUT /uniks/:id` – Обновление (роли: `admin|owner`)
- `DELETE /uniks/:id` – Удаление (роль: `owner`)

### Управление участниками

- `GET /uniks/:id/members` – Список участников (любой member)
- `POST /uniks/:id/members` – Добавление участника (роли: `admin|owner`)
- `PUT /uniks/:id/members/:userId` – Смена роли (роль: `owner`)
- `DELETE /uniks/:id/members/:userId` – Удаление (роль: `owner`)

## Схема базы данных (текущая)

### Схема и таблицы
Все таблицы находятся в выделенной схеме `uniks`:

```sql
CREATE SCHEMA IF NOT EXISTS uniks;

CREATE TABLE uniks.uniks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE uniks.uniks_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    unik_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner','admin','editor','member')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, unik_id)
);
```

### TypeORM сущности (фрагмент)
```typescript
export const UNIK_ROLES = ['owner','admin','editor','member'] as const
export type UnikRole = typeof UNIK_ROLES[number]

@Entity({ schema: 'uniks', name: 'uniks' })
export class Unik { /* поля, таймстемпы, связи memberships */ }

@Entity({ schema: 'uniks', name: 'uniks_users' })
export class UnikUser { /* id, userId, unikId, role, createdAt */ }
```

### Политики RLS (концепт)
```sql
ALTER TABLE uniks.uniks ENABLE ROW LEVEL SECURITY;
ALTER TABLE uniks.uniks_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY uniks_select_members ON uniks.uniks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM uniks.uniks_users mu
            WHERE mu.unik_id = uniks.id AND mu.user_id = auth.uid()
        )
    );
```

## Интеграция

Этот пакет интегрируется с:

- **Основным сервером**: Монтаж роутов + инъекция контекста сессии
- **Passport.js**: Слой сессий, гидратация личности пользователя
- **Supabase**: Валидация токенов и источник identity
- **TypeORM**: Репозитории и сущности в схеме
- **Express**: Маршрутизация и middleware цепочка

## Разработка

### Предварительные требования

- Node.js 18+
- PNPM
- PostgreSQL с `pgcrypto` (для `gen_random_uuid()`)
- Доступ к Supabase (URL, anon/service ключи)

### Установка

```bash
# Установка зависимостей
pnpm install

# Сборка пакета
pnpm build

# Запуск в режиме разработки
pnpm dev
```

### Команды сборки

```bash
# Сборка для продакшена
pnpm build

# Сборка в режиме наблюдения
pnpm dev

# Сборка конкретного пакета
pnpm build --filter @universo/uniks-srv
```

## Конфигурация

Пакет использует следующую конфигурацию:

-   **TypeScript**: Включена строгая проверка типов
-   **TypeORM**: Конфигурация ORM базы данных
-   **Express**: Настройка веб-фреймворка
-   **Supabase**: Интеграция аутентификации и базы данных

## Зависимости

### Основные зависимости

-   `express`: Веб-фреймворк
-   `typeorm`: ORM базы данных
-   `pg`: Драйвер PostgreSQL
-   `@supabase/supabase-js`: Supabase клиент

### Зависимости разработки

-   `typescript`: TypeScript компилятор
-   `@types/express`: TypeScript определения для Express
-   `@types/node`: TypeScript определения для Node.js

## Миграции базы данных

Единственная обновлённая миграция (in-place `AddUniks`):

- Добавлена схема `uniks`
- Переименование `user_uniks` → `uniks.uniks_users`
- Композитная уникальность `(user_id, unik_id)`
- Расширенный набор ролей + CHECK ограничение
- Включён RLS + политики членства
- Индексы для быстрого поиска членств

## Декларации типов

Пакет предоставляет TypeScript декларации для внешних модулей:

-   `flowiseRoutes.d.ts`: Декларации для модулей роутов Flowise
-   Интерфейсы сущностей для моделей базы данных
-   Типы API запросов/ответов

## Безопасность

- **Гибридная аутентификация**: Passport.js сессии + Supabase JWT проверка
- **Авторизация ролей**: Центральный guard (`WorkspaceAccessService.ensure`)
- **Многоуровневая защита**: Политики RLS + проверки приложения
- **SQL защита**: Параметризация в TypeORM
- **Валидация ввода**: DTO / schema проверка
- **Минимально необходимые привилегии**: Расширенные роли уменьшают поверхность прав

## Обработка ошибок

Стандартизированная таксономия ошибок:

- **401 Unauthorized**: Отсутствует/некорректна сессия или токен
- **403 Forbidden**: Недостаточная роль (логируется без утечки деталей)
- **404 Not Found**: Недоступно или не существует
- **409 Conflict**: Дублируемое членство
- **422 Unprocessable Entity**: Ошибка валидации
- **500 Internal Error**: Неожиданная ошибка (корреляция по request id)

## Вклад в разработку

При вкладе в этот пакет:

1. Следуйте TypeScript лучшим практикам
2. Поддерживайте совместимость миграций базы данных
3. Добавляйте правильную обработку ошибок
4. Включайте TypeScript определения типов
5. Следуйте стандартам кодирования проекта

## Связанная документация

-   [Документация основных приложений](../README-RU.md)
-   [Документация Uniks Frontend](../uniks-frt/base/README-RU.md)
-   [Архитектура платформы](../../../docs/ru/applications/README.md)

---

**Universo Platformo | Пакет Uniks Server**
