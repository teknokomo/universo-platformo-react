---
description: Объясняет, как организован PNPM-монорепозиторий.
---

# Структура монорепозитория

Рабочее пространство использует PNPM workspaces и Turborepo. Активные React
пакеты следуют плоской схеме `packages/universo-react-<name>/package.json`,
используют соответствующие имена `@universo-react/<name>` и находятся через
единственный workspace-глоб `packages/*`.

## Основные группы пакетов

-   Core shell packages: `@universo-react/core-backend`, `@universo-react/core-frontend`.
-   Функциональные пакеты: auth, start, profile, metahubs, applications, admin.
-   Инфраструктурные пакеты: database, schema-ddl, migrations, types, utils, i18n.
-   Пакеты поддержки UI: template-mui, apps-template-mui, store.
-   Пакеты документации: rest-docs и GitBook-исходники в `docs/`.

## Межпакетные правила

Используйте имена workspace-пакетов для импортов между пакетами и запускайте
PNPM-команды из корня репозитория.
