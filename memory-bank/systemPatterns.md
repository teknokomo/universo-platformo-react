# System Patterns

## i18n Architecture Patterns

### Multi-Namespace i18n Pattern (2025-10-28)

**Pattern**: Organize translations into logical namespaces with clear hierarchy: core shared translations (common, roles, access) + feature-specific namespaces (metaverses, flowList).

**Structure**:
```
packages/universo-i18n/base/src/locales/
├── en/
│   ├── core/                    # Shared across all features
│   │   ├── common.json          # UI elements, CRUD, errors, pagination
│   │   ├── roles.json           # Universal roles (owner, admin, member, etc)
│   │   └── access.json          # Access control (permissions, dialogs)
│   ├── views/                   # View-specific translations
│   │   ├── flowList.json        # Generic flow/table list component
│   │   ├── admin.json           # Admin interface
│   │   └── ...
│   ├── dialogs/                 # Dialog-specific translations
│   └── features/                # Feature-specific translations
└── ru/                          # Same structure for Russian
```

**Usage in Components**:
```typescript
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'

// Multi-namespace hook (default namespace first)
const { t } = useTranslation(['metaverses', 'common', 'roles', 'access', 'flowList'], { i18n })

// Default namespace (no prefix needed)
t('metaverses.title')                  // → "Metaverses"
t('metaverses.searchPlaceholder')      // → "Search metaverses..."

// Other namespaces (explicit prefix required)
t('common:addNew')                     // → "Add New"
t('common:table.role')                 // → "Role"
t('roles:owner')                       // → "Owner"
t('access:permissions.manage')         // → "Manage Access"
t('flowList:table.columns.name')       // → "Name"
```

**Key Principles**:

1. **Core Namespace Hierarchy**:
   - `common.json`: Buttons, labels, CRUD actions, errors, pagination
   - `roles.json`: Universal user roles (owner, admin, editor, member, viewer)
   - `access.json`: Access control (permissions, share dialogs, invitations)

2. **Feature Namespaces**:
   - Feature-specific keys in own package (`metaverses.json`)
   - Generic component translations in `views/` (`flowList.json` for table lists)

3. **Namespace Registration**:
   - Core namespaces loaded in `universo-i18n/instance.ts`
   - Feature namespaces registered via `registerNamespace()` from package i18n modules
   - Side-effect imports ensure namespace availability before component render

4. **Translation Key Naming**:
   - Flat structure preferred: `metaverses.createMetaverse` not `metaverses.actions.create`
   - Shared keys moved to core: `common:addNew` not `metaverses.addNew`
   - Consistent naming across features for reusability

**FlowListTable Namespace Example**:
```typescript
// Component prop determines which namespace to use
<FlowListTable
    data={items}
    i18nNamespace='flowList'  // Uses flowList:table.columns.* keys
    customColumns={customColumns}
/>

// Custom columns use their own namespace
const customColumns = [
    {
        id: 'role',
        label: t('common:table.role'),  // Shared label from common namespace
        render: (row) => t(`roles:${row.role}`)  // Dynamic role translation
    }
]
```

**Benefits**:
- ✅ Eliminates translation duplication (DRY principle)
- ✅ Consistent labels across features (e.g., "Add New", "Role", "Actions")
- ✅ Easy maintenance (update one common key, all features reflect change)
- ✅ Type-safe with proper namespace imports
- ✅ Generic components reusable across features (FlowListTable, PaginationControls)

### JSON Namespace Wrapper Pattern (Critical)

**Pattern**: All translation JSON files use top-level wrapper keys matching the namespace name. During registration in `instance.ts`, these wrappers **must be unwrapped** to avoid double-nesting.

**Critical Rule**: JSON files with wrapper keys MUST be unwrapped during registration, otherwise i18next creates double-nested paths (e.g., `roles.roles.owner` instead of `roles.owner`).

**File Structure**:
```json
// packages/universo-i18n/base/src/locales/en/core/roles.json
{
  "roles": {           // ← Wrapper key (matches namespace name)
    "owner": "Owner",
    "admin": "Admin",
    "editor": "Editor",
    "member": "Member",
    "viewer": "Viewer"
  }
}
```

**Why Wrappers Exist**:
1. ✅ Self-documenting: Immediately see which namespace the file contains
2. ✅ Prevents key conflicts when merging translations
3. ✅ Consistent pattern across all namespaces
4. ✅ Git-friendly: Merge conflicts are namespace-scoped

**Registration Patterns**:

```typescript
// ❌ WRONG: Double-nesting (creates roles.roles.owner path)
resources: {
  en: {
    roles: rolesEn  // rolesEn = {roles: {...}}
  }
}

// ✅ CORRECT: Unwrap to single-nesting (creates roles.owner path)
resources: {
  en: {
    roles: rolesEn.roles  // Extract inner object
  }
}

// Special case: Keys with hyphens require bracket notation
resources: {
  en: {
    'api-keys': apiKeysEn.apiKeys,         // apiKeys.json uses camelCase key
    'document-store': documentStoreEn.documentStore  // documentStore in JSON
  }
}

// Special case: Flat JSON files without wrappers (keep as-is)
resources: {
  en: {
    admin: adminEn,  // admin.json is flat: {title: "...", superAdmin: "..."}
    translation: {
      ...commonEn.common,  // Unwrap common
      ...headerEn.header,  // Unwrap header
      ...spacesEn,         // Keep flat (no wrapper)
      ...canvasesEn        // Keep flat (no wrapper)
    }
  }
}
```

**Feature Package Registration** (already correct pattern):
```typescript
// packages/metaverses-frt/base/src/i18n/index.ts
import { registerNamespace } from '@universo/i18n/registry'
import enMetaverses from './locales/en/metaverses.json'
import ruMetaverses from './locales/ru/metaverses.json'

// ✅ CORRECT: Extract inner object before registration
registerNamespace('metaverses', {
  en: enMetaverses.metaverses,  // Unwrap {metaverses: {...}}
  ru: ruMetaverses.metaverses
})
```

**Verification Checklist**:
- ✅ All namespace JSON files in `core/`, `views/`, `dialogs/`, `features/` have wrapper keys
- ✅ `instance.ts` extracts inner object during registration: `rolesEn.roles`, `flowListEn.flowList`, etc.
- ✅ Hyphenated namespace names use bracket notation: `apiKeysEn.apiKeys` for `'api-keys'` namespace
- ✅ Flat JSON files (admin, spaces, canvases) registered without unwrapping
- ✅ Mixed namespace keys use correct format: camelCase in JSON (`apiKeys`), kebab-case in registration (`'api-keys'`)

**Common Mistakes**:
```typescript
// ❌ MISTAKE 1: Using bracket notation instead of dot notation
'api-keys': apiKeysEn['api-keys']  // Wrong: JSON uses apiKeys not api-keys

// ✅ CORRECT: Use camelCase key from JSON file
'api-keys': apiKeysEn.apiKeys

// ❌ MISTAKE 2: Assuming JSON key matches namespace name
'document-store': documentStoreEn['document-store']  // Wrong

// ✅ CORRECT: Check JSON file for actual key name
'document-store': documentStoreEn.documentStore

// ❌ MISTAKE 3: Unwrapping flat files
translation: {
  ...commonEn,  // Wrong: creates translation.common.loading
  ...headerEn
}

// ✅ CORRECT: Unwrap files with wrappers
translation: {
  ...commonEn.common,  // Creates translation.loading
  ...headerEn.header
}
```

**Testing Namespace Registration**:
```typescript
// Add console logs in feature package i18n registration
console.log('[metaverses-i18n] Registering namespace', {
  namespace: 'metaverses',
  enKeys: Object.keys(enMetaverses.metaverses),
  ruKeys: Object.keys(ruMetaverses.metaverses)
})
```

**Expected Browser Console**:
```
[metaverses-i18n] Registering namespace {namespace: 'metaverses', enKeys: Array(4), ruKeys: Array(4)}
[metaverses-i18n] Namespace registered successfully
```

If translations don't appear, check:
1. Is side-effect import present? (`import './i18n'` in package index)
2. Is namespace correctly unwrapped in `instance.ts` or `registerNamespace()`?
3. Does JSON key name match what's used in registration? (camelCase vs kebab-case)
4. Are translation keys using correct namespace prefix? (`t('common:save')` for non-default namespaces)

### Defense-in-Depth i18n Registration (Best Practice)

**Pattern**: Multi-layer protection to ensure translation namespaces are registered before components use them.

**When to Use**:
- React Router lazy loading (`React.lazy`)
- Code-split applications with async routes
- Monorepo with multiple i18n packages
- Production builds with aggressive tree-shaking

**Implementation Layers**:

**Layer 1: Package Configuration (Prevent Tree-Shaking)**
```json
// package.json
{
  "sideEffects": [
    "dist/i18n/index.mjs",
    "dist/i18n/index.js",
    "*.css"
  ]
}
```

**Layer 2: Build Configuration (Compile i18n Entry)**
```typescript
// tsdown.config.ts
export default defineConfig({
  entry: {
    'i18n/index': './src/i18n/index.ts'
  },
  format: ['esm', 'cjs'],
  dts: true
})
```

**Layer 3: Global Registration (Application Root)**
```typescript
// flowise-ui/src/index.jsx
import '@universo/i18n'  // Core instance
import '@universo/spaces-frt/i18n'
import '@universo/publish-frt/i18n'
import '@universo/analytics-frt/i18n'
import '@universo/profile-frt/i18n'
import '@universo/uniks-frt/i18n'
import '@universo/metaverses-frt/i18n'
import '@universo/template-mmoomm/i18n'
import '@universo/template-quiz/i18n'
// ... render App
```

**Layer 4: Route-Level Registration (Before Lazy Components)**
```typescript
// routes/MainRoutesMUI.tsx
import { lazy } from 'react'

// CRITICAL: Import BEFORE lazy() calls
import '@universo/uniks-frt/i18n'
import '@universo/metaverses-frt/i18n'

const UnikList = Loadable(lazy(() => import('@universo/uniks-frt/pages/UnikList')))
const MetaverseList = Loadable(lazy(() => import('@universo/metaverses-frt/pages/MetaverseList')))
```

**How It Works**:
1. `sideEffects` array prevents bundlers from removing i18n imports during optimization
2. Explicit imports at route level guarantee synchronous registration before lazy components load
3. Global imports provide fallback for non-lazy routes and initial render

**Common Pitfall**:
```typescript
// ❌ WRONG - i18n registered too late
const routes = {
  element: <Layout />,
  children: [
    { path: 'uniks', element: lazy(() => import('UnikList')) }  // May load before i18n ready
  ]
}
import '@universo/uniks-frt/i18n'  // Too late!

// ✅ CORRECT - i18n registered before route definition
import '@universo/uniks-frt/i18n'  // Registration first
const routes = {
  element: <Layout />,
  children: [
    { path: 'uniks', element: lazy(() => import('UnikList')) }  // Safe to use translations
  ]
}
```

**Verification Checklist**:
- [ ] `dist/i18n/index.js` and `index.mjs` exist after build
- [ ] `sideEffects` array includes i18n files
- [ ] Global imports at app root (`index.jsx`)
- [ ] Route-level imports before lazy components
- [ ] Production build tested (not just dev mode)
- [ ] Browser console shows no i18n warnings

---

## UPDL Node Patterns and Visual Programming

### Key Design Principles

1. **Universal Description Layer**

    - UPDL nodes describe "what" should happen, not "how"
    - Technical implementation details are hidden from the developer
    - The same node graph works across different platforms

2. **Hierarchical Structure**

    - Space node serves as the root container (formerly Scene)
    - Objects can contain other objects (parent-child relationship)
    - Cameras and lights can be attached to objects or directly to space

3. **Typed Ports and Connections**
    - Each port has a specific data type
    - Connections are validated for type compatibility
    - The editor prevents incompatible connections

### Connector Implementation Guide ✅ **COMPLETE**

**Key Principles for UPDL node connectors:**

1. **Input Connectors**: Define in parent node's `inputs` array with matching `type` property
2. **Output Connectors**: Use empty `outputs: []` for default Flowise behavior
3. **Type Safety**: Centralize connector types in `CONNECTABLE_TYPES` constant
4. **Terminal Nodes**: Use empty arrays for self-contained nodes (e.g., ActionNode)

**Connection Structure:**

-   **Entity** accepts: Components, Events
-   **Event** accepts: Actions
-   **Space** accepts: Entities, Universo, legacy nodes
-   **Universo** connects to Space for global context

## Template Package Architecture Patterns

### Shared Package Pattern

**Purpose**: Centralize common functionality across multiple applications

**Structure**:

```
packages/package-name/
├── base/
│   ├── src/
│   │   ├── interfaces/     # TypeScript interfaces
│   │   ├── utils/          # Utility functions
│   │   └── index.ts        # Package entry point
│   ├── dist/               # Compiled output
│   │   ├── cjs/           # CommonJS modules
│   │   ├── esm/           # ES modules
│   │   └── types/         # TypeScript declarations
│   ├── package.json
│   └── README.md
```

**Key Principles**:

-   **Dual Build System**: Support both CJS and ESM for maximum compatibility
-   **Type-Only Packages**: Separate types from runtime code when possible
-   **Workspace Dependencies**: Use `workspace:*` for internal dependencies
-   **Zero Runtime Dependencies**: Minimize external dependencies in shared packages

### Template Package Pattern

**Purpose**: Encapsulate platform-specific template functionality

**Structure**:

```
packages/template-name/
├── base/
│   ├── src/
│   │   ├── platform/       # Platform-specific implementations
│   │   ├── handlers/       # UPDL node handlers
│   │   ├── builders/       # Main builder classes
│   │   ├── common/         # Shared utilities
│   │   └── index.ts        # Package entry point
│   ├── dist/               # Compiled output (CJS + ESM + Types)
│   ├── package.json
│   └── README.md
```

**Key Principles**:

-   **Handler Separation**: Separate handlers for different UPDL node types
-   **Builder Interface**: Implement consistent ITemplateBuilder interface
-   **Platform Isolation**: Keep platform-specific code in dedicated directories
-   **Modular Architecture**: Enable easy testing and maintenance

### Template Registry Pattern

**Purpose**: Dynamic template loading and management

**Implementation**:

```typescript
class TemplateRegistry {
    private static templates = new Map<string, TemplateInfo>()

    static registerTemplate(template: TemplateInfo) {
        this.templates.set(template.id, template)
    }

    static createBuilder(templateId: string): ITemplateBuilder {
        const template = this.templates.get(templateId)
        return new template.builder()
    }
}
```

**Key Principles**:

-   **Dynamic Loading**: Templates are loaded at runtime
-   **Type Safety**: All templates implement ITemplateBuilder interface
-   **Extensibility**: Easy to add new templates without core changes
-   **Isolation**: Templates are self-contained packages

### UPDLProcessor Pattern

**Purpose**: Convert flow data to structured UPDL representations

**Key Features**:

-   **Multi-Scene Detection**: Automatically detect single vs multi-scene flows
-   **Node Relationship Mapping**: Maintain edge relationships between nodes
-   **Type Safety**: Use shared types from @universo-platformo/types
-   **Error Handling**: Robust error handling with fallbacks

### Template-Specific Implementation Patterns

#### PlayCanvas MMOOMM Template Patterns

**Physics Fallback Pattern:**

```typescript
// Graceful degradation from physics to direct movement
if (!entity.rigidbody.body) {
    this.moveDirectly(direction) // Fallback method
}
```

### Common UPDL Patterns

**High-Level Node Patterns:**

-   **Space** → **Entity** → **Component** (modern approach)
-   **Space** → **Object** → **Animation** → **Interaction** (legacy support)
-   **Multi-Space**: Connected spaces for complex experiences

**Export Features:**

-   Automatic addition of missing required elements (camera, lighting)
-   Platform-specific transformations and optimizations
-   Technology-specific parameter handling

**Rendering Patterns:**

-   **Iframe-based Rendering**: Isolated script execution for proper library loading and security
-   **Template System**: Reusable export templates across multiple technologies
-   **Static Library Integration**: CDN and local library sources with fallback support

## Build, Packaging, and Integration Patterns (2025-08-31)

### Build Order & Workspace Graph

-   Combine Turborepo `dependsOn: ["^build"]` with explicit `workspace:*` dependencies in consumers to enforce correct order. Example: `flowise-ui` → `@universo/template-quiz`, `@universo/template-mmoomm`, `publish-frt`.
-   Avoid cycles: feature/front packages (e.g., `finance-frt`) must never depend on UI (`flowise-ui`). UI is the top-level consumer.
-   Cold start requires upstream packages (templates/publish) to build before UI/server; declare deps accordingly. Optionally add `publish-frt` as a server dep to ensure `/assets` exist.

### Template Package Exports & Types

-   Ship dual builds with proper `exports` mapping to `dist/esm` and `dist/cjs`, plus `dist/types`. Provide multi-entry exports (`./arjs`, `./playcanvas`) when needed.
-   Consumers reference template declaration files via tsconfig `paths` to `dist/index.d.ts` instead of source.

### i18n Entry Points (TypeScript)

-   Use `.ts` entry files for package i18n to ensure inclusion in `dist` and strong typing; keep `resolveJsonModule: true` for JSON locales.
-   Provide typed helpers like `getTemplateXxxTranslations(language: string)` to return a single namespace.

### Vite + Workspace Libraries

-   Prefer building libraries prior to UI. Use `optimizeDeps.include` and `build.commonjsOptions.include` for workspace packages only if necessary; avoid aliasing to `src` in production builds.

### Uniks Child Resource Integration

-   New bounded contexts (e.g., Finance) integrate as Uniks children:
  -   Server: export `entities` and `migrations` arrays and `createXxxRouter()`; mount under `/api/v1/unik/:unikId/...` (preferred) — legacy `/api/v1/uniks/:unikId/...` remains supported for backward compatibility.
    -   UI: add nested routes inside Unik workspace and include namespaced i18n.

  Fallback behavior: a normalization middleware maps `:id` → `unikId`, and controllers use `req.params.unikId || req.params.id` to eliminate intermittent missing parameter errors.

### URL Parsing Patterns (2025-09-16)

-   **Frontend URL Parsing**: When extracting `unikId` from `window.location.pathname`, always support both new singular `/unik/:unikId` and legacy `/uniks/:unikId` patterns for backward compatibility:
    ```typescript
    // Correct pattern - support both singular and legacy
    const unikSingularMatch = pathname.match(/\/unik\/([^\/]+)/)
    const unikLegacyMatch = pathname.match(/\/uniks\/([^\/]+)/)
    if (unikSingularMatch && unikSingularMatch[1]) {
        result.unikId = unikSingularMatch[1]
    } else if (unikLegacyMatch && unikLegacyMatch[1]) {
        result.unikId = unikLegacyMatch[1]
    }
    ```
-   **Priority**: Always prioritize new singular pattern first, fallback to legacy pattern for compatibility.
-   **Reference Implementation**: See `CanvasHeader.jsx extractUnikId()` and `getCurrentUrlIds()` in `common.ts`.

## Data Isolation and Entity Relationship Patterns

### Three-Tier Architecture Pattern

**Purpose**: Implement hierarchical data organization with complete isolation between top-level containers

**Structure**:
```
Clusters (Top-level isolation)
├── Domains (Logical groupings within clusters)
│   └── Resources (Individual assets within domains)
```

**Key Principles**:
- **Complete Isolation**: Data from different clusters is never visible across boundaries
- **Mandatory Associations**: Child entities must be associated with parent entities
- **Cascade Operations**: Deleting parent entities removes all child relationships
- **Idempotent Operations**: Relationship creation is safe to retry

### Junction Table Pattern

**Purpose**: Manage many-to-many relationships with data integrity

**Implementation**:
```typescript
@Entity({ name: 'entities_parents' })
export class EntityParent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Entity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entity_id' })
  entity: Entity

  @ManyToOne(() => Parent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: Parent

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE constraint on (entity_id, parent_id)
}
```

**Key Features**:
- **CASCADE Delete**: Automatically clean up relationships when entities are deleted
- **UNIQUE Constraints**: Prevent duplicate relationships
- **Indexed Foreign Keys**: Optimize query performance
- **Audit Trail**: Track relationship creation timestamps

### Cluster-Scoped API Pattern

**Purpose**: Maintain data isolation through URL routing and context preservation

**Implementation**:
```typescript
// Cluster-scoped endpoints
GET    /clusters/:clusterId/domains
POST   /clusters/:clusterId/domains/:domainId  // Link domain to cluster
GET    /clusters/:clusterId/resources
POST   /clusters/:clusterId/resources/:resourceId  // Link resource to cluster

// Context-aware creation
POST   /resources { domainId: required, clusterId: optional }
POST   /domains { clusterId: required }
```

**Key Principles**:
- **URL Context**: Cluster ID in URL maintains context throughout operations
- **Scoped Queries**: All list operations filtered by cluster context
- **Idempotent Linking**: Safe to retry relationship creation
- **Validation**: Server validates entity existence before creating relationships

### Frontend Validation Pattern

**Purpose**: Prevent invalid data entry with clear user feedback

**Implementation**:
```typescript
// Material-UI required field pattern
<InputLabel id='field-label'>{t('namespace.field')}</InputLabel>
<Select
  required
  error={!selectedValue}
  value={selectedValue || ''}
  onChange={handleChange}
>
  {/* No empty option for required fields */}
  {options.map(option => (
    <MenuItem key={option.id} value={option.id}>
      {option.name}
    </MenuItem>
  ))}
</Select>

// Conditional save button
<Button
  disabled={!isFormValid}
  onClick={handleSave}
>
  {t('common.save')}
</Button>
```

**Key Features**:
- **Required Indicators**: Automatic asterisk display for required fields
- **Error States**: Visual feedback for validation errors
- **Conditional Actions**: Disable actions until form is valid
- **No Empty Options**: Remove empty/dash options for required selections

## APPs Architecture Pattern (v0.21.0-alpha)

**6 Working Applications** with modular architecture:

-   **UPDL**: High-level abstract nodes (Space, Entity, Component, Event, Action, Data, Universo)
-   **Publish Frontend/Backend**: Multi-technology export (AR.js, PlayCanvas)
-   **Analytics**: Quiz performance tracking
-   **Profile Frontend/Backend**: Enhanced user management with workspace packages

### Key Benefits

-   **Separation of Concerns**: Core Flowise unchanged, functionality isolated in apps
-   **Template-First Architecture**: Reusable export templates across technologies
-   **Interface Separation**: Core UPDL vs simplified integration interfaces
-   **Easy Extension**: New technologies and node types added modularly

## UPDL Node System ✅ **COMPLETE**

**High-Level Abstract Nodes** (v0.21.0-alpha):

### 7 Core Node Types

-   **Space**: Root container for 3D environments
-   **Entity**: Game objects with transform and behavior
-   **Component**: Attachable behaviors (geometry, material, script)
-   **Event**: Trigger system for interactions
-   **Action**: Executable behaviors and responses
-   **Data**: Information storage and quiz functionality
-   **Universo**: Global connectivity and network features

### Architecture Features

-   **Universal Description**: Platform-independent intermediate representation
-   **Template-Based Export**: Multi-technology support (AR.js, PlayCanvas)
-   **Hierarchical Structure**: Parent-child relationships with typed connections
-   **Version Compatibility**: Forward/backward compatibility via `updlVersion`

## React Hooks Patterns

### ⚠️ React useEffect Antipattern Warning

**CRITICAL**: Never use `useCallback` functions in `useEffect` dependencies array for mount-only effects.

**Antipattern (Creates Infinite Loop)**:
```javascript
const loadData = useCallback(async () => {
    // ... fetch data, setState
}, [dep1, dep2])

useEffect(() => {
    loadData()
}, [loadData])  // ❌ WRONG! Creates infinite loop
```

**Problem**: 
- Functions are objects in JavaScript
- Each render creates new function reference (even with `useCallback`)
- `useEffect` sees new reference → runs → `setState` → re-render → new reference → loop

**Correct Pattern (Mount-Only Execution)**:
```javascript
const loadData = useCallback(async () => {
    // ... fetch data, setState
}, [dep1, dep2])

// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
    loadData()
}, [])  // ✅ CORRECT! Empty array = mount-only
```

**Why It Works**: JavaScript closures capture current values. `loadData` has access to latest `dep1` and `dep2` even with empty deps array.

**When to Use**:
- Event-driven data loading (load on mount, reload after user actions)
- Single-user MVP contexts
- Initial data fetch that doesn't need automatic refresh

**Real Example** (Publication System):
- PlayCanvasPublisher.jsx line 212
- PublishVersionSection.tsx line 167
- Bug caused continuous 429 errors (infinite requests)
- Fix: Changed `[loadFunction]` → `[]` with eslint-disable comment

---

### useAutoSave Hook Pattern

**Purpose**: Standardized auto-save functionality with debouncing, status indication, and data loss protection

**Location**: `packages/publish-frt/base/src/hooks/useAutoSave.ts`

**Features**:
- **Debouncing**: Configurable delay (default 500ms) to reduce API calls
- **Status Indication**: Returns `idle | saving | saved | error` for UI feedback
- **Unsaved Changes Tracking**: `hasUnsavedChanges` flag for conditional logic
- **Manual Save**: `triggerSave()` function for immediate saves
- **Beforeunload Protection**: Optional warning on page close with unsaved changes
- **First Render Skip**: Prevents save on component initialization

**Usage Pattern**:
```typescript
const { status, hasUnsavedChanges, triggerSave } = useAutoSave({
    data: settingsData,
    onSave: async (data) => await api.saveSettings(data),
    delay: 500,
    enableBeforeUnload: true
})

// Visual indicator in UI
<TextField
    helperText={
        status === 'saving' ? t('common.saving') :
        status === 'saved' ? t('common.saved') :
        status === 'error' ? t('common.saveError') : ''
    }
/>
```

**When to Use**:
- Forms with frequent updates (settings, configurations)
- Preventing data loss on accidental page close
- Consistent auto-save UX across application
- Reducing API calls via debouncing

**When NOT to Use**:
- Single-field forms (use inline debounce)
- Critical data requiring explicit save confirmation
- Real-time collaborative editing (use dedicated sync library)

## Event-Driven Data Loading Pattern

**Purpose**: Efficient data fetching without polling overhead for single-user MVP contexts

**Implementation** (Publication System):

**Key Principles**:
1. **Load on Mount**: Single initial request via `useEffect(() => { loadData() }, [])` (mount-only, see antipattern warning above)
2. **Reload After Actions**: Call `loadData()` after create/delete operations
3. **No Polling**: Remove `setInterval` - periodic updates unnecessary for single-user context
4. **AbortController**: Cancel stale requests to prevent race conditions

**Pattern Example**:
```javascript
const statusRef = useRef({
    loading: false,
    abortController: null
})

const loadData = useCallback(async () => {
    if (statusRef.current.loading) return []
    
    // Cancel previous request
    if (statusRef.current.abortController) {
        statusRef.current.abortController.abort()
    }
    
    const abortController = new AbortController()
    statusRef.current.loading = true
    statusRef.current.abortController = abortController
    
    try {
        const data = await api.fetchData({ signal: abortController.signal })
        setData(data)
        return data
    } catch (error) {
        if (error.name === 'AbortError' || error.name === 'CanceledError') {
            return []
        }
        console.error('Load failed:', error)
        return []
    } finally {
        statusRef.current.loading = false
        statusRef.current.abortController = null
    }
}, [dependencies])

// Mount-time load (mount-only pattern, see antipattern warning)
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => { loadData() }, [])

// Reload after action
const handleCreate = async () => {
    await api.create(item)
    await loadData() // Refresh data
}
```

**Benefits**:
- 92% reduction in API requests (from 12 req/min polling to 1 initial + action-triggered)
- Eliminates rate limit errors (429)
- Simpler codebase (no throttling cache logic)
- Race condition protection via AbortController

**When to Use**:
- Single-user scenarios (admin dashboards, settings)
- Data that changes only via user actions
- MVP/early-stage products
- Rate-limited APIs

**When NOT to Use**:
- Multi-user collaborative features
- Real-time data requirements
- Server-driven updates (use WebSocket/SSE)
- High-frequency external data changes

---

## TanStack Query v5 Architecture Patterns (2025-01-16)

### Overview

**TanStack Query v5** (formerly React Query) is used for server state management across the application. This section documents our patterns and best practices.

**Installation**:
- `@tanstack/react-query`: ^5.90.3 (production)
- `@tanstack/react-query-devtools`: ^5.90.2 (development)

### 1. Global QueryClient Pattern

✅ **CORRECT**: Single QueryClient at application root

```javascript
// packages/flowise-ui/src/index.jsx
import { QueryClientProvider } from '@tanstack/react-query'
import { createGlobalQueryClient } from '@/config/queryClient'

const queryClient = createGlobalQueryClient()

root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
```

❌ **WRONG**: Multiple QueryClient instances per component
```javascript
// Don't create local QueryClient in components
const MyComponent = () => {
  const queryClient = new QueryClient() // ❌ NO!
  // ...
}
```

**Why**: 
- One QueryClient = one cache for entire app
- Enables automatic request deduplication
- Persistent cache across component lifecycle
- Follows official TanStack Query v5 best practices

### 2. Query Key Factory Pattern

**Location**: `packages/publish-frt/base/src/api/queryKeys.ts`

✅ **CORRECT**: Use Query Key Factory for consistency

```typescript
import { publishQueryKeys } from '@/api/queryKeys'

const { data } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
  queryFn: fetchCanvas
})
```

❌ **WRONG**: Hardcoded query keys
```javascript
// Don't hardcode keys - prone to typos and mismatches
const { data } = useQuery({
  queryKey: ['publish', 'canvas', unikId, canvasId], // ❌ NO!
  queryFn: fetchCanvas
})
```

**Benefits**:
- Type normalization (prevents cache mismatches)
- Easy cache invalidation
- TypeScript autocomplete support
- Single source of truth

**Available Keys**:
```typescript
publishQueryKeys.all                              // ['publish']
publishQueryKeys.canvas()                         // ['publish', 'canvas']
publishQueryKeys.canvasByUnik(unikId, canvasId)   // ['publish', 'canvas', uId, cId]
publishQueryKeys.linksByVersion(tech, fId, vId)   // ['publish', 'links', tech, fId, vId]
```

**Cache Invalidation**:
```typescript
import { invalidatePublishQueries } from '@/api/queryKeys'

const queryClient = useQueryClient()

// After mutation
await saveCanvas()
invalidatePublishQueries.canvas(queryClient, canvasId)
```

### 3. Declarative useQuery() vs Imperative fetchQuery()

✅ **CORRECT**: useQuery() for component-level data

```javascript
// Automatic deduplication, loading states, error handling
const { data, isLoading, isError } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
  queryFn: async () => await PublicationApi.getCanvasById(unikId, canvasId),
  enabled: !!unikId && !!canvasId,
  staleTime: 5 * 60 * 1000  // 5 minutes
})
```

❌ **WRONG**: fetchQuery() in useEffect (no deduplication)

```javascript
// This creates duplicate requests if multiple components mount
useEffect(() => {
  const fetch = async () => {
    const data = await queryClient.fetchQuery({ /* ... */ })
    setData(data)
  }
  fetch()
}, [canvasId])
```

**When to use each**:

| Pattern | Use Case | Deduplication |
|---------|----------|---------------|
| `useQuery()` | Component-level data fetching | ✅ Automatic |
| `queryClient.fetchQuery()` | On-demand fetching in callbacks | ❌ Manual |

### 4. Hybrid Approach Pattern

✅ **CORRECT**: Combine useQuery + useQueryClient

```javascript
const MyPublisher = ({ flow }) => {
  // 1. Get queryClient for imperative operations
  const queryClient = useQueryClient()
  
  // 2. useQuery for component data (automatic deduplication)
  const { data: canvasData } = useQuery({
    queryKey: publishQueryKeys.canvasByUnik(unikId, flow?.id),
    queryFn: fetchCanvas,
    enabled: !!flow?.id
  })
  
  // 3. Computed values via useMemo (reactive)
  const resolvedVersionGroupId = useMemo(() => {
    if (normalizedVersionGroupId) return normalizedVersionGroupId
    if (canvasData) return FieldNormalizer.normalizeVersionGroupId(canvasData)
    return null
  }, [normalizedVersionGroupId, canvasData])
  
  // 4. queryClient.fetchQuery for callbacks (on-demand)
  const loadPublishLinks = useCallback(async () => {
    const records = await queryClient.fetchQuery({
      queryKey: publishQueryKeys.linksByVersion('arjs', flow.id, versionGroupId),
      queryFn: fetchLinks
    })
    return records
  }, [queryClient, flow.id, versionGroupId])
  
  // 5. Cache invalidation after mutations
  const handlePublish = async () => {
    await publishCanvas()
    invalidatePublishQueries.linksByTechnology(queryClient, 'arjs')
  }
}
```

**Why this works**:
- `useQuery()` for component state = automatic deduplication
- `useQueryClient()` for imperative actions = manual control when needed
- Both patterns are valid and complement each other

### 5. QueryClient Configuration Best Practices

**Location**: `packages/flowise-ui/src/config/queryClient.js`

```javascript
export const createGlobalQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,        // 5 minutes - reduces API calls
        gcTime: 30 * 60 * 1000,          // 30 minutes - memory management
        refetchOnWindowFocus: false,      // Prevents unnecessary refetch
        
        // Smart retry: skip auth errors and rate limits
        retry: (failureCount, error) => {
          const status = error?.response?.status
          if ([401, 403, 404, 429].includes(status)) return false
          if (status >= 500 && status < 600) return failureCount < 2
          return false
        },
        
        // Exponential backoff with Retry-After header support (RFC 7231)
        retryDelay: (attempt, error) => {
          const retryAfter = error?.response?.headers?.['retry-after']
          const parsed = parseRetryAfter(retryAfter)
          if (parsed !== null) {
            return parsed + Math.random() * 150  // Jitter prevents thundering herd
          }
          return Math.min(1000 * Math.pow(2, attempt), 30000)
        }
      },
      
      mutations: {
        retry: false  // Don't retry mutations (may have side effects)
      }
    }
  })
```

**Key Configuration Choices**:

| Option | Value | Rationale |
|--------|-------|-----------|
| `staleTime` | 5 minutes | Balance between freshness and API calls |
| `gcTime` | 30 minutes | Keep data in memory for quick navigation |
| `refetchOnWindowFocus` | false | Prevent unnecessary refetch on tab switch |
| `retry` | Smart policy | Skip 401/403/404/429, retry 5xx up to 2x |
| `retryDelay` | Exponential + jitter | Respect Retry-After, prevent thundering herd |

### 6. React Query DevTools

**Usage** (development only):

```javascript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

{process.env.NODE_ENV === 'development' && (
  <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
)}
```

**How to use**:
1. Open DevTools in browser (bottom-right corner)
2. Find query by key
3. Check status: fresh/stale/fetching/error
4. Verify fetch count (should be 1, not 10+)

### 7. Common Anti-Patterns to Avoid

❌ **Multiple QueryClient instances**
```javascript
// Don't create local QueryClient per component
const MyComponent = () => {
  const queryClient = new QueryClient()  // ❌
}
```

❌ **fetchQuery in useEffect**
```javascript
// No automatic deduplication
useEffect(() => {
  queryClient.fetchQuery({ /* ... */ })  // ❌
}, [deps])
```

❌ **Manual state management for async data**
```javascript
// useQuery handles this automatically
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)  // ❌
```

❌ **Hardcoded query keys**
```javascript
// Use Query Key Factory instead
queryKey: ['publish', 'canvas', id]  // ❌
```

### 8. Migration from Old Patterns

**Before (Anti-pattern)**:
```javascript
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  const fetch = async () => {
    const result = await api.getData()
    setData(result)
    setLoading(false)
  }
  fetch()
}, [id])
```

**After (Best practice)**:
```javascript
const { data, isLoading } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, id),
  queryFn: () => api.getData(id),
  enabled: !!id
})
```

**Benefits**:
- ✅ -40 lines of code per component
- ✅ Automatic deduplication (prevents 429 errors)
- ✅ No manual state management
- ✅ Declarative approach
- ✅ Built-in loading/error states

### Documentation

**Detailed guides**:
- `packages/publish-frt/README.md` - Full architecture documentation
- `packages/publish-frt/README-RU.md` - Русская версия
- `packages/publish-frt/base/src/api/queryKeys.ts` - Query Key Factory with JSDoc

**External resources**:
- [TanStack Query v5 Docs](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Query Key Factory Pattern](https://tkdodo.eu/blog/effective-react-query-keys)

---

## Universal List Pattern (Reference Implementation)

### Overview

**Pattern**: Standardized approach for list views with server-side pagination, search, and sorting using TanStack Query v5.

**Reference**: `packages/metaverses-frt/base/src/pages/MetaverseList.tsx`

**When to Use**:
- Any entity list view (Metaverses, Uniks, Spaces, Sections, Entities)
- Views requiring server-side pagination
- Search and filtering capabilities
- Consistent UX across all lists

### Architecture (Updated 2025-01-29)

**Component Layers**:
1. **usePaginated Hook** (TanStack Query v5) - Server-side pagination, sorting, search, **dynamic pageSize**
2. **useDebouncedSearch Hook** (use-debounce library) - **NEW: Reusable debounced search** with cancel/flush/isPending control
3. **ViewHeader** (with search) - Top bar with title + search input + action buttons
4. **PaginationControls** (MUI pagination) - **Bottom positioned**, rows per page selector + page navigation
5. **FlowListTable / ItemCard Grid** - Data rendering (table or card view)

**Key Changes from Previous Pattern**:
- ✅ **Reusable Debounce Hook**: `useDebouncedSearch` replaces custom setTimeout logic
- ✅ **Library-Backed**: use-debounce ^10.0.6 (2.6M downloads/week, battle-tested)
- ✅ **No eslint-disable**: Proper dependency arrays, no exhaustive-deps violations
- ✅ **Advanced Control**: Cancel, flush, isPending utilities exposed
- ✅ **Dynamic Page Size**: `usePaginated` now supports `setPageSize()` action
- ✅ **Bottom Pagination**: `PaginationControls` positioned below content (not above)
- ✅ **MUI Pagination**: Uses Material-UI `TablePagination` for consistent UX
- ✅ **Multi-Namespace i18n**: Components use multiple namespaces (`common`, `flowList`, feature-specific)

### Implementation

#### Step 1: Setup usePaginated Hook with Dynamic Page Size

```typescript
import { usePaginated } from '@universo/template-mui'
import { metaversesQueryKeys } from '../api/queryKeys'
import * as metaversesApi from '../api/metaverses'

const paginationResult = usePaginated<Metaverse, 'name' | 'created' | 'updated'>({
    queryKeyFn: metaversesQueryKeys.list,
    queryFn: metaversesApi.listMetaverses,
    initialLimit: 20,  // NEW: Use initialLimit (or legacy limit param)
    sortBy: 'updated',
    sortOrder: 'desc'
})

const { data: metaverses, isLoading, error, pagination, actions } = paginationResult

// actions now includes setPageSize(newSize: number)
// pagination.pageSize is stateful and updates when user changes rows per page
```

#### Step 2: Debounced Search Hook (NEW Pattern - 2025-01-29)

```typescript
import { useDebouncedSearch } from '@universo/template-mui'

// NEW: Reusable hook with library backing (use-debounce ^10.0.6)
const { searchValue, handleSearchChange, debounced } = useDebouncedSearch({
    onSearchChange: paginationResult.actions.setSearch,
    delay: 300,  // 300ms debounce
    initialValue: ''
})

// Advanced control (optional):
// debounced.cancel()    - Cancel pending debounce
// debounced.flush()     - Execute immediately
// debounced.isPending() - Check if debounce is waiting
```

**Benefits Over Custom setTimeout**:
- ✅ No custom useEffect/useState boilerplate (3 lines → 1 line)
- ✅ No eslint-disable comments needed (proper dependency arrays)
- ✅ Battle-tested library (2.6M weekly downloads)
- ✅ Advanced control: cancel, flush, isPending utilities
- ✅ Auto-cleanup on unmount (prevents memory leaks)
- ✅ Reusable across all list views

#### Step 3: ViewHeader (NEW - uses searchValue from hook)

```typescript
import { ViewHeaderMUI as ViewHeader } from '@universo/template-mui'

<ViewHeader
    search={true}  // Search in header (top right)
    searchValue={searchValue}  // NEW: Controlled value from useDebouncedSearch
    searchPlaceholder={t('metaverses.searchPlaceholder')}
    onSearchChange={handleSearchChange}  // NEW: Handler from useDebouncedSearch
    title={t('metaverses.title')}
>
    <ToolbarControls
        viewToggleEnabled
        viewMode={view as 'card' | 'list'}
        onViewModeChange={(mode: string) => handleChange(null, mode)}
        primaryAction={{
            label: t('common:addNew'),
            onClick: handleAddNew,
            startIcon: <AddRoundedIcon />
        }}
    />
</ViewHeader>

{/* NO PaginationControls here - moved to bottom */}
```

#### Step 4: Card/List View Rendering

```typescript
{isLoading && metaverses.length === 0 ? (
    <SkeletonGrid />
) : !isLoading && metaverses.length === 0 ? (
    <EmptyListState image={APIEmptySVG} title={t('metaverses.noMetaversesFound')} />
) : (
    <>
        {view === 'card' ? (
            <Box sx={{ display: 'grid', gap: gridSpacing, ... }}>
                {metaverses.map((metaverse) => (
                    <ItemCard
                        key={metaverse.id}
                        data={metaverse}
                        onClick={() => navigate(`/metaverses/${metaverse.id}`)}
                        headerAction={<BaseEntityMenu ... />}
                    />
                ))}
            </Box>
        ) : (
            <FlowListTable
                data={metaverses}
                isLoading={isLoading}
                i18nNamespace='flowList'  // IMPORTANT: Use flowList namespace
                customColumns={metaverseColumns}
                renderActions={(row) => <BaseEntityMenu ... />}
            />
        )}
    </>
)}
```

#### Step 5: PaginationControls (Bottom Position)

```typescript
import { PaginationControls } from '@universo/template-mui'

{/* NEW: Pagination at bottom, only when data exists */}
{!isLoading && metaverses.length > 0 && (
    <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
        <PaginationControls
            pagination={paginationResult.pagination}
            actions={paginationResult.actions}
            isLoading={paginationResult.isLoading}
            rowsPerPageOptions={[10, 20, 50, 100]}  // Configurable page sizes
            namespace='common'  // Uses common:pagination.* keys
        />
    </Box>
)}
```

**PaginationControls Features**:
- MUI `TablePagination` component (island design with border-top)
- Rows per page dropdown (default: 10, 20, 50, 100)
- Page navigation: First / Previous / Next / Last buttons
- Display info: "1–20 of 157" with i18n support
- 0-based (MUI) ↔ 1-based (usePaginated) conversion handled internally
- Fully localized via `common:pagination.*` keys
- Wrapped in Box with negative margin for alignment with content
- **Mobile responsive**: "Rows per page" label and left spacing hidden on mobile (< 600px) to prevent horizontal scroll and optimize layout
- **Consistent spacing**: 8px spacing between dropdown, display text, and navigation buttons for visual harmony

### Backend API Requirements

**Query Parameters**:
- `limit` (number): Items per page
- `offset` (number): Pagination offset
- `sortBy` (string): Sort field (name, created, updated)
- `sortOrder` ('asc' | 'desc'): Sort direction
- `search` (string, optional): Search query

**Response Headers**:
- `X-Pagination-Limit`: Applied limit
- `X-Pagination-Offset`: Applied offset
- `X-Pagination-Count`: Items in current response
- `X-Total-Count`: Total items count
- `X-Pagination-Has-More`: More pages available (true/false)

**Example Backend Implementation** (packages/metaverses-srv):

```typescript
// Parse parameters with validation
const limit = parseIntSafe(req.query.limit, 100, 1, 1000)
const offset = parseIntSafe(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER)
const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''

// Safe sorting with whitelist
const ALLOWED_SORT_FIELDS = {
    name: 'm.name',
    created: 'm.createdAt',
    updated: 'm.updatedAt'
}
const sortBy = req.query.sortBy in ALLOWED_SORT_FIELDS 
    ? ALLOWED_SORT_FIELDS[req.query.sortBy]
    : 'm.updatedAt'
const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC'

// Query with search filter (case-insensitive)
const qb = repo.createQueryBuilder('m')
if (search) {
    qb.andWhere('(LOWER(m.name) LIKE :search OR LOWER(m.description) LIKE :search)', {
        search: `%${search.toLowerCase()}%`
    })
}
qb.orderBy(sortBy, sortOrder).limit(limit).offset(offset)

const items = await qb.getMany()
const total = await countQb.getCount() // Always calculate total

// Set pagination headers
res.setHeader('X-Pagination-Limit', limit.toString())
res.setHeader('X-Pagination-Offset', offset.toString())
res.setHeader('X-Total-Count', total.toString())
res.setHeader('X-Pagination-Has-More', (offset + items.length < total).toString())

res.json(items)
```

### Query Keys Factory Pattern

```typescript
// packages/metaverses-frt/base/src/api/queryKeys.ts
export const metaversesQueryKeys = {
    all: ['metaverses'] as const,
    lists: () => [...metaversesQueryKeys.all, 'list'] as const,
    list: (params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metaversesQueryKeys.lists(), normalized] as const
    },
    detail: (id: string) => [...metaversesQueryKeys.all, 'detail', id] as const
}
```

### Cache Invalidation

```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

// After create/update/delete operations
await queryClient.invalidateQueries({
    queryKey: metaversesQueryKeys.lists() // Invalidates all list queries
})
```

### i18n Multi-Namespace Pattern

**Component Translation Setup**:
```typescript
const { t } = useTranslation(['metaverses', 'common', 'roles', 'access', 'flowList'], { i18n })

// Feature-specific keys (default namespace, no prefix)
t('metaverses.title')                  // → "Metaverses"
t('metaverses.noMetaversesFound')      // → "No metaverses found"

// Common UI elements (explicit namespace)
t('common:addNew')                     // → "Add New"
t('common:table.role')                 // → "Role"
t('common:pagination.rowsPerPage')     // → "Rows per page"

// Role translations (explicit namespace)
t('roles:owner')                       // → "Owner"
t('roles:admin')                       // → "Administrator"

// FlowListTable uses flowList namespace
<FlowListTable i18nNamespace='flowList' />
// Internally: t('flowList:table.columns.name') → "Name"
```

**Custom Columns with Multi-Namespace**:
```typescript
const metaverseColumns = useMemo(
    () => [
        {
            id: 'description',
            label: t('common:table.description'),  // Shared label
            render: (row) => row.description || '—'
        },
        {
            id: 'role',
            label: t('common:table.role'),         // Shared label
            render: (row) => t(`roles:${row.role}`) // Dynamic role translation
        },
        {
            id: 'sections',
            label: t('common:table.sections'),     // Shared label
            render: (row) => row.sectionsCount ?? '—'
        }
    ],
    [t]
)
```

### UX Features

**Keyboard Shortcuts**:
- `Ctrl+F` / `Cmd+F` - Focus search input (built into ViewHeader)

**Responsive Layout**:
- Search visible on desktop (325px width)
- Hidden on mobile (< sm breakpoint)
- Card grid responsive (1 column → auto-fill)
- Pagination sticky to bottom
- **Pagination mobile-optimized**: "Rows per page" label and left spacing hidden on mobile (< 600px) for compact layout

**Loading States**:
- Skeleton grid for initial load
- Pagination shows during refetch (disabled state)
- Smooth transitions between states

**Pagination UX**:
- Bottom position (standard pattern for tables)
- Rows per page selector: 10 / 20 / 50 / 100
- First / Previous / Next / Last navigation
- Display: "1–20 of 157" with full i18n

### Benefits

- ✅ **Consistent UX**: Same behavior across all list views
- ✅ **Server-side Performance**: Pagination + search on backend
- ✅ **Debounced Search**: 300ms delay reduces API calls
- ✅ **Automatic Caching**: TanStack Query handles cache
- ✅ **Type Safety**: Generic `usePaginated<T>` with type inference
- ✅ **Keyboard Shortcuts**: Built-in Ctrl+F / Cmd+F support
- ✅ **Dynamic Page Size**: User-controlled rows per page
- ✅ **Multi-Namespace i18n**: Reusable translations across features
- ✅ **Bottom Pagination**: Standard table pagination UX

### Migration Steps (Existing Lists → Universal Pattern)

1. **Add usePaginated Hook**
   - Replace `useState` + `useEffect` with `usePaginated`
   - Remove manual pagination state
   - Use `initialLimit` instead of deprecated `limit` parameter

2. **Add useDebouncedSearch Hook** (NEW - 2025-01-29)
   - Replace custom debounce logic with `useDebouncedSearch` hook
   - Remove old `useState('')` + `useEffect` setTimeout pattern
   - Configure `delay: 300` and `onSearchChange` callback
   - Delete any `// eslint-disable-next-line react-hooks/exhaustive-deps` comments

3. **Update ViewHeader**
   - Enable `search={true}`
   - Add `searchValue={searchValue}` from hook
   - Add `onSearchChange={handleSearchChange}` from hook
   - Remove old pagination controls from header

4. **Add PaginationControls**
   - Position at bottom of content (after card/list view)
   - Wrap in Box with `sx={{ mx: { xs: -1.5, md: -2 } }}` for alignment
   - Set `namespace='common'`
   - Configure `rowsPerPageOptions={[10, 20, 50, 100]}`

5. **Update FlowListTable**
   - Set `i18nNamespace='flowList'` prop
   - Ensure custom columns use multi-namespace pattern

6. **Verify Backend API**
   - Ensure query params support
   - Verify response headers
   - Test search filter

7. **Test End-to-End**
   - Search debounce works (300ms delay)
   - Pagination navigation
   - Rows per page selector
   - Sort changes
   - CRUD operations + cache invalidation

**Code Comparison (Old vs New)**:
```typescript
// ❌ OLD: Custom debounce with eslint-disable
const [localSearch, setLocalSearch] = useState('')
useEffect(() => {
    const timer = setTimeout(() => {
        paginationResult.actions.setSearch(localSearch)
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [localSearch])

// ✅ NEW: Reusable hook with library backing
const { searchValue, handleSearchChange } = useDebouncedSearch({
    onSearchChange: paginationResult.actions.setSearch,
    delay: 300
})
```

### Reference Implementations

**Primary**: `packages/metaverses-frt/base/src/pages/MetaverseList.tsx`

**To Migrate**:
- `packages/uniks-frt/base/src/pages/UnikList.jsx` → Copy MetaverseList pattern
- `packages/spaces-frt/base/src/pages/SpacesList.tsx` → Apply pattern
- Other entity lists as needed

**Documentation**:
- TanStack Query v5: https://tanstack.com/query/latest
- usePaginated Hook: `packages/universo-template-mui/base/src/hooks/usePaginated.ts`
- **useDebouncedSearch Hook**: `packages/universo-template-mui/base/src/hooks/useDebouncedSearch.ts` (NEW - 2025-01-29)
- PaginationControls: `packages/universo-template-mui/base/src/components/pagination/PaginationControls.tsx`
- Multi-Namespace i18n: See "Multi-Namespace i18n Pattern" section above
- use-debounce Library: https://www.npmjs.com/package/use-debounce

---

## Development Principles

### Architecture Patterns

**Editor-Format-Export-Deploy**: Flowise UI → UPDL JSON → Template System → Published Applications

**Modular Communication**: Clear interfaces via UPDL JSON, platform abstraction through unified exporters

### Code Standards

-   **Documentation**: Prefix comments with "Universo Platformo |", concise English documentation
-   **Localization**: Modular i18n with namespace separation (`packages/<app>/i18n/`)
-   **Workspace Packages**: Scoped packages (`@universo/package-name`) for backend services

### Future-Ready Design

-   Workspace packages extractable to separate repositories
-   Microservices architecture evolution support
-   Easy addition of new technologies and node types

---

_For detailed application structure and development guidelines, see [packages/README.md](../packages/README.md). For technical implementation details, see [techContext.md](techContext.md). For project overview, see [projectbrief.md](projectbrief.md)._

---

## TypeScript Migration Patterns (2025-01-31)

### Generic Component Pattern

**Purpose**: Create reusable components with type-safe generic data structures

**Pattern**: Generic type parameter with extends constraint
```typescript
export interface ItemCardData {
    iconSrc?: string
    color?: string
    templateName?: string
    name?: string
    description?: string
    [key: string]: any  // Allow additional properties
}

export interface ItemCardProps<T extends ItemCardData = ItemCardData> {
    data: T
    images?: any[]
    onClick?: () => void
    allowStretch?: boolean
    footerEndContent?: React.ReactNode
    headerAction?: React.ReactNode
    sx?: SxProps<Theme>
}

export const ItemCard = <T extends ItemCardData = ItemCardData>({
    data,
    images,
    onClick,
    ...rest
}: ItemCardProps<T>): React.ReactElement => {
    // Component implementation
}
```

**Benefits**:
- ✅ Type inference for specific data structures
- ✅ Autocomplete for data properties
- ✅ Reusable across multiple entity types (Metaverses, Uniks, Spaces)
- ✅ Default generic parameter for simple usage

**Usage Examples**:
```typescript
// Simple usage (uses default ItemCardData)
<ItemCard data={metaverse} onClick={() => navigate(`/metaverses/${metaverse.id}`)} />

// Type-safe usage with custom data type
interface MetaverseData extends ItemCardData {
    sectionsCount: number
    role: BaseRole
}

<ItemCard<MetaverseData>
    data={metaverse}
    onClick={() => navigate(`/metaverses/${metaverse.id}`)}
    footerEndContent={<Chip label={`${metaverse.sectionsCount} sections`} />}
/>
```

### ForwardRef Pattern with TypeScript

**Purpose**: Create ref-forwarding components with proper TypeScript typing

**Pattern**: forwardRef with explicit ref and props types
```typescript
export interface MainCardProps extends Omit<CardProps, 'children' | 'title' | 'content'> {
    border?: boolean
    boxShadow?: boolean
    children?: React.ReactNode
    content?: boolean
    contentSX?: SxProps<Theme>
    darkTitle?: boolean
    disableContentPadding?: boolean
    disableHeader?: boolean
    secondary?: React.ReactNode
    shadow?: string | false
    title?: React.ReactNode
}

export const MainCard = forwardRef<HTMLDivElement, MainCardProps>(
    function MainCard({ children, border, boxShadow, ...rest }, ref) {
        return <Card ref={ref} {...rest}>{children}</Card>
    }
)
```

**Key Points**:
- ✅ Use `Omit<CardProps, 'conflictingProp'>` to exclude conflicting properties
- ✅ Explicit function name in forwardRef for React DevTools
- ✅ Separate type and component exports
- ✅ Ref type matches underlying DOM element

**Common Pitfalls**:
```typescript
// ❌ WRONG: Union with Record<string, any> causes ReactNode conflict
interface Props {
    title?: React.ReactNode | Record<string, any>  // Error!
}

// ✅ CORRECT: Remove Record<string, any> from union
interface Props {
    title?: React.ReactNode
}

// ❌ WRONG: Property conflict with base interface
interface Props extends CardProps {
    content?: boolean  // Error: CardProps.content is string | undefined
}

// ✅ CORRECT: Exclude conflicting properties with Omit
interface Props extends Omit<CardProps, 'content'> {
    content?: boolean
}
```

### Generic Table Column Pattern

**Purpose**: Type-safe table columns with custom render functions

**Pattern**: Generic column interface with render callback
```typescript
export interface FlowListTableData {
    id: string
    name?: string
    templateName?: string
    updatedDate?: string
    updated_at?: string
    updatedAt?: string
    updatedOn?: string
    [key: string]: any
}

export interface TableColumn<T extends FlowListTableData> {
    id: string
    label?: React.ReactNode
    width?: string | number
    align?: 'inherit' | 'left' | 'center' | 'right' | 'justify'
    render?: (row: T, index: number) => React.ReactNode
}

export interface FlowListTableProps<T extends FlowListTableData = FlowListTableData> {
    data?: T[]
    customColumns?: TableColumn<T>[]
    renderActions?: (row: T) => React.ReactNode
    // ... other props
}

export const FlowListTable = <T extends FlowListTableData = FlowListTableData>({
    data,
    customColumns,
    ...rest
}: FlowListTableProps<T>): React.ReactElement => {
    // Table implementation
}
```

**Benefits**:
- ✅ Type-safe column definitions
- ✅ Autocomplete in render functions
- ✅ Flexible row data structure
- ✅ Reusable across different entity types

**Usage Example**:
```typescript
interface MetaverseRow extends FlowListTableData {
    description?: string
    role: BaseRole
    sectionsCount: number
}

const metaverseColumns: TableColumn<MetaverseRow>[] = [
    {
        id: 'description',
        label: t('common:table.description'),
        render: (row) => row.description || '—'  // row is MetaverseRow
    },
    {
        id: 'role',
        label: t('common:table.role'),
        render: (row) => <RoleChip role={row.role} />  // Type-safe access
    },
    {
        id: 'sections',
        label: t('common:table.sections'),
        render: (row) => row.sectionsCount ?? '—'  // Type-safe property
    }
]

<FlowListTable<MetaverseRow>
    data={metaverses}
    customColumns={metaverseColumns}
/>
```

### MUI Theme Type Extension Pattern

**Purpose**: Use custom MUI theme properties without TypeScript errors

**Pattern**: Type assertion for non-standard theme properties
```typescript
import { alpha, styled, Theme } from '@mui/material/styles'

// Custom theme property not in MUI types
const borderColor = (theme as any).vars?.palette?.outline ?? alpha(theme.palette.text.primary, 0.08)

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: (theme as any).vars?.palette?.outline ?? alpha(theme.palette.text.primary, 0.08),
    // ... other styles
}))
```

**Why This Works**:
- MUI v6 uses CSS variables system with `theme.vars`
- Standard TypeScript types don't include all CSS variable properties
- `as any` type assertion bypasses type checking for custom properties
- Fallback ensures graceful degradation if property doesn't exist

**Alternative (Type Declaration)**:
```typescript
// For frequently used custom properties, extend the Theme interface
declare module '@mui/material/styles' {
    interface PaletteVars {
        outline?: string
    }
}

// Then use without type assertion
const borderColor = theme.vars?.palette.outline ?? alpha(theme.palette.text.primary, 0.08)
```

### Migration Checklist

**Phase 1: Type Definitions**
- [ ] Create TypeScript interfaces for component props
- [ ] Define generic type parameters with extends constraints
- [ ] Add proper JSDoc comments for complex types
- [ ] Export types from component files

**Phase 2: Component Migration**
- [ ] Rename `.jsx` → `.tsx`
- [ ] Add type annotations to props destructuring
- [ ] Replace `PropTypes` with TypeScript interfaces
- [ ] Fix MUI theme type issues with appropriate patterns
- [ ] Handle forwardRef with explicit types

**Phase 3: Build Configuration**
- [ ] Add TypeScript compilation to build pipeline
- [ ] Update package.json exports to include type declarations
- [ ] Verify dual CJS/ESM build output
- [ ] Test type imports in consuming packages

**Phase 4: Integration Testing**
- [ ] Build package in isolation (`pnpm --filter <package> build`)
- [ ] Verify consuming packages can import types
- [ ] Run full workspace build (`pnpm build`)
- [ ] Check for any TypeScript errors in dependents

**Phase 5: Documentation**
- [ ] Update package README with TypeScript usage examples
- [ ] Document generic type parameters
- [ ] Add JSDoc comments for exported functions
- [ ] Update systemPatterns.md with migration notes

### Migration Results (2025-01-31)

**Migrated Components** (packages/universo-template-mui):
1. **ItemCard.jsx → ItemCard.tsx** (230 lines)
   - Generic type: `<T extends ItemCardData>`
   - Exported types: `ItemCardData`, `ItemCardProps<T>`
   - Build: SUCCESS (1130ms)

2. **MainCard.jsx → MainCard.tsx** (94 lines)
   - ForwardRef pattern with proper typing
   - Omit conflicts: `Omit<CardProps, 'children' | 'title' | 'content'>`
   - Exported types: `MainCardProps`
   - Build: SUCCESS (1190ms)

3. **FlowListTable.jsx → FlowListTable.tsx** (389 lines)
   - Generic type: `<T extends FlowListTableData>`
   - Custom columns: `TableColumn<T>[]`
   - Exported types: `FlowListTableData`, `TableColumn<T>`, `FlowListTableProps<T>`
   - MUI theme fix: `(theme as any).vars?.palette?.outline`
   - Build: SUCCESS (1242ms)

**Created Type Definitions**:
- `packages/flowise-template-mui/base/src/hooks/formatDate.d.ts` - TypeScript declarations for formatDate utility

**Full Workspace Build**: SUCCESS (3m 35s, all 30 packages)

**Key Achievements**:
- ✅ Zero TypeScript errors
- ✅ Dual CJS/ESM builds working
- ✅ Type exports available to consumers
- ✅ Generic patterns reusable across entity types
- ✅ MUI theme compatibility maintained

---

## Universal Role System Pattern (2025-01-19)

**Pattern**: Centralized role types in `@universo/types` with reusable RoleChip component for consistent UI representation.

**Structure**:
```
packages/
├── universo-types/base/src/common/roles.ts     # Single source of truth
├── universo-template-mui/base/src/
│   └── components/chips/RoleChip.tsx          # Reusable UI component
└── metaverses-frt, metaverses-srv, flowise-server
    └── Import role types from @universo/types
```

**Core Types** (`@universo/types`):
```typescript
// Base role hierarchy (used by all entity types)
export const BASE_ROLES = ['owner', 'admin', 'editor', 'member'] as const
export type BaseRole = typeof BASE_ROLES[number]

export const ROLE_HIERARCHY: Record<BaseRole, number> = {
    owner: 4, admin: 3, editor: 2, member: 1
}

// Entity-specific role types
export type MetaverseRole = BaseRole
export type UnikRole = BaseRole
export type SectionRole = Exclude<BaseRole, 'owner'>
export type EntityRole = 'viewer' | 'editor'

// Utilities
export function getRoleLevel(role: BaseRole): number
export function hasRequiredRole(actual: BaseRole, allowed: BaseRole[]): boolean
export function canManageRole(managerRole: BaseRole, targetRole: BaseRole): boolean
```

**RoleChip Component** (`@universo/template-mui`):
```typescript
import { RoleChip } from '@universo/template-mui'

<RoleChip role={member.role} size="small" />
```

**Color Mapping**:
- `owner` → `error` (red) - Highest permission level
- `admin` → `warning` (orange) - Administrative access
- `editor` → `info` (blue) - Content editing rights
- `member` → `default` (grey) - Basic access

**i18n Integration**: Uses `roles` namespace from `@universo/i18n`:
```json
// en/core/roles.json
{
  "owner": "Owner",
  "admin": "Administrator",
  "editor": "Editor",
  "member": "Member"
}
```

**Usage Examples**:

1. **Frontend Display**:
```typescript
import { useTranslation } from 'react-i18next'
import { RoleChip } from '@universo/template-mui'
import type { MetaverseRole } from '@universo/types'

<TableCell>
  <RoleChip role={row.role} />
</TableCell>
```

2. **Backend Permission Checks**:
```typescript
import { hasRequiredRole, getRoleLevel } from '@universo/types'

// Check if user has required role
if (!hasRequiredRole(userRole, ['admin', 'owner'])) {
  throw new ForbiddenError()
}

// Compare role levels
if (getRoleLevel(managerRole) <= getRoleLevel(targetRole)) {
  throw new Error('Cannot manage role at same or higher level')
}
```

**Benefits**:
- ✅ Zero role type duplication across packages
- ✅ Consistent color mapping throughout UI
- ✅ Type-safe role comparisons and checks
- ✅ i18n support out of the box
- ✅ Single source of truth for role hierarchy

**Affected Packages** (3):
- `@universo/types` - Core role definitions
- `@universo/template-mui` - RoleChip UI component
- `@universo/metaverses-frt`, `@universo/metaverses-srv`, `flowise-server` - Role type imports

---

## JSX→TSX Migration Pattern (2025-10-31)

**Pattern**: Migrate legacy JSX components with PropTypes to modern TypeScript with generics for full type safety and IDE support.

**Before** (Legacy Pattern - Deprecated):
```javascript
// ItemCard.jsx
import PropTypes from 'prop-types'

function ItemCard({ title, data, onClick }) {
    // ... implementation
}

ItemCard.propTypes = {
    title: PropTypes.node,
    data: PropTypes.object,
    onClick: PropTypes.func
}

export default ItemCard
```

**After** (Modern Pattern - Recommended):
```typescript
// ItemCard.tsx
import React from 'react'

// Generic data interface with common fields
export interface ItemCardData {
    id: string
    name?: string
    [key: string]: any
}

export interface ItemCardProps<T extends ItemCardData = ItemCardData> {
    title?: React.ReactNode
    data: T
    onClick?: (data: T) => void
    sx?: SxProps<Theme>
}

export function ItemCard<T extends ItemCardData = ItemCardData>({
    title,
    data,
    onClick,
    sx
}: ItemCardProps<T>): React.ReactElement {
    const handleClick = () => {
        if (onClick && data) {
            onClick(data)
        }
    }

    return (
        <Card onClick={handleClick} sx={sx}>
            {title && <CardHeader title={title} />}
            <CardContent>{/* ... */}</CardContent>
        </Card>
    )
}
```

**Key Improvements**:

1. **Generic Types** - Full type safety for data parameter:
   ```typescript
   // Usage with custom data type
   interface MetaverseData extends ItemCardData {
       sectionsCount: number
       entitiesCount: number
   }
   
   <ItemCard<MetaverseData>
       data={metaverse}
       onClick={(data) => {
           // `data` is typed as MetaverseData
           console.log(data.sectionsCount)
       }}
   />
   ```

2. **No Runtime Overhead** - PropTypes checked at runtime, TypeScript types stripped after compilation:
   ```typescript
   // ✅ NEW: Compile-time type checking (zero runtime cost)
   <ItemCard data={{ id: '1', name: 'Test' }} />
   
   // ❌ OLD: PropTypes validation runs on every render
   ItemCard.propTypes = { /* ... */ }
   ```

3. **MUI Theme Integration** - Proper `SxProps` typing for theme-aware styles:
   ```typescript
   export interface ItemCardProps<T> {
       sx?: SxProps<Theme>  // Full autocomplete for theme properties
   }
   ```

4. **forwardRef Pattern** - For components needing ref forwarding (e.g., MainCard):
   ```typescript
   export const MainCard = React.forwardRef<HTMLDivElement, MainCardProps>(
       function MainCard({ children, title, ...others }, ref) {
           return <Card ref={ref} {...others}>{/* ... */}</Card>
       }
   )
   
   MainCard.displayName = 'MainCard'  // DevTools friendly
   ```

**Migration Checklist**:

- [x] Rename `.jsx` → `.tsx`
- [x] Replace `PropTypes` with TypeScript interfaces
- [x] Add generic type parameters where data is passed
- [x] Update MUI imports to use `type` keyword: `import type { SxProps, Theme } from '@mui/material'`
- [x] Use `React.ReactNode` instead of `PropTypes.node`
- [x] Use `React.ReactElement` for component return types
- [x] Add `forwardRef` if component accepts `ref` prop
- [x] Export both component and props interface
- [x] Delete `.d.ts` type declaration files (no longer needed)

**Benefits**:
- ✅ Full IDE autocomplete for props
- ✅ Compile-time type checking (no runtime errors)
- ✅ Generic types for reusability
- ✅ No runtime PropTypes overhead
- ✅ Better refactoring support (find all references, rename symbol)
- ✅ Tree-shaking friendly (unused props removed)

**Migrated Components** (3):
- `ItemCard.tsx` - Generic card with icon, title, description, footer
- `MainCard.tsx` - Main content wrapper with header, divider, content
- `FlowListTable.tsx` - Generic table with sorting, columns, actions (402 LOC)

---

_For detailed application structure and development guidelines, see [packages/README.md](../packages/README.md). For technical implementation details, see [techContext.md](techContext.md). For project overview, see [projectbrief.md](projectbrief.md)._
