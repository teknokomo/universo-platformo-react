---
description: Base REST API conventions for Universo Platformo React.
---

# REST API

## Base URL

```text
https://your-instance.example.com/api/v1
```

## Current API Shape

The current repository organizes API routes by platform module and entity-owned
metahub surfaces.

Typical route groups include system health, auth, locales, profile, onboarding,
applications, connectors, admin, public metahub, and metahub design-time APIs.

## Generic Entity Authoring Endpoints

-   `GET /metahub/{metahubId}/entity-types` and `POST /metahub/{metahubId}/entity-types` list and create entity type definitions for the Entities workspace and admin-managed entity-type registry.
-   `GET /metahub/{metahubId}/entity-type/{entityTypeId}`, `PATCH /metahub/{metahubId}/entity-type/{entityTypeId}`, and `DELETE /metahub/{metahubId}/entity-type/{entityTypeId}` manage one entity type, including its publication flag.
-   `GET /metahub/{metahubId}/entities`, `POST /metahub/{metahubId}/entities`, and `POST /metahub/{metahubId}/entities/reorder` list, create, and reorder design-time instances for one custom kind.
-   `GET /metahub/{metahubId}/entity/{entityId}`, `PATCH /metahub/{metahubId}/entity/{entityId}`, `DELETE /metahub/{metahubId}/entity/{entityId}`, `POST /metahub/{metahubId}/entity/{entityId}/restore`, `DELETE /metahub/{metahubId}/entity/{entityId}/permanent`, and `POST /metahub/{metahubId}/entity/{entityId}/copy` manage one custom entity instance through the generic route surface.

## Entity Automation Endpoints

-   `GET /metahub/{metahubId}/object/{objectId}/actions` and `POST /metahub/{metahubId}/object/{objectId}/actions` list and create object-owned entity actions.
-   `GET /metahub/{metahubId}/action/{actionId}`, `PATCH /metahub/{metahubId}/action/{actionId}`, and `DELETE /metahub/{metahubId}/action/{actionId}` read, update, and remove one action.
-   `GET /metahub/{metahubId}/object/{objectId}/event-bindings` and `POST /metahub/{metahubId}/object/{objectId}/event-bindings` list and create event bindings for one object.
-   `GET /metahub/{metahubId}/event-binding/{bindingId}`, `PATCH /metahub/{metahubId}/event-binding/{bindingId}`, and `DELETE /metahub/{metahubId}/event-binding/{bindingId}` read, update, and remove one binding.

## Interactive Documentation Source

The interactive Swagger and OpenAPI presentation layer is provided by
`@universo/rest-docs`.

That package regenerates its `src/openapi/index.yml` file from the live backend
route files before validation and build so the published route inventory stays
aligned with the repository after refactors.

For the run-and-use workflow, continue to the Interactive OpenAPI Docs page in
this section.

## Metahub Shared Authoring Endpoints

-   `GET /metahub/{metahubId}/shared-containers` resolves the virtual Resources containers used for shared components, constants, and values.
-   `GET /metahub/{metahubId}/shared-entity-overrides` lists sparse exclusion or ordering overrides for one shared entity or one target object.
-   `PATCH /metahub/{metahubId}/shared-entity-overrides` upserts fail-closed exclusion, active-state, or sort-order overrides for shared entities.
-   `GET /metahub/{metahubId}/modules` plus `POST /metahub/{metahubId}/modules` list and create design-time modules; Common authoring must pair `attachedToKind=general` with `moduleRole=library`.
-   `GET /metahub/{metahubId}/module/{moduleId}`, `PATCH /metahub/{metahubId}/module/{moduleId}`, and `DELETE /metahub/{metahubId}/module/{moduleId}` fail closed when a shared-library rename, delete, or circular dependency would break `@shared/<codename>` consumers.
-   `GET /metahub/{metahubId}/export` and `POST /metahubs/import` preserve the shared snapshot sections together with layouts, modules, and publication-ready metadata.

## Runtime Module Endpoints

-   `GET /applications/{applicationId}/runtime/modules` lists published client-visible runtime modules without embedding bundle bodies.
-   `GET /applications/{applicationId}/runtime/modules/{moduleId}/client` returns the JavaScript client bundle with `ETag` and `304 Not Modified` support.
-   `POST /applications/{applicationId}/runtime/modules/{moduleId}/call` executes only non-lifecycle published server methods from modules that declare `rpc.client`, and preserves fail-closed capability/error codes.

Use these endpoints together when a runtime surface needs module metadata, bundle delivery, and RPC execution.
