# @universo/metahubs-frontend

> 🏗️ **Modern Package** - TypeScript-first architecture with dual build system

Frontend application for managing metahubs, hubs, catalogs, attributes, and elements in the Universo Platformo ecosystem.

## Package Information

- **Package**: `@universo/metahubs-frontend`
- **Version**: `0.1.0`
- **Type**: React Frontend Package (Modern)
- **Framework**: React 18 + TypeScript + Material-UI
- **Build System**: tsdown (dual build - CJS + ESM)
- **Testing**: Vitest + React Testing Library

## Key Features

### 🌍 Metahub Management
- **Hierarchical Organization**: Four-tier architecture (Metahubs → Hubs → Catalogs → Attributes/Elements)
- **Complete Data Isolation**: Data from different metahubs is completely separated
- **Role-Based Access**: User roles and permissions for metahub access control
- **Context-Aware Navigation**: Metahub-aware routing with breadcrumbs and sidebar preservation

### 🗂️ Hubs & Catalogs
- **Hubs**: Data containers that define the structure of your metahub
- **Catalogs**: Reusable schema definitions with N:M relationship to hubs
- **Attributes**: Field definitions within catalogs (name, type, validation)
- **Elements**: Data entries conforming to catalog schemas (JSONB storage)

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

### 🧩 Entity V2 Delegation
- **Entities Workspace**: Hubs V2, Catalogs V2, Sets V2, and Enumerations V2 are created from presets and published into the dynamic metahub menu.
- **Legacy Surface Reuse**: The V2 entity routes delegate to HubList, CatalogList, SetList, and EnumerationList instead of introducing parallel CRUD shells.
- **Route Ownership**: Delegated detail tabs stay under `/metahub/:id/entities/:kindKey/...` while legacy routes continue to coexist for shared data visibility.
- **Runtime Boundary**: Catalog-compatible V2 sections can surface in runtime after publication sync, while hub/set/enumeration-compatible V2 sections stay filtered out of runtime navigation.

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
  HubList,
  CatalogList,
  AttributeList,
  ElementList,
  metahubsDashboard 
} from '@universo/metahubs-frontend'

// Import i18n resources
import { metahubsTranslations } from '@universo/metahubs-frontend'

// Use in routes
<Route path="/metahubs" element={<MetahubList />} />
<Route path="/metahub/:id/board" element={<MetahubBoard />} />
<Route path="/metahub/:id/hubs" element={<HubList />} />
<Route path="/metahub/:id/hub/:hubId/catalogs" element={<CatalogList />} />
<Route path="/metahub/:id/catalogs" element={<CatalogList />} />
<Route path="/metahub/:id/catalog/:catalogId/attributes" element={<AttributeList />} />
<Route path="/metahub/:id/catalog/:catalogId/elements" element={<ElementList />} />
```

## Architecture

### Four-Tier Entity Model
```
Metahub (top-level organizational unit)
  └── Hub (data container)
        └── CatalogHub (N:M junction)
              └── Catalog (schema definition)
                    ├── Attribute (field definitions)
                    └── Element (data entries)
```

### Key Concepts
- **Metahubs**: Top-level organizational units providing complete data isolation
- **Hubs**: Content containers within metahubs for organizing catalogs
- **Catalogs**: Reusable schema definitions that can belong to multiple hubs (N:M relationship)
- **Attributes**: Field definitions within catalogs (name, type, required, order)
- **Elements**: Data entries stored as JSONB conforming to catalog attribute schema

### Data Isolation Strategy
- Complete separation between metahubs - no cross-metahub visibility
- All operations maintain metahub context through URL routing
- Frontend and backend validation preventing orphaned entities
- Role-based access control for metahub permissions

## File Structure

```
packages/metahubs-frontend/base/
├── src/
│   ├── api/              # API client functions
│   │   ├── metahubs.ts   # Metahub CRUD operations
│   │   ├── hubs.ts       # Hub management
│   │   ├── catalogs.ts   # Catalog operations
│   │   ├── attributes.ts # Attribute operations
│   │   ├── elements.ts   # Element operations
│   │   ├── templates.ts  # Template listing
│   │   └── queryKeys.ts  # React Query keys
│   ├── domains/
│   │   ├── layouts/      # Layout management domain
│   │   │   ├── ui/
│   │   │   │   └── ColumnsContainerEditorDialog.tsx  # DnD column editor
│   │   │   └── index.ts
│   │   └── migrations/   # Migration guard domain
│   │       ├── api/      # Migration status & apply API
│   │       ├── hooks/    # useMetahubMigrationsStatus hook
│   │       ├── ui/
│   │       │   └── MetahubMigrationGuard.tsx         # Route guard component
│   │       └── index.ts
│   ├── hooks/            # Custom React hooks
│   │   ├── mutations.ts  # useMutation hooks
│   │   └── index.ts      # Hook exports
│   ├── i18n/             # Internationalization
│   │   └── locales/      # Language files (en, ru)
│   ├── pages/            # Main page components
│   │   ├── MetahubList.tsx
│   │   ├── MetahubBoard.tsx
│   │   ├── HubList.tsx
│   │   ├── CatalogList.tsx
│   │   ├── AttributeList.tsx
│   │   └── ElementList.tsx
│   ├── menu-items/       # Navigation configuration
│   ├── types/            # TypeScript definitions
│   ├── utils/            # Utility functions
│   └── index.ts          # Package exports
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
// - Statistics cards (hubs, catalogs, members)
// - Interactive data visualization
```

### HubList
Component for managing hubs within a metahub:

```tsx
import { HubList } from '@universo/metahubs-frontend'

// Features:
// - Hub CRUD operations
// - Catalog count display
// - Codename with transliteration
```

### CatalogList
Component for managing catalogs (hub-scoped or global):

```tsx
import { CatalogList } from '@universo/metahubs-frontend'

// Features:
// - Dual mode: hub-scoped or metahub-wide
// - N:M hub relationship management
// - Attributes and elements count display
```

### AttributeList / ElementList
Components for managing catalog data:

```tsx
import { AttributeList, ElementList } from '@universo/metahubs-frontend'

// Features:
// - Attribute ordering (drag & drop)
// - Dynamic element forms based on attributes
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

### `useMetahubHubs(metahubId)`

Shared hook for fetching hub lists with consistent caching (staleTime: 5min). All List components share the same React Query key for automatic deduplication.

### `mapBaseVlcFields(entity, locale)`

Extracts VLC strings for the standard codename/name/description triple. Used as a building block inside domain-specific `toXxxDisplay()` converter functions in `displayConverters.ts`.

### `fetchAllPaginatedItems(fetchFn, params)`

Recursive paginator that fetches all pages and returns a unified `PaginatedResponse`.

---
*Part of [Universo Platformo](../../../README.md) - A package-based business platform*
