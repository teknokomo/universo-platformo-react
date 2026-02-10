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
- [`@universo/flowise-template-mui`](../../flowise-template-mui/base/README.md) - UI components
- [`@universo/types`](../../universo-types/base/README.md) - Shared types

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive metahub management platform*
