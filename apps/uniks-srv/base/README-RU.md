# Бэкенд сервиса Уников (@universo/uniks-srv)

Пакет содержит Express-маршруты и сущности TypeORM для функционала **Уников** (рабочих пространств) в Universo Platformo.

## Структура проекта

```
apps/uniks-srv/base/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts               # Экспорты пакета
    ├── routes/
    │   └── uniksRoutes.ts     # фабрика `createUniksRouter`
    └── database/
        ├── entities/
        │   ├── Unik.ts
        │   └── UserUnik.ts
        └── migrations/postgres/
            ├── 1741277504476-AddUniks.ts
            └── index.ts       # `uniksMigrations`
```

## Экспорты

- `createUniksRouter(ensureAuth, supabase)` – маршруты с вложенными модулями
- `Unik`, `UserUnik` – сущности TypeORM
- `uniksMigrations` – массив миграций базы данных

Пакет оформлен как workspace‑модуль и при необходимости может быть вынесен в отдельный репозиторий.
