# Clusters Frontend

✨ **Modern Package** - Part of the new Universo Platformo architecture

## Overview

Frontend application for managing clusters, domains, and resources in the Universo Platformo ecosystem. The Clusters Frontend provides comprehensive UI workflows for managing the three-tier architecture of Clusters → Domains → Resources with complete data isolation and security.

## Package Information

- **Package**: `@universo/clusters-frt`
- **Version**: `0.1.0`
- **Type**: React Frontend Package (Modern)
- **Framework**: React 18 + TypeScript + Material-UI
- **Build System**: tsdown (dual build - CJS + ESM)
- **Testing**: Vitest + React Testing Library

## Key Features

### 🌍 Cluster Management
- **Hierarchical Organization**: Three-tier architecture (Clusters → Domains → Resources)
- **Complete Data Isolation**: Resources and domains from different clusters are completely separated
- **Role-Based Access**: User roles and permissions for cluster access control
- **Context-Aware Navigation**: Cluster-aware routing with breadcrumbs and sidebar preservation

### 🎨 User Interface
- **Material-UI Integration**: Consistent UI components with modern design system
- **Responsive Design**: Optimized for desktop and mobile experiences
- **Table & Grid Views**: Flexible data presentation with pagination and search
- **Dialog Forms**: Modal forms for creating and editing resources

### 🔧 Technical Features
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
pnpm --filter @universo/clusters-frt build

# Run in development mode
pnpm --filter @universo/clusters-frt dev
```

### Integration
```tsx
// Import components in your React application
import { ClusterList, ClusterBoard, clustersDashboard } from '@universo/clusters-frt'

// Import i18n resources
import { clustersTranslations } from '@universo/clusters-frt'

// Use in routes
<Route path="/clusters" element={<ClusterList />} />
<Route path="/clusters/:id/board" element={<ClusterBoard />} />
```

## Architecture

### Three-Tier Resource Model
- **Clusters**: Top-level organizational units providing complete data isolation
- **Domains**: Logical groupings within clusters (e.g., "Web Services", "Mobile Apps")  
- **Resources**: Individual assets belonging to specific domains within clusters

### Data Isolation Strategy
- Complete separation between clusters - no cross-cluster visibility
- All operations maintain cluster context through URL routing
- Frontend and backend validation preventing orphaned resources
- Role-based access control for cluster permissions

## Usage

### Basic Components
```tsx
import { ClusterList, ClusterBoard } from '@universo/clusters-frt'

// Cluster listing with management capabilities
function ClustersPage() {
  return <ClusterList />
}

// Cluster dashboard and analytics
function ClusterBoardPage() {
  return <ClusterBoard />
}
```

### API Integration
```tsx
import { useApi } from '@universo/clusters-frt/hooks'
import * as clustersApi from '@universo/clusters-frt/api'

function ClusterData() {
  const { data: clusters, isLoading } = useApi(
    clustersApi.getClusters
  )
  
  if (isLoading) return <div>Loading...</div>
  return <div>{clusters?.length} clusters found</div>
}
```

### Menu Integration
```tsx
import { clustersDashboard } from '@universo/clusters-frt'

// Add to navigation menu
const menuItems = [
  ...otherMenuItems,
  clustersDashboard
]
```

## File Structure

```
packages/clusters-frt/base/
├── src/
│   ├── api/              # API client functions
│   │   ├── clusters.ts   # Cluster CRUD operations
│   │   ├── domains.ts     # Domain management
│   │   ├── resources.ts     # Resource operations
│   │   └── queryKeys.ts    # React Query keys
│   ├── hooks/            # Custom React hooks
│   │   ├── useApi.ts       # API integration hook
│   │   └── index.ts        # Hook exports
│   ├── i18n/             # Internationalization
│   │   ├── locales/        # Language files (en, ru)
│   │   │   ├── en.json     # English translations
│   │   │   └── ru.json     # Russian translations
│   │   └── index.ts        # i18n configuration
│   ├── pages/            # Main page components
│   │   ├── ClusterList.tsx   # Main listing component
│   │   ├── ClusterBoard.tsx  # Dashboard component
│   │   └── ClusterActions.ts # Action definitions
│   ├── menu-items/       # Navigation configuration
│   │   └── clusterDashboard.ts
│   ├── types/            # TypeScript definitions
│   │   ├── index.ts        # Main type exports
│   │   └── types.ts        # Type definitions
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

### ClusterList
Main component for displaying and managing clusters:

```tsx
import { ClusterList } from '@universo/clusters-frt'

// Features:
// - Paginated table view with search functionality
// - Create, edit, delete operations
// - Role-based access control
// - Responsive design with Material-UI
// - Internationalization support
```

### ClusterBoard  
Dashboard component for cluster analytics:

```tsx
import { ClusterBoard } from '@universo/clusters-frt'

// Features:
// - Cluster-specific dashboard
// - Analytics and statistics
// - Interactive data visualization
// - Context-aware navigation
```

## API Integration

### Basic API Operations
```typescript
import * as clustersApi from '@universo/clusters-frt/api'

// Get all clusters
const clusters = await clustersApi.getClusters()

// Get specific cluster
const cluster = await clustersApi.getCluster(id)

// Create new cluster
const newCluster = await clustersApi.createCluster({
  name: 'My Cluster',
  description: 'Cluster description'
})

// Update cluster
const updated = await clustersApi.updateCluster(id, data)

// Delete cluster
await clustersApi.deleteCluster(id)
```

### Cluster-Scoped Operations
```typescript
// Get domains for specific cluster
const domains = await clustersApi.getClusterDomains(clusterId)

// Get resources for specific cluster  
const resources = await clustersApi.getClusterResources(clusterId)

// Link domain to cluster
await clustersApi.addDomainToCluster(clusterId, domainId)
```

### React Query Integration
```typescript
import { useQuery } from '@tanstack/react-query'
import { clustersQueryKeys } from '@universo/clusters-frt/api'

function useClusters() {
  return useQuery({
    queryKey: clustersQueryKeys.all,
    queryFn: clustersApi.getClusters
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
- **Three-tier Model**: Clusters → Domains → Resources
- **Data Isolation**: Strict context boundaries between clusters
- **React Query**: Centralized data fetching and caching
- **Material-UI**: Consistent component library usage

#### Context Management
```typescript
// Always maintain cluster context
const clusterContext = useClusterContext()
const domains = useDomains(clusterContext.id)
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
├── __tests__/
│   ├── components/
│   ├── hooks/
│   ├── api/
│   └── utils/
└── vitest.config.ts
```

### Testing Approach
```typescript
// Component testing with React Testing Library
import { render, screen } from '@testing-library/react'
import { ClusterList } from '../ClusterList'

test('renders cluster list', () => {
  render(<ClusterList />)
  expect(screen.getByText('Clusters')).toBeInTheDocument()
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
feat(clusters): add search functionality
fix(api): handle empty response
docs(readme): update installation guide
```

## Related Packages
- [`@universo/clusters-srv`](../clusters-srv/base/README.md) - Backend service
- [`@universo/template-mui`](../universo-template-mui/base/README.md) - UI components
- [`@universo/types`](../universo-types/base/README.md) - Shared types

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive cluster management platform*
