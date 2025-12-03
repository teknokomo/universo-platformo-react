# Campaigns Frontend

✨ **Modern Package** - Part of the new Universo Platformo architecture

## Overview

Frontend application for managing campaigns, events, and activities in the Universo Platformo ecosystem. The Campaigns Frontend provides comprehensive UI workflows for managing the three-tier architecture of Campaigns → Events → Activities with complete data isolation and security.

## Package Information

- **Package**: `@universo/campaigns-frontend`
- **Version**: `0.1.0`
- **Type**: React Frontend Package (Modern)
- **Framework**: React 18 + TypeScript + Material-UI
- **Build System**: tsdown (dual build - CJS + ESM)
- **Testing**: Vitest + React Testing Library

## Key Features

### 🌍 Campaign Management
- **Hierarchical Organization**: Three-tier architecture (Campaigns → Events → Activities)
- **Complete Data Isolation**: Activities and events from different campaigns are completely separated
- **Role-Based Access**: User roles and permissions for campaign access control
- **Context-Aware Navigation**: Campaign-aware routing with breadcrumbs and sidebar preservation

### 🎨 User Interface
- **Material-UI Integration**: Consistent UI components with modern design system
- **Responsive Design**: Optimized for desktop and mobile experiences
- **Table & Grid Views**: Flexible data presentation with pagination and search
- **Dialog Forms**: Modal forms for creating and editing activities

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
pnpm --filter @universo/campaigns-frontend build

# Run in development mode
pnpm --filter @universo/campaigns-frontend dev
```

### Integration
```tsx
// Import components in your React application
import { CampaignList, CampaignBoard, campaignsDashboard } from '@universo/campaigns-frontend'

// Import i18n resources
import { campaignsTranslations } from '@universo/campaigns-frontend'

// Use in routes
<Route path="/campaigns" element={<CampaignList />} />
<Route path="/campaign/:id/board" element={<CampaignBoard />} />
```

## Architecture

### Three-Tier Activity Model
- **Campaigns**: Top-level organizational units providing complete data isolation
- **Events**: Logical groupings within campaigns (e.g., "Web Services", "Mobile Apps")  
- **Activities**: Individual assets belonging to specific events within campaigns

### Data Isolation Strategy
- Complete separation between campaigns - no cross-campaign visibility
- All operations maintain campaign context through URL routing
- Frontend and backend validation preventing orphaned activities
- Role-based access control for campaign permissions

## Usage

### Basic Components
```tsx
import { CampaignList, CampaignBoard } from '@universo/campaigns-frontend'

// Campaign listing with management capabilities
function CampaignsPage() {
  return <CampaignList />
}

// Campaign dashboard and analytics
function CampaignBoardPage() {
  return <CampaignBoard />
}
```

### API Integration
```tsx
import { useApi } from '@universo/campaigns-frontend/hooks'
import * as campaignsApi from '@universo/campaigns-frontend/api'

function CampaignData() {
  const { data: campaigns, isLoading } = useApi(
    campaignsApi.getCampaigns
  )
  
  if (isLoading) return <div>Loading...</div>
  return <div>{campaigns?.length} campaigns found</div>
}
```

### Menu Integration
```tsx
import { campaignsDashboard } from '@universo/campaigns-frontend'

// Add to navigation menu
const menuItems = [
  ...otherMenuItems,
  campaignsDashboard
]
```

## File Structure

```
packages/campaigns-frontend/base/
├── src/
│   ├── api/              # API client functions
│   │   ├── campaigns.ts   # Campaign CRUD operations
│   │   ├── events.ts     # Event management
│   │   ├── activities.ts     # Activity operations
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
│   │   ├── CampaignList.tsx   # Main listing component
│   │   ├── CampaignBoard.tsx  # Dashboard component
│   │   └── CampaignActions.ts # Action definitions
│   ├── menu-items/       # Navigation configuration
│   │   └── campaignDashboard.ts
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

### CampaignList
Main component for displaying and managing campaigns:

```tsx
import { CampaignList } from '@universo/campaigns-frontend'

// Features:
// - Paginated table view with search functionality
// - Create, edit, delete operations
// - Role-based access control
// - Responsive design with Material-UI
// - Internationalization support
```

### CampaignBoard  
Dashboard component for campaign analytics:

```tsx
import { CampaignBoard } from '@universo/campaigns-frontend'

// Features:
// - Campaign-specific dashboard
// - Analytics and statistics
// - Interactive data visualization
// - Context-aware navigation
```

## API Integration

### Basic API Operations
```typescript
import * as campaignsApi from '@universo/campaigns-frontend/api'

// Get all campaigns
const campaigns = await campaignsApi.getCampaigns()

// Get specific campaign
const campaign = await campaignsApi.getCampaign(id)

// Create new campaign
const newCampaign = await campaignsApi.createCampaign({
  name: 'My Campaign',
  description: 'Campaign description'
})

// Update campaign
const updated = await campaignsApi.updateCampaign(id, data)

// Delete campaign
await campaignsApi.deleteCampaign(id)
```

### Campaign-Scoped Operations
```typescript
// Get events for specific campaign
const events = await campaignsApi.getCampaignEvents(campaignId)

// Get activities for specific campaign  
const activities = await campaignsApi.getCampaignActivities(campaignId)

// Link event to campaign
await campaignsApi.addEventToCampaign(campaignId, eventId)
```

### React Query Integration
```typescript
import { useQuery } from '@tanstack/react-query'
import { campaignsQueryKeys } from '@universo/campaigns-frontend/api'

function useCampaigns() {
  return useQuery({
    queryKey: campaignsQueryKeys.all,
    queryFn: campaignsApi.getCampaigns
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
- **Three-tier Model**: Campaigns → Events → Activities
- **Data Isolation**: Strict context boundaries between campaigns
- **React Query**: Centralized data fetching and caching
- **Material-UI**: Consistent component library usage

#### Context Management
```typescript
// Always maintain campaign context
const campaignContext = useCampaignContext()
const events = useEvents(campaignContext.id)
```

#### Form Validation
```typescript
// Mandatory field validation
const activitySchema = z.object({
  name: z.string().min(1),
  eventId: z.string().min(1), // Required - no empty option
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
import { CampaignList } from '../CampaignList'

test('renders campaign list', () => {
  render(<CampaignList />)
  expect(screen.getByText('Campaigns')).toBeInTheDocument()
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
feat(campaigns): add search functionality
fix(api): handle empty response
docs(readme): update installation guide
```

## Related Packages
- [`@universo/campaigns-backend`](../../campaigns-backend/base/README.md) - Backend service
- [`@universo/template-mui`](../../universo-template-mui/base/README.md) - UI components
- [`@universo/types`](../../universo-types/base/README.md) - Shared types

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive campaign management platform*
