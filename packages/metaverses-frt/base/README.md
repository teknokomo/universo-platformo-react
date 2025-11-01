# Metaverses Frontend

✨ **Modern Package** - Part of the new Universo Platformo architecture

## Overview

Frontend application for managing metaverses, sections, and entities in the Universo Platformo ecosystem. The Metaverses Frontend provides comprehensive UI workflows for managing the three-tier architecture of Metaverses → Sections → Entities with complete data isolation and security.

## Package Information

- **Package**: `@universo/metaverses-frt`
- **Version**: `0.1.0`
- **Type**: React Frontend Package (Modern)
- **Framework**: React 18 + TypeScript + Material-UI
- **Build System**: tsdown (dual build - CJS + ESM)
- **Testing**: Vitest + React Testing Library

## Key Features

### 🌍 Metaverse Management
- **Hierarchical Organization**: Three-tier architecture (Metaverses → Sections → Entities)
- **Complete Data Isolation**: Entities and sections from different metaverses are completely separated
- **Role-Based Access**: User roles and permissions for metaverse access control
- **Context-Aware Navigation**: Metaverse-aware routing with breadcrumbs and sidebar preservation

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
pnpm --filter @universo/metaverses-frt build

# Run in development mode
pnpm --filter @universo/metaverses-frt dev
```

### Integration
```tsx
// Import components in your React application
import { MetaverseList, MetaverseBoard, metaversesDashboard } from '@universo/metaverses-frt'

// Import i18n resources
import { metaversesTranslations } from '@universo/metaverses-frt'

// Use in routes
<Route path="/metaverses" element={<MetaverseList />} />
<Route path="/metaverses/:id/board" element={<MetaverseBoard />} />
```

## Architecture

### Three-Tier Entity Model
- **Metaverses**: Top-level organizational units providing complete data isolation
- **Sections**: Logical groupings within metaverses (e.g., "Web Services", "Mobile Apps")  
- **Entities**: Individual assets belonging to specific sections within metaverses

### Data Isolation Strategy
- Complete separation between metaverses - no cross-metaverse visibility
- All operations maintain metaverse context through URL routing
- Frontend and backend validation preventing orphaned entities
- Role-based access control for metaverse permissions

## Usage

### Basic Components
```tsx
import { MetaverseList, MetaverseBoard } from '@universo/metaverses-frt'

// Metaverse listing with management capabilities
function MetaversesPage() {
  return <MetaverseList />
}

// Metaverse dashboard and analytics
function MetaverseBoardPage() {
  return <MetaverseBoard />
}
```

### API Integration
```tsx
import { useApi } from '@universo/metaverses-frt/hooks'
import * as metaversesApi from '@universo/metaverses-frt/api'

function MetaverseData() {
  const { data: metaverses, isLoading } = useApi(
    metaversesApi.getMetaverses
  )
  
  if (isLoading) return <div>Loading...</div>
  return <div>{metaverses?.length} metaverses found</div>
}
```

### Menu Integration
```tsx
import { metaversesDashboard } from '@universo/metaverses-frt'

// Add to navigation menu
const menuItems = [
  ...otherMenuItems,
  metaversesDashboard
]
```

## File Structure

```
packages/metaverses-frt/base/
├── src/
│   ├── api/              # API client functions
│   │   ├── metaverses.ts   # Metaverse CRUD operations
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
│   │   ├── MetaverseList.tsx   # Main listing component
│   │   ├── MetaverseBoard.tsx  # Dashboard component
│   │   └── MetaverseActions.ts # Action definitions
│   ├── menu-items/       # Navigation configuration
│   │   └── metaverseDashboard.ts
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

### MetaverseList
Main component for displaying and managing metaverses:

```tsx
import { MetaverseList } from '@universo/metaverses-frt'

// Features:
// - Paginated table view with search functionality
// - Create, edit, delete operations
// - Role-based access control
// - Responsive design with Material-UI
// - Internationalization support
```

### MetaverseBoard  
Dashboard component for metaverse analytics:

```tsx
import { MetaverseBoard } from '@universo/metaverses-frt'

// Features:
// - Metaverse-specific dashboard
// - Analytics and statistics
// - Interactive data visualization
// - Context-aware navigation
```

## API Integration

### Basic API Operations
```typescript
import * as metaversesApi from '@universo/metaverses-frt/api'

// Get all metaverses
const metaverses = await metaversesApi.getMetaverses()

// Get specific metaverse
const metaverse = await metaversesApi.getMetaverse(id)

// Create new metaverse
const newMetaverse = await metaversesApi.createMetaverse({
  name: 'My Metaverse',
  description: 'Metaverse description'
})

// Update metaverse
const updated = await metaversesApi.updateMetaverse(id, data)

// Delete metaverse
await metaversesApi.deleteMetaverse(id)
```

### Metaverse-Scoped Operations
```typescript
// Get sections for specific metaverse
const sections = await metaversesApi.getMetaverseSections(metaverseId)

// Get entities for specific metaverse  
const entities = await metaversesApi.getMetaverseEntities(metaverseId)

// Link section to metaverse
await metaversesApi.addSectionToMetaverse(metaverseId, sectionId)
```

### React Query Integration
```typescript
import { useQuery } from '@tanstack/react-query'
import { metaversesQueryKeys } from '@universo/metaverses-frt/api'

function useMetaverses() {
  return useQuery({
    queryKey: metaversesQueryKeys.all,
    queryFn: metaversesApi.getMetaverses
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
- **Three-tier Model**: Metaverses → Sections → Entities
- **Data Isolation**: Strict context boundaries between metaverses
- **React Query**: Centralized data fetching and caching
- **Material-UI**: Consistent component library usage

#### Context Management
```typescript
// Always maintain metaverse context
const metaverseContext = useMetaverseContext()
const sections = useSections(metaverseContext.id)
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
import { MetaverseList } from '../MetaverseList'

test('renders metaverse list', () => {
  render(<MetaverseList />)
  expect(screen.getByText('Metaverses')).toBeInTheDocument()
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
feat(metaverses): add search functionality
fix(api): handle empty response
docs(readme): update installation guide
```

## Related Packages
- [`@universo/metaverses-srv`](../metaverses-srv/base/README.md) - Backend service
- [`@universo/template-mui`](../universo-template-mui/base/README.md) - UI components
- [`@universo/types`](../universo-types/base/README.md) - Shared types

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive metaverse management platform*
