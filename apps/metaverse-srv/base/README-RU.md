# Metaverse Server (Бэкенд)

Бэкенд‑API домена «Метавселенные» в Universo Platformo.

## Эндпоинты (MVP)

-   `GET /api/v1/metaverses` (требуется авторизация) — список метавселенных, доступных пользователю по членству или публичной видимости
-   `POST /api/v1/metaverses` (требуется авторизация) — создание новой метавселенной; для вызывающего автоматически создаётся членство владельца

Все маршруты защищены `ensureAuth` и ограничены rate‑limit.

## Безопасность и RLS

-   Supabase‑клиент создаётся на каждый запрос из входящего заголовка `Authorization: Bearer <JWT>`
-   Схема PostgreSQL: `metaverse`
-   Таблицы: `metaverse.metaverses`, `metaverse.user_metaverses`, `metaverse.metaverse_links`
-   Строгие RLS‑политики:
    -   `metaverses`: SELECT по членству или публичной видимости; INSERT только от `auth.uid()`; UPDATE/DELETE только владельцы
    -   `user_metaverses`: SELECT сам или владельцы той же метавселенной; INSERT/UPDATE только владельцы; сам может обновлять `is_default`
    -   `metaverse_links`: SELECT члены; INSERT/UPDATE/DELETE владельцы
-   Индексы:
    -   `uq_user_default_metaverse` (частичный уникальный по `user_id` при `is_default=true`)
    -   `uq_links` по (`src_metaverse_id`, `dst_metaverse_id`, `relation_type`)

## Интеграция

-   Роутер смонтирован в `packages/server/src/routes/index.ts` под `/api/v1/metaverses`
-   Миграции агрегированы в `packages/server/src/database/migrations/postgres/index.ts`

## Миграции

Реализовано через TypeORM‑миграцию `1742020000000-MetaverseCore`:

-   Создаёт схему и таблицы, добавляет внешние ключи (best‑effort), индексы, включает RLS и определяет политики

## Окружение

-   Используется основная конфигурация базы сервера (Postgres)
-   Дополнительные переменные не требуются, кроме Supabase JWT секретов и параметров БД

## Команды

-   `pnpm build` — компиляция TypeScript
-   `pnpm lint` — проверка ESLint

## Примечания

-   Не подключайте фронтенд‑зависимости
-   Не логируйте токены и PII
-   Будущие эндпоинты: update/delete/get‑by‑id; переключение default; CRUD членства; CRUD связей; хуки импорта/публикации
