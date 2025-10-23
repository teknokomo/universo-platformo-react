# Workflow Engine — [Статус: Планируется]

## Назначение

Исполнение чатфлоу/геймфлоу, интеграция с UPDL событиями.

## Интерфейсы

-   REST API: `/flows/*`
-   События: `flow.started`, `flow.completed`

## Структура (ожидаемая)

```txt
packages/workflow-engine-srv/base/
  src/{api,domain,infra}/...
```
