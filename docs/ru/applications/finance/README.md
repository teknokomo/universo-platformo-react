# Приложения Финансовой системы

Модуль Finance обеспечивает управление счетами, валютами и транзакциями как дочерний ресурс рабочих пространств Uniks.

- Фронтенд пакет: `@universo/finance-frt`
- Бэкенд пакет: `@universo/finance-srv`

## Архитектура

- Сервер публикует вложенные маршруты `/api/v1/uniks/:unikId/finance/*` через `createFinanceRouter()`.
- Интеграция TypeORM: `financeEntities` и `financeMigrations` экспортируются и агрегируются в центральных реестрах сервера.
- Интеграция UI: маршруты добавляются внутри области рабочего пространства Unik (например, `finance/accounts`, `finance/currencies`).
- i18n: отдельный неймспейс `finance` подключается в основном приложении.

```
apps/
├─ finance-srv/
│  └─ base/
│     ├─ src/database/entities/Transaction.ts
│     ├─ src/database/migrations/postgres/
│     ├─ src/routes/(accountRoutes|currencyRoutes).ts
│     └─ src/index.ts (экспорт router, entities, migrations)
├─ finance-frt/
│  └─ base/
│     ├─ src/api/finance/(accounts|currencies).ts
│     ├─ src/pages/(AccountList|CurrencyList).jsx
│     ├─ src/i18n/index.js (неймспейс: finance)
│     └─ src/index.ts (экспорт меню, i18n, api)
└─ ...
```

## Бэкенд (`@universo/finance-srv`)

- Маршрутизатор: `createFinanceRouter()` монтирует подресурсы:
  - `GET/POST /currencies`, `GET/PUT/DELETE /currencies/:id`
  - `GET/POST /accounts`, `GET/PUT/DELETE /accounts/:id`
- Сущности:
  - `Transaction` — базовая сущность с политиками RLS
- Миграции:
  - `AddTransactions1741277504478` создаёт таблицу `transactions` с RLS и опциональными внешними ключами

### Интеграция на сервере

- Добавьте в зависимости сервера: `"@universo/finance-srv": "workspace:*"`
- Подключите сущности и миграции в центральные реестры.
- Смонтируйте роутер в Uniks: `createUniksRouter(..., createFinanceRouter())`.

## Фронтенд (`@universo/finance-frt`)

- Страницы: `AccountList.jsx`, `CurrencyList.jsx` внутри области Unik.
- API: `/uniks/{unikId}/finance/(accounts|currencies)`.
- i18n: неймспейс `finance` (EN/RU).
- Меню: экспортируемый раздел для дашборда Unik.

### Интеграция в UI

- Добавьте ленивые маршруты внутри Unik (`finance/accounts`, `finance/currencies`).
- Зарегистрируйте `financeTranslations` в основном загрузчике i18n.

## Рекомендации

- Относитесь к Finance как к дочерней сущности Uniks (унаследование контекста и авторизации).
- Используйте паттерн репозиториев TypeORM (без прямого доступа к БД-клиенту).
- Держите код типизированным (TypeScript) и минимальным.
- Избегайте циклических зависимостей: фронтенд-пакеты не должны зависеть от приложения UI (`flowise-ui`).

