# @universo/admin-frontend

> ✨ **Modern Package** - React 18 with TypeScript and Material-UI

Frontend application for the Admin Panel with global user management capabilities.

## Package Information

- **Version**: 0.1.0
- **Type**: React Frontend Package (Modern)
- **Framework**: React 18 + TypeScript + Material-UI
- **Build System**: tsdown (dual build - CJS + ESM)

## Key Features

### 👥 Global User Management
- **List View**: Paginated table with search and filtering
- **Role Assignment**: Grant `Superuser`, `User`, or custom global roles by email
- **Role Updates**: Change roles and add/edit comments
- **Access Revocation**: Remove global access from users

### 🎨 User Interface
- **Material-UI Integration**: Modern components with consistent design
- **Table & Card Views**: Toggle between display modes
- **Role Chips**: Color-coded role indicators
- **Confirmation Dialogs**: Safe deletion with confirmation

### 🔧 Technical Features
- **TanStack Query**: Optimistic updates and cache management
- **Internationalization**: English and Russian translations
- **Codename Editing**: Role forms use one canonical localized codename field
- **Type Safety**: Full TypeScript with strict typing

## Installation

```bash
# Build the package
pnpm --filter @universo/admin-frontend build

# Run development mode
pnpm --filter @universo/admin-frontend dev
```

## Usage

### Page Components

```tsx
import { AdminAccess, AdminBoard } from '@universo/admin-frontend'

// In your routes
<Route path="/admin/access" element={<AdminAccess />} />
<Route path="/admin/board" element={<AdminBoard />} />
```

### React Query Hooks

```tsx
import { useIsSuperadmin, useGrantGlobalRole } from '@universo/admin-frontend'

function MyComponent() {
    const isSuperadmin = useIsSuperadmin()
    const grantMutation = useGrantGlobalRole()
    
    const handleGrant = () => {
        grantMutation.mutate({
            email: 'user@example.com',
            role: 'User',
            comment: 'Access granted for project review'
        })
    }
}
```

### i18n Integration

```tsx
// Import and register translations
import '@universo/admin-frontend/i18n'

// Use translations
const { t } = useTranslation('admin')
t('board.title') // "Administration Dashboard"
```

## API Layer

### Query Keys

```typescript
import { adminQueryKeys } from '@universo/admin-frontend'

// Available keys
adminQueryKeys.globalUsersList(params)  // List with pagination
adminQueryKeys.globalUsersMe()          // Current user's role
adminQueryKeys.globalUsersStats()       // Dashboard statistics
```

### API Client

```typescript
import { createAdminApi } from '@universo/admin-frontend'

const adminApi = createAdminApi(axiosInstance)

// Methods
adminApi.listGlobalUsers(params)
adminApi.getMyGlobalRole()
adminApi.grantGlobalRole(data)
adminApi.updateGlobalRole(id, data)
adminApi.revokeGlobalRole(id)
```

## File Structure

```
packages/admin-frontend/base/
├── src/
│   ├── api/
│   │   ├── adminApi.ts        # API client with pagination
│   │   ├── apiClient.ts       # Axios instance
│   │   └── queryKeys.ts       # TanStack Query keys
│   ├── hooks/
│   │   ├── useGlobalRole.ts   # Role state hooks
│   │   └── index.ts
│   ├── pages/
│   │   ├── AdminAccess.tsx    # User management page
│   │   ├── AdminBoard.tsx     # Dashboard page
│   │   └── MemberActions.tsx  # Action handlers
│   ├── types/
│   │   └── index.ts           # TypeScript interfaces
│   ├── i18n/
│   │   ├── en.json            # English translations
│   │   └── ru.json            # Russian translations
│   └── index.ts               # Package exports
├── dist/                       # Built files
└── package.json
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-query` | catalog | Data fetching & caching |
| `@mui/material` | catalog | UI components |
| `axios` | catalog | HTTP client |
| `react-i18next` | catalog | Internationalization |

## Peer Dependencies

This package expects the following to be provided by the host application:

```json
{
    "react": ">=18",
    "react-dom": ">=18",
    "react-router-dom": ">=6"
}
```

## Related Packages

- `@universo/admin-backend` - Backend API for admin panel
- `@universo/auth-frontend` - Authentication hooks
- `@universo/template-mui` - Shared UI components
- `@universo/types` - Shared TypeScript types
