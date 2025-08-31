# Finance Server (finance-srv)

Бекенд-пакет для управления финансовыми данными в экосистеме Universo Platformo.

## Обзор

Finance Server предоставляет маршруты для работы со счетами и валютами внутри рабочего пространства.
Пакет содержит REST эндпоинты для CRUD операций со счетами и валютами и интегрируется с основным сервером платформы.

## Ключевые возможности

- **CRUD операций со счетами**: Создание, чтение, обновление и удаление счетов
- **CRUD операций с валютами**: Управление валютами и курсами обмена в рамках рабочего пространства
- **Интеграция с рабочим пространством**: Маршруты монтируются под `/uniks/:unikId/finance`
- **Поддержка TypeScript**: Полностью типизированная конфигурация Express и TypeORM

## Структура

```
src/
├── routes/         # Express роуты финансовых операций
│   ├── accountRoutes.ts
│   └── currencyRoutes.ts
├── database/       # Файлы базы данных (сущности, миграции)
├── types/          # Декларации типов
└── index.ts        # Точка входа пакета
```

## API эндпоинты

### Счета

- `GET /uniks/:unikId/finance/accounts`
- `POST /uniks/:unikId/finance/accounts`
- `PUT /uniks/:unikId/finance/accounts/:id`
- `DELETE /uniks/:unikId/finance/accounts/:id`

### Валюты

- `GET /uniks/:unikId/finance/currencies`
- `POST /uniks/:unikId/finance/currencies`
- `PUT /uniks/:unikId/finance/currencies/:id`
- `DELETE /uniks/:unikId/finance/currencies/:id`

## Разработка

### Предварительные требования

- Node.js 18+
- Менеджер пакетов PNPM
- База данных PostgreSQL
- Доступ к проекту Supabase

### Установка

```bash
pnpm install
pnpm build
pnpm dev
```

### Команды сборки

```bash
pnpm build
pnpm dev
pnpm build --filter @universo/finance-srv
```

## Связанная документация

- [Документация Finance Frontend](../finance-frt/base/README-RU.md)
- [Архитектура платформы](../../../docs/ru/applications/README.md)

---

**Universo Platformo | Пакет Finance Server**
