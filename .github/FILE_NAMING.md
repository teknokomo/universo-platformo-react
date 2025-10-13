# File Naming Conventions

This document defines the file naming conventions for the Universo Platformo React monorepo.

## General Principles

File naming should be **consistent**, **predictable**, and **semantic**. The convention depends on the file's content and purpose, not just its location.

## React/TypeScript Files

### PascalCase (Component Files)

**When to use**: File contains React components OR JSX elements

**Where**: `pages/`, `components/`, `dialogs/`, any directory with React UI

**Rule of Thumb**: **Contains `<Component />` or JSX? → PascalCase**

**Examples**:
```
✅ MetaverseList.tsx        - React component
✅ MetaverseActions.tsx     - Configuration with JSX icons
✅ EntityDialog.tsx         - Dialog component
✅ ConfirmDeleteDialog.tsx  - Confirmation dialog
✅ SkeletonGrid.tsx         - Reusable UI component
```

**Rationale**: 
- PascalCase immediately signals "this file contains React/JSX code"
- Consistent with React community standards
- Aligns with component naming conventions
- Even if the file exports configuration data (like action descriptors), if it contains JSX elements (`<EditIcon />`), it should use PascalCase

### camelCase (Utility/Module Files)

**When to use**: File contains pure TypeScript/JavaScript functions, hooks, or data (NO JSX)

**Where**: `api/`, `utils/`, `hooks/`, `types/`, `menu-items/`, `services/`

**Rule of Thumb**: **Pure TS/JS functions/data? → camelCase**

**Examples**:
```
✅ apiClient.ts            - HTTP client utilities
✅ metaverseDashboard.ts   - Menu configuration (no JSX)
✅ useApi.ts               - Custom React hook
✅ genericHelper.ts        - Utility functions
✅ metaverses.ts           - API endpoints
```

**Rationale**:
- camelCase signals "this is a utility/module, not a UI component"
- Consistent with JavaScript/TypeScript module conventions
- Clear distinction from React components

### kebab-case (Directories)

**When to use**: All directory names

**Examples**:
```
✅ space-builder-frt/
✅ universo-template-mui/
✅ memory-bank/
✅ menu-items/
```

**Rationale**:
- Lowercase reduces case-sensitivity issues across different filesystems
- Hyphens improve readability
- Standard convention in Node.js ecosystem

## Special Cases

### Action Descriptors

**Pattern**: Files that export action/menu configurations

**Decision**: Use **PascalCase** if they contain JSX elements, **camelCase** if pure data

**Examples**:
```
✅ MetaverseActions.tsx    - Contains <EditIcon />, <DeleteIcon /> (JSX)
✅ ClusterActions.tsx      - Contains JSX icons
✅ metaverseDashboard.ts   - Pure configuration, no JSX
```

**Why**: Action descriptors in `pages/` directories contain React Icon components, making them React-specific files.

### Type Definition Files

**Pattern**: `.d.ts` files for type declarations

**Convention**: **camelCase** matching the module they describe

**Examples**:
```
✅ template-mui.d.ts
✅ ui.d.ts
✅ gulp.d.ts
✅ env.d.ts
```

### Test Files

**Convention**: Match the file being tested

**Examples**:
```
✅ MetaverseList.test.tsx      - Tests MetaverseList.tsx
✅ apiClient.test.ts           - Tests apiClient.ts
✅ MetaverseList.spec.tsx      - Alternative test naming
```

## Decision Tree

```
Does the file contain JSX elements (<Component />)?
│
├─ YES → PascalCase
│   └─ Examples: MetaverseList.tsx, MetaverseActions.tsx, EntityDialog.tsx
│
└─ NO → Is it a React component file?
    │
    ├─ YES → PascalCase
    │   └─ Examples: Button.tsx (even if JSX is minimal)
    │
    └─ NO → camelCase
        └─ Examples: apiClient.ts, useApi.ts, metaverseDashboard.ts
```

## Migration Guide

### When renaming files:

1. **Use Git rename** to preserve history:
   ```bash
   git mv apps/metaverses-frt/base/src/pages/metaverseActions.tsx apps/metaverses-frt/base/src/pages/MetaverseActions.tsx
   ```

2. **Find all imports**:
   ```bash
   grep -r "from './metaverseActions'" apps/metaverses-frt/
   grep -r "from '../pages/metaverseActions'" apps/metaverses-frt/
   ```

3. **Update imports**:
   - Change `./metaverseActions` → `./MetaverseActions`
   - Change `../pages/metaverseActions` → `../pages/MetaverseActions`

4. **Verify build**:
   ```bash
   pnpm --filter <package-name> build
   pnpm --filter <package-name> lint
   ```

## Summary Table

| File Type | Convention | Location | Example |
|-----------|-----------|----------|---------|
| React Component | **PascalCase** | pages/, components/ | `MetaverseList.tsx` |
| Component with JSX | **PascalCase** | pages/ | `MetaverseActions.tsx` |
| Hook | **camelCase** | hooks/ | `useApi.ts` |
| API Module | **camelCase** | api/ | `metaverses.ts` |
| Utility | **camelCase** | utils/ | `genericHelper.ts` |
| Type Definitions | **camelCase** | types/ | `template-mui.d.ts` |
| Configuration (no JSX) | **camelCase** | menu-items/ | `metaverseDashboard.ts` |
| Directory | **kebab-case** | anywhere | `space-builder-frt/` |

## Enforcement

- **ESLint**: Consider adding rules to enforce naming conventions
- **Code Review**: Reviewers should check file naming consistency
- **AI Agents**: This document guides automated code generation and refactoring

## References

- [React Style Guide](https://github.com/airbnb/javascript/tree/master/react)
- [TypeScript Naming Conventions](https://typescript-lang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [AGENTS.md](../AGENTS.md) - Project-specific guidelines

---

**Last Updated**: 2025-10-13  
**Status**: Active Standard
