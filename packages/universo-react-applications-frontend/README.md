# @universo-react/applications-frontend

> 🏗️ **Modern Package** - TypeScript-first architecture with dual build system

Frontend application for managing applications and connectors in the Universo Platformo ecosystem.

## Package Information

-   **Package**: `@universo-react/applications-frontend`
-   **Version**: `0.1.0`
-   **Type**: React Frontend Package (Modern)
-   **Framework**: React 18 + TypeScript + Material-UI
-   **Build System**: tsdown (dual build - CJS + ESM)
-   **Testing**: Vitest + React Testing Library

## Key Features

### 🌍 Application Management

-   **Two-Tier Architecture**: Applications → Connectors (streamlined data organization)
-   **Complete Data Isolation**: Data from different applications is completely separated
-   **Role-Based Access**: User roles and permissions for application access control
-   **Context-Aware Navigation**: Application-aware routing with breadcrumbs and sidebar preservation
-   **Mutable Visibility**: Application owners/admins can switch applications between closed and public after creation
-   **Public Discovery + Join**: Public applications are visible to regular users and support explicit join / leave flows
-   **Workspace Isolation**: Workspace-enabled applications isolate runtime object rows per user workspace
-   **Workspace Limits**: Admin settings expose per-object row limits at the workspace boundary

### 🗂️ Connectors

-   **Connectors**: Data containers that define the structure of your application
-   **Flexible Schema**: Each connector can have its own configuration

### 🧩 Layouts

-   **Application Layouts**: Application admins can customize metahub-published layouts and create application-owned layouts.
-   **Entity Scopes**: Global layouts and entity-scoped layouts share one authoring model, so Home-only widgets can stay scoped to a Page while other runtime sections use the global shell.
-   **Source Awareness**: Layout cards show whether a layout came from a metahub publication or from the application.
-   **Runtime-Safe Toggles**: Inactive layouts and widgets remain editable but are excluded from runtime rendering.
-   **Runtime Widget Overrides**: Application-level settings update materialized widget configuration for the deployed instance without changing the source metahub template.

### 🎨 User Interface

-   **Material-UI Integration**: Consistent UI components with modern design system
-   **Responsive Design**: Optimized for desktop and mobile experiences
-   **Table & Grid Views**: Flexible data presentation with pagination and search
-   **Dialog Forms**: Modal forms for creating and editing entities
-   **Tabbed Application Forms**: Create, edit, and copy dialogs reuse the shared `General / Parameters` pattern
-   **Settings Surface**: Applications with runtime schema expose `General` and `Limits` settings tabs, plus feature-specific tabs derived from active materialized layout widgets. Interpretation Network Matrix settings are saved to the `interpretationNetworkWorkspace` widget config; LMS Learning Content is not shown or saved for unrelated configurations.

### 🧭 Interpretation Network Matrix Settings

-   The Application control panel owns deployment-specific Matrix display overrides for active materialized `interpretationNetworkWorkspace` widgets.
-   Administrators select a non-empty allowed subset of `table`, `horizontalRows`, and `verticalTree`, then choose `defaultMatrixView` from that subset.
-   Save applies one coherent configuration to all active Interpretation Network workspace widgets. If the widgets currently disagree, the UI shows a localized warning and normalizes the saved state instead of presenting raw JSON or widget IDs.
-   Matrix view settings do not create or edit workspace content. Structures, cells, Relations, Materials, and table templates remain authored in the published workspace.
-   Narrow screens stack settings controls, use full-width inputs, and keep validation and snackbar feedback localized.

### 🔧 Technical Features

-   **TypeScript-First**: Full TypeScript implementation with strict typing
-   **React Query Integration**: Advanced data fetching and caching with TanStack Query v5
-   **Internationalization**: English and Russian translations with i18next
-   **Form Validation**: Comprehensive validation with Zod schemas
-   **API Integration**: RESTful API client with authentication
-   **Migration Guard**: Unified schema update guard with severity levels

> **Migration documentation**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)

## Installation & Setup

### Prerequisites

```bash
# System requirements
Node.js >= 22.6.0
PNPM >= 10.0.0
```

### Installation

```bash
# Install dependencies
pnpm install

# Build the package
pnpm --filter @universo-react/applications-frontend build

# Run tests
pnpm --filter @universo-react/applications-frontend test
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
} from '@universo-react/applications-frontend'

// Import i18n resources (auto-registers namespace)
import '@universo-react/applications-frontend/i18n'

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

-   **ApplicationList**: Main list view with search, pagination, and CRUD operations
-   **ApplicationBoard**: Dashboard with statistics and overview
-   **ConnectorList**: Manage connectors within an application
-   **ApplicationLayouts**: Manage application-side layouts, layout sources, defaults, activation, and widget zones
-   **ApplicationMembers**: Manage user access and roles

### Directory Structure

```
packages/universo-react-applications-frontend/
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
GET    /api/v1/applications/:id/settings/limits # Read workspace object limits
PUT    /api/v1/applications/:id/settings/limits # Update workspace object limits
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

| Role   | Manage Members | Manage App | Create Content | Edit Content | Delete Content |
| ------ | -------------- | ---------- | -------------- | ------------ | -------------- |
| owner  | ✅             | ✅         | ✅             | ✅           | ✅             |
| admin  | ✅             | ✅         | ✅             | ✅           | ✅             |
| editor | ❌             | ❌         | ✅             | ✅           | ❌             |
| member | ❌             | ❌         | ✅             | ✅           | ✅             |

## Workspace-Aware Behavior

-   `Public` / `Closed` visibility is editable from Application Settings with optimistic locking.
-   `workspacesEnabled` is resolved during connector schema sync from the publication-version workspace policy and connector schema options.
-   The application create and copy dialogs do not expose a workspace toggle.
-   Once schema sync enables workspaces, later connector syncs cannot turn them off.
-   On first runtime schema creation, the owner and all current members receive a personal `Main` workspace in the database.
-   Runtime object creation and copy flows enforce workspace boundaries automatically.
-   When a workspace limit is reached, the runtime UI disables the create action and shows an informational alert.

## Development

### Running Tests

```bash
pnpm --filter @universo-react/applications-frontend test
```

### Building

```bash
pnpm --filter @universo-react/applications-frontend build
```

### Linting

```bash
pnpm --filter @universo-react/applications-frontend lint
```

## Related Packages

-   `@universo-react/applications-backend` - Backend API for applications
-   `@universo-react/template-mui` - Shared UI components
-   `@universo-react/types` - Shared TypeScript types
-   `@universo-react/i18n` - Internationalization utilities

## License

Omsk Open License
