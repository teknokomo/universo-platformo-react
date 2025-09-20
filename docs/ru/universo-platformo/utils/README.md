# @universo-platformo/utils

Утилиты, используемые на фронтенде и бэкенде для валидации, сериализации, дельт, синхронизации времени и сетевых утилит в Universo Platformo. Пакет не зависит от конкретного рантайма (browser/Node), поддерживает tree‑shaking и использует безопасные значения по умолчанию.

## Обзор

-   Zod‑схемы для ECS/сетевых DTO (Intent, Ack, Snapshot, Delta, Event)
-   Вычисление и применение минимальных дельт компонент для ECS снапшотов
-   Детерминированная сериализация и безопасный парсинг JSON
-   Оценка синхронизации времени (по аналогии с NTP) и простые seq/ack хелперы
-   Утилиты для проверки доступности сетевых портов в серверных приложениях
-   Zod‑схемы UPDL (passthrough) для совместимой валидации на фронте и бэке

## Установка (workspace)

-   Пакет является частью монорепозитория и доступен через workspace:
-   Добавьте зависимость при необходимости: "@universo-platformo/utils": "workspace:\*"

## Экспорты

```ts
import { validation, delta, net, serialization, math, updl } from '@universo-platformo/utils'
```

-   validation.schemas: Zod‑схемы для DTO (strict)
-   delta: computeDelta, applyDelta
-   net: createTimeSyncEstimator, updateSeqState, reconcileAck, ensurePortAvailable
-   serialization: stableStringify, safeParseJson, hashFNV1a32
-   math: clamp, lerp, approxEq
-   updl.schemas: Zod‑схемы для UPDL (passthrough)

## Примеры использования

### Безопасный парсинг JSON

```ts
import { serialization } from '@universo-platformo/utils'
const r = serialization.safeParseJson<any>(raw)
if (!r.ok) throw new Error(r.error.message)
const value = r.value
```

### Детерминированная сериализация и хеширование

```ts
import { serialization } from '@universo-platformo/utils'
const s = serialization.stableStringify(obj)
const sig = serialization.hashFNV1a32(s)
```

### Дельты ECS

```ts
import { delta } from '@universo-platformo/utils'
const d = delta.computeDelta(prev.entities, next.entities, prev.tick, next.tick)
const merged = delta.applyDelta(prev, d)
```

### Синхронизация времени и сетевые утилиты

```ts
import { net } from '@universo-platformo/utils'

// Синхронизация времени
const est = net.createTimeSyncEstimator()
est.addSample({ tClientSendMs, tServerRecvMs, tServerSendMs, tClientRecvMs })
const { offsetMs, rttMs, jitterMs } = est.getState()

// Проверка доступности порта (только Node.js)
await net.ensurePortAvailable(3000)
await net.ensurePortAvailable(8080, 'localhost')
```

### Валидация UPDL (frontend/backend)

```ts
import { updl } from '@universo-platformo/utils'
const ok = updl.schemas.entity.safeParse(entity).success
```

## Рекомендации

-   Импортируйте только из корня пакета (без глубоких импортов)
-   Для сетевых DTO используйте строгие схемы; для UPDL оставляйте passthrough для совместимости
-   Для ключей кэша/сигнатур используйте stableStringify
-   В дельтах используйте approxEq для числовых кортежей, чтобы избежать шумов с плавающей точкой
