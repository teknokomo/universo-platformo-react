---
description: REST reference for the sparse shared-entity override endpoints.
---

# Shared Entity Overrides

The shared-entity override endpoints manage sparse per-target state for shared attributes, constants, and enumeration values.
They require metahub management permission and do not clone the shared source row.

![Shared attributes](../.gitbook/assets/entities/shared-attributes.png)

## List Endpoints

- `GET /metahub/{metahubId}/shared-entity-overrides?entityKind=attribute&sharedEntityId={id}` lists all target overrides for one shared row.
- `GET /metahub/{metahubId}/shared-entity-overrides?entityKind=attribute&targetObjectId={id}` lists all shared overrides affecting one target object.
- Exactly one of `sharedEntityId` or `targetObjectId` must be present.
- `entityKind` accepts `attribute`, `constant`, or `value`.

## Upsert Endpoint

- `PATCH /metahub/{metahubId}/shared-entity-overrides`
- Body fields: `entityKind`, `sharedEntityId`, `targetObjectId`, and at least one of `isExcluded`, `isActive`, or `sortOrder`.
- The backend rejects exclusion, deactivation, or reordering when the shared row locks that behavior.
- Returning to the default state removes the sparse override row.

## Clear Endpoint

- `DELETE /metahub/{metahubId}/shared-entity-overrides?entityKind=attribute&sharedEntityId={id}&targetObjectId={targetId}`
- Use this when the target should go back to inherited default behavior.
- The endpoint returns `204 No Content` on success.
- Deleting the override never deletes the shared source row.

## Related Reading

- [REST API](rest-api.md)
- [Shared Behavior Settings](../platform/metahubs/shared-behavior-settings.md)
- [Exclusions](../platform/metahubs/exclusions.md)
