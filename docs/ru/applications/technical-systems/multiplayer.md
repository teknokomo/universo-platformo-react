# Multiplayer — [Статус: Планируется]

## Назначение

Авторитетный сервер реального времени для PlayCanvas-клиента: обработка интентов, расчёт состояния мира, рассылка снапшотов/дельт, античит.

## Технологический стек

-   Сервер: Node.js + TypeScript + Colyseus (комнаты/состояние)
-   Хранилище: Supabase (PostgreSQL) — долговременные данные; Redis — presence/pubsub/скейлинг
-   Клиент: PlayCanvas + colyseus.js (SDK), локальная предикция и реконсилиация

## Клиент (PlayCanvas)

-   Буферизация инпутов с seq и clientTime
-   Предикция локального движения; интерполяция чужих сущностей
-   Реконсилиация по ack и снапшотам сервера
-   Тайм-синхронизация (оценка offset/RTT)

## Сервер (Colyseus Rooms)

-   Фиксированный тик (30 Гц по умолчанию), батчинг интентов
-   Интерес-менеджмент (grid/октодерево), рассылка снапшотов 10–20 Гц
-   Валидация интентов (скорость/ускорение/масса/энергия/кулдауны)
-   Серверный расчёт боёвки/коллизий/модулей

## Протокол сообщений (черновик)

-   Intent c seq/tClient и payload (move|fire|use_module|interact)
-   Ack c seq/tServer/stateHash
-   Snapshot/Delta с минимальным набором полей (pos/rot/vel/flags)
-   Event: combat.hit, entity.spawn/despawn, module.state

## Античит

-   JWT при join; валидация прав/ролей
-   Серверные лимиты на физику и действия
-   Rate limit, эвристики аномалий, аудит событий

## Масштабирование

-   Redis presence/pubsub, горизонтальное масштабирование по комнатам
-   Шардинг по мирам/инстансам; миграция сущностей между shard
-   Периодические снапшоты состояния в БД

## Интеграция с доменами

-   `entities-srv`: инстансы ECS и компоненты
-   `combat-srv`: формулы урона/резисты, лаг-компенсация
-   `economy-srv`: кошельки/сделки (идемпотентность)

## Ссылки

-   Предикция/rewind (контекст Godot): [NetworkSynchronizer discussion #116](https://github.com/GameNetworking/NetworkSynchronizer/discussions/116)
-   PlayCanvas + Colyseus: [официальный туториал](https://developer.playcanvas.com/tutorials/real-time-multiplayer-colyseus/)

## Структура (ожидаемая)

```txt
apps/multiplayer-srv/base/
  src/{ws,api,domain,infra}/...
```
