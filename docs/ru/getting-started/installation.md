---
description: Установите зависимости монорепозитория и подготовьте локальный workspace.
---

# Установка

## Предварительные требования

- Node.js 18.15.x, 20.x или другая версия, разрешённая корневыми правилами.
- PNPM 9 или новее.
- Доступ к Supabase (PostgreSQL) окружению для запуска бэкенда.

## Bootstrap workspace

```bash
git clone https://github.com/teknokomo/universo-platformo-react.git
cd universo-platformo-react
pnpm install
```

## Шаг валидации

После установки запустите корневую сборку.

```bash
pnpm build
```

Репозиторий использует PNPM workspaces и Turborepo, поэтому установку зависимостей
и сборку нужно выполнять из корня репозитория, а не из вложенных пакетов.
