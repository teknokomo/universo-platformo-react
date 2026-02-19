# @universo/metahubs-backend

> ✨ **Современный пакет** — архитектура TypeScript-first с Express.js, TypeORM, Knex и Zod

Бэкенд-сервис для управления метахабами, хабами, каталогами, атрибутами, элементами, членством, шаблонами и динамическими DDL-схемами со строгой изоляцией на уровне метахабов.

## Информация о пакете

| Поле | Значение |
|------|----------|
| **Версия** | 0.1.0 |
| **Тип** | Серверный пакет (TypeScript) |
| **Статус** | ✅ Активная разработка |
| **Архитектура** | Express.js + TypeORM + Knex + Zod |
| **Имя пакета** | `@universo/metahubs-backend` |

## Ключевые возможности

### Доменная модель
- **Метахабы** — Организационные единицы верхнего уровня с полной изоляцией данных
- **Хабы** — Контейнеры контента внутри метахабов (связь N:M с каталогами)
- **Каталоги** — Определения схем для структурированных данных (связь N:M с хабами)
- **Атрибуты** — Определения полей внутри каталогов
- **Элементы** — Записи данных, соответствующие схемам каталогов (JSONB)
- **Членство** — Связь пользователь-метахаб с ролями и разрешениями
- **Шаблоны** — Переиспользуемые чертежи метахабов с версионированными манифестами
- **Ветки** — Изолированные PostgreSQL-схемы на ветку метахаба (`mhb_<uuid>_b<n>`)

### Декларативный DDL и системные таблицы
- **Типизированные определения** — Все системные таблицы описаны как структуры данных `SystemTableDef` вместо императивного кода Knex
- **Общие наборы полей** — Поля `_upl_*` (аудит платформы) и `_mhb_*` (жизненный цикл метахаба) определяются один раз и добавляются ко всем таблицам автоматически
- **Реестр версий** — Карта `SYSTEM_TABLE_VERSIONS` связывает каждую версию с полным набором таблиц
- **DDL-генератор** — `SystemTableDDLGenerator` преобразует декларативные определения в Knex DDL (идемпотентно, пропускает существующие таблицы)

### Движок миграций

Безопасная система аддитивных миграций с рекомендательными блокировками и полной историей.

> **Полная документация**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)

### Система шаблонов
- **Встроенные шаблоны** — Предустановленные шаблоны, заполняемые при запуске приложения (например, `basic` дашборд)
- **Версионированные манифесты** — Каждая версия шаблона хранит полный `MetahubTemplateManifest` с SHA-256 хэшем для обнаружения изменений
- **Идемпотентное заполнение** — `TemplateSeeder` пропускает неизменённые шаблоны через сравнение хэшей (`json-stable-stringify` + SHA-256)
- **Валидация Zod** — Манифесты шаблонов проверяются строгими Zod-схемами перед вставкой в БД
- **Автоматическое назначение** — При создании метахаба без явного `templateId` шаблон по умолчанию назначается автоматически
- **Первичное заполнение** — `TemplateSeedExecutor` заполняет пустые схемы веток атомарно в одной транзакции БД
- **Инкрементальное заполнение** — `TemplateSeedMigrator` добавляет только НОВЫЕ элементы в существующие схемы без перезаписи данных пользователя

### Изоляция данных и безопасность
- Полная изоляция метахабов — нет межметахабного доступа к данным
- Авторизация на уровне приложения с гардами метахаб/хаб/каталог
- Защита от DoS-атак через ограничение частоты запросов
- Оптимистическая блокировка с счётчиком `_upl_version` для обнаружения конкурентных правок

### Структурированные блокировки и гард миграций

Интернационализированные структурированные блокировки и эндпоинты гарда миграций. См. [MIGRATIONS-RU.md](MIGRATIONS-RU.md) для подробностей.

### Конфигурация columnsContainer в сидах
- **Сид макета по умолчанию** в `layoutDefaults.ts` включает виджет `columnsContainer` в центральной зоне
- **2-колоночный макет**: 9/12 ширины `detailsTable` + 3/12 ширины `productTree`
- **Структура конфигурации**: тип `ColumnsContainerConfig` с `columns: ColumnsContainerColumn[]`
- **Виджеты на колонку**: `ColumnsContainerColumnWidget[]` с поддержкой нескольких виджетов в колонке
- **buildDashboardLayoutConfig()** генерирует булевые флаги из списка активных виджетов с учётом зоны

## Установка

```bash
# Установка из корня монорепозитория
pnpm install

# Сборка пакета
pnpm --filter @universo/metahubs-backend build
```

## Использование

### Интеграция с Express Router

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
- `ensureAuth` — ваш middleware аутентификации
- `getDataSource` — возвращает TypeORM `DataSource`

### Заполнение шаблонов при запуске

Шаблоны заполняются автоматически при запуске приложения. Сидер вызывается из `flowise-core-backend`:

```typescript
import { seedTemplates } from '@universo/metahubs-backend'

// Вызвать один раз после инициализации DataSource
await seedTemplates(dataSource) // Идемпотентно — безопасно вызывать при каждом запуске
```

### Добавление нового шаблона

1. Создайте новый файл в `src/domains/templates/data/` (например, `catalog.template.ts`):

```typescript
import type { MetahubTemplateManifest, VersionedLocalizedContent } from '@universo/types'

const vlc = (en: string, ru: string): VersionedLocalizedContent<string> => ({
  _schema: '1', _primary: 'en',
  locales: {
    en: { content: en, version: 1, isActive: true, createdAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z' },
    ru: { content: ru, version: 1, isActive: true, createdAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z' }
  }
})

export const catalogTemplate: MetahubTemplateManifest = {
  $schema: 'metahub-template/v1',
  codename: 'catalog-manager',
  version: '1.0.0',
  minStructureVersion: 1,
  name: vlc('Catalog Manager', 'Менеджер каталогов'),
  description: vlc('Template for product catalog management', 'Шаблон для управления каталогами товаров'),
  meta: { author: 'universo-platformo', tags: ['catalog'], icon: 'Inventory' },
  seed: {
    layouts: [/* ... */],
    layoutZoneWidgets: {/* ... */},
    settings: [/* ... */],
    entities: [/* ... */]
  }
}
```

2. Зарегистрируйте в `src/domains/templates/data/index.ts`:

```typescript
import { catalogTemplate } from './catalog.template'

export const builtinTemplates: MetahubTemplateManifest[] = [
  basicTemplate,
  catalogTemplate   // ← добавить сюда
]
```

3. Шаблон будет автоматически заполнен при следующем запуске приложения.

### Добавление новой версии структуры / Обновление существующих метахабов

Пошаговые руководства по добавлению новых версий структуры и как существующие метахабы автоматически мигрируются (DDL-изменения, обновления шаблонов, TypeORM-сущности).

> **Полная документация**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)

## Архитектура

### Системные таблицы (на схему ветки)

Каждая ветка метахаба получает изолированную PostgreSQL-схему (`mhb_<uuid>_b<n>`) с этими системными таблицами:

| Таблица | Версия | Описание |
|---------|--------|----------|
| `_mhb_objects` | V1 | Единый реестр объектов (каталоги, хабы, документы) с презентацией и конфигом |
| `_mhb_attributes` | V1 | Определения полей с типами данных, правилами валидации и UI-конфигурацией |
| `_mhb_elements` | V1 | Предустановленные записи данных для каталогов (JSONB) |
| `_mhb_settings` | V1 | Настройки ветки в формате ключ-значение |
| `_mhb_layouts` | V1 | UI-макеты для опубликованных приложений (шаблоны дашбордов) |
| `_mhb_widgets` | V1 | Назначение виджетов по зонам макета с порядком сортировки и конфигом |
| `_mhb_migrations` | V1 | История миграций с отслеживанием версий и метаданными |

Все таблицы автоматически включают:
- **Поля `_upl_*`** (16 колонок) — аудит на уровне платформы, оптимистическая блокировка, мягкое удаление, архив, блокировка записей
- **Поля `_mhb_*`** (9 колонок) — публикация, архив и мягкое удаление на уровне метахаба

### Жизненный цикл схемы

```
┌─────────────────────────────────────────────────────────────────┐
│  Запуск приложения                                               │
│  TemplateSeeder.seed() → upsert шаблонов в БД (идемпотентно)   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  MetahubSchemaService.ensureSchema(metahubId, userId)           │
│  1. Определить ветку (по умолчанию или активную пользователя)    │
│  2. Захватить advisory lock                                      │
│  3. CREATE SCHEMA IF NOT EXISTS                                  │
│  4. initSystemTables() → DDL из реестра версий структуры         │
│     └─ SystemTableDDLGenerator.createAll(tableDefs)             │
│  5. TemplateSeedExecutor.apply(seed) → заполнить сид-данные      │
│  6. Авто-миграция если structureVersion < CURRENT_STRUCTURE_VER  │
│     ├─ SystemTableMigrator.migrate(from, to) → DDL-изменения     │
│     └─ TemplateSeedMigrator.migrateSeed(seed) → новые сид-данные │
│  7. Обновить branch.structureVersion = CURRENT                   │
│  8. Освободить advisory lock                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Поток декларативного DDL

```
SystemTableDef[]              ──→ SystemTableDDLGenerator  ──→ Knex DDL (CREATE TABLE)
       │                                                            │
       └──→ calculateSystemTableDiff() ──→ SystemTableDiff  ──→ SystemTableMigrator
                                            │                       │
                                            ├─ additive[]     ──→ Применяются автоматически
                                            └─ destructive[]  ──→ Логируются, НЕ применяются
```

### Поток заполнения шаблона

```
MetahubTemplateManifest
  └─ seed: MetahubTemplateSeed
       ├─ layouts[]              ──→  _mhb_layouts
       ├─ layoutZoneWidgets{}    ──→  _mhb_widgets
       ├─ settings[]             ──→  _mhb_settings
       ├─ entities[]             ──→  _mhb_objects + _mhb_attributes
       └─ elements{}             ──→  _mhb_elements
```

Два пути выполнения:
- **Новая схема** → `TemplateSeedExecutor` — вставляет все сид-данные транзакционно
- **Существующая схема** → `TemplateSeedMigrator` — добавляет только НОВЫЕ элементы, не конфликтующие с текущим состоянием

### Архитектура системных полей

Все системные таблицы используют трёхуровневую архитектуру полей:

#### Уровень платформы (`_upl_*`) — 16 колонок
- `_upl_created_at`, `_upl_created_by` — Аудит создания
- `_upl_updated_at`, `_upl_updated_by` — Аудит модификации
- `_upl_version` — Счётчик оптимистической блокировки
- `_upl_archived`, `_upl_archived_at`, `_upl_archived_by` — Статус архива
- `_upl_deleted`, `_upl_deleted_at`, `_upl_deleted_by`, `_upl_purge_after` — Мягкое удаление
- `_upl_locked`, `_upl_locked_at`, `_upl_locked_by`, `_upl_locked_reason` — Блокировка записей

#### Уровень метахаба (`_mhb_*`) — 9 колонок
- `_mhb_published`, `_mhb_published_at`, `_mhb_published_by` — Статус публикации
- `_mhb_archived`, `_mhb_archived_at`, `_mhb_archived_by` — Архив на уровне метахаба
- `_mhb_deleted`, `_mhb_deleted_at`, `_mhb_deleted_by` — Мягкое удаление на уровне метахаба

### Оптимистическая блокировка

Все PATCH/PUT эндпоинты поддерживают оптимистическую блокировку для предотвращения конфликтов конкурентных правок:

```http
PATCH /metahub/:metahubId
Content-Type: application/json

{
  "name": "Updated Name",
  "expectedVersion": 3
}
```

Если сущность была изменена другим пользователем, сервер отвечает HTTP 409:

```json
{
  "error": "Conflict: entity was modified by another user",
  "code": "OPTIMISTIC_LOCK_CONFLICT",
  "conflict": {
    "entityId": "uuid",
    "entityType": "metahub",
    "expectedVersion": 3,
    "actualVersion": 4,
    "updatedAt": "2024-01-15T10:30:00Z",
    "updatedBy": "user-uuid",
    "updatedByEmail": "user@example.com"
  }
}
```

## Справочник API

### Эндпоинты метахабов
```http
GET    /metahubs                               # Список метахабов
POST   /metahubs                               # Создание метахаба
GET    /metahub/:metahubId                     # Получение деталей метахаба
PUT    /metahub/:metahubId                     # Обновление метахаба
DELETE /metahub/:metahubId                     # Удаление метахаба (CASCADE)

GET    /metahub/:metahubId/members             # Список участников метахаба
POST   /metahub/:metahubId/members             # Добавление участника
PATCH  /metahub/:metahubId/member/:memberId    # Обновление участника
DELETE /metahub/:metahubId/member/:memberId    # Удаление участника
```

### Эндпоинты веток
```http
GET    /metahub/:metahubId/branches                          # Список веток
GET    /metahub/:metahubId/branches/options                  # Список веток (формат select options)
GET    /metahub/:metahubId/branch/:branchId                  # Получение деталей ветки
POST   /metahub/:metahubId/branches                          # Создание ветки (клон из источника)
PATCH  /metahub/:metahubId/branch/:branchId                  # Обновление метаданных ветки
POST   /metahub/:metahubId/branch/:branchId/activate         # Установить активную ветку для пользователя
POST   /metahub/:metahubId/branch/:branchId/default          # Установить ветку по умолчанию для метахаба
GET    /metahub/:metahubId/branch/:branchId/blocking-users   # Пользователи с этой активной веткой
DELETE /metahub/:metahubId/branch/:branchId                  # Удаление ветки
```

### Эндпоинты хабов
```http
GET    /metahub/:metahubId/hubs                # Список хабов в метахабе
POST   /metahub/:metahubId/hubs                # Создание хаба
GET    /metahub/:metahubId/hub/:hubId          # Получение деталей хаба
PATCH  /metahub/:metahubId/hub/:hubId          # Обновление хаба
DELETE /metahub/:metahubId/hub/:hubId          # Удаление хаба
```

### Эндпоинты каталогов
```http
GET    /metahub/:metahubId/catalogs                               # Все каталоги в метахабе
POST   /metahub/:metahubId/catalogs                               # Создание каталога на уровне метахаба
GET    /metahub/:metahubId/catalog/:catalogId                     # Получение каталога (область метахаба)
PATCH  /metahub/:metahubId/catalog/:catalogId                     # Обновление каталога (область метахаба)
DELETE /metahub/:metahubId/catalog/:catalogId                     # Удаление каталога (область метахаба)

GET    /metahub/:metahubId/hub/:hubId/catalogs                     # Каталоги в хабе
POST   /metahub/:metahubId/hub/:hubId/catalogs                     # Создание каталога в хабе
GET    /metahub/:metahubId/hub/:hubId/catalog/:catalogId           # Получение каталога (область хаба)
PATCH  /metahub/:metahubId/hub/:hubId/catalog/:catalogId           # Обновление каталога (область хаба)
DELETE /metahub/:metahubId/hub/:hubId/catalog/:catalogId           # Удаление каталога (область хаба)
```

### Эндпоинты атрибутов
```http
GET    /metahub/:m/hub/:h/catalog/:c/attributes                   # Список атрибутов (область хаба)
POST   /metahub/:m/hub/:h/catalog/:c/attributes                   # Создание атрибута (область хаба)
GET    /metahub/:m/hub/:h/catalog/:c/attribute/:attrId            # Получение атрибута (область хаба)
PATCH  /metahub/:m/hub/:h/catalog/:c/attribute/:attrId            # Обновление атрибута (область хаба)
DELETE /metahub/:m/hub/:h/catalog/:c/attribute/:attrId            # Удаление атрибута (область хаба)
PATCH  /metahub/:m/hub/:h/catalog/:c/attribute/:attrId/move       # Перемещение атрибута (область хаба)

GET    /metahub/:m/catalog/:c/attributes                          # Список атрибутов (прямой)
POST   /metahub/:m/catalog/:c/attributes                          # Создание атрибута (прямой)
GET    /metahub/:m/catalog/:c/attribute/:attrId                   # Получение атрибута (прямой)
PATCH  /metahub/:m/catalog/:c/attribute/:attrId                   # Обновление атрибута (прямой)
DELETE /metahub/:m/catalog/:c/attribute/:attrId                   # Удаление атрибута (прямой)
PATCH  /metahub/:m/catalog/:c/attribute/:attrId/move              # Перемещение атрибута (прямой)
```

### Эндпоинты элементов
```http
GET    /metahub/:m/hub/:h/catalog/:c/elements                     # Список элементов (область хаба)
POST   /metahub/:m/hub/:h/catalog/:c/elements                     # Создание элемента (область хаба)
GET    /metahub/:m/hub/:h/catalog/:c/element/:elementId           # Получение элемента (область хаба)
PATCH  /metahub/:m/hub/:h/catalog/:c/element/:elementId           # Обновление элемента (область хаба)
DELETE /metahub/:m/hub/:h/catalog/:c/element/:elementId           # Удаление элемента (область хаба)

GET    /metahub/:m/catalog/:c/elements                            # Список элементов (прямой)
POST   /metahub/:m/catalog/:c/elements                            # Создание элемента (прямой)
GET    /metahub/:m/catalog/:c/element/:elementId                  # Получение элемента (прямой)
PATCH  /metahub/:m/catalog/:c/element/:elementId                  # Обновление элемента (прямой)
DELETE /metahub/:m/catalog/:c/element/:elementId                  # Удаление элемента (прямой)
```

### Эндпоинты макетов
```http
GET    /metahub/:metahubId/layouts                                        # Список макетов
POST   /metahub/:metahubId/layouts                                        # Создание макета
GET    /metahub/:metahubId/layout/:layoutId                               # Получение деталей макета
PATCH  /metahub/:metahubId/layout/:layoutId                               # Обновление макета
DELETE /metahub/:metahubId/layout/:layoutId                               # Удаление макета

GET    /metahub/:metahubId/layout/:layoutId/zone-widgets/catalog          # Список доступных типов виджетов
GET    /metahub/:metahubId/layout/:layoutId/zone-widgets                  # Список назначенных виджетов зон
PUT    /metahub/:metahubId/layout/:layoutId/zone-widget                   # Назначение виджета в зону
PATCH  /metahub/:metahubId/layout/:layoutId/zone-widgets/move             # Перемещение виджета зоны
DELETE /metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId         # Удаление виджета зоны
PATCH  /metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId/config  # Обновление конфига виджета
```

### Эндпоинты публикаций (синхронизация схем)
```http
GET    /metahub/:metahubId/publications                           # Список публикаций
POST   /metahub/:metahubId/publications                           # Создание публикации
GET    /metahub/:metahubId/publication/:id                        # Получение деталей публикации
PATCH  /metahub/:metahubId/publication/:id                        # Обновление публикации
DELETE /metahub/:metahubId/publication/:id                        # Удаление публикации + схема
GET    /metahub/:metahubId/publication/:id/diff                   # Получение различий схемы
POST   /metahub/:metahubId/publication/:id/sync                   # Синхронизация схемы в БД
```

### Эндпоинты приложений (рантайм-схема)
```http
POST   /application/:applicationId/sync                                  # Создание или обновление рантайм-схемы
GET    /application/:applicationId/diff                                  # Вычисление различий схемы

GET    /application/:applicationId/migrations                            # Список всех миграций
GET    /application/:applicationId/migration/:migrationId                # Получение деталей миграции
GET    /application/:applicationId/migration/:migrationId/analyze        # Анализ возможности отката
POST   /application/:applicationId/migration/:migrationId/rollback       # Откат к миграции
```

### Эндпоинты миграций метахабов
```http
GET    /metahub/:metahubId/migrations/status                              # Проверка статуса миграций (блокировки, информация о версиях)
POST   /metahub/:metahubId/migrations/apply                               # Применение ожидающих миграций (тело: { cleanupMode: 'keep' })
```

> **Формат ответа и подробности**: [MIGRATIONS-RU.md](MIGRATIONS-RU.md)
```

### Эндпоинты шаблонов
```http
GET    /templates                              # Список всех активных шаблонов
GET    /templates/:templateId                  # Получение шаблона с активной версией манифеста
```

### Публичный API (без аутентификации)
```http
GET    /api/public/metahub/:slug                                                    # Получение публичного метахаба по slug
GET    /api/public/metahub/:slug/hub/:hubCodename                                   # Получение хаба по codename
GET    /api/public/metahub/:slug/hub/:hubCodename/catalog/:catalogCodename          # Получение каталога
GET    /api/public/metahub/:slug/hub/:hubCodename/catalog/:catalogCodename/attributes   # Список атрибутов
GET    /api/public/metahub/:slug/hub/:hubCodename/catalog/:catalogCodename/elements     # Список элементов
GET    /api/public/metahub/:slug/hub/:hubCodename/catalog/:catalogCodename/element/:id  # Получение элемента
```

### Примеры запросов/ответов

#### Создание метахаба
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

## Модель данных

### Основные сущности (TypeORM)

| Сущность | Таблица | Описание |
|----------|---------|----------|
| `Metahub` | `metahubs` | Контейнер верхнего уровня (организация/рабочее пространство) |
| `MetahubBranch` | `metahub_branches` | Ветка с изолированной схемой, отслеживание версии структуры |
| `MetahubUser` | `metahub_users` | Членство с ролью, разрешениями, выбором активной ветки |
| `Publication` | `publications` | Публикация, связывающая метахаб со схемой приложения |
| `PublicationVersion` | `publication_versions` | Снимок состояния опубликованной схемы |
| `Template` | `templates` | Определение переиспользуемого шаблона метахаба |
| `TemplateVersion` | `template_versions` | Неизменяемый снимок манифеста шаблона (хэш SHA-256) |

### Таблицы связей

- `CatalogHub` — связь каталогов с хабами (связь N:M, `UNIQUE` на пару, `ON DELETE CASCADE`)

### Системные таблицы (на схему ветки) — Динамические

Смотрите [Архитектура → Системные таблицы](#системные-таблицы-на-схему-ветки) для полного списка 7 таблиц с описаниями.

## Валидация и бизнес-правила

- `metahubId` обязателен для всех операций
- `hubId` обязателен для создания каталогов
- `catalogId` обязателен для создания атрибутов и элементов
- UUID-параметры валидируются, доступ контролируется гардами
- Манифесты шаблонов проверяются Zod-схемами перед вставкой в БД
- Миграции версий структуры безопасны (только аддитивные) и записываются в `_mhb_migrations`

## Схема базы данных

### Миграции и регистрация сущностей

Сущности и миграции метахабов зарегистрированы в ядре Flowise. См. [MIGRATIONS-RU.md](MIGRATIONS-RU.md) для подробностей.

## Структура файлов

```
src/
├── index.ts                          # Публичные экспорты API
├── database/
│   ├── entities/                     # TypeORM-сущности
│   │   ├── Metahub.ts
│   │   ├── MetahubBranch.ts
│   │   ├── MetahubUser.ts
│   │   ├── Publication.ts
│   │   ├── PublicationVersion.ts
│   │   ├── Template.ts
│   │   ├── TemplateVersion.ts
│   │   └── index.ts
│   └── migrations/
│       └── postgres/
├── domains/
│   ├── metahubs/
│   │   ├── routes/
│   │   │   ├── metahubsRoutes.ts             # Аутентифицированный CRUD метахабов + участники
│   │   │   └── publicMetahubsRoutes.ts       # Публичный API только для чтения (без авторизации)
│   │   ├── services/
│   │   │   ├── MetahubSchemaService.ts       # Оркестратор жизненного цикла схемы
│   │   │   ├── SystemTableDDLGenerator.ts    # Декларативный DDL → Knex DDL
│   │   │   ├── SystemTableMigrator.ts        # Движок аддитивных миграций
│   │   │   ├── systemTableDefinitions.ts     # Декларативные определения таблиц (базовая версия V1)
│   │   │   ├── systemTableDiff.ts            # Движок различий (старая vs новая версия)
│   │   │   ├── structureVersions.ts          # Реестр версий, CURRENT_STRUCTURE_VERSION
│   │   │   ├── MetahubAttributesService.ts
│   │   │   ├── MetahubElementsService.ts
│   │   │   ├── MetahubHubsService.ts
│   │   │   ├── MetahubObjectsService.ts
│   │   │   └── schemaSync.ts
│   │   └── index.ts
│   ├── templates/
│   │   ├── data/
│   │   │   ├── basic.template.ts             # Встроенный манифест шаблона "basic"
│   │   │   └── index.ts                      # Реестр шаблонов + DEFAULT_TEMPLATE_CODENAME
│   │   ├── routes/
│   │   │   └── templatesRoutes.ts            # Эндпоинты GET /templates
│   │   └── services/
│   │       ├── TemplateSeeder.ts             # Сидер запуска (дедупликация SHA-256)
│   │       ├── TemplateSeedExecutor.ts       # Заполнение новой схемы (транзакционно)
│   │       ├── TemplateSeedMigrator.ts       # Инкрементальная миграция сидов
│   │       └── TemplateManifestValidator.ts  # Zod-схемы валидации
│   ├── branches/
│   │   ├── routes/
│   │   │   └── branchesRoutes.ts             # CRUD веток + activate/default
│   │   └── services/
│   │       └── MetahubBranchesService.ts
│   ├── hubs/
│   │   └── routes/
│   ├── catalogs/
│   │   └── routes/
│   ├── attributes/
│   │   └── routes/
│   ├── elements/
│   │   └── routes/
│   ├── publications/
│   │   ├── routes/
│   │   │   └── publicationsRoutes.ts
│   │   └── services/
│   │       └── SnapshotSerializer.ts
│   ├── layouts/
│   │   ├── routes/
│   │   │   └── layoutsRoutes.ts              # CRUD макетов + виджеты зон
│   │   └── services/
│   │       └── MetahubLayoutsService.ts
│   ├── applications/
│   │   └── routes/
│   │       ├── applicationSyncRoutes.ts      # Синхронизация схемы + различия
│   │       └── applicationMigrationsRoutes.ts # История миграций + откат
│   ├── migrations/
│   │   ├── routes/
│   │   │   └── metahubMigrationsRoutes.ts    # Эндпоинты статуса и применения миграций
│   │   └── services/
│   │       └── TemplateSeedCleanupService.ts  # Генерация структурированных блокировок (11 точек)
│   ├── ddl/
│   │   ├── KnexClient.ts                    # Singleton Knex-экземпляр
│   │   ├── definitions/
│   │   │   └── catalogs.ts
│   │   └── index.ts                          # Реэкспорт из @universo/schema-ddl
│   ├── shared/
│   │   ├── guards.ts                         # ensureMetahubAccess, ensureHubAccess и т.д.
│   │   ├── layoutDefaults.ts                 # DEFAULT_DASHBOARD_ZONE_WIDGETS + сид columnsContainer
│   │   ├── queryParams.ts
│   │   └── index.ts
│   └── router.ts                             # Агрегатор маршрутов сервиса
├── tests/
├── types/
└── utils/
```

## Точки интеграции

### Зависимости рабочего пространства
- **`@universo/types`** — Общие TypeScript-типы (`MetahubTemplateManifest`, `MetahubTemplateSeed`, VLC, зоны/виджеты дашборда)
- **`@universo/schema-ddl`** — DDL-утилиты (`SchemaGenerator`, `SchemaMigrator`, `KnexClient`, advisory locks)
- **`@universo/auth-backend`** — Middleware аутентификации
- **`@universo/admin-backend`** — Интеграция с админ-сервисом
- **`@universo/applications-backend`** — Управление схемами приложений
- **`@universo/utils`** — Общие утилиты (ограничение частоты, валидация, локализованный контент)

### Интеграция при запуске
- `seedTemplates()` вызывается из `flowise-core-backend` при запуске приложения
- Заполнение шаблонов идемпотентно и не фатально (ошибки логируются, сервер не падает)

## Разработка

### Доступные скрипты
```bash
pnpm --filter @universo/metahubs-backend build    # Сборка пакета
pnpm --filter @universo/metahubs-backend dev      # Режим наблюдения
pnpm --filter @universo/metahubs-backend test     # Запуск тестов
pnpm --filter @universo/metahubs-backend lint     # Запуск линтера
```

### Ключевые проектные решения
1. **Декларативный вместо императивного** — Системные таблицы описаны как типизированные структуры данных, а не императивные вызовы Knex builder. Это позволяет миграции на основе различий.
2. **Только аддитивные авто-миграции** — Деструктивные изменения схемы (DROP TABLE/COLUMN) никогда не применяются автоматически, обеспечивая безопасность данных.
3. **Двойные пути заполнения** — Новые схемы используют `TemplateSeedExecutor` (полная вставка); существующие — `TemplateSeedMigrator` (инкрементально, без разрушений).
4. **Ленивая миграция по веткам** — Существующие метахабы обновляются лениво при первом обращении после повышения версии, а не при запуске. Это избегает долгих запусков.
5. **Advisory Locking** — PostgreSQL advisory locks предотвращают гонки при конкурентном создании схем.

## Безопасность

- Авторизация на уровне приложения с гардами `ensureMetahubAccess`, `ensureHubAccess` и `ensureCatalogAccess`
- Ограничение частоты через `initializeRateLimiters()` (чтение: 600/15мин, запись: 240/15мин)
- Row-Level Security на уровне PostgreSQL через интеграцию с Supabase
- Публичные API-эндпоинты обслуживают только метахабы с флагом `isPublic=true`, только чтение

## Связанные пакеты

- [`@universo/metahubs-frontend`](../../metahubs-frontend/base/README.md) — Frontend UI для управления метахабами
- [`@universo/schema-ddl`](../../schema-ddl/base/README.md) — DDL-генерация и управление схемами
- [`@universo/types`](../../universo-types/base/README.md) — Общие TypeScript-определения типов
- [`@universo/auth-backend`](../../auth-backend/base/README.md) — Сервис аутентификации
- [`@universo/applications-backend`](../../applications-backend/base/README.md) — Сервис схем приложений

## Вклад в разработку

### Рабочий процесс разработки
1. Создать ветку функциональности от `main`
2. Реализовать изменения, следуя стандартам кодирования
3. Добавить соответствующие тесты для новой функциональности
4. Обновить документацию по необходимости
5. Отправить pull request на ревью

## Лицензия

Apache License Version 2.0 — Смотрите файл [LICENSE](../../../LICENSE) для деталей.

---

**Поддержка**: По вопросам, проблемам или запросам функциональности обращайтесь к документации проекта или создайте issue в репозитории.

*Часть [Universo Platformo](../../../README.md)*
