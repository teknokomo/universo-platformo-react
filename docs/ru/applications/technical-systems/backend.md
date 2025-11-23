# `world-coordinator-srv` — Координатор шардов и миграций — [Статус: Планируется]

Назначение: сервис размещения и маршрутизации миров/инстансов по шардам/нодам, а также выдачи `transferToken` для миграции между комнатами (ворота/зоны).

Роль в дорожной карте: Этап 9 (масштабирование и шардирование).

Функциональность (MVP):

-   Реестр активных шардов/комнат (`roomId → host/node`) через Redis/DB.
-   Алгоритм назначения (placement) по `worldId:instanceId[:region]` и метрикам загрузки.
-   API/события: `prepareTransfer(roomA→roomB)` → короткоживущий JWT `transferToken`.

Интеграции: `multiplayer-srv` (кластер, presence/pubsub), LB/Ingress (sticky WS), `auth-srv` (подпись токенов), `entities-srv` (сериализация минимального состояния).

См. также: `roadmap/technical-specifications/authoritative-mmo-networking.md`, `roadmap/implementation-plan/tasks-registry.md#этап-9-масштабирование-и-шардирование`.
