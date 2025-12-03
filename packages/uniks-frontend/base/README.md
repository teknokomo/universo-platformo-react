# @universo/uniks-frontend

> 🏢 Frontend application for workspace management functionality in the Universo Platformo ecosystem

## Package Information

| Field | Value |
|-------|-------|
| **Package Name** | `@universo/uniks-frontend` |
| **Version** | See `package.json` |
| **Type** | React Frontend Application |
| **Build** | TypeScript-first with Material-UI |
| **Purpose** | Workspace management interface with role-based access control |

> Q3 2025 Update: Interface aligned with new backend architecture (schema `uniks`, expanded roles `owner/admin/editor/member`, Passport.js + Supabase hybrid auth, membership-based access control).

## 🚀 Key Features

- 🏢 **Workspace Management**: Create, edit, delete (role-gated)
- 👥 **Member Management**: Add/remove & view roles (live constraints)
- 🎭 **Expanded Role Awareness**: UI reacts to `owner/admin/editor/member`
- 📱 **Responsive UI**: Material-UI component system
- 🌍 **Internationalization**: English & Russian parity
- 🔗 **Navigation Integration**: Unified platform routing

## Overview

The Uniks Frontend application provides a user-friendly interface for creating, managing, and organizing workspaces. It offers workspace listing, creation, editing, and member management capabilities with full internationalization support.

## Structure

```
src/
├── i18n/           # Internationalization resources
│   ├── locales/    # Language-specific translations
│   └── index.js    # i18n configuration
├── pages/          # React page components
│   ├── UnikList.jsx    # Workspace listing page
│   ├── UnikDetail.jsx  # Workspace detail view
│   └── UnikDialog.jsx  # Workspace creation/editing dialog
├── menu-items/     # Menu configuration
│   └── unikDashboard.js # Dashboard menu items
└── index.js        # Application entry point
```

## Components

### UnikList.jsx

Main workspace listing page that displays all user workspaces with filtering and search capabilities.

### UnikDetail.jsx

Detailed view of a specific workspace showing workspace information and member management.

### UnikDialog.jsx

Modal dialog for creating new workspaces or editing existing ones.

## Internationalization

The application supports multiple languages through the i18n system:

-   **English**: Default language with complete translations
-   **Russian**: Full Russian localization

Translation keys are organized under the `uniks` namespace.

## Integration

This application integrates with:

- **Main UI Package**: Routed via shared shell layout
- **Uniks Backend**: Calls `@universo/uniks-backend` endpoints (role-gated)
- **Hybrid Auth Layer**: Passport.js session context + Supabase identity
- **Access Control Hooks**: Derived capabilities from membership data

## Development

### Prerequisites

-   Node.js 18+
-   PNPM package manager
-   Access to the Universo Platformo workspace

### Installation

```bash
# Install dependencies
pnpm install

# Build the application
pnpm build

# Run in development mode
pnpm dev
```

### Build Commands

```bash
# Build for production
pnpm build

# Build with watch mode
pnpm dev

# Build specific components
pnpm build --filter @universo/uniks-frontend
```

### API Usage

Use the shared `useApi` hook for backend calls. Include the returned `request` function in effect dependency arrays so requests execute only once when components mount:

```javascript
const { request } = useApi(fetchList)

useEffect(() => {
    request()
}, [request])
```

## Configuration

The application uses the following configuration:

-   **TypeScript**: Strict type checking enabled
-   **Material-UI**: Component library for UI elements
-   **i18next**: Internationalization framework
-   **React**: Frontend framework

## Dependencies

### Core Dependencies

-   `react`: Frontend framework
-   `@mui/material`: Material-UI component library
-   `@mui/icons-material`: Material-UI icons
-   `i18next`: Internationalization framework
-   `react-i18next`: React integration for i18next

### Development Dependencies

-   `typescript`: TypeScript compiler
-   `@types/react`: TypeScript definitions for React
-   `gulp`: Build tool for asset processing

## API Integration

The application communicates with the backend through shared platform API utilities:

- Workspace CRUD (schema-qualified server layer)
- Membership listing & mutation
- Role derivation -> conditional UI rendering
- Session state (Passport.js) + identity (Supabase) consumption

## Testing

Role-aware UI behavior should be covered by component tests (e.g. action buttons hidden for `member` but visible for `admin`). Suggested areas:

- Workspace list rendering (empty, populated, filtered)
- Membership role badge display
- Conditional action menus per role
- Dialog form validation & submission lifecycle

Run tests (if configured):

```bash
pnpm --filter @universo/uniks-frontend test
```

If a test harness is not yet present, add one under `src/__tests__/` using React Testing Library.

## Contributing

When contributing to this package:

1. Preserve role-based conditional rendering (avoid hard-coded role names)
2. Maintain i18n parity (EN/RU) — no untranslated strings
3. Keep network logic inside shared hooks/services (no ad-hoc fetch in components)
4. Avoid direct assumptions about membership shape (use exported types)
5. Follow accessibility guidelines (focus management in dialogs)

## Related Documentation

-   [Main Apps Documentation](../README.md)
-   [Uniks Backend Documentation](../uniks-backend/base/README.md)
-   [Platform Architecture](../../../docs/en/applications/README.md)

---

**Universo Platformo | Uniks Frontend Application**
