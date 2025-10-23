---
description: Узнайте, как настроить контроль доступа на уровне приложения в Universo Platformo React
---

# Аутентификация на уровне приложения

***

## Почта и пароль

Universo Platformo использует сессионный стек на базе [**Passport.js**](https://www.passportjs.org/) и Supabase. При входе в систему учетные данные проверяются через Supabase, access-токен сохраняется в серверной сессии, а все последующие запросы авторизуются через эту сессию. Cookie являются HTTP-only, автоматически обновляются перед истечением срока действия и могут быть усилены дополнительными переменными окружения.

Чтобы перейти с устаревшей базовой аутентификации, настройте Supabase и задействуйте эндпоинты `/api/v1/auth`, как описано ниже.

<figure><img src="../../.gitbook/assets/image (18) (1) (1).png" alt="" width="387"><figcaption></figcaption></figure>

### Обязательные переменные окружения

Добавьте следующие переменные в `packages/flowise-server/.env` (или передайте их через CLI):

- `SESSION_SECRET` — секрет для подписи сессий Express.
- `SUPABASE_URL` — URL вашего проекта Supabase.
- `SUPABASE_ANON_KEY` — публичный anon-ключ (используется для CSRF и инициализации сессии).
- `SUPABASE_JWT_SECRET` — сервисный JWT секрет для валидации access-токенов Supabase.

### Дополнительные параметры cookie

- `SESSION_COOKIE_NAME` — имя cookie (по умолчанию `up.sid`).
- `SESSION_COOKIE_MAXAGE` — время жизни cookie в миллисекундах (по умолчанию `86400000`).
- `SESSION_COOKIE_SAMESITE` — политика SameSite (`lax`, `strict` или `none`).
- `SESSION_COOKIE_SECURE` — установите `true` в продакшне с HTTPS.

### npm

1. Установите зависимости

```bash
npm install -g flowise
```

2. Запустите сервер с нужными переменными окружения (экспортируйте их в оболочке или сохраните в `.env`):

```bash
SESSION_SECRET=super-secret SUPABASE_URL=https://xyz.supabase.co \
SUPABASE_ANON_KEY=public-anon SUPABASE_JWT_SECRET=service-secret \
npx flowise start
```

3. Откройте [http://localhost:3000](http://localhost:3000) и авторизуйтесь через `/auth`.

### Docker

1. Перейдите в каталог `docker`.

```bash
cd docker
```

2. Создайте файл `.env` с новыми переменными аутентификации:

```dotenv
PORT=3000
SESSION_SECRET=super-secret
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=public-anon
SUPABASE_JWT_SECRET=service-secret
```

3. Передайте значения в `docker-compose.yml`:

```yaml
environment:
  - PORT=${PORT}
  - SESSION_SECRET=${SESSION_SECRET}
  - SUPABASE_URL=${SUPABASE_URL}
  - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
  - SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
```

4. `docker compose up -d`
5. Откройте [http://localhost:3000](http://localhost:3000)
6. Остановите сервис командой `docker compose stop`.

### Git clone

При запуске из исходников добавьте переменные в `packages/flowise-server/.env`:

```dotenv
SESSION_SECRET=super-secret
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=public-anon
SUPABASE_JWT_SECRET=service-secret
```

## Имя пользователя и пароль (устарело)

Наследняя защита `FLOWISE_USERNAME`/`FLOWISE_PASSWORD` удалена. Для всех новых развертываний используйте сессию на базе Supabase, описанную выше.
