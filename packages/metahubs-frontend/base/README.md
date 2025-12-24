# Metahubs Frontend

✨ **Modern Package** - Part of the new Universo Platformo architecture

## Overview

Frontend application for managing metahubs, sections, and entities in the Universo Platformo ecosystem. The Metahubs Frontend provides comprehensive UI workflows for managing the three-tier architecture of Metahubs → Sections → Entities with complete data isolation and security.

## Package Information

- **Package**: `@universo/metahubs-frontend`
- **Version**: `0.1.0`
- **Type**: React Frontend Package (Modern)
- **Framework**: React 18 + TypeScript + Material-UI
- **Build System**: tsdown (dual build - CJS + ESM)
- **Testing**: Vitest + React Testing Library

## Key Features

### 🌍 Metahub Management
- **Hierarchical Organization**: Three-tier architecture (Metahubs → Sections → Entities)
- **Complete Data Isolation**: Entities and sections from different metahubs are completely separated
- **Role-Based Access**: User roles and permissions for metahub access control
- **Context-Aware Navigation**: Metahub-aware routing with breadcrumbs and sidebar preservation

### 🎨 User Interface
- **Material-UI Integration**: Consistent UI components with modern design system
- **Responsive Design**: Optimized for desktop and mobile experiences
- **Table & Grid Views**: Flexible data presentation with pagination and search
- **Dialog Forms**: Modal forms for creating and editing entities

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
pnpm --filter @universo/metahubs-frontend build

# Run in development mode
pnpm --filter @universo/metahubs-frontend dev
```

### Integration
```tsx
// Import components in your React application
import { MetahubList, MetahubBoard, metahubsDashboard } from '@universo/metahubs-frontend'

// Import i18n resources
import { metahubsTranslations } from '@universo/metahubs-frontend'

// Use in routes
<Route path="/metahubs" element={<MetahubList />} />
<Route path="/metahubs/:id/board" element={<MetahubBoard />} />
```

## Architecture

### Three-Tier Entity Model
- **Metahubs**: Top-level organizational units providing complete data isolation
- **Sections**: Logical groupings within metahubs (e.g., "Web Services", "Mobile Apps")  
- **Entities**: Individual assets belonging to specific sections within metahubs

### Data Isolation Strategy
- Complete separation between metahubs - no cross-metahub visibility
- All operations maintain metahub context through URL routing
- Frontend and backend validation preventing orphaned entities
- Role-based access control for metahub permissions

## Usage

### Basic Components
```tsx
import { MetahubList, MetahubBoard } from '@universo/metahubs-frontend'

// Metahub listing with management capabilities
function MetahubsPage() {
  return <MetahubList />
}

// Metahub dashboard and analytics
function MetahubBoardPage() {
  return <MetahubBoard />
}
```

### API Integration
```tsx
import { useApi } from '@universo/metahubs-frontend/hooks'
import * as metahubsApi from '@universo/metahubs-frontend/api'

function MetahubData() {
  const { data: metahubs, isLoading } = useApi(
    metahubsApi.getMetahubs
  )
  
  if (isLoading) return <div>Loading...</div>
  return <div>{metahubs?.length} metahubs found</div>
}
```

### Menu Integration
```tsx
import { metahubsDashboard } from '@universo/metahubs-frontend'

// Add to navigation menu
const menuItems = [
  ...otherMenuItems,
  metahubsDashboard
]
```

## File Structure

```
packages/metahubs-frontend/base/
├── src/
│   ├── api/              # API client functions
│   │   ├── metahubs.ts   # Metahub CRUD operations
│   │   ├── sections.ts     # Section management
│   │   ├── entities.ts     # Entity operations
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
│   │   ├── MetahubList.tsx   # Main listing component
│   │   ├── MetahubBoard.tsx  # Dashboard component
│   │   └── MetahubActions.ts # Action definitions
│   ├── menu-items/       # Navigation configuration
│   │   └── metahubDashboard.ts
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

### MetahubList
Main component for displaying and managing metahubs:

```tsx
import { MetahubList } from '@universo/metahubs-frontend'

// Features:
// - Paginated table view with search functionality
// - Create, edit, delete operations
// - Role-based access control
// - Responsive design with Material-UI
// - Internationalization support
```

### MetahubBoard  
Dashboard component for metahub analytics:

```tsx
import { MetahubBoard } from '@universo/metahubs-frontend'

// Features:
// - Metahub-specific dashboard
// - Analytics and statistics
// - Interactive data visualization
// - Context-aware navigation
```

## API Integration

### Basic API Operations
```typescript
import * as metahubsApi from '@universo/metahubs-frontend/api'

// Get all metahubs
const metahubs = await metahubsApi.getMetahubs()

// Get specific metahub
const metahub = await metahubsApi.getMetahub(id)

// Create new metahub
const newMetahub = await metahubsApi.createMetahub({
  name: 'My Metahub',
  description: 'Metahub description'
})

// Update metahub
const updated = await metahubsApi.updateMetahub(id, data)

// Delete metahub
await metahubsApi.deleteMetahub(id)
```

### Metahub-Scoped Operations
```typescript
// Get sections for specific metahub
const sections = await metahubsApi.getMetahubSections(metahubId)

// Get entities for specific metahub  
const entities = await metahubsApi.getMetahubEntities(metahubId)

// Link section to metahub
await metahubsApi.addSectionToMetahub(metahubId, sectionId)
```

### React Query Integration
```typescript
import { useQuery } from '@tanstack/react-query'
import { metahubsQueryKeys } from '@universo/metahubs-frontend/api'

function useMetahubs() {
  return useQuery({
    queryKey: metahubsQueryKeys.all,
    queryFn: metahubsApi.getMetahubs
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
- **Three-tier Model**: Metahubs → Sections → Entities
- **Data Isolation**: Strict context boundaries between metahubs
- **React Query**: Centralized data fetching and caching
- **Material-UI**: Consistent component library usage

#### Context Management
```typescript
// Always maintain metahub context
const metahubContext = useMetahubContext()
const sections = useSections(metahubContext.id)
```

#### Form Validation
```typescript
// Mandatory field validation
const entitySchema = z.object({
  name: z.string().min(1),
  sectionId: z.string().min(1), // Required - no empty option
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
import { MetahubList } from '../MetahubList'

test('renders metahub list', () => {
  render(<MetahubList />)
  expect(screen.getByText('Metahubs')).toBeInTheDocument()
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
feat(metahubs): add search functionality
fix(api): handle empty response
docs(readme): update installation guide
```

## Related Packages
- [`@universo/metahubs-backend`](../metahubs-backend/base/README.md) - Backend service
- [`@universo/template-mui`](../universo-template-mui/base/README.md) - UI components
- [`@universo/types`](../universo-types/base/README.md) - Shared types

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive metahub management platform*
