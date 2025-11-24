# Storages Frontend

? **Modern Package** - Part of the new Universo Platformo architecture

## Overview

Frontend application for managing Storages, Containers, and Slots in the Universo Platformo ecosystem. The Storages Frontend provides comprehensive UI workflows for managing the three-tier architecture of Storages > Containers > Slots with complete data isolation and security.

## Package Information

- **Package**: `@universo/storages-frt`
- **Version**: `0.1.0`
- **Type**: React Frontend Package (Modern)
- **Framework**: React 18 + TypeScript + Material-UI
- **Build System**: tsdown (dual build - CJS + ESM)
- **Testing**: Vitest + React Testing Library

## Key Features

### ?? Storage Management
- **Hierarchical Organization**: Three-tier architecture (Storages > Containers > Slots)
- **Complete Data Isolation**: Slots and Containers from different Storages are completely separated
- **Role-Based Access**: User roles and permissions for Storage access control
- **Context-Aware Navigation**: Storage-aware routing with breadcrumbs and sidebar preservation

### ?? User Interface
- **Material-UI Integration**: Consistent UI components with modern design system
- **Responsive Design**: Optimized for desktop and mobile experiences
- **Table & Grid Views**: Flexible data presentation with pagination and search
- **Dialog Forms**: Modal forms for creating and editing Slots

### ?? Technical Features
- **TypeScript-First**: Full TypeScript implementation with strict typing
- **React Query Integration**: Advanced data fetching and caching
- **Internationalization**: English and Russian translations with i18next
- **Form Validation**: Comprehensive validation with error handling
- **API Integration**: RESTful API client with authentication

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
pnpm --filter @universo/storages-frt build

# Run in development mode
pnpm --filter @universo/storages-frt dev
```

### Integration
```tsx
// Import components in your React application
import { ClusterList, ClusterBoard, clustersDashboard } from '@universo/storages-frt'

// Import i18n Slots
import { clustersTranslations } from '@universo/storages-frt'

// Use in routes
<Route path="/Storages" element={<ClusterList />} />
<Route path="/Storages/:id/board" element={<ClusterBoard />} />
```

## Architecture

### Three-Tier Slot Model
- **Storages**: Top-level organizational units providing complete data isolation
- **Containers**: Logical groupings within Storages (e.g., "Web Services", "Mobile Apps")  
- **Slots**: Individual assets belonging to specific Containers within Storages

### Data Isolation Strategy
- Complete separation between Storages - no cross-Storage visibility
- All operations maintain Storage context through URL routing
- Frontend and backend validation preventing orphaned Slots
- Role-based access control for Storage permissions

## Usage

### Basic Components
```tsx
import { ClusterList, ClusterBoard } from '@universo/storages-frt'

// Storage listing with management capabilities
function ClustersPage() {
  return <ClusterList />
}

// Storage dashboard and analytics
function ClusterBoardPage() {
  return <ClusterBoard />
}
```

### API Integration
```tsx
import { useApi } from '@universo/storages-frt/hooks'
import * as clustersApi from '@universo/storages-frt/api'

function ClusterData() {
  const { data: Storages, isLoading } = useApi(
    clustersApi.getStorages
  )
  
  if (isLoading) return <div>Loading...</div>
  return <div>{Storages?.length} Storages found</div>
}
```

### Menu Integration
```tsx
import { clustersDashboard } from '@universo/storages-frt'

// Add to navigation menu
const menuItems = [
  ...otherMenuItems,
  clustersDashboard
]
```

## File Structure

```
packages/Storages-frt/base/
+-- src/
¦   +-- api/              # API client functions
¦   ¦   +-- Storages.ts   # Storage CRUD operations
¦   ¦   +-- Containers.ts     # Container management
¦   ¦   +-- Slots.ts     # Slot operations
¦   ¦   L-- queryKeys.ts    # React Query keys
¦   +-- hooks/            # Custom React hooks
¦   ¦   +-- useApi.ts       # API integration hook
¦   ¦   L-- index.ts        # Hook exports
¦   +-- i18n/             # Internationalization
¦   ¦   +-- locales/        # Language files (en, ru)
¦   ¦   ¦   +-- en.json     # English translations
¦   ¦   ¦   L-- ru.json     # Russian translations
¦   ¦   L-- index.ts        # i18n configuration
¦   +-- pages/            # Main page components
¦   ¦   +-- ClusterList.tsx   # Main listing component
¦   ¦   +-- ClusterBoard.tsx  # Dashboard component
¦   ¦   L-- ClusterActions.ts # Action definitions
¦   +-- menu-items/       # Navigation configuration
¦   ¦   L-- clusterDashboard.ts
¦   +-- types/            # TypeScript definitions
¦   ¦   +-- index.ts        # Main type exports
¦   ¦   L-- types.ts        # Type definitions
¦   +-- utils/            # Utility functions
¦   L-- index.ts          # Package exports
+-- dist/                 # Compiled output (CJS, ESM, types)
+-- package.json
+-- tsconfig.json
+-- tsdown.config.ts      # Build configuration
+-- vitest.config.ts      # Test configuration
+-- README.md             # This file
L-- README-RU.md          # Russian documentation
```

## Core Components

### ClusterList
Main component for displaying and managing Storages:

```tsx
import { ClusterList } from '@universo/storages-frt'

// Features:
// - Paginated table view with search functionality
// - Create, edit, delete operations
// - Role-based access control
// - Responsive design with Material-UI
// - Internationalization support
```

### ClusterBoard  
Dashboard component for Storage analytics:

```tsx
import { ClusterBoard } from '@universo/storages-frt'

// Features:
// - Storage-specific dashboard
// - Analytics and statistics
// - Interactive data visualization
// - Context-aware navigation
```

## API Integration

### Basic API Operations
```typescript
import * as clustersApi from '@universo/storages-frt/api'

// Get all Storages
const Storages = await clustersApi.getStorages()

// Get specific Storage
const Storage = await clustersApi.getStorage(id)

// Create new Storage
const newCluster = await clustersApi.createStorage({
  name: 'My Storage',
  description: 'Storage description'
})

// Update Storage
const updated = await clustersApi.updateStorage(id, data)

// Delete Storage
await clustersApi.deleteStorage(id)
```

### Storage-Scoped Operations
```typescript
// Get Containers for specific Storage
const Containers = await clustersApi.getClusterDomains(clusterId)

// Get Slots for specific Storage  
const Slots = await clustersApi.getClusterResources(clusterId)

// Link Container to Storage
await clustersApi.addContainerToStorage(clusterId, domainId)
```

### React Query Integration
```typescript
import { useQuery } from '@tanstack/react-query'
import { storagesQueryKeys } from '@universo/storages-frt/api'

function useStorages() {
  return useQuery({
    queryKey: storagesQueryKeys.all,
    queryFn: clustersApi.getStorages
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

### Development Guidelines

#### Architecture Patterns
- **Three-tier Model**: Storages > Containers > Slots
- **Data Isolation**: Strict context boundaries between Storages
- **React Query**: Centralized data fetching and caching
- **Material-UI**: Consistent component library usage

#### Context Management
```typescript
// Always maintain Storage context
const clusterContext = useClusterContext()
const Containers = useDomains(clusterContext.id)
```

#### Form Validation
```typescript
// Mandatory field validation
const resourceSchema = z.object({
  name: z.string().min(1),
  domainId: z.string().min(1), // Required - no empty option
  description: z.string().optional()
})
```

## Testing

### Test Structure
```
src/
+-- __tests__/
¦   +-- components/
¦   +-- hooks/
¦   +-- api/
¦   L-- utils/
L-- vitest.config.ts
```

### Testing Approach
```typescript
// Component testing with React Testing Library
import { render, screen } from '@testing-library/react'
import { ClusterList } from '../ClusterList'

test('renders Storage list', () => {
  render(<ClusterList />)
  expect(screen.getByText('Storages')).toBeInTheDocument()
})
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
feat(Storages): add search functionality
fix(api): handle empty response
docs(readme): update installation guide
```

## Related Packages
- [`@universo/storages-srv`](../Storages-srv/base/README.md) - Backend service
- [`@universo/template-mui`](../universo-template-mui/base/README.md) - UI components
- [`@universo/types`](../universo-types/base/README.md) - Shared types

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive Storage management platform*


