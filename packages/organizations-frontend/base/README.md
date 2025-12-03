# Organizations Frontend

✨ **Modern Package** - Part of the new Universo Platformo architecture

## Overview

Frontend application for managing organizations, departments, and positions in the Universo Platformo ecosystem. The Organizations Frontend provides comprehensive UI workflows for managing the three-tier architecture of Organizations → Departments → Positions with complete data isolation and security.

## Package Information

- **Package**: `@universo/organizations-frontend`
- **Version**: `0.1.0`
- **Type**: React Frontend Package (Modern)
- **Framework**: React 18 + TypeScript + Material-UI
- **Build System**: tsdown (dual build - CJS + ESM)
- **Testing**: Vitest + React Testing Library

## Key Features

### 🌍 Organization Management
- **Hierarchical Organization**: Three-tier architecture (Organizations → Departments → Positions)
- **Complete Data Isolation**: Positions and departments from different organizations are completely separated
- **Role-Based Access**: User roles and permissions for organization access control
- **Context-Aware Navigation**: Organization-aware routing with breadcrumbs and sidebar preservation

### 🎨 User Interface
- **Material-UI Integration**: Consistent UI components with modern design system
- **Responsive Design**: Optimized for desktop and mobile experiences
- **Table & Grid Views**: Flexible data presentation with pagination and search
- **Dialog Forms**: Modal forms for creating and editing positions

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
pnpm --filter @universo/organizations-frontend build

# Run in development mode
pnpm --filter @universo/organizations-frontend dev
```

### Integration
```tsx
// Import components in your React application
import { OrganizationList, OrganizationBoard, organizationsDashboard } from '@universo/organizations-frontend'

// Import i18n positions
import { organizationsTranslations } from '@universo/organizations-frontend'

// Use in routes
<Route path="/organizations" element={<OrganizationList />} />
<Route path="/organizations/:id/board" element={<OrganizationBoard />} />
```

## Architecture

### Three-Tier Position Model
- **Organizations**: Top-level organizational units providing complete data isolation
- **Departments**: Logical groupings within organizations (e.g., "Web Services", "Mobile Apps")  
- **Positions**: Individual assets belonging to specific departments within organizations

### Data Isolation Strategy
- Complete separation between organizations - no cross-organization visibility
- All operations maintain organization context through URL routing
- Frontend and backend validation preventing orphaned positions
- Role-based access control for organization permissions

## Usage

### Basic Components
```tsx
import { OrganizationList, OrganizationBoard } from '@universo/organizations-frontend'

// Organization listing with management capabilities
function OrganizationsPage() {
  return <OrganizationList />
}

// Organization dashboard and analytics
function OrganizationBoardPage() {
  return <OrganizationBoard />
}
```

### API Integration
```tsx
import { useApi } from '@universo/organizations-frontend/hooks'
import * as organizationsApi from '@universo/organizations-frontend/api'

function OrganizationData() {
  const { data: organizations, isLoading } = useApi(
    organizationsApi.getOrganizations
  )
  
  if (isLoading) return <div>Loading...</div>
  return <div>{organizations?.length} organizations found</div>
}
```

### Menu Integration
```tsx
import { organizationsDashboard } from '@universo/organizations-frontend'

// Add to navigation menu
const menuItems = [
  ...otherMenuItems,
  organizationsDashboard
]
```

## File Structure

```
packages/organizations-frontend/base/
├── src/
│   ├── api/              # API client functions
│   │   ├── organizations.ts   # Organization CRUD operations
│   │   ├── departments.ts     # Department management
│   │   ├── positions.ts     # Position operations
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
│   │   ├── OrganizationList.tsx   # Main listing component
│   │   ├── OrganizationBoard.tsx  # Dashboard component
│   │   └── OrganizationActions.ts # Action definitions
│   ├── menu-items/       # Navigation configuration
│   │   └── organizationDashboard.ts
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

### OrganizationList
Main component for displaying and managing organizations:

```tsx
import { OrganizationList } from '@universo/organizations-frontend'

// Features:
// - Paginated table view with search functionality
// - Create, edit, delete operations
// - Role-based access control
// - Responsive design with Material-UI
// - Internationalization support
```

### OrganizationBoard  
Dashboard component for organization analytics:

```tsx
import { OrganizationBoard } from '@universo/organizations-frontend'

// Features:
// - Organization-specific dashboard
// - Analytics and statistics
// - Interactive data visualization
// - Context-aware navigation
```

## API Integration

### Basic API Operations
```typescript
import * as organizationsApi from '@universo/organizations-frontend/api'

// Get all organizations
const organizations = await organizationsApi.getOrganizations()

// Get specific organization
const organization = await organizationsApi.getOrganization(id)

// Create new organization
const newCluster = await organizationsApi.createOrganization({
  name: 'My Organization',
  description: 'Organization description'
})

// Update organization
const updated = await organizationsApi.updateOrganization(id, data)

// Delete organization
await organizationsApi.deleteOrganization(id)
```

### Organization-Scoped Operations
```typescript
// Get departments for specific organization
const departments = await organizationsApi.getOrganizationDepartments(organizationId)

// Get positions for specific organization  
const positions = await organizationsApi.getOrganizationPositions(organizationId)

// Link department to organization
await organizationsApi.addDepartmentToOrganization(organizationId, departmentId)
```

### React Query Integration
```typescript
import { useQuery } from '@tanstack/react-query'
import { organizationsQueryKeys } from '@universo/organizations-frontend/api'

function useOrganizations() {
  return useQuery({
    queryKey: organizationsQueryKeys.all,
    queryFn: organizationsApi.getOrganizations
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
- **Three-tier Model**: Organizations → Departments → Positions
- **Data Isolation**: Strict context boundaries between organizations
- **React Query**: Centralized data fetching and caching
- **Material-UI**: Consistent component library usage

#### Context Management
```typescript
// Always maintain organization context
const organizationContext = useOrganizationContext()
const departments = useDepartments(organizationContext.id)
```

#### Form Validation
```typescript
// Mandatory field validation
const positionSchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().min(1), // Required - no empty option
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
import { OrganizationList } from '../OrganizationList'

test('renders organization list', () => {
  render(<OrganizationList />)
  expect(screen.getByText('Organizations')).toBeInTheDocument()
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
feat(organizations): add search functionality
fix(api): handle empty response
docs(readme): update installation guide
```

## Related Packages
- [`@universo/organizations-backend`](../organizations-backend/base/README.md) - Backend service
- [`@universo/template-mui`](../universo-template-mui/base/README.md) - UI components
- [`@universo/types`](../universo-types/base/README.md) - Shared types

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive organization management platform*
