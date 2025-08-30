# Shared Packages

Universo Platformo uses a modular architecture with shared packages that provide common functionality across multiple applications. This approach ensures consistency, reduces code duplication, and simplifies maintenance.

## Overview

The shared packages are located in the `apps/` directory and follow a standardized structure:

- **Types Package** (`@universo-platformo/types`): Shared TypeScript type definitions
- **Utils Package** (`@universo-platformo/utils`): Common utility functions and processors
- **Template Packages**: Specialized packages for different export templates

## Package Architecture

### Dual Build System

All shared packages use a dual build system that compiles TypeScript source code into multiple formats:

```
dist/
├── cjs/           # CommonJS modules (for Node.js)
├── esm/           # ES Modules (for modern bundlers)
└── types/         # TypeScript declaration files
```

This ensures maximum compatibility across different environments and bundlers.

### Workspace Integration

Packages are integrated using PNPM workspaces with the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@universo-platformo/types": "workspace:*",
    "@universo-platformo/utils": "workspace:*"
  }
}
```

## Core Packages

### Types Package

**Location**: `apps/universo-platformo-types/`
**Package Name**: `@universo-platformo/types`

Contains all shared TypeScript type definitions and interfaces used across the platform.

**Key Features**:
- UPDL interface definitions
- Platform-wide type consistency
- Zero runtime dependencies
- Comprehensive type coverage

**Usage**:
```typescript
import { IUPDLSpace, IUPDLData, IFlowData } from '@universo-platformo/types'
```

### Utils Package

**Location**: `apps/universo-platformo-utils/`
**Package Name**: `@universo-platformo/utils`

Provides shared utility functions and processors used across multiple applications.

**Key Features**:
- UPDLProcessor for flow data conversion
- Multi-scene processing support
- Mathematical utilities
- Serialization helpers

**Usage**:
```typescript
import { UPDLProcessor } from '@universo-platformo/utils'

const result = UPDLProcessor.processFlowData(flowDataString)
```

## Template Packages

Template packages provide specialized functionality for different export formats and use cases.

### Quiz Template

**Location**: `apps/template-quiz/`
**Package Name**: `@universo/template-quiz`

Specialized package for creating AR.js educational quizzes with lead collection capabilities.

### MMOOMM Template

**Location**: `apps/template-mmoomm/`
**Package Name**: `@universo/template-mmoomm`

Specialized package for creating PlayCanvas space MMO experiences with advanced game mechanics.

## Development Guidelines

### Creating New Shared Packages

When creating new shared packages, follow these guidelines:

1. **Location**: Place in `apps/` directory with descriptive name
2. **Structure**: Use the standard `base/` subdirectory structure
3. **Build System**: Implement dual build (CJS + ESM + Types)
4. **Dependencies**: Minimize external dependencies
5. **Documentation**: Include comprehensive README files

### Package Naming Convention

- **Platform Packages**: `@universo-platformo/package-name`
- **Template Packages**: `@universo/template-name`
- **Application Packages**: Use descriptive names without namespace

### Version Management

All shared packages use `workspace:*` for internal dependencies, ensuring they always use the latest local version during development.

## Migration from Local Implementations

When migrating from local implementations to shared packages:

1. **Update Dependencies**: Add shared packages to `package.json`
2. **Update Imports**: Change import paths to use package names
3. **Remove Local Files**: Delete duplicated local implementations
4. **Test Integration**: Verify functionality with shared packages

## Best Practices

### Type Safety

Always use shared types from `@universo-platformo/types` to ensure consistency:

```typescript
// Good
import { IUPDLSpace } from '@universo-platformo/types'

// Avoid
interface LocalUPDLSpace { /* ... */ }
```

### Utility Functions

Prefer shared utilities over local implementations:

```typescript
// Good
import { UPDLProcessor } from '@universo-platformo/utils'

// Avoid
class LocalUPDLProcessor { /* ... */ }
```

### Template Integration

Use the template registry system for dynamic template loading:

```typescript
import { TemplateRegistry } from '@universo/publish-frt'

const builder = TemplateRegistry.createBuilder('quiz')
```

## Building and Testing

### Build All Shared Packages

```bash
# Build all shared packages
pnpm build --filter @universo-platformo/types
pnpm build --filter @universo-platformo/utils

# Build template packages
pnpm build --filter @universo/template-quiz
pnpm build --filter @universo/template-mmoomm
```

### Development Workflow

1. Make changes to shared package source code
2. Build the package: `pnpm build --filter package-name`
3. Test in consuming applications
4. Commit changes when tests pass

## Troubleshooting

### Common Issues

**Import Errors**: Ensure packages are built before importing
**Type Conflicts**: Check for duplicate type definitions
**Build Failures**: Verify TypeScript configuration consistency

### Debug Tips

- Use `pnpm list` to check package resolution
- Check `dist/` directories for compiled output
- Verify `package.json` exports configuration
