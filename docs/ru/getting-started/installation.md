---
description: Установите зависимости монорепозитория и подготовьте локальный workspace.
---

# Установка

## Предварительные требования

- Рекомендуется Node.js 22.22.2; корневые правила требуют Node.js >=22.6.0.
- Требуется PNPM 10.x; workspace закреплён на pnpm 10.33.2.
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
