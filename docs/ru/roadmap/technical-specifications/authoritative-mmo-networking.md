# Сетевая модель авторитетного MMO-сервера — [Статус: Планируется]

## Назначение

Описывает принципы сервер-авторитетной сетевой модели для MMO: интенты клиентов, серверные тики, предикция/реконсилиация, лаг-компенсация, снапшоты и дельты состояния, интерес-менеджмент, античит и QoS.

## Архитектура (высокоуровнево)

-   Клиент (PlayCanvas): локальная предикция ввода, буферизация инпутов, интерполяция чужих сущностей
-   Сервер (`multiplayer-srv`): авторитетный тик-цикл, валидация интентов, расчёт урона/коллизий, рассылка снапшотов
-   Долговременное состояние: Supabase (PostgreSQL); кэш/мастеринг комнат: Redis
-   Доменные сервисы: `entities-srv`, `ships-srv`, `combat-srv`, `economy-srv`, … вызываются из серверной логики

## Временные параметры

-   Тикрейт сервера: 20–60 Гц (по умолчанию 30 Гц)
-   Частота снапшотов: 10–20 Гц; дельты между снапшотами
-   Окно лаг-компенсации: 100–250 мс (конфигурируемо)
-   Интерполяционный буфер клиента: 100–200 мс

## Форматы сообщений (черновик)

Intent (client → server):

```
{
  type: "intent",           // move|fire|use_module|interact
  seq: number,               // монотонный счётчик инпутов
  tClient: number,           // клиентское время (ms)
  payload: {
    move?: { thrust: vec3, yaw: number, pitch: number, roll: number },
    fire?: { weaponId: string, targetId?: string },
    use_module?: { moduleId: string, params?: any },
    interact?: { action: string, targetId?: string }
  }
}
```

Ack (server → client):

```
{
  type: "ack",
  seq: number,
  tServer: number,
  stateHash?: string
}
```

Snapshot (server → client):

```
{
  type: "snapshot",
  tServer: number,
  full: boolean,
  entities: [
    { id, pos: vec3, rot: quat, vel?: vec3, flags?: number }
  ]
}
```

Delta (server → client):

```
{
  type: "delta",
  tServer: number,
  changes: [ { id, fields: { pos?, rot?, vel?, flags? } } ]
}
```

Event (server → client):

```
{ type: "event", topic: "combat.hit", tServer, payload: { attackerId, targetId, amount, damageType, critical? } }
```

## Интерес-менеджмент

-   Пространственный индекс (grid/октодерево) для подписок на ближайшие сущности
-   Порог видимости: радиус/угол/вантабл-списки; лимиты сущностей в снапшоте
-   Пересчёт подписок раз в N тиков; «мягкое» добавление/удаление для стабильности

## Лаг-компенсация и реконсилиация

-   Сервер хранит историю состояний в окне Т (позиции/ориентации ключевых целей)
-   При обработке `fire`/hit-scan — rewind к tClient, расчёт попадания по прошлому состоянию
-   Клиент хранит буфер intents > последнего ack и переигрывает предсказания после снапшота

## Античит

-   Серверные лимиты: скорость/ускорение/повороты, масса/энергия/кулдауны
-   Только сервер считает урон/коллизии/эффекты модулей
-   Rate limit и верификация JWT при присоединении
-   Аудит событий и эвристики аномалий (телепорты, спам интентов)

## Масштабирование

-   Горизонтальное масштабирование комнат через Redis presence/pubsub
-   Шардинг по мирам/инстансам; миграция сущностей при переходах
-   Состояние комнат — в памяти; периодические снапшоты в БД

## Метрики и QoS

-   Тик-длительность, latency (RTT), размер/частота дельт, пропуски сообщений
-   Процент исправленных предсказаний (reconciliation), рассинхронизация состояния
-   Экономические инварианты и безопасность (см. отдельную спецификацию)

## Источники и смежные материалы

-   Обсуждение предикции/rewind (Godot): [NetworkSynchronizer discussion #116](https://github.com/GameNetworking/NetworkSynchronizer/discussions/116)
-   PlayCanvas + Colyseus (реал-тайм): [официальный туториал](https://developer.playcanvas.com/tutorials/real-time-multiplayer-colyseus/)
