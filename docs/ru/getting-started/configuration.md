---
description: Настройте бэкенд- и фронтенд-конфигурацию окружения для локального запуска.
---

# Конфигурация

## Окружение бэкенда

Создайте локальный файл `.env` в `packages/universo-core-backend/base` и укажите
как минимум параметры Supabase/PostgreSQL и аутентификации, необходимые серверной части.

Обычно сюда входят Supabase URL, anonymous key, JWT secret, настройки
подключения к базе, конфигурация сессий и другие секреты конкретного
развёртывания.

Минимальный backend-контракт для первого запуска:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_public_anon_key
SERVICE_ROLE_KEY=your_server_only_service_role_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
BOOTSTRAP_SUPERUSER_ENABLED=true
BOOTSTRAP_SUPERUSER_EMAIL=demo-admin@example.com
BOOTSTRAP_SUPERUSER_PASSWORD=ChangeMe_123456!
```

Важные замечания:

- `SERVICE_ROLE_KEY` является строго server-only секретом. Никогда не отдавайте его в browser bundle.
- `BOOTSTRAP_SUPERUSER_ENABLED` по умолчанию равен `true`.
- Когда bootstrap включён, backend во время старта создаёт или подтверждает реального Supabase auth user и назначает ему эксклюзивную глобальную роль `superuser`.
- Demo bootstrap email и пароль предназначены только для local/dev bootstrap. Перед любым реальным развёртыванием обязательно замените их.
- Если bootstrap email уже принадлежит существующему non-superuser аккаунту, старт завершится явной ошибкой вместо молчаливого повышения привилегий.

## Окружение фронтенда

Если нужны переопределения для фронтенда, создайте локальный `.env` в
`packages/universo-core-frontend/base`.

Обычно сюда входят UI host или port-настройки, например `VITE_PORT`.

## Правила конфигурации

- Не храните реальные секреты в системе контроля версий.
- В отслеживаемых env-файлах оставляйте только placeholder-значения.
- После изменения общих предпосылок конфигурации повторно запускайте root build.
