---
description: Explain the admin scope, its settings categories, and how global dialog settings relate to metahub and application scopes.
---

# Admin

The admin surface is the global governance layer for the platform.
It is where operators manage platform-wide roles, users, locales, instances, and settings that should not live inside one metahub or one application.

## What Admin Controls

- global roles and permissions;
- global users and locale configuration;
- instance-level management surfaces;
- platform policies consumed by metahubs and applications;
- admin-only dialog presentation defaults for the `/admin` area.

## Settings Categories

The admin settings area is organized by category so global policies stay separate from scoped product settings.

| Category | Purpose |
| --- | --- |
| General | Admin-area dialog presentation settings. |
| Metahubs | Global policies that influence metahub behavior. |
| Applications | Global policies that influence application behavior. |

## General Dialog Settings

The General tab is the admin equivalent of the metahub and application dialog settings surfaces.
It stores the same four dialog-presentation controls for the `/admin` route scope.

| Setting | Meaning |
| --- | --- |
| Dialog size preset | Default width of admin dialogs. |
| Allow fullscreen | Whether admin dialogs expose fullscreen controls. |
| Allow resize | Whether admin dialogs expose the resize handle. |
| Close behavior | Whether admin dialogs stay strict-modal or allow outside-click close. |

## Scope Precedence

The three dialog settings scopes are intentionally independent.

| Route scope | Source of truth |
| --- | --- |
| `/admin` | Admin General dialog settings. |
| `/metahub/:metahubId/...` | Metahub common dialog settings. |
| `/a/:applicationId/admin` | Application dialog settings. |

This means changing admin defaults does not silently rewrite metahub authoring dialogs or application control-panel dialogs.

## Why Global Policy Still Matters

Some behavior must remain platform-governed even when local scopes exist.
For example, platform system-attribute governance is resolved from admin settings and then applied by metahub backend policy helpers.
That is why admin pages document platform policy, while metahub pages document authoring behavior.

## Recommended Use

- Use admin General settings to standardize how platform operators work inside `/admin`.
- Use metahub settings when a design team needs different authoring dialog behavior for a specific metahub.
- Use application settings when a specific application control panel needs different dialog behavior from the rest of the platform.

For the scoped authoring and runtime flow, continue with [Metahubs](metahubs.md) and [Applications](applications.md).