# @universo/applications-frontend

> 🏗️ **Modern Package** - TypeScript-first architecture with dual build system

Frontend application for managing applications and connectors in the Universo Platformo ecosystem.

## Package Information

- **Package**: `@universo/applications-frontend`
- **Version**: `0.1.0`
- **Type**: React Frontend Package (Modern)
- **Framework**: React 18 + TypeScript + Material-UI
- **Build System**: tsdown (dual build - CJS + ESM)
- **Testing**: Vitest + React Testing Library

## Key Features

### 🌍 Application Management
- **Two-Tier Architecture**: Applications → Connectors (streamlined data organization)
- **Complete Data Isolation**: Data from different applications is completely separated
- **Role-Based Access**: User roles and permissions for application access control
- **Context-Aware Navigation**: Application-aware routing with breadcrumbs and sidebar preservation
- **Mutable Visibility**: Application owners/admins can switch applications between closed and public after creation
- **Public Discovery + Join**: Public applications are visible to regular users and support explicit join / leave flows
- **Workspace Isolation**: Workspace-enabled applications isolate runtime catalog rows per user workspace
- **Workspace Limits**: Admin settings expose per-catalog row limits at the workspace boundary

### 🗂️ Connectors
- **Connectors**: Data containers that define the structure of your application
- **Flexible Schema**: Each connector can have its own configuration

### 🧩 Layouts
- **Application Layouts**: Application admins can customize metahub-published layouts and create application-owned layouts.
- **Source Awareness**: Layout cards show whether a layout came from a metahub publication or from the application.
- **Runtime-Safe Toggles**: Inactive layouts and widgets remain editable but are excluded from runtime rendering.

### 🎨 User Interface
- **Material-UI Integration**: Consistent UI components with modern design system
- **Responsive Design**: Optimized for desktop and mobile experiences
- **Table & Grid Views**: Flexible data presentation with pagination and search
- **Dialog Forms**: Modal forms for creating and editing entities
- **Tabbed Application Forms**: Create, edit, and copy dialogs reuse the shared `General / Parameters` pattern
- **Settings Surface**: Applications with runtime schema now expose `General` and `Limits` settings tabs

### 🔧 Technical Features
- **TypeScript-First**: Full TypeScript implementation with strict typing
- **React Query Integration**: Advanced data fetching and caching with TanStack Query v5
- **Internationalization**: English and Russian translations with i18next
- **Form Validation**: Comprehensive validation with Zod schemas
- **API Integration**: RESTful API client with authentication
- **Migration Guard**: Unified schema update guard with severity levels

> **Migration documentation**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)

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
pnpm --filter @universo/applications-frontend build

# Run tests
pnpm --filter @universo/applications-frontend test
```

### Integration
```tsx
// Import components in your React application
import { 
  ApplicationList, 
  ApplicationBoard, 
  ConnectorList,
  ApplicationLayouts,
  ApplicationMembers
} from '@universo/applications-frontend'

// Import i18n resources (auto-registers namespace)
import '@universo/applications-frontend/i18n'

// Use in routes
<Route path="/applications" element={<ApplicationList />} />
<Route path="/application/:applicationId/board" element={<ApplicationBoard />} />
<Route path="/application/:applicationId/connectors" element={<ConnectorList />} />
<Route path="/application/:applicationId/layouts" element={<ApplicationLayouts />} />
<Route path="/application/:applicationId/access" element={<ApplicationMembers />} />
```

## Architecture

### Two-Tier Entity Model
```
Application (top-level organizational unit)
  └── Connector (data container)
```

### Key Components
- **ApplicationList**: Main list view with search, pagination, and CRUD operations
- **ApplicationBoard**: Dashboard with statistics and overview
- **ConnectorList**: Manage connectors within an application
- **ApplicationLayouts**: Manage application-side layouts, layout sources, defaults, activation, and widget zones
- **ApplicationMembers**: Manage user access and roles

### Directory Structure
```
packages/applications-frontend/base/
├── src/
│   ├── api/              # API client and query hooks
│   ├── components/       # Reusable UI components
│   ├── constants/        # Storage keys and constants
│   ├── hooks/            # Custom React hooks
│   ├── i18n/             # Translations (en, ru)
│   ├── pages/            # Page components
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── dist/                 # Built output (CJS + ESM)
└── package.json
```

## API Endpoints

### Applications
```
GET    /api/v1/applications                    # List applications
POST   /api/v1/applications                    # Create application
GET    /api/v1/applications/:id                # Get application details
PUT    /api/v1/applications/:id                # Update application
DELETE /api/v1/applications/:id                # Delete application
POST   /api/v1/applications/:id/join           # Join a public application
POST   /api/v1/applications/:id/leave          # Leave an application and archive personal workspace
GET    /api/v1/applications/:id/settings/limits # Read workspace catalog limits
PUT    /api/v1/applications/:id/settings/limits # Update workspace catalog limits
```

### Connectors
```
GET    /api/v1/applications/:id/connectors        # List connectors
POST   /api/v1/applications/:id/connectors        # Create connector
PUT    /api/v1/applications/:id/connectors/:cid   # Update connector
DELETE /api/v1/applications/:id/connectors/:cid   # Delete connector
```

### Members
```
GET    /api/v1/applications/:id/members        # List members
POST   /api/v1/applications/:id/members        # Invite member
PUT    /api/v1/applications/:id/members/:mid   # Update member role
DELETE /api/v1/applications/:id/members/:mid   # Remove member
```

### Layouts
```
GET    /api/v1/applications/:id/layout-scopes          # List allowed layout scopes
GET    /api/v1/applications/:id/layouts                # List layouts
POST   /api/v1/applications/:id/layouts                # Create application-owned layout
PATCH  /api/v1/applications/:id/layouts/:layoutId      # Update layout metadata/default/active state
DELETE /api/v1/applications/:id/layouts/:layoutId      # Exclude metahub layout or soft-delete application layout
POST   /api/v1/applications/:id/layouts/:layoutId/copy # Copy layout into an application-owned layout
```

## Roles & Permissions

| Role    | Manage Members | Manage App | Create Content | Edit Content | Delete Content |
|---------|----------------|------------|----------------|--------------|----------------|
| owner   | ✅              | ✅          | ✅              | ✅            | ✅              |
| admin   | ✅              | ✅          | ✅              | ✅            | ✅              |
| editor  | ❌              | ❌          | ✅              | ✅            | ❌              |
| member  | ❌              | ❌          | ✅              | ✅            | ✅              |

## Workspace-Aware Behavior

- `Public` / `Closed` visibility is editable from Application Settings with optimistic locking.
- `workspacesEnabled` remains read-only after creation because it is tied to runtime schema structure.
- The create UI auto-enables workspaces for public apps, but still allows opting out with a warning when a shared data surface is intentional.
- `Add workspaces` is also immutable after creation.
- On first runtime schema creation, the owner and all current members receive a personal `Main` workspace in the database.
- Runtime catalog creation and copy flows enforce workspace boundaries automatically.
- When a workspace limit is reached, the runtime UI disables the create action and shows an informational alert.

## Development

### Running Tests
```bash
pnpm --filter @universo/applications-frontend test
```

### Building
```bash
pnpm --filter @universo/applications-frontend build
```

### Linting
```bash
pnpm --filter @universo/applications-frontend lint
```

## Related Packages

- `@universo/applications-backend` - Backend API for applications
- `@universo/template-mui` - Shared UI components
- `@universo/types` - Shared TypeScript types
- `@universo/i18n` - Internationalization utilities

## License

Omsk Open License
