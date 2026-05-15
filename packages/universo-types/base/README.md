# @universo/types

> 🔧 Core protocol and ECS domain types for Universo Platformo

## Package Information

| Field | Value |
|-------|-------|
| **Package Name** | `@universo/types` |
| **Version** | See `package.json` |
| **Type** | TypeScript-first (Types & Interfaces) |
| **Build** | ES module with type definitions |
| **Purpose** | Core protocol and ECS domain types |

## 🚀 Key Features

- 🔧 **ECS Components** - Entity-Component-System type system
- 🌐 **Networking DTO** - Intent/Ack/Snapshot/Delta/Event protocols
- ❌ **Error Codes** - Standardized error code definitions
- 📦 **Protocol Versioning** - Protocol version control
- 📋 **Strict Typing** - Full TypeScript support
- 🔄 **Backward Compatibility** - Version compatibility preservation
- 🧾 **Record Behavior Types** - Shared Object numbering, lifecycle, and posting contracts
- 📊 **Ledger Types** - Shared append-only Ledger configuration, field roles, source policies, and projections
- 🎓 **LMS Platform Primitives** - Generic resource, sequence, workflow action, role policy, report definition, and acceptance-matrix contracts

## Description

Base protocol types and ECS domain types for Universo Platformo.

### Scope:
- ECS components
- Networking DTO (Intent/Ack/Snapshot/Delta/Event)
- Error codes
- Protocol version
- Metahub entity component manifests
- Object `recordBehavior` and Ledger configuration contracts
- Generic LMS-like platform primitives that remain reusable outside LMS configurations

### Out of scope:
- UPDL design-time types
- Publication types (kept in their respective packages)

## Compatibility Rules

- **Do not rename** existing fields or change their semantics
- **Only add new fields** as optional to preserve backward compatibility
- **Extend** component and event unions by adding new keys

## Object And Ledger Contracts

`common/recordBehavior` defines the shared metadata contract that turns a standard Object into a reference, transactional, or hybrid collection.
It covers identity fields, atomic numbering, effective dates, lifecycle states, posting target ledgers, and posted-row immutability.

`common/ledgers` defines the standard Ledger configuration.
The code-facing kind is `ledger`; the Russian UI label is "Регистры".
Ledgers classify ordinary field definitions through `fieldRoles` and use source policies to distinguish manual writes from registrar-owned posting writes.

## Install (workspace)

This package lives at `packages/universo-types/base` and is consumed via `workspace:*` by other packages in the monorepo.

## Testing

Run the type-level regression tests with Vitest:

```bash
pnpm --filter @universo/types test
```

## Contributing

When contributing to this package:

1. Follow TypeScript best practices and maintain strict typing
2. Document all exported types with JSDoc comments
3. Ensure type definitions match backend schemas
4. Update both EN and RU documentation
5. Follow the project's coding standards
6. Add tests for complex type guards and utilities

## Related Documentation

- [Main package index](../../README.md)
- [Core Backend](../../universo-core-backend/base/README.md)
- [Core Frontend](../../universo-core-frontend/base/README.md)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## License

Omsk Open License

---

_Universo Platformo | Types Package_
