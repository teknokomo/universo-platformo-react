---
description: Узнайте, как настроить контроль доступа на уровне приложения для ваших экземпляров Universo Platformo
---

# Приложение

***

## Email и пароль

Universo Platformo поставляется со стеком сессий на основе [**Passport.js**](https://www.passportjs.org/), поддерживаемым Supabase. Когда пользователь входит в систему, его учётные данные проверяются в Supabase, токен доступа сохраняется в серверной сессии, и каждый последующий вызов API авторизуется через эту сессию. Cookies HTTP-only, автоматически обновляются перед истечением срока действия и могут быть усилены дополнительными переменными окружения.

Для миграции с устаревшего Basic Auth потока настройте Supabase и откройте эндпоинты `/api/v1/auth`, как описано ниже.

<figure><img src="../../.gitbook/assets/image (18) (1) (1).png" alt="" width="387"><figcaption></figcaption></figure>

### Обязательные переменные окружения

Добавьте следующие переменные в `packages/flowise-server/.env` (или передайте их через флаги CLI):

- `SESSION_SECRET` — Секретная строка для подписи Express сессий.
- `SUPABASE_URL` — URL вашего проекта Supabase.
- `SUPABASE_ANON_KEY` — Публичный anon ключ (используется для CSRF/инициализации сессии).
- `SUPABASE_JWT_SECRET` — Секрет JWT сервиса для валидации токенов доступа Supabase.

### Опциональная настройка cookies

- `SESSION_COOKIE_NAME` — Переопределить имя cookie (по умолчанию: `up.sid`).
- `SESSION_COOKIE_MAXAGE` — Максимальное время жизни в миллисекундах (по умолчанию: `86400000`).
- `SESSION_COOKIE_SAMESITE` — Политика SameSite (`lax`, `strict` или `none`).
- `SESSION_COOKIE_SECURE` — Установите `true` в production средах, обслуживаемых через HTTPS.

### npm

1. Установите зависимости

```bash
npm install -g flowise
```

2. Запустите сервер с необходимыми переменными сессии (экспортируйте их в вашем shell или сохраните в `.env`):

```bash
SESSION_SECRET=super-secret SUPABASE_URL=https://xyz.supabase.co \
SUPABASE_ANON_KEY=public-anon SUPABASE_JWT_SECRET=service-secret \
npx flowise start
```

3. Откройте [http://localhost:3000](http://localhost:3000) и войдите через `/auth`.

### Docker

1. Перейдите в папку `docker`.

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

3. Сопоставьте эти значения в `docker-compose.yml`:

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
6. Остановите стек командой `docker compose stop` после завершения.

### Git clone

При запуске из исходного кода добавьте переменные в `packages/flowise-server/.env`:

```dotenv
SESSION_SECRET=super-secret
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=public-anon
SUPABASE_JWT_SECRET=service-secret
```

## Имя пользователя и пароль (устарело)

Устаревший метод `FLOWISE_USERNAME`/`FLOWISE_PASSWORD` был удалён. Используйте поток сессий на основе Supabase, описанный выше, для всех новых развёртываний.
