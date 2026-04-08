---
description: Справочник REST API для design-time metahub scripts и доставки runtime scripts в applications.
---

# API скриптов

Scripts API охватывает routes design-time authoring в metahub и routes доставки runtime в application.
Он удерживает Common libraries, consumer scripts, client bundles и server calls в рамках одного fail-closed контракта.

## Endpoint-ы design-time metahub

- `GET /metahub/{metahubId}/scripts` перечисляет design-time scripts для одного scope привязки.
- `POST /metahub/{metahubId}/scripts` создаёт design-time script.
- `GET /metahub/{metahubId}/script/{scriptId}`, `PATCH /metahub/{metahubId}/script/{scriptId}` и `DELETE /metahub/{metahubId}/script/{scriptId}` читают, обновляют или удаляют один script.
- Authoring в Common должно всегда сочетать `attachedToKind=general` с `moduleRole=library`.

## Endpoint-ы runtime application

- `GET /applications/{applicationId}/runtime/scripts` перечисляет metadata опубликованных runtime scripts без inline bundles.
- `GET /applications/{applicationId}/runtime/scripts/{scriptId}/client` возвращает cacheable client JavaScript bundle.
- `POST /applications/{applicationId}/runtime/scripts/{scriptId}/call` выполняет только разрешённые non-lifecycle server methods.
- Runtime routes раскрывают consumer scripts, а не прямые строки Common library.

## Примечания fail-closed

- Неподдерживаемые imports, версии SDK или сочетания scope-role отклоняются до runtime delivery.
- Ошибки delete, rename и circular dependency shared-library блокируют publication и последующий runtime sync.
- Public runtime RPC требует `rpc.client` и не может вызывать lifecycle handlers.
- Application sync падает, а не молча пропускает persistence runtime scripts.

## Что читать дальше

- [REST API](rest-api.md)
- [Shared Scripts](../platform/metahubs/shared-scripts.md)
- [Script Scopes](../platform/metahubs/script-scopes.md)