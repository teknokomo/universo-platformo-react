---
description: Архитектурный обзор entity-first системы.
---

# Архитектура Entity Systems

Entity system предоставляет унифицированную модель для всех структурированных данных внутри метахаба. Каждый элемент контента — будь то tree entity (hub), linked collection (catalog), value group (set) или option list (enumeration) — представлен как **entity instance**, принадлежащий **entity type**.

## Основные концепции

### Entity Types

Entity types определяют форму и поведение экземпляров. Выделяют две категории:

- **Standard kinds**: Встроенные виды, создаваемые пресетами шаблонов. К ним относятся `hub`, `catalog`, `set` и `enumeration`. Каждый standard kind имеет специализированные UI и backend behavior, зарегистрированные через behavior service registry.
- **Custom entity types**: Пользовательские типы, создаваемые через UI управления entity types. Custom types используют generic entity instance CRUD и могут иметь кастомные component manifests.

### Behavior Service Registry

Behavior registry сопоставляет kind keys со специализированными сервисами и UI-компонентами. При загрузке entity instance система находит его kind key и делегирует соответствующим:
- Backend controller handlers (CRUD, reorder, copy, delete with blocking references)
- Frontend list components (TreeEntityList, LinkedCollectionList, ValueGroupList, OptionListList)
- Delete dialogs (TreeDeleteDialog, BlockingEntitiesDeleteDialog)

### Template Presets

Templates определяют, какие standard kinds доступны при создании метахаба. Каждый пресет может включаться/выключаться при создании. Когда пресет включён:
1. Создаётся строка entity type для данного standard kind
2. Создаётся экземпляр по умолчанию с локализованным именем
3. Инициализируются child metadata structures (field definitions, fixed values и т.д.)

### Child Resources (Metadata)

Entity instances могут владеть child metadata:
- **Field definitions**: Поля схемы, определяющие структуру записей (ранее "attributes")
- **Fixed values**: Предопределённые значения внутри value group (ранее "constants")
- **Records**: Записи данных внутри linked collection (ранее "elements")
- **Option values**: Выбираемые значения внутри option list (ранее "enumeration values")

## Структура маршрутов

Все операции с entity проходят через entity-owned routes:
- `/entities/:kindKey/instance/:instanceId` — детали экземпляра
- `/entities/:kindKey/instance/:instanceId/field-definitions` — вкладка field definitions
- `/entities/:kindKey/instance/:instanceId/fixed-values` — вкладка fixed values
- `/entities/:kindKey/instance/:instanceId/records` — вкладка records

## Соответствие Standard Kind

| Kind Key | Display Name | Container | Child Metadata |
|----------|-------------|-----------|----------------|
| `hub` | Tree Entity | — (top-level tree) | Linked collections |
| `catalog` | Linked Collection | Tree Entity | Field definitions, Records |
| `set` | Value Group | — (standalone) | Fixed values |
| `enumeration` | Option List | — (standalone) | Option values |

## Что читать дальше

- [Архитектура фронтенда](frontend.md)
- [Архитектура бэкенда](backend.md)
- [Руководство по Custom Entity Types](../guides/custom-entity-types.md)
- [Схема метахаба](metahub-schema.md)
