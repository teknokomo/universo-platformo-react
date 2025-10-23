# @universo/auth-srv

Набор для интеграции Passport.js + Supabase, обеспечивающий сессионную авторизацию на сервере Universo Platformo. Пакет публикуется как библиотека (CJS + ESM) и подключён в `packages/flowise-server` на маршруте `/api/v1/auth`.

## Возможности

- Passport LocalStrategy с Supabase как провайдером личности
- Хранение сессий в `express-session` (HttpOnly cookie, настраиваемые SameSite/Secure)
- Защита CSRF через `csurf` и заголовок `X-CSRF-Token`
- Ограничение попыток входа (10 попыток в минуту)
- Автообновление Supabase access-токена с блокировкой single-flight

## Эндпоинты (подключены к `/api/v1/auth`)

- `GET /csrf` — выдаёт `{ csrfToken }`
- `POST /login` — `{ email, password }`, требуется CSRF
- `GET /me` — возвращает данные текущего пользователя Supabase
- `POST /refresh` — опциональный ручной refresh (обычно происходит автоматически)
- `POST /logout` — выход с очисткой сессии

## Переменные окружения

Используются сервером `packages/flowise-server`.

- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`
- Опционально для cookie: `SESSION_COOKIE_NAME`, `SESSION_COOKIE_MAXAGE`, `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`

## Сборка

```bash
pnpm --filter @universo/auth-srv build
```

Сборка формирует CommonJS (`dist/`) и ESM (`dist/esm/`).
