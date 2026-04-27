---
description: Как запускать и использовать интерактивную OpenAPI- и Swagger-документацию.
---

# Интерактивная OpenAPI-документация

## Пакет

Интерактивный REST-справочник отдаётся пакетом `@universo/rest-docs`.

## Сборка и запуск

Запускайте команды из корня репозитория:

```bash
pnpm --filter @universo/rest-docs build
pnpm --filter @universo/rest-docs start
```

По умолчанию сервер документации доступен по адресу `http://localhost:6655/api-docs`.

## Как использовать

1. Запустите основной backend, который отдаёт `/api/v1`.
2. Откройте страницу Swagger UI от docs server.
3. Укажите URL того backend instance, который хотите исследовать.
4. Добавляйте bearer token в Swagger только для protected endpoints.
5. Для mutating requests предпочитайте non-production environments.

## Важные заметки

- Сгенерированный документ авторитетен для текущих paths и methods.
- Payload schemas пока остаются generic, если у route family нет явного stable contract.
- Если backend route mounts меняются, пересоберите docs package до использования UI.
