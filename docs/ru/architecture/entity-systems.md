---
description: Архитектурный обзор entity-first системы.
---

# Архитектура Entity Systems

Entity system предоставляет унифицированную модель для всех структурированных данных внутри метахаба. Каждый элемент контента — будь то хаб, каталог, набор или перечисление — представлен как **entity instance**, принадлежащий **entity type**. Система является полностью универсальным конструктором сущностей; Хабы, Каталоги, Наборы и Перечисления — это **шаблоны типов сущностей** (entity type presets), определённые в шаблонах метахабов, а не захардкоженные типы.

## Основные концепции

### Entity Types

Entity types определяют форму и поведение экземпляров. Выделяют две категории:

- **Standard presets**: Шаблоны типов сущностей, создаваемые шаблонами метахабов. К ним относятся `hub`, `catalog`, `set` и `enumeration`. Каждый пресет имеет специализированные UI и backend behavior, зарегистрированные через behavior service registry. Они не являются захардкоженными — система сущностей это универсальный конструктор, который обрабатывает все виды единообразно.
- **Custom entity types**: Пользовательские типы, создаваемые через UI управления Entity Types (в разделе администрирования). Custom types используют generic entity instance CRUD и могут иметь кастомные component manifests.

### Behavior Service Registry

Behavior registry сопоставляет kind keys со специализированными сервисами и UI-компонентами. При загрузке entity instance система находит его kind key и делегирует соответствующим:
- Backend controller handlers (CRUD, reorder, copy, delete with blocking references)
- Frontend list components (HubList, CatalogList, SetList, EnumerationList)
- Delete dialogs (TreeDeleteDialog, BlockingEntitiesDeleteDialog)

### Template Presets

Templates определяют, какие standard kinds доступны при создании метахаба. Каждый пресет может включаться/выключаться при создании. Когда пресет включён:
1. Создаётся строка entity type для данного standard kind
2. Создаётся экземпляр по умолчанию с локализованным именем
3. Инициализируются child metadata structures (field definitions, fixed values и т.д.)

### Child Resources (Metadata)

Entity instances могут владеть child metadata:
- **Field definitions**: Поля схемы, определяющие структуру записей (ранее "attributes")
- **Fixed values**: Предопределённые значения внутри набора (ранее "constants")
- **Records**: Записи данных внутри каталога (ранее "elements")
- **Option values**: Выбираемые значения внутри перечисления (ранее "enumeration values")

## Структура маршрутов

Все операции с entity проходят через entity-owned routes:
- `/entities/:kindKey/instance/:instanceId` — детали экземпляра
- `/entities/:kindKey/instance/:instanceId/field-definitions` — вкладка field definitions
- `/entities/:kindKey/instance/:instanceId/fixed-values` — вкладка fixed values
- `/entities/:kindKey/instance/:instanceId/records` — вкладка records

## Соответствие Standard Kind

| Kind Key | Display Name | Container | Child Metadata |
|----------|-------------|-----------|----------------|
| `hub` | Хаб (Hub) | — (top-level tree) | Каталоги |
| `catalog` | Каталог (Catalog) | Хаб | Field definitions, Records |
| `set` | Набор (Set) | — (standalone) | Fixed values |
| `enumeration` | Перечисление (Enumeration) | — (standalone) | Option values |

## Что читать дальше

- [Архитектура фронтенда](frontend.md)
- [Архитектура бэкенда](backend.md)
- [Руководство по Custom Entity Types](../guides/custom-entity-types.md)
- [Схема метахаба](metahub-schema.md)
