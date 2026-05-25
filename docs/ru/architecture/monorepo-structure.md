---
description: Объясняет, как организован PNPM-монорепозиторий.
---

# Структура монорепозитория

Рабочее пространство использует PNPM workspaces и Turborepo. Пакеты следуют
плоской схеме `packages/<name>/package.json` и находятся через единственный
workspace-глоб `packages/*`.

## Основные группы пакетов

-   Core shell packages: `@universo/core-backend`, `@universo/core-frontend`.
-   Функциональные пакеты: auth, start, profile, metahubs, applications, admin.
-   Инфраструктурные пакеты: database, schema-ddl, migrations, types, utils, i18n.
-   Пакеты поддержки UI: template-mui, apps-template-mui, store.
-   Пакеты документации: rest-docs и GitBook-исходники в `docs/`.

## Межпакетные правила

Используйте имена workspace-пакетов для импортов между пакетами и запускайте
PNPM-команды из корня репозитория.
