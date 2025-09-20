# @universo-platformo/utils

Utilities shared across frontend and backend for validation, serialization, ECS deltas, time synchronization, and network utilities in Universo Platformo.

-   Scope: Zod schemas for networking DTOs (Intent/Ack/Snapshot/Delta/Event), UPDL schemas (passthrough), deterministic serialization and safe JSON parsing, lightweight hashing, ECS delta compute/apply, time sync estimator (NTP-like), seq/ack helpers, network port utilities.
-   Out of scope: Node-only or browser-only utilities, framework-specific helpers, crypto-grade hashing/encryption, heavy IO operations.

Compatibility rules:

-   Keep public APIs backward compatible; extend with new functions/options instead of breaking changes.
-   Add new fields as optional/defaulted to preserve schema compatibility.
-   Import from the package root only (no deep imports).

Install (workspace):

-   This package lives at `apps/universo-platformo-utils/base` and is consumed via `workspace:*` by other packages in the monorepo.

License: Omsk Open License

## Testing

Run Vitest against the workspace package to exercise UPDL serialization helpers:

```bash
pnpm --filter @universo-platformo/utils test
```

## API Reference

### Network Utilities (`net`)

**`ensurePortAvailable(port: number, host?: string): Promise<void>`**

Checks if a port is available by attempting to bind to it. Throws an error if the port is already in use.

```typescript
import { net } from '@universo-platformo/utils'

// Check if port 3000 is available
await net.ensurePortAvailable(3000)

// Check with specific host
await net.ensurePortAvailable(8080, 'localhost')
```

### Time Synchronization (`net`)

**`createTimeSyncEstimator()`**

Creates an NTP-like time synchronization estimator for client-server time coordination.

### Sequencing (`net`)

**`updateSeqState()` and `reconcileAck()`**

Helpers for managing sequence numbers and acknowledgments in networked applications.
