---
description: Архитектура Entity-Component-Action-Event для пользовательских типов сущностей в metahub.
---

# Entity Component System

Слой Entity-Component-Action-Event (ECAE) добавляет пользовательские типы сущностей metahub без замены legacy-поверхностей Catalogs, Sets и Enumerations в текущей волне внедрения.

## Purpose

- Удерживать новое доменное моделирование внутри одного универсального пайплайна сущностей.
- Переиспользовать существующие сервисы authoring metahub и поток runtime publication.
- Публиковать entity-based разделы, такие как Hubs V2, Catalogs V2, Sets V2 и Enumerations V2, через metadata, а не через хардкод меню.

## Core Model

1. Определения типов сущностей описывают kind key, presentation, component manifest и UI metadata.
2. Components включают возможности вроде data schema, hierarchy, relations, actions, events, layout и scripting.
3. Actions остаются object-owned строками в `_mhb_actions` и представляют исполняемое lifecycle behavior.
4. Event bindings остаются object-owned строками в `_mhb_event_bindings` и связывают события с actions.

## Current Boundaries

- Built-in kinds по-прежнему сохраняют свои отдельные legacy routes и UI entry points.
- Generic entity instance routes сейчас нацелены только на custom kinds.
- Shared services и adapters позволяют custom kinds переиспользовать существующие seams для attributes, layouts и publication.
- Runtime consumers разрешают section-oriented aliases до отката к legacy catalog naming.

## Builder Flow

1. Создайте тип из workspace Entities или из reusable preset.
2. Включайте только те components, которые уже genericized или adapter-backed.
3. Сохраните тип и редактируйте экземпляры из сгенерированной custom-kind поверхности.
4. Отметьте тип как published, когда он должен появиться в dynamic menu zone.
5. Опубликуйте metahub и выполните sync связанного application перед проверкой runtime.

## Coexistence Rules

- Legacy Hubs, Catalogs, Sets и Enumerations остаются видимыми до принятия parity.
- Hubs V2, Catalogs V2, Sets V2 и Enumerations V2 переиспользуют соответствующие legacy authoring primitives вместо второго policy layer.
- Browser validation должна покрывать design-time workspace flows, legacy/V2 coexistence и publication/runtime path.
- Только catalog-compatible sections материализуются в runtime navigation; hub/set/enumeration-compatible kinds остаются отфильтрованными после publication sync.

## Related Packages

- `@universo/metahubs-backend` владеет entity definitions, actions, event bindings и publication metadata.
- `@universo/metahubs-frontend` владеет workspace Entities и authoring экземпляров custom entity.
- `@universo/applications-backend` и `@universo/applications-frontend` потребляют published sections в runtime.