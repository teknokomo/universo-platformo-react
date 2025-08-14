# @universo-platformo/types

Core protocol and ECS domain types for Universo Platformo.

-   Scope: ECS components, networking DTO (Intent/Ack/Snapshot/Delta/Event), error codes, protocol version.
-   Out of scope: UPDL design-time types and publication types (kept in their respective packages).

Compatibility rules:

-   Do not rename existing fields or change their semantics.
-   Only add new fields as optional to preserve backward compatibility.
-   Extend component and event unions by adding new keys.

Install (workspace):

-   This package lives at `apps/universo-platformo-types/base` and is consumed via `workspace:*` by other packages in the monorepo.

License: Omsk Open License
