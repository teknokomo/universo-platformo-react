# @universo/metahubs-backend

> 🏗️ **Современный пакет** - TypeScript-first архитектура с Express.js и TypeORM

Бэкенд-сервис для управления метахабами, хабами, каталогами, атрибутами, записями и членством со строгой изоляцией на уровне метахаба.

## Информация о пакете

- **Версия**: 0.1.0
- **Тип**: Backend Service Package (TypeScript)
- **Статус**: ✅ Активная разработка
- **Архитектура**: Express.js + TypeORM + Zod

## Ключевые возможности

### Доменная модель
- **Метахабы**: Верхнеуровневые организационные единицы с полной изоляцией данных
- **Хабы**: Контейнеры контента внутри метахабов (N:M связь с каталогами)
- **Каталоги**: Определения схем для структурированных данных (N:M связь с хабами)
- **Атрибуты**: Определения полей внутри каталогов
- **Записи**: Записи данных, соответствующие схемам каталогов
- **Членство**: Членство пользователя в метахабе с ролями и правами

### Изоляция данных и безопасность
- Полная изоляция метахабов — нет межметахабного доступа к данным
- Связь многие-ко-многим между хабами и каталогами (каталог может принадлежать нескольким хабам)
- Идемпотентные операции для управления связями
- Комплексная валидация входных данных с понятными сообщениями об ошибках
- Авторизация на уровне приложения с guard-ами метахаба/хаба/каталога
- Защита от DoS-атак через rate limiting

### Интеграция с базой данных
- Паттерн TypeORM Repository для всех операций с данными
- PostgreSQL с поддержкой JSONB для метаданных
- Автоматизированные миграции через центральный реестр
- CASCADE удаление связей с UNIQUE ограничениями

## Установка

```bash
# Установка из корня workspace
pnpm install

# Сборка пакета
pnpm --filter @universo/metahubs-backend build
```

## Использование

### Интеграция Express Router (рекомендуется)
```typescript
import express from 'express'
import { createMetahubsServiceRoutes, initializeRateLimiters } from '@universo/metahubs-backend'

const app = express()
app.use(express.json())

await initializeRateLimiters()

app.use('/api/v1', createMetahubsServiceRoutes(ensureAuth, getDataSource))

app.listen(3000)
```

Где:
- `ensureAuth` — ваше middleware аутентификации
- `getDataSource` возвращает TypeORM `DataSource`

## Справочник API

### Эндпоинты метахабов
```http
GET    /metahubs                               # Список метахабов
POST   /metahubs                               # Создать метахаб
GET    /metahubs/:metahubId                    # Получить детали метахаба
PUT    /metahubs/:metahubId                    # Обновить метахаб
DELETE /metahubs/:metahubId                    # Удалить метахаб (CASCADE)

GET    /metahubs/:metahubId/members            # Список участников метахаба
POST   /metahubs/:metahubId/members            # Добавить участника
PATCH  /metahubs/:metahubId/members/:memberId  # Обновить участника
DELETE /metahubs/:metahubId/members/:memberId  # Удалить участника
```

### Эндпоинты хабов
```http
GET    /metahubs/:metahubId/hubs               # Список хабов в метахабе
POST   /metahubs/:metahubId/hubs               # Создать хаб
GET    /metahubs/:metahubId/hubs/:hubId        # Получить детали хаба
PUT    /metahubs/:metahubId/hubs/:hubId        # Обновить хаб
DELETE /metahubs/:metahubId/hubs/:hubId        # Удалить хаб
```

### Эндпоинты каталогов
```http
GET    /metahubs/:metahubId/catalogs           # Список всех каталогов в метахабе
GET    /metahubs/:metahubId/hubs/:hubId/catalogs                  # Список каталогов в хабе
POST   /metahubs/:metahubId/hubs/:hubId/catalogs                  # Создать каталог в хабе
GET    /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId       # Получить детали каталога
PUT    /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId       # Обновить каталог
DELETE /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId       # Удалить каталог

POST   /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId/link  # Привязать существующий каталог к хабу
DELETE /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId/unlink # Отвязать каталог от хаба
```

### Эндпоинты атрибутов
```http
GET    /metahubs/:m/hubs/:h/catalogs/:c/attributes                # Список атрибутов
POST   /metahubs/:m/hubs/:h/catalogs/:c/attributes                # Создать атрибут
GET    /metahubs/:m/hubs/:h/catalogs/:c/attributes/:attrId        # Получить атрибут
PUT    /metahubs/:m/hubs/:h/catalogs/:c/attributes/:attrId        # Обновить атрибут
DELETE /metahubs/:m/hubs/:h/catalogs/:c/attributes/:attrId        # Удалить атрибут
```

### Эндпоинты записей
```http
GET    /metahubs/:m/hubs/:h/catalogs/:c/records                   # Список записей
POST   /metahubs/:m/hubs/:h/catalogs/:c/records                   # Создать запись
GET    /metahubs/:m/hubs/:h/catalogs/:c/records/:recordId         # Получить запись
PUT    /metahubs/:m/hubs/:h/catalogs/:c/records/:recordId         # Обновить запись
DELETE /metahubs/:m/hubs/:h/catalogs/:c/records/:recordId         # Удалить запись
```

### Примеры запросов/ответов

#### Создать метахаб
```http
POST /metahubs
Content-Type: application/json

{
  "name": "Gaming Hub",
  "description": "Virtual gaming worlds and assets"
}
```

Ответ:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Gaming Hub", 
    "description": "Virtual gaming worlds and assets",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Создать запись
```http
POST /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId/records
Content-Type: application/json

{
  "data": {
    "name": "Player Avatar",
    "model": "character.fbx",
    "animations": ["idle", "walk", "run"]
  }
}
```

## Модель данных

### Основные сущности (высокий уровень)

- `Metahub`: верхнеуровневый контейнер (организация/рабочее пространство).
- `Hub`: контейнер контента внутри метахаба.
- `Catalog`: определение схемы для структурированных данных (N:M с хабами через таблицу связей).
- `Attribute`: определение поля внутри каталога (имя, тип, ограничения).
- `Record`: запись данных, соответствующая схеме каталога (JSONB данные).
- `MetahubUser`: членство с ролями и правами.

### Таблицы связей

- `CatalogHub`: связывает каталоги с хабами (связь N:M).

Примечания:
- Таблицы связей используют `UNIQUE` ограничения на пары и `ON DELETE CASCADE` для ссылочной целостности.
- Каталог может принадлежать нескольким хабам внутри одного метахаба.

## Валидация и бизнес-правила

- `metahubId` обязателен для всех операций.
- `hubId` обязателен при создании каталогов.
- `catalogId` обязателен при создании атрибутов и записей.
- UUID-параметры валидируются, а доступ обеспечивается guard-ами.

## Схема базы данных

### Миграции и регистрация сущностей

Сущности и миграции Metahubs регистрируются в Flowise core backend:

```typescript
// flowise-core-backend/base/src/database/entities/index.ts
import { metahubsEntities } from '@universo/metahubs-backend'

// flowise-core-backend/base/src/database/migrations/postgres/index.ts
import { metahubsMigrations } from '@universo/metahubs-backend'
```

## Разработка

### Доступные скрипты
```bash
pnpm --filter @universo/metahubs-backend build
pnpm --filter @universo/metahubs-backend dev
pnpm --filter @universo/metahubs-backend test
pnpm --filter @universo/metahubs-backend lint
```

### Структура проекта
```
src/
├── database/
│   ├── entities/
│   └── migrations/
├── routes/
├── schemas/
├── tests/
├── types/
├── utils/
└── index.ts
```

## Безопасность

- Авторизация на уровне приложения с `ensureMetahubAccess`, `ensureHubAccess` и `ensureCatalogAccess`.
- Rate limiting инициализируется через `initializeRateLimiters()`.

## Связанные пакеты
- [`@universo/metahubs-frontend`](../metahubs-frontend/base/README.md) - Frontend client
- [`@universo/auth-backend`](../auth-backend/base/README.md) - Authentication service
- [`@universo/utils`](../universo-utils/base/README.md) - Shared utilities

---
*Часть [Universo Platformo](../../../README.md)*
