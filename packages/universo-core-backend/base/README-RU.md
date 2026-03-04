# Universo Core Backend

✅ **Современный пакет** — `@universo/core-backend`

## Обзор

Основной бэкенд-сервер Universo Platformo. Это центральное Express-приложение, которое запускает HTTP-сервер, подключается к PostgreSQL через TypeORM, настраивает middleware аутентификации, регистрирует все API-маршруты и интегрирует функциональные бэкенд-пакеты `@universo/*`.

## Информация о пакете

- **Пакет**: `@universo/core-backend`
- **Версия**: `0.1.0`
- **Тип**: Backend Server (Современный)
- **Фреймворк**: Express.js + TypeORM + OCLIF CLI
- **Язык**: TypeScript
- **База данных**: PostgreSQL через Supabase
- **Аутентификация**: Passport.js + JWT + интеграция с Supabase

## Ключевые особенности

### 🎯 Основная функциональность сервера
- **Express API сервер**: REST API с ограничением частоты запросов, CORS и парсингом тел запросов
- **TypeORM DataSource**: Централизованное подключение к базе данных с запуском миграций
- **Реестр сущностей и миграций**: Все пакеты регистрируют сущности и миграции через ядро
- **OCLIF CLI**: Команда `universo start` с настраиваемым портом и хостом

### 🔐 Безопасность
- **CSRF защита**: Middleware на основе токенов
- **Ограничение частоты запросов**: Express rate limiter с настраиваемым окном
- **Санитизация запросов**: Middleware защиты от XSS
- **Управление сессиями**: Passport.js с безопасными cookie-сессиями
- **Валидация API-ключей**: Многоуровневая аутентификация (JWT → сессия → API-ключ)

### 🏗️ Архитектура
- **Модульные маршруты**: Маршруты импортируются из бэкенд-пакетов `@universo/*`
- **Обработка ошибок**: Централизованный middleware ошибок с классом `InternalError`
- **Управление очередями**: Redis-очередь задач для фоновой обработки
- **Метрики**: Интеграция Prometheus и OpenTelemetry (опционально)
- **Мультиплеер**: Интеграция сервера Colyseus для real-time функций

## CLI команды (OCLIF)

```bash
# Запуск сервера
pnpm start

# Запуск в режиме разработки (из корня проекта)
pnpm dev
```

## Архитектура

### Последовательность загрузки

```
bin/run                        → Точка входа OCLIF CLI
  └─ commands/start.ts         → Команда Start
       └─ index.ts (App)       → Класс Express-приложения
            ├─ DataSource.ts   → TypeORM соединение + миграции
            ├─ middlewares/     → Аутентификация, CSRF, rate-limit, обработка ошибок
            ├─ routes/         → API v1 роутер (агрегирует маршруты функций)
            └─ utils/          → Утилиты сервера (пути, версии)
```

### Ключевые модули

| Модуль | Назначение |
|---|---|
| `index.ts` | Класс `App` — настройка Express, цепочка middleware, монтирование маршрутов |
| `DataSource.ts` | Фабрика TypeORM DataSource с управлением пулом |
| `routes/` | API v1 роутер, импортирующий функциональные роутеры |
| `middlewares/errors/` | Централизованный обработчик ошибок Express |
| `errors/internalError/` | Пользовательский HTTP-класс ошибок `InternalError` |
| `utils/` | `getUserHome()`, `getAppVersion()`, утилиты путей |
| `database/entities/` | Центральный реестр сущностей (все пакеты регистрируются здесь) |
| `database/migrations/` | Центральный реестр миграций (Postgres) |

### Директория данных

Сервер хранит данные времени выполнения в `~/.universo/` (настраивается через переменную `UNIVERSO_PATH`, с обратной совместимостью через `FLOWISE_PATH`).

## Файловая структура

```
packages/universo-core-backend/
└── base/
    ├── bin/                    # Точка входа CLI (OCLIF)
    ├── src/
    │   ├── commands/           # OCLIF команды (start)
    │   ├── database/
    │   │   ├── entities/       # Центральный реестр сущностей
    │   │   └── migrations/     # Центральный реестр миграций (postgres)
    │   ├── errors/
    │   │   └── internalError/  # HTTP-класс ошибок InternalError
    │   ├── middlewares/
    │   │   └── errors/         # Обработчик ошибок Express
    │   ├── routes/             # API v1 роутер
    │   ├── utils/              # Утилиты сервера
    │   ├── DataSource.ts       # Фабрика TypeORM DataSource
    │   ├── Interface.ts        # Общие TypeScript интерфейсы
    │   └── index.ts            # Класс Express App (основной сервер)
    ├── package.json
    ├── README.md
    └── README-RU.md
```

## Конфигурация

### Переменные окружения

| Переменная | Обязательная | Описание |
|---|---|---|
| `SUPABASE_URL` | Да | URL проекта Supabase |
| `SUPABASE_ANON_KEY` | Да | Анонимный ключ Supabase |
| `SUPABASE_JWT_SECRET` | Да | JWT-секрет для верификации токенов |
| `UNIVERSO_PATH` | Нет | Пользовательская директория данных (по умолчанию: `~/.universo`) |
| `FILE_SIZE_LIMIT` | Нет | Максимальный размер загружаемого файла (по умолчанию: `50mb`) |
| `PORT` | Нет | Порт сервера (по умолчанию: `3000`) |

### Добавление сущностей и миграций

Функциональные пакеты регистрируют свои TypeORM сущности и миграции через центральные реестры:

```typescript
// 1. Определите сущность в вашем пакете
// packages/your-backend/base/src/database/entities/YourEntity.ts

// 2. Зарегистрируйте в центральном реестре сущностей
// packages/universo-core-backend/base/src/database/entities/index.ts
export { YourEntity } from '@universo/your-backend/entities'

// 3. Зарегистрируйте миграции в центральном реестре миграций
// packages/universo-core-backend/base/src/database/migrations/postgres/index.ts
import { yourMigrations } from '@universo/your-backend/migrations'
export const postgresMigrations = [...yourMigrations, ...]
```

## Разработка

```bash
# Из корня проекта
pnpm install
pnpm build              # Полная сборка workspace
pnpm start              # Запуск продакшн-сервера
```

> **Примечание**: Всегда выполняйте команды из корня проекта. Сборка отдельных пакетов — только для проверки. Используйте `pnpm build` в корне для применения изменений.

## Связанные пакеты

- [universo-core-frontend](../../universo-core-frontend/base/README.md) — React frontend-приложение
- [universo-types](../../universo-types/base/README.md) — Общие TypeScript типы
- [universo-utils](../../universo-utils/base/README.md) — Общие утилиты (UUID, codename и т.д.)
- [auth-backend](../../auth-backend/base/README.md) — Сервис аутентификации
