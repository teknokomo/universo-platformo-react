---
description: Архитектура Entity-Component-Action-Event для пользовательских типов сущностей в metahub.
---

# Entity Component System

Слой Entity-Component-Action-Event (ECAE) добавляет пользовательские и standard типы сущностей metahub через одну entity-owned route model, опирающуюся на shared authoring surfaces.

## Purpose

- Удерживать новое доменное моделирование внутри одного универсального пайплайна сущностей.
- Переиспользовать существующие сервисы authoring metahub и поток runtime publication.
- Публиковать entity-based разделы, такие как Hubs, Catalogs, Sets и Enumerations, через metadata, а не через хардкод меню.

## Core Model

1. Определения типов сущностей описывают kind key, presentation, component manifest и UI metadata.
2. Components включают возможности вроде data schema, hierarchy, relations, actions, events, layout и scripting.
3. Actions остаются object-owned строками в `_mhb_actions` и представляют исполняемое lifecycle behavior.
4. Event bindings остаются object-owned строками в `_mhb_event_bindings` и связывают события с actions.

## Resource Surfaces

- Вкладки раздела `Ресурсы` задаются persisted metadata `ui.resourceSurfaces` в строках типов сущностей.
- Видимое название вкладки берётся из `ui.resourceSurfaces[].title` в VLC-формате.
- `titleKey` остаётся только fallback-ом совместимости; новые standard presets хранят локализованные названия прямо в metadata сущности.
- Сервисы больше не синтезируют standard definitions из кода, если в `_mhb_entity_type_definitions` нет строки. Отсутствующая metadata должна fail closed.
- Publication snapshots сохраняют `entityTypeDefinitions`, а canonical publication hash учитывает эту metadata.
- Application executable schema по-прежнему строится из structural `snapshot.entities`, поэтому изменение только названия resource surface не создаёт DDL changes.

## Current Boundaries

- Generic entity instance routes по-прежнему сфокусированы на настоящих custom kinds.
- Standard metadata kinds входят через entity-owned routes и переиспользуют соответствующие authoring surfaces underneath.
- Shared services и adapters позволяют custom kinds переиспользовать существующие seams для attributes, layouts и publication.
- Runtime consumers разрешают section-oriented aliases из published entity metadata до отката к более старым naming aliases.

## Builder Flow

1. Создайте тип из workspace Entities или из reusable preset.
2. Включайте только те components, которые уже genericized или adapter-backed.
3. Сохраните тип и редактируйте экземпляры из сгенерированной entity-owned поверхности.
4. Отметьте тип как published, когда он должен появиться в dynamic menu zone.
5. Опубликуйте metahub и выполните sync связанного application перед проверкой runtime.

## Route Ownership Rules

- Standard Hubs, Catalogs, Sets и Enumerations публикуются через прямые standard kind keys.
- Entity-owned routes переиспользуют соответствующие authoring primitives вместо введения второго CRUD shell.
- Browser validation должна покрывать design-time workspace flows, entity-owned standard routes и publication/runtime path.
- Runtime navigation материализует разделы, описанные published entity metadata и текущими runtime adapters.

## Related Packages

- `@universo/metahubs-backend` владеет entity definitions, actions, event bindings и publication metadata.
- `@universo/metahubs-frontend` владеет workspace Entities и authoring экземпляров custom entity.
- `@universo/applications-backend` и `@universo/applications-frontend` потребляют published sections в runtime.
