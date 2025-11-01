# @universo-platformo/types

> 🔧 Core protocol and ECS domain types for Universo Platformo

## Package Information

| Field | Value |
|-------|-------|
| **Package Name** | `@universo-platformo/types` |
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

## Description

Base protocol types and ECS domain types for Universo Platformo.

### Scope:
- ECS components
- Networking DTO (Intent/Ack/Snapshot/Delta/Event)
- Error codes
- Protocol version

### Out of scope:
- UPDL design-time types
- Publication types (kept in their respective packages)

## Compatibility Rules

- **Do not rename** existing fields or change their semantics
- **Only add new fields** as optional to preserve backward compatibility
- **Extend** component and event unions by adding new keys

## Install (workspace)

This package lives at `packages/universo-types/base` and is consumed via `workspace:*` by other packages in the monorepo.

## Testing

Run the type-level regression tests with Vitest:

```bash
pnpm --filter @universo-platformo/types test
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

- [Main Apps Documentation](../README.md)
- [Flowise Server](../flowise-server/base/README.md)
- [UPDL](../updl/base/README.md)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## License

Omsk Open License

---

_Universo Platformo | Types Package_
