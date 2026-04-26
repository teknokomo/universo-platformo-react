# @universo/metahubs-frontend

> 🏗️ **Modern Package** - TypeScript-first architecture with dual build system

Frontend package for entity-first metahub authoring, shared resources, and dynamic runtime navigation in the Universo Platformo ecosystem.

## Package Information

- **Package**: `@universo/metahubs-frontend`
- **Version**: `0.1.0`
- **Type**: React Frontend Package (Modern)
- **Framework**: React 18 + TypeScript + Material-UI
- **Build System**: tsdown (dual build - CJS + ESM)
- **Testing**: Vitest + React Testing Library

## Key Features

### 🌍 Metahub Management
- **Entity-First Navigation**: Metahubs expose board, resources, entities, and nested entity-owned authoring flows
- **Complete Data Isolation**: Data from different metahubs is completely separated
- **Role-Based Access**: User roles and permissions for metahub access control
- **Context-Aware Navigation**: Metahub-aware routing with breadcrumbs and sidebar preservation

### 🗂️ Entity Types & Shared Resources
- **Entity Types**: Platform-provided standard kinds and custom kinds share the same authoring workspace
- **Tree Entities**: Hierarchical containers drive nested authoring and publication-aware navigation
- **Linked Collections**: Reusable schema/data surfaces stay on entity-owned child routes
- **Shared Resources**: Common layouts, metadata pools, and scripts stay available on the dedicated `/resources` surface
- **Data-Driven Resource Labels**: Resource tabs resolve their titles from persisted entity type `ui.resourceSurfaces[].title` metadata instead of frontend hardcoded standard labels

### 🎨 User Interface
- **Material-UI Integration**: Consistent UI components with modern design system
- **Responsive Design**: Optimized for desktop and mobile experiences
- **Table & Grid Views**: Flexible data presentation with pagination and search
- **Dialog Forms**: Modal forms for creating and editing entities

### 🔧 Technical Features
- **TypeScript-First**: Full TypeScript implementation with strict typing
- **React Query Integration**: Advanced data fetching and caching
- **Internationalization**: English and Russian translations with i18next
- **Form Validation**: Comprehensive validation with Zod schemas
- **API Integration**: RESTful API client with authentication

### 🧩 Standard Metadata Entity Routes
- **Entities Workspace**: Platform-provided standard kinds and custom kinds are authored from the unified entities workspace and published through the dynamic metahub menu.
- **Unified Authoring**: Standard and custom entity types share the same workspace actions and generic entity route contract.
- **Resource Surface Editing**: Standard resource surface titles are edited with the same localized field controls used by other entity metadata; standard structural fields remain protected.
- **Entity-Owned Surfaces**: Standard kinds render through entity-owned route components, while shared resources remain on the dedicated `/resources` surface.
- **Route Ownership**: Detail tabs stay under `/metahub/:id/entities/:kindKey/...`, and metahub resources stay under `/metahub/:id/resources/...`; removed top-level `/hubs`, `/catalogs`, `/sets`, and `/enumerations` authoring routes are no longer part of the shipped frontend contract.
- **Runtime Boundary**: Runtime sections materialize from published entity metadata after publication sync instead of V2-specific compatibility aliases.

### 📋 Template Selection
- **TemplateSelector Component**: Dropdown selector for choosing metahub templates during creation
- **Templates API**: Fetches available templates via `GET /templates` endpoint
- **TanStack Query Hook**: `useTemplates()` hook with caching and loading states
- **Default Template**: When no template is explicitly selected, the default "basic" template is auto-assigned by the backend

## Installation & Setup

### Prerequisites
```bash
# System requirements
Node.js >= 18.0.0
PNPM >= 8.0.0
```

### Installation
```bash
# Install dependencies
pnpm install

# Build the package
pnpm --filter @universo/metahubs-frontend build

# Run in development mode
pnpm --filter @universo/metahubs-frontend dev
```

### Integration
```tsx
// Import components in your React application
import { 
  MetahubList, 
  MetahubBoard, 
  MetahubResources,
  StandardEntityCollectionPage,
  StandardEntityChildCollectionPage,
  FieldDefinitionList,
  RecordList,
  metahubsDashboard 
} from '@universo/metahubs-frontend'

// Import i18n resources
import { metahubsTranslations } from '@universo/metahubs-frontend'

// Example route registration
<Route path="/metahubs" element={<MetahubList />} />
<Route path="/metahub/:id/board" element={<MetahubBoard />} />
<Route path="/metahub/:id/resources" element={<MetahubResources />} />
<Route path="/metahub/:id/entities/:kindKey/instances" element={<StandardEntityCollectionPage />} />
<Route path="/metahub/:id/entities/:kindKey/instance/:entityId/instances" element={<StandardEntityChildCollectionPage />} />
<Route path="/metahub/:id/entities/:kindKey/instance/:entityId/field-definitions" element={<FieldDefinitionList />} />
<Route path="/metahub/:id/entities/:kindKey/instance/:entityId/records" element={<RecordList />} />
```

## Architecture

### Entity-First Route Model
```
Metahub
  ├── Shared Resources (/resources)
  │   ├── Layouts / metadata pools / scripts
  │   └── Reusable authoring surfaces for platform-wide assets
  └── Entity Type (/entities/:kindKey)
      └── Entity Instance (/entities/:kindKey/instance/:entityId)
          ├── Field definitions / records / layout
          └── Nested child collections (/instance/:entityId/instances)
```

### Key Concepts
- **Metahubs**: Top-level organizational units providing complete data isolation
- **Shared Resources**: Common layouts, metadata pools, and reusable scripts available under the dedicated `/resources` surface
- **Entity Types**: Platform-provided standard kinds and custom kinds published through the unified entities workspace
- **Entity Instances**: Design-time objects authored on generic entity routes with role-aware actions
- **Child Resources**: Field definitions, records, and standard child collections mounted under entity-owned routes

### Data Isolation Strategy
- Complete separation between metahubs - no cross-metahub visibility
- All operations maintain metahub context through URL routing
- Frontend and backend validation preventing orphaned entities
- Role-based access control for metahub permissions

## File Structure

```
packages/metahubs-frontend/base/
├── __mocks__/            # Test doubles for focused frontend slices
├── __tests__/            # Package-level smoke and export tests
├── src/
│   ├── components/       # Shared metahub-specific UI building blocks
│   ├── view-preferences/  # View preference storage keys and helpers
│   ├── domains/          # Entity-first feature domains and screens
│   │   ├── branches/     # Branch management routes and UI
│   │   ├── entities/     # Entity types, instances, metadata, actions, events
│   │   ├── layouts/      # Layout authoring and widget composition
│   │   ├── metahubs/     # Metahub list, board, create, and members UX
│   │   ├── migrations/   # Migration guard and migration-status UX
│   │   ├── publications/ # Publication authoring and published data surfaces
│   │   ├── scripts/      # Script editor and bundle authoring flows
│   │   ├── settings/     # Metahub settings, permissions, and helpers
│   │   ├── shared/       # Cross-domain API helpers, query keys, shared UI
│   │   └── templates/    # Template selection and preset-aware create flows
│   ├── hooks/            # Package-level shared React hooks
│   ├── i18n/             # EN/RU translations for metahubs UI
│   ├── menu-items/       # Sidebar navigation descriptors
│   ├── utils/            # Local helpers and adapters
│   ├── displayConverters.ts
│   ├── types.ts
│   └── index.ts          # Public package exports
├── dist/                 # Compiled output (CJS, ESM, types)
├── package.json
├── tsconfig.json
├── tsdown.config.ts      # Build configuration
├── vitest.config.ts      # Test configuration
├── README.md             # This file
└── README-RU.md          # Russian documentation
```

## Core Components

### MetahubList
Main component for displaying and managing metahubs:

```tsx
import { MetahubList } from '@universo/metahubs-frontend'

// Features:
// - Paginated table view with search functionality
// - Create, edit, delete operations
// - Role-based access control
// - Responsive design with Material-UI
```

### MetahubBoard
Dashboard component for metahub analytics:

```tsx
import { MetahubBoard } from '@universo/metahubs-frontend'

// Features:
// - Metahub-specific dashboard
// - Statistics cards (entities, branches, members)
// - Interactive data visualization
```

### StandardEntityCollectionPage
Entity-owned component for rendering standard metadata instances through a single dynamic route surface:

```tsx
import { StandardEntityCollectionPage } from '@universo/metahubs-frontend'

// Features:
// - Single route surface for platform-provided standard entity instances
// - Uses the route kind key instead of per-kind exported page components
// - Keeps the standard metadata authoring contract inside the entity workspace
```

### StandardEntityChildCollectionPage
Entity-owned component for rendering nested standard collections from a parent entity context:

```tsx
import { StandardEntityChildCollectionPage } from '@universo/metahubs-frontend'

// Features:
// - Generic child collection entrypoint for nested standard entity collections
// - Keeps nested authoring routes on the entity-owned path surface
// - Removes the need for separate per-kind public page exports
```

### FieldDefinitionList / RecordList
Components for managing entity-owned metadata and records:

```tsx
import { FieldDefinitionList, RecordList } from '@universo/metahubs-frontend'

// Features:
// - Field-definition ordering (drag & drop)
// - Dynamic record forms based on field definitions
// - Data type support (string, with extensibility)
```

### TemplateSelector
Component for selecting a metahub template during creation:

```tsx
import { TemplateSelector } from '@universo/metahubs-frontend'

// Features:
// - Fetches available templates via useTemplates() hook
// - Dropdown with template name, description, and version
// - Integrated into MetahubList create dialog
// - Loading and empty states handled
```

### ColumnsContainerEditorDialog
Visual editor for managing multi-column layouts with drag-and-drop:

```tsx
import { ColumnsContainerEditorDialog } from '@universo/metahubs-frontend'

// Features:
// - Visual editor for ColumnsContainerConfig (multi-column grid layouts)
// - Drag-and-drop column reordering via @dnd-kit (SortableContext + DragEndEvent)
// - Per-column width slider (1–12 grid units, MUI 12-column grid)
// - Per-column widget list: add/remove center-zone widgets (max MAX_WIDGETS_PER_COLUMN=6)
// - Max columns: MAX_COLUMNS=6 per container
// - Save-time validation: strips nested columnsContainer widgetKey to prevent recursion
// - Dirty tracking with isDirty memo (JSON snapshot comparison)
// - UUID v7 generation for new column IDs via generateUuidV7()
```

### MetahubMigrationGuard

Route guard component that blocks navigation when metahub migrations are pending. Uses `MigrationGuardShell` from `@universo/migration-guard-shared` for shared guard logic.

> **Full documentation**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)

## API Integration

This package focuses on UI components and does not expose a public API client.
If you need programmatic access, call the backend endpoints directly.

### Example (custom client)
```typescript
import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })
const { data } = await api.get('/metahubs')
const { data: metahub } = await api.get('/metahub/123')
```

### React Query Example
```typescript
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })

function useMetahubs() {
  return useQuery({
    queryKey: ['metahubs', 'list'],
    queryFn: async () => (await api.get('/metahubs')).data
  })
}
```

## Development

### Prerequisites
- Node.js 18+
- pnpm 8+
- TypeScript 5+

### Available Scripts
```bash
# Development
pnpm dev              # Start development server
pnpm build            # Build for production (dual CJS/ESM)
pnpm build:watch      # Build in watch mode

# Testing
pnpm test             # Run Vitest test suite
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Generate coverage report

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint issues
pnpm type-check       # TypeScript type checking
```

### Build System
This package uses `tsdown` for dual-build output:
- **CommonJS**: `dist/index.js` (for legacy compatibility)
- **ES Modules**: `dist/index.mjs` (for modern bundlers)
- **Types**: `dist/index.d.ts` (TypeScript declarations)

## Testing

### Test Structure
```
src/
├── __tests__/
│   ├── exports.test.ts
│   └── ...
├── api/__tests__/
├── hooks/__tests__/
└── pages/__tests__/
```

### Running Tests
```bash
pnpm test                    # Run all tests
pnpm test:watch              # Watch mode
pnpm test:coverage           # With coverage
pnpm test -- --reporter=verbose  # Verbose output
```

## Configuration

### Environment Variables
```bash
# API Configuration
VITE_API_URL=http://localhost:3000
VITE_API_VERSION=v1

# Authentication
VITE_AUTH_ENABLED=true
VITE_AUTH_PROVIDER=supabase
```

### TypeScript Configuration
The package uses strict TypeScript configuration:
- Strict null checks enabled
- No implicit any types
- Strict function types
- All compiler strict options enabled

## Contributing

### Code Style
- Follow ESLint configuration
- Use Prettier for formatting
- Prefer TypeScript over JavaScript
- Use functional components with hooks

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes with tests
3. Update documentation
4. Run full test suite
5. Submit PR with description

### Commit Convention
Follow conventional commits:
```bash
feat(metahubs): add search functionality
fix(api): handle empty response
docs(readme): update installation guide
```

## Related Packages
- [`@universo/metahubs-backend`](../../metahubs-backend/base/README.md) - Backend service
- [`@universo/template-mui`](../../universo-template-mui/base/README.md) - UI components
- [`@universo/types`](../../universo-types/base/README.md) - Shared types

## Shared Abstractions

### Component Decomposition Pattern

Each List component is split into three layers:
1. **List component** (`domains/<domain>/ui/<Domain>List.tsx`) — UI rendering, dialogs, actions.
2. **Data hook** (`domains/<domain>/hooks/use<Domain>ListData.ts`) — React Query logic, pagination, data transforms.
3. **Utilities** (`domains/<domain>/ui/<domain>ListUtils.ts`) — helper functions for formatting, filtering, sorting.

### `createDomainErrorHandler()`

Factory for mapping backend error codes to localized snackbar messages. Eliminates repetitive if/else chains in mutation `onError` callbacks:

```ts
const handleError = createDomainErrorHandler({
    LIMIT_REACHED: (data, t) => t('attributes.limitReached', { limit: data.limit }),
})

// In mutation: handleError(error, t, enqueueSnackbar, 'attributes.createError')
```

### `createSimpleDeleteMutation()`

Configurable factory for standard delete mutation hooks with optimistic delete, rollback, snackbar notifications, and cache invalidation.

### `useListDialogs()`

Generic `useReducer`-based hook managing five dialog states (create, edit, copy, delete, conflict) with stable callback references. Eliminates repetitive dialog open/close state management in List components.

### `useMetahubTrees(metahubId)`

Shared hook for fetching hub lists with consistent caching (staleTime: 5min). All List components share the same React Query key for automatic deduplication.

### `mapBaseVlcFields(entity, locale)`

Extracts VLC strings for the standard codename/name/description triple. Used as a building block inside domain-specific `toXxxDisplay()` converter functions in `displayConverters.ts`.

### `fetchAllPaginatedItems(fetchFn, params)`

Recursive paginator that fetches all pages and returns a unified `PaginatedResponse`.

---
*Part of [Universo Platformo](../../../README.md) - A package-based business platform*
