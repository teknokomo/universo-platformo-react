# Projects Frontend

✨ **Modern Package** - Part of the new Universo Platformo architecture

## Overview

Frontend application for managing projects, milestones, and tasks in the Universo Platformo ecosystem. The Projects Frontend provides comprehensive UI workflows for managing the three-tier architecture of Projects → Milestones → Tasks with complete data isolation and security.

## Package Information

- **Package**: `@universo/projects-frt`
- **Version**: `0.1.0`
- **Type**: React Frontend Package (Modern)
- **Framework**: React 18 + TypeScript + Material-UI
- **Build System**: tsdown (dual build - CJS + ESM)
- **Testing**: Vitest + React Testing Library

## Key Features

### 🌍 Project Management
- **Hierarchical Organization**: Three-tier architecture (Projects → Milestones → Tasks)
- **Complete Data Isolation**: Tasks and milestones from different projects are completely separated
- **Role-Based Access**: User roles and permissions for project access control
- **Context-Aware Navigation**: Project-aware routing with breadcrumbs and sidebar preservation

### 🎨 User Interface
- **Material-UI Integration**: Consistent UI components with modern design system
- **Responsive Design**: Optimized for desktop and mobile experiences
- **Table & Grid Views**: Flexible data presentation with pagination and search
- **Dialog Forms**: Modal forms for creating and editing tasks

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
pnpm --filter @universo/projects-frt build

# Run in development mode
pnpm --filter @universo/projects-frt dev
```

### Integration
```tsx
// Import components in your React application
import { ProjectList, ProjectBoard, projectsDashboard } from '@universo/projects-frt'

// Import i18n tasks
import { projectsTranslations } from '@universo/projects-frt'

// Use in routes
<Route path="/projects" element={<ProjectList />} />
<Route path="/projects/:id/board" element={<ProjectBoard />} />
```

## Architecture

### Three-Tier Task Model
- **Projects**: Top-level organizational units providing complete data isolation
- **Milestones**: Logical groupings within projects (e.g., "Web Services", "Mobile Apps")  
- **Tasks**: Individual assets belonging to specific milestones within projects

### Data Isolation Strategy
- Complete separation between projects - no cross-project visibility
- All operations maintain project context through URL routing
- Frontend and backend validation preventing orphaned tasks
- Role-based access control for project permissions

## Usage

### Basic Components
```tsx
import { ProjectList, ProjectBoard } from '@universo/projects-frt'

// Project listing with management capabilities
function ProjectsPage() {
  return <ProjectList />
}

// Project dashboard and analytics
function ProjectBoardPage() {
  return <ProjectBoard />
}
```

### API Integration
```tsx
import { useApi } from '@universo/projects-frt/hooks'
import * as projectsApi from '@universo/projects-frt/api'

function ProjectData() {
  const { data: projects, isLoading } = useApi(
    projectsApi.getProjects
  )
  
  if (isLoading) return <div>Loading...</div>
  return <div>{projects?.length} projects found</div>
}
```

### Menu Integration
```tsx
import { projectsDashboard } from '@universo/projects-frt'

// Add to navigation menu
const menuItems = [
  ...otherMenuItems,
  projectsDashboard
]
```

## File Structure

```
packages/projects-frt/base/
├── src/
│   ├── api/              # API client functions
│   │   ├── projects.ts   # Project CRUD operations
│   │   ├── milestones.ts     # Milestone management
│   │   ├── tasks.ts     # Task operations
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
│   │   ├── ProjectList.tsx   # Main listing component
│   │   ├── ProjectBoard.tsx  # Dashboard component
│   │   └── ProjectActions.ts # Action definitions
│   ├── menu-items/       # Navigation configuration
│   │   └── projectDashboard.ts
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

### ProjectList
Main component for displaying and managing projects:

```tsx
import { ProjectList } from '@universo/projects-frt'

// Features:
// - Paginated table view with search functionality
// - Create, edit, delete operations
// - Role-based access control
// - Responsive design with Material-UI
// - Internationalization support
```

### ProjectBoard  
Dashboard component for project analytics:

```tsx
import { ProjectBoard } from '@universo/projects-frt'

// Features:
// - Project-specific dashboard
// - Analytics and statistics
// - Interactive data visualization
// - Context-aware navigation
```

## API Integration

### Basic API Operations
```typescript
import * as projectsApi from '@universo/projects-frt/api'

// Get all projects
const projects = await projectsApi.getProjects()

// Get specific project
const project = await projectsApi.getProject(id)

// Create new project
const newProject = await projectsApi.createProject({
  name: 'My Project',
  description: 'Project description'
})

// Update project
const updated = await projectsApi.updateProject(id, data)

// Delete project
await projectsApi.deleteProject(id)
```

### Project-Scoped Operations
```typescript
// Get milestones for specific project
const milestones = await projectsApi.getProjectMilestones(projectId)

// Get tasks for specific project  
const tasks = await projectsApi.getProjectTasks(projectId)

// Link milestone to project
await projectsApi.addMilestoneToProject(projectId, milestoneId)
```

### React Query Integration
```typescript
import { useQuery } from '@tanstack/react-query'
import { projectsQueryKeys } from '@universo/projects-frt/api'

function useProjects() {
  return useQuery({
    queryKey: projectsQueryKeys.all,
    queryFn: projectsApi.getProjects
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
- **Three-tier Model**: Projects → Milestones → Tasks
- **Data Isolation**: Strict context boundaries between projects
- **React Query**: Centralized data fetching and caching
- **Material-UI**: Consistent component library usage

#### Context Management
```typescript
// Always maintain project context
const projectContext = useProjectContext()
const milestones = useMilestones(projectContext.id)
```

#### Form Validation
```typescript
// Mandatory field validation
const taskSchema = z.object({
  name: z.string().min(1),
  milestoneId: z.string().min(1), // Required - no empty option
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
import { ProjectList } from '../ProjectList'

test('renders project list', () => {
  render(<ProjectList />)
  expect(screen.getByText('Projects')).toBeInTheDocument()
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
feat(projects): add search functionality
fix(api): handle empty response
docs(readme): update installation guide
```

## Related Packages
- [`@universo/projects-srv`](../projects-srv/base/README.md) - Backend service
- [`@universo/template-mui`](../universo-template-mui/base/README.md) - UI components
- [`@universo/types`](../universo-types/base/README.md) - Shared types

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive project management platform*
