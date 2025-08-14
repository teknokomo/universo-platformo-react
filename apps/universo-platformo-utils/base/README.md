# @universo-platformo/utils

Utilities shared across frontend and backend for validation, serialization, ECS deltas and time synchronization in Universo Platformo.

-   Scope: Zod schemas for networking DTOs (Intent/Ack/Snapshot/Delta/Event), UPDL schemas (passthrough), deterministic serialization and safe JSON parsing, lightweight hashing, ECS delta compute/apply, time sync estimator (NTP-like), seq/ack helpers.
-   Out of scope: Node-only or browser-only utilities, framework-specific helpers, crypto-grade hashing/encryption, IO and other side effects.

Compatibility rules:

-   Keep public APIs backward compatible; extend with new functions/options instead of breaking changes.
-   Add new fields as optional/defaulted to preserve schema compatibility.
-   Import from the package root only (no deep imports).

Install (workspace):

-   This package lives at `apps/universo-platformo-utils/base` and is consumed via `workspace:*` by other packages in the monorepo.

License: Omsk Open License
