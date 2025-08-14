# @universo-platformo/utils

Utilities shared across frontend and backend for validation, serialization, deltas and time sync in Universo Platformo. This package is runtime-agnostic (browser/Node), tree‑shaking friendly, and designed for safe defaults.

## Overview

-   Provides Zod schemas for ECS/network DTOs (Intent, Ack, Snapshot, Delta, Event)
-   Computes and applies minimal component deltas for ECS snapshots
-   Deterministic serialization and safe JSON parsing
-   Time synchronization estimator (NTP‑like) and simple seq/ack helpers
-   UPDL Zod schemas (passthrough) for forward‑compatible validation on both sides

## Installation (workspace)

-   Package is part of the monorepo and available via workspace:
-   Add dependency where needed: "@universo-platformo/utils": "workspace:\*"

## Exports

```ts
import { validation, delta, net, serialization, math, updl } from '@universo-platformo/utils'
```

-   validation.schemas: Zod schemas for DTOs (strict)
-   delta: computeDelta, applyDelta
-   net: createTimeSyncEstimator, updateSeqState, reconcileAck
-   serialization: stableStringify, safeParseJson, hashFNV1a32
-   math: clamp, lerp, approxEq
-   updl.schemas: Zod schemas for UPDL (passthrough)

## Usage examples

### Safe JSON parsing

```ts
import { serialization } from '@universo-platformo/utils'
const r = serialization.safeParseJson<any>(raw)
if (!r.ok) throw new Error(r.error.message)
const value = r.value
```

### Deterministic stringify and hashing

```ts
import { serialization } from '@universo-platformo/utils'
const s = serialization.stableStringify(obj)
const sig = serialization.hashFNV1a32(s)
```

### ECS deltas

```ts
import { delta } from '@universo-platformo/utils'
const d = delta.computeDelta(prev.entities, next.entities, prev.tick, next.tick)
const merged = delta.applyDelta(prev, d)
```

### Time sync

```ts
import { net } from '@universo-platformo/utils'
const est = net.createTimeSyncEstimator()
est.addSample({ tClientSendMs, tServerRecvMs, tServerSendMs, tClientRecvMs })
const { offsetMs, rttMs, jitterMs } = est.getState()
```

### UPDL validation (frontend/backend)

```ts
import { updl } from '@universo-platformo/utils'
const ok = updl.schemas.entity.safeParse(entity).success
```

## Best practices

-   Import from the package root only (no deep imports)
-   Use strict DTO schemas on the wire; keep UPDL schemas passthrough for forward compatibility
-   Prefer stableStringify for cache keys/signatures
-   For deltas, treat number tuples with approxEq to avoid float noise
