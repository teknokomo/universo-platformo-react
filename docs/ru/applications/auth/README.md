# Auth (Passport.js + Supabase)

В Universo Platformo внедрена сессионная авторизация на базе Passport.js и Supabase. Реализация вынесена в два переиспользуемых пакета:

- `@universo/auth-srv` — интеграция Express/Passport, подключённая в `packages/flowise-server`
- `@universo/auth-frt` — React-примитивы (`createAuthClient`, `useSession`, `LoginForm`), используемые в `packages/flowise-ui`

## Поток запросов

1. `POST /api/v1/auth/login`
    - Проверяет учётные данные через Supabase Auth (Passport LocalStrategy)
    - Сохраняет access/refresh токены в Express-сессии (HttpOnly cookie)
2. Все последующие запросы
    - Браузер отправляет cookie сессии (`up.sid` по умолчанию)
    - Middleware добавляет заголовок `Authorization: Bearer <access>`, поэтому существующие сервисы продолжают работать
    - Токены автоматически обновляются при истечении срока
3. `GET /api/v1/auth/me`
    - Возвращает профиль пользователя Supabase из текущей сессии
4. `POST /api/v1/auth/logout`
    - Завершает сессию в Supabase и уничтожает сессию Express

CSRF-защита включена для всех state-changing маршрутов через `csurf` и заголовок `X-CSRF-Token`, получаемый из `GET /api/v1/auth/csrf`.

## Интеграция на фронтенде

`packages/flowise-ui` использует `@universo/auth-frt`:

```ts
const authClient = createAuthClient({ baseURL: `${baseURL}/api/v1` })
const { user, refresh, logout } = useSession({ client: authClient })
```

Экран входа переиспользует `LoginForm`, полностью отказавшись от хранения токенов в `localStorage` и полагаясь на cookies + `withCredentials`.

## Переменные окружения

Определяются в `packages/flowise-server`:

- `SESSION_SECRET`
- `SESSION_COOKIE_NAME` (опционально, по умолчанию `up.sid`)
- `SESSION_COOKIE_MAXAGE` (опционально, миллисекунды, по умолчанию 7 дней)
- `SESSION_COOKIE_SAMESITE` (`lax`, `strict`, `none` или `true`/`false`)
- `SESSION_COOKIE_SECURE` (`true` для Secure-cookie)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`

## Сборка и проверка

```bash
pnpm --filter @universo/auth-srv build
pnpm --filter @universo/auth-frt build
pnpm --filter flowise build   # packages/flowise-server
pnpm --filter flowise lint
```

После сборки запустите сервер (`pnpm --filter flowise dev`) и проверьте цепочку:

1. `POST /api/v1/auth/login`
2. `GET /api/v1/auth/me`
3. Вызов защищённого маршрута (например, `/api/v1/uniks`) — проходит без ручного токена
4. `POST /api/v1/auth/logout`
