# Node Registry — [Статус: Планируется]

## Назначение

Реестр определений узлов UPDL, версионирование, схемы параметров.

## Интерфейсы

-   REST API: `/nodes/*`
-   События: `node.updated`

## Структура (ожидаемая)

```txt
packages/node-registry-srv/base/
  src/{api,domain,infra}/...
```
