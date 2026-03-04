# @universo/applications-backend

> 🏗️ **Современный пакет** - TypeScript-first архитектура с Express.js и TypeORM

Бэкенд-сервис для управления приложениями, коннекторами и членством со строгой изоляцией на уровне приложения.

## Информация о пакете

- **Пакет**: `@universo/applications-backend`
- **Версия**: `0.1.0`
- **Тип**: Backend Service Package (TypeScript)
- **Статус**: ✅ Активная разработка
- **Архитектура**: Express.js + TypeORM + Zod

## Ключевые возможности

### Доменная модель
- **Приложения**: Верхнеуровневые организационные единицы с полной изоляцией данных
- **Коннекторы**: Контейнеры данных внутри приложений
- **Членство**: Членство пользователя в приложении с ролями и правами

### Изоляция данных и безопасность
- Полная изоляция приложений — нет межприложенного доступа к данным
- Комплексная валидация входных данных с понятными сообщениями об ошибках
- Авторизация на уровне приложения с guard-ами
- Защита от DoS-атак через rate limiting

### Интеграция с базой данных
- Паттерн TypeORM Repository для всех операций с данными
- PostgreSQL с поддержкой JSONB для метаданных
- Автоматизированные миграции через центральный реестр
- CASCADE удаление связей с UNIQUE ограничениями

> **Документация по миграциям**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)

## Установка

```bash
# Установка из корня workspace
pnpm install

# Сборка пакета
pnpm --filter @universo/applications-backend build
```

## Использование

### Интеграция Express Router (рекомендуется)
```typescript
import express from 'express'
import { createApplicationsRoutes, initializeRateLimiters } from '@universo/applications-backend'

const app = express()
app.use(express.json())

await initializeRateLimiters()

app.use('/api/v1', createApplicationsRoutes(ensureAuth, getDataSource))
```

## API эндпоинты

### Приложения
```
GET    /applications                           # Список приложений
POST   /applications                           # Создать приложение
GET    /applications/:applicationId            # Получить детали приложения
PUT    /applications/:applicationId            # Обновить приложение
DELETE /applications/:applicationId            # Удалить приложение
```

### Коннекторы
```
GET    /applications/:applicationId/connectors              # Список коннекторов
POST   /applications/:applicationId/connectors              # Создать коннектор
GET    /applications/:applicationId/connectors/:connectorId # Получить детали коннектора
PUT    /applications/:applicationId/connectors/:connectorId # Обновить коннектор
DELETE /applications/:applicationId/connectors/:connectorId # Удалить коннектор
```

### Участники
```
GET    /applications/:applicationId/members              # Список участников
POST   /applications/:applicationId/members              # Пригласить участника
PUT    /applications/:applicationId/members/:memberId    # Изменить роль участника
DELETE /applications/:applicationId/members/:memberId    # Удалить участника
```

## Схема базы данных

### Основные сущности
- `Application`: Верхнеуровневый контейнер с локализованными именем/описанием (VLC)
- `Connector`: Контейнер данных внутри приложения с кодовым именем и порядком сортировки
- `ApplicationUser`: Таблица связи для членства пользователя в приложении с ролями

### Связи
```
Application (1) ─────┬───── (N) Connector
                     │
                     └───── (N) ApplicationUser ───── (1) User
```

## Роли и разрешения

| Роль    | Управление участниками | Управление прил. | Создание контента | Редактирование | Удаление |
|---------|------------------------|------------------|-------------------|----------------|----------|
| owner   | ✅                      | ✅                | ✅                 | ✅              | ✅        |
| admin   | ✅                      | ✅                | ✅                 | ✅              | ✅        |
| editor  | ❌                      | ❌                | ✅                 | ✅              | ✅        |
| member  | ❌                      | ❌                | ❌                 | ❌              | ❌        |

## Функции безопасности

- **Валидация входных данных**: Все входные данные валидируются Zod схемами
- **Авторизационные guard-ы**: Ролевой контроль доступа на всех эндпоинтах
- **Rate Limiting**: Настраиваемые лимиты запросов для каждого эндпоинта
- **Защита от SQL-инъекций**: Параметризованные запросы TypeORM
- **CORS**: Настраиваемый cross-origin resource sharing

## Разработка

### Запуск тестов
```bash
pnpm --filter @universo/applications-backend test
```

### Сборка
```bash
pnpm --filter @universo/applications-backend build
```

## Связанные пакеты

- `@universo/applications-frontend` - Frontend UI для приложений
- `@universo/core-backend` - Core backend с DataSource и миграциями
- `@universo/types` - Общие TypeScript типы

## Лицензия

Omsk Open License
