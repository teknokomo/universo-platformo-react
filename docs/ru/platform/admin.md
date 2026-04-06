---
description: Объясняет admin scope, его settings category и то, как глобальные dialog settings соотносятся с metahub и application scope.
---

# Администрирование

Admin surface — это глобальный governance layer платформы.
Именно здесь операторы управляют platform-wide role-ями, user-ами, locale-ями, instance-ами и settings, которые не должны жить внутри одного metahub или одного application.

## What Admin Controls

- global role-и и permission-ы;
- global user-ов и locale configuration;
- instance-level management surface-ы;
- platform policy, которые потребляются metahub-ами и application-ами;
- admin-only dialog presentation default-ы для `/admin` area.

## Settings Categories

Admin settings area организована по category, чтобы глобальные policy не смешивались со scoped product settings.

| Category | Purpose |
| --- | --- |
| General | Dialog presentation settings для admin-area. |
| Metahubs | Глобальные policy, которые влияют на поведение metahub-ов. |
| Applications | Глобальные policy, которые влияют на поведение application-ов. |

## General Dialog Settings

Вкладка General — это admin-эквивалент metahub и application dialog settings surface.
Она хранит те же четыре dialog-presentation control для route scope `/admin`.

| Setting | Meaning |
| --- | --- |
| Dialog size preset | Базовая ширина admin dialog-ов. |
| Allow fullscreen | Показывают ли admin dialog-и fullscreen control-ы. |
| Allow resize | Показывают ли admin dialog-и resize handle. |
| Close behavior | Остаются ли admin dialog-и strict-modal или разрешают outside-click close. |

## Scope Precedence

Три scope dialog settings намеренно независимы друг от друга.

| Route scope | Source of truth |
| --- | --- |
| `/admin` | Admin General dialog settings. |
| `/metahub/:metahubId/...` | Metahub common dialog settings. |
| `/a/:applicationId/admin` | Application dialog settings. |

Это означает, что изменение admin default-ов не переписывает молча metahub authoring dialog-и или dialog-и application control panel.

## Why Global Policy Still Matters

Некоторое поведение должно оставаться platform-governed даже тогда, когда существуют локальные scope.
Например, platform system-attribute governance разрешается из admin settings и затем применяется backend policy helper-ами на стороне metahub.
Именно поэтому admin page документируют platform policy, а metahub page документируют authoring behavior.

## Recommended Use

- Используйте admin General settings, чтобы стандартизовать работу platform operator-ов внутри `/admin`.
- Используйте metahub settings, когда design team нужен другой authoring dialog behavior для конкретного metahub.
- Используйте application settings, когда конкретная application control panel должна вести себя иначе, чем остальная платформа.

Для scoped authoring и runtime flow продолжайте с [Метахабы](metahubs.md) и [Приложения](applications.md).