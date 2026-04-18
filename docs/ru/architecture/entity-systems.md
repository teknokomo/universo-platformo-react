---
description: Архитектурный обзор entity-first системы метахабов.
---

# Архитектура Entity Systems

Теперь метахабы используют единый entity-first конструктор и для платформенных пресетов, и для пользовательских типов метаданных. Хабы, Каталоги, Наборы и Перечисления больше не являются отдельными захардкоженными модулями продукта. Это встроенные пресеты типов сущностей, которые поставляются шаблонами метахабов и материализуются в том же реестре типов сущностей, что и пользовательские типы.

## Основные слои

### Типы сущностей

Тип сущности определяет:

- свой `kindKey`
- локализованные presentation- и codename-метаданные
- component manifest, который включает schema, records, fixed values, option values, scripts, layouts, runtime behavior и другие возможности
- UI-настройки: иконку, размещение в боковом меню, вкладки authoring-а и метаданные resource surfaces

Платформенные пресеты и пользовательские типы проходят через одно и то же хранилище и один и тот же контур валидации.

### Экземпляры сущностей

Каждый design-time объект внутри метахаба является entity instance, привязанным к одному типу сущности. CRUD, reorder, copy, delete, publication и runtime sync работают через общие entity-контракты, а behavior registry подключает специализированные сценарии только там, где они действительно нужны для платформенных пресетов.

### Resource Surfaces

Рабочее пространство Resources больше не хардкодит названия вкладок метаданных. Типы сущностей описывают resource surfaces через `ui.resourceSurfaces`, где стабильный ключ и route segment связываются с одной совместимой capability:

- `dataSchema` для атрибутов
- `fixedValues` для констант
- `optionValues` для значений

Страница shared Resources отображает только те capabilities, которые реально где-то включены в метахабе, но название, стабильный ключ и route segment теперь берутся из контракта типа сущности, а не из page-level string mapping.

### Шаблоны и пресеты

Встроенные шаблоны определяют, какие optional presets будут созданы при создании метахаба:

- `basic`: минимальное authoring-ready рабочее пространство
- `basic-demo`: демонстрационный стартовый шаблон с seed-контентом
- `empty`: без optional presets; пользователь начинает с рабочего пространства Entities и создаёт типы вручную

Каждый пресет может создавать:

- одно определение типа сущности
- необязательные default instances
- shared metadata defaults
- layouts и widgets

## Runtime и поведенческий слой

Behavior registry по-прежнему важен, но это уже слой специализации, а не модель владения. Runtime- и design-time-маршруты сначала разрешают тип сущности, а затем делегируют специализированным обработчикам только те kind-ы, которым действительно нужно preset-specific поведение. Generic custom types остаются внутри общего entity CRUD и publication pipeline.

## Форма маршрутов

Ключевые design-time маршруты:

- `/metahub/{metahubId}/entity-types`
- `/metahub/{metahubId}/entity-type/{entityTypeId}`
- `/metahub/{metahubId}/entities`
- `/metahub/{metahubId}/entity/{entityId}`
- `/metahub/{metahubId}/shared-containers`
- `/metahub/{metahubId}/shared-entity-overrides`

Рабочее пространство Resources использует shared containers для layouts, attributes, constants, values и shared scripts. Страницы экземпляров сущностей используют ту же capability-модель, но работают уже с одним конкретным объектом.

## Правила безопасности

- Ключи типов сущностей и codename-ы остаются уникальными в пределах одной схемы метахаба.
- Resource surfaces должны иметь уникальные ключи и уникальные совместимые capabilities.
- Resource surface отклоняется, если соответствующий компонент выключен.
- Delete-потоки fail closed, если ещё существуют зависимые экземпляры.
- Shared authoring хранит sparse override rows вместо разрушительного дублирования shared metadata.

## Что читать дальше

- [Архитектура фронтенда](frontend.md)
- [Архитектура бэкенда](backend.md)
- [Руководство по Custom Entity Types](../guides/custom-entity-types.md)
- [Схема метахаба](metahub-schema.md)
