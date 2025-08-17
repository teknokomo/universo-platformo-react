# Auth (Passport.js + Supabase) — Изолированный PoC

Этот документ описывает изолированный PoC аутентификации, реализованный как отдельные пакеты: `apps/auth-srv/base` (сервер) и `apps/auth-frt/base` (фронтенд). PoC хранит токены Supabase на сервере и предоставляет безопасный cookie/CSRF‑базированный API для клиента.

> Важно: код PoC полностью изолирован и НЕ интегрирован в текущую систему. Существующие роуты и UI не изменялись.

## Возможности

-   Passport LocalStrategy с Supabase как IdP
-   Серверные сессии с безопасными cookies (HttpOnly, SameSite, Secure)
-   Защита CSRF (double‑submit cookie + `X-CSRF-Token`)
-   Rate‑limit на `/login`
-   Per‑request клиент Supabase с RLS через `Authorization: Bearer <access>` из сессии
-   Автоматический refresh (single‑flight); при ошибке refresh — сессия инвалидируется

## Эндпоинты (префикс: `/api/v2/auth`)

-   `GET /csrf` — возвращает `{ csrfToken }`
-   `POST /login` — `{ email, password }` (требуется CSRF)
-   `GET /me` — возвращает `{ id, email }` при аутентификации
-   `POST /refresh` — опциональный ручной refresh (требуется CSRF); авто‑refresh прозрачен
-   `POST /logout` — выход (требуется CSRF)

## Окружение

-   `PORT` (по умолчанию: 3101)
-   `SESSION_SECRET` (обязательно)
-   `SUPABASE_URL` (обязательно)
-   `SUPABASE_ANON_KEY` (обязательно)
-   `SAME_SITE` (опционально; `lax` или `none`)
-   `DEV_SAME_ORIGIN` (опционально; `true` для dev при едином origin)

## Быстрый старт (PoC)

-   Сервер (`apps/auth-srv/base`):
    ```bash
    pnpm --filter @universo/auth-srv build
    pnpm --filter @universo/auth-srv start
    ```
-   Фронтенд (`apps/auth-frt/base`):
    ```bash
    # установить VITE_AUTH_API=http://localhost:3101/api/v2
    pnpm --filter @universo/auth-frt dev
    ```

## План внедрения (замена текущей авторизации)

1. PoC (изолированно)
    - Запустить сервер авторизации на порту 3101
    - Клиент `apps/auth-frt`: проверить login → me → auto‑refresh → logout
2. Интеграция в `packages/server`
    - Добавить `express-session`, `passport`, `helmet`, `csurf`, `cors` при необходимости
    - Заменить RLS по заголовку на RLS по сессии: `Authorization: Bearer <req.session.tokens.access>`
    - Защищать маршруты через `req.isAuthenticated()`
3. Интеграция в `packages/ui`
    - Удалить хранение токенов в `localStorage` и Authorization‑интерсептор
    - Перейти на `withCredentials: true` и `GET /auth/me` для guard‑логики
4. Продакшен
    - Redis‑хранилище сессий; cookies `SameSite=Lax; Secure; HttpOnly`
    - CSRF для всех state‑changing запросов
    - Регрессионные и нагрузочные тесты (rate‑limit логина)
