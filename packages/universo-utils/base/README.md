# @universo-platformo/utils

> 🛠️ Utilities shared across frontend and backend for validation, serialization, ECS deltas, time synchronization, and network utilities in Universo Platformo

## Package Information

| Field | Value |
|-------|-------|
| **Package Name** | `@universo-platformo/utils` |
| **Version** | See `package.json` |
| **Type** | TypeScript-first (Utilities) |
| **Build** | ES module with types |
| **Purpose** | Shared utilities for validation, serialization, and network operations |

## 🚀 Key Features

- 📋 **Zod Schemas** - For networking DTOs (Intent/Ack/Snapshot/Delta/Event)
- 📝 **UPDL Schemas** - Passthrough schema handling
- 🔄 **Deterministic Serialization** - Safe JSON parsing
- 🔨 **Lightweight Hashing** - Fast hashing algorithms
- ⚡ **ECS Delta Operations** - Compute and apply deltas
- ⏰ **Time Synchronization** - NTP-like estimator
- 🌐 **Network Utilities** - seq/ack helpers, port utilities

## Description

Utilities shared across frontend and backend for validation, serialization, ECS deltas, time synchronization, and network utilities in Universo Platformo.

### Scope:
- Zod schemas for networking DTOs (Intent/Ack/Snapshot/Delta/Event)
- UPDL schemas (passthrough)
- Deterministic serialization and safe JSON parsing
- Lightweight hashing
- ECS delta compute/apply
- Time sync estimator (NTP-like)
- seq/ack helpers
- Network port utilities

### Out of scope:
- Node-only or browser-only utilities
- Framework-specific helpers
- Crypto-grade hashing/encryption
- Heavy IO operations

## Compatibility Rules

- **Keep public APIs backward compatible**; extend with new functions/options instead of breaking changes
- **Add new fields as optional/defaulted** to preserve schema compatibility
- **Import from the package root only** (no deep imports)

## Install (workspace)

This package lives at `packages/universo-utils/base` and is consumed via `workspace:*` by other packages in the monorepo.

License: Omsk Open License

## Production Deployment

For production deployment with Redis-based rate limiting, refer to [DEPLOYMENT.md](./DEPLOYMENT.md) for:

-   Redis configuration and connection setup
-   Docker, Kubernetes, and PM2 deployment examples
-   Health checks and monitoring
-   Troubleshooting common issues
-   Security best practices (TLS, authentication, network isolation)

Quick start: Set `REDIS_URL` environment variable to enable distributed rate limiting:

```bash
# Local Redis (development)
REDIS_URL=redis://localhost:6379

# Production with authentication
REDIS_URL=redis://:password@redis.example.com:6379

# TLS-enabled (recommended)
REDIS_URL=rediss://:password@redis.example.com:6380
```

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

## Contributing

When contributing to this package:

1. Follow TypeScript best practices
2. Add tests for all utility functions
3. Document functions with JSDoc comments
4. Update both EN and RU documentation
5. Follow the project's coding standards
6. Ensure utilities are pure functions when possible

## Related Documentation

- [Main Apps Documentation](../README.md)
- [Universo Types](../universo-types/base/README.md)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

_Universo Platformo | Utils Package_
