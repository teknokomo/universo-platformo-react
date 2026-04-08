---
description: Справочник REST API для sparse endpoint-ов override-ов общих сущностей.
---

# Shared Entity Overrides

Endpoint-ы shared-entity overrides управляют sparse per-target state для общих атрибутов, констант и значений перечислений.
Они требуют permission на управление metahub и не клонируют shared source row.

## Endpoint-ы чтения

- `GET /metahub/{metahubId}/shared-entity-overrides?entityKind=attribute&sharedEntityId={id}` перечисляет все target overrides для одной shared row.
- `GET /metahub/{metahubId}/shared-entity-overrides?entityKind=attribute&targetObjectId={id}` перечисляет все shared overrides, влияющие на один target object.
- Должен присутствовать ровно один из параметров: `sharedEntityId` или `targetObjectId`.
- `entityKind` принимает значения `attribute`, `constant` или `value`.

## Endpoint upsert

- `PATCH /metahub/{metahubId}/shared-entity-overrides`
- Поля body: `entityKind`, `sharedEntityId`, `targetObjectId` и как минимум одно из `isExcluded`, `isActive` или `sortOrder`.
- Backend отклоняет exclusion, деактивацию или reorder, когда shared row блокирует такое поведение.
- Возврат к состоянию по умолчанию удаляет sparse override row.

## Endpoint очистки

- `DELETE /metahub/{metahubId}/shared-entity-overrides?entityKind=attribute&sharedEntityId={id}&targetObjectId={targetId}`
- Используйте его, когда target должен вернуться к inherited default behavior.
- Endpoint возвращает `204 No Content` при успешном выполнении.
- Удаление override никогда не удаляет shared source row.

## Что читать дальше

- [REST API](rest-api.md)
- [Shared Behavior Settings](../platform/metahubs/shared-behavior-settings.md)
- [Exclusions](../platform/metahubs/exclusions.md)