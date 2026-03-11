---
description: Объясняет, как организован PNPM-монорепозиторий.
---

# Структура монорепозитория

Рабочее пространство использует PNPM workspaces и Turborepo. Большинство пакетов следует
схеме `packages/<name>/base`, тогда как небольшое число корней пакетов, вроде
`packages/apps-template-mui` или `packages/universo-rest-docs`, живёт без
вложенного слоя `base`.

## Основные группы пакетов

- Core shell packages: `@universo/core-backend`, `@universo/core-frontend`.
- Функциональные пакеты: auth, start, profile, metahubs, applications, admin.
- Инфраструктурные пакеты: database, schema-ddl, migrations, types, utils, i18n.
- Пакеты поддержки UI: template-mui, apps-template-mui, store.
- Пакеты документации: rest-docs и GitBook-исходники в `docs/`.

## Межпакетные правила

Используйте имена workspace-пакетов для импортов между пакетами и запускайте
PNPM-команды из корня репозитория.
