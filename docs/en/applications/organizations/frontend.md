# Organizations Frontend (`@universo/organizations-frt`)

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo. Some sections may still reference Flowise functionality that has not yet been fully updated for Universo Platformo-specific capabilities.

## Overview

The frontend package of the Organizations module provides a complete user interface for managing a three-tier organizational structure (Organizations → Departments → Positions). Built with React 18, TypeScript, and Material-UI with internationalization support.

## Technology Stack

- **React**: 18.x (with hooks)
- **TypeScript**: Full typing
- **UI Framework**: Material-UI (MUI) v5
- **State Management**: React Query for server state
- **Routing**: React Router v6
- **i18n**: i18next (EN/RU)
- **Forms**: React Hook Form + Zod validation
- **Build**: tsdown (dual CJS + ESM)

## Package Architecture

```
packages/organizations-frt/base/
├── src/
│   ├── api/              # API Client
│   │   └── organizations.ts
│   ├── components/       # React component
│   │   ├── OrganizationList.tsx
│   │   ├── OrganizationDetail.tsx
│   │   ├── OrganizationMembers.tsx
│   │   ├── DepartmentList.tsx
│   │   ├── PositionList.tsx
│   │   └── forms/
│   │       ├── OrganizationForm.tsx
│   │       ├── DepartmentForm.tsx
│   │       └── PositionForm.tsx
│   ├── hooks/            # Custom React hooks
│   │   ├── useOrganizations.ts
│   │   ├── useDepartments.ts
│   │   └── usePositions.ts
│   ├── types/            # TypeScript 
│   │   └── index.ts
│   └── i18n/             # Translations
│       ├── en/
│       │   └── organizations.json
│       └── ru/
│           └── organizations.json
├── dist/                 # Compiled output
│   ├── index.js         # CJS
│   └── index.mjs        # ESM
├── package.json
├── tsconfig.json
└── tsconfig.esm.json
```

## Main Components

### 1. OrganizationList

Organization list with pagination, search, and filtering.

**Features:**
- Display organizations as cards or table
- Search by name
- Pagination (10/25/50 items)
- Actions: create, edit, delete, view members

**Usage Example:**
```tsx
import { OrganizationList } from '@universo/organizations-frt';

function MyPage() {
  return <OrganizationList />;
}
```

### 2. OrganizationDetail

Organization detail page with tabs.

**Tabs:**
- **Overview**: Basic information (name, description, slug)
- **Departments**: Organization's department list
- **Positions**: Organization's position list
- **Members**: User membership management

**Props:**
```tsx
interface OrganizationDetailProps {
  organizationId: string;
}
```

### 3. OrganizationMembers

User membership management component.

**Features:**
- Member list with roles (owner/admin/member)
- Adding new members
- Role changes
- Removing members
- Access Control

**Roles:**
- `owner`: Full access, ownership transfer
- `admin`: Member and settings management
- `member`: View and basic operations

### 4. DepartmentList

Department list with hierarchy.

**Features:**
- Display departments of current organization
- Department-organization relationship (many-to-many)
- CRUD operations
- Filter by organization

### 5. PositionList

Position list with hierarchy.

**Features:**
- Display positions linked to departments and organizations
- CRUD operations
- Filter by department/organization
- Display position metadata

## Forms

### OrganizationForm

Organization create/edit form.

**Fields:**
- `name` (required): Organization name
- `description`: Description
- `slug` (auto-generated): URL-friendly identifier
- `metadata`: Additional data (JSON)

**Validation:**
```typescript
const schema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  metadata: z.record(z.any()).optional()
});
```

### DepartmentForm

Department form with parent organization selection.

**Fields:**
- `name`: Department name
- `description`: Description
- `organizations`: Array of organization IDs (many-to-many)

### PositionForm

Position form with department and organization selection.

**Fields:**
- `name`: Position name
- `description`: Description
- `departmentId`: Department ID
- `organizationId`: Organization ID
- `metadata`: Additional data

## Hooks

### useOrganizations

React Query hook    .

**Methods:**
```typescript
const {
  organizations,      // Organization list
  isLoading,         // Loading
  error,             // Error
  createOrganization,// Create
  updateOrganization,// Update
  deleteOrganization,// Delete
  refetch            // Update 
} = useOrganizations();
```

**Caching:**
- React Query automatically caches data
- Stale time: 5 minutes
- Cache time: 10 minutes

### useDepartments

Hook    .

```typescript
const {
  departments,
  isLoading,
  createDepartment,
  updateDepartment,
  deleteDepartment
} = useDepartments(organizationId);
```

### usePositions

Hook    .

```typescript
const {
  positions,
  isLoading,
  createPosition,
  updatePosition,
  deletePosition
} = usePositions({ organizationId, departmentId });
```

## API Client

### Configuration

```typescript
import { OrganizationsApi } from '@universo/organizations-frt';

const api = new OrganizationsApi({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  timeout: 10000
});
```

### Methods

**Organizations:**
```typescript
api.getOrganizations({ page, limit, search })
api.getOrganization(id)
api.createOrganization(data)
api.updateOrganization(id, data)
api.deleteOrganization(id)
api.getOrganizationMembers(id)
api.addOrganizationMember(id, { userId, role })
api.updateOrganizationMemberRole(orgId, userId, role)
api.removeOrganizationMember(orgId, userId)
```

**Departments:**
```typescript
api.getDepartments({ organizationId, page, limit })
api.createDepartment(data)
api.updateDepartment(id, data)
api.deleteDepartment(id)
```

**Positions:**
```typescript
api.getPositions({ organizationId, departmentId, page, limit })
api.createPosition(data)
api.updatePosition(id, data)
api.deletePosition(id)
```

## Internationalization

### Translation Structure

**Russian** (`i18n/ru/organizations.json`):
```json
{
  "organization": {
    "title": "Organizations",
    "create": "Create organization",
    "edit": "Edit organization",
    "delete": "Delete organization"
  },
  "department": {
    "title": "Departments",
    "create": "Create department"
  },
  "position": {
    "title": "Positions",
    "create": "Create position"
  },
  "members": {
    "title": "Members",
    "add": "Add member",
    "role": {
      "owner": "Owner",
      "admin": "Administrator",
      "member": "Member"
    }
  }
}
```

**English** (`i18n/en/organizations.json`): similar with translation.

### Usage

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('organizations');
  
  return <h1>{t('organization.title')}</h1>;
}
```

## Application Integration

### Adding to Flowise UI

**1. Install dependency:**
```json
{
  "dependencies": {
    "@universo/organizations-frt": "workspace:*"
  }
}
```

**2. Import components:**
```tsx
// In flowise-ui/src/index.jsx
import {
  OrganizationList,
  OrganizationDetail
} from '@universo/organizations-frt';
```

**3. Add routes:**
```tsx
// In template-mui/src/routes/MainRoutesMUI.tsx
import { OrganizationList, OrganizationDetail } from '@universo/organizations-frt';

const routes = [
  {
    path: '/organizations',
    element: <OrganizationList />
  },
  {
    path: '/organizations/:id',
    element: <OrganizationDetail />
  }
];
```

**4. Add to menu:**
```tsx
// In template-mui/src/config/menuConfigs.ts
export const getOrganizationMenuItems = (t) => [
  {
    id: 'organizations',
    title: t('menu.organizations'),
    type: 'item',
    url: '/organizations',
    icon: icons.OrganizationIcon
  }
];
```

## Styling

### Theme Customization

```tsx
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@universo/template-mui';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2'
    }
  }
});

<ThemeProvider theme={theme}>
  <OrganizationList />
</ThemeProvider>
```

### CSS Classes

CSS modules and styled-components are used:

```tsx
import { styled } from '@mui/material/styles';

const OrganizationCard = styled('div')(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius
}));
```

## Security

### Access Control

```tsx
import { useAuth } from '@universo/auth-frt';

function SecureComponent() {
  const { user, hasPermission } = useAuth();
  
  if (!hasPermission('organization:write')) {
    return <AccessDenied />;
  }
  
  return <OrganizationForm />;
}
```

### RLS Integration

Frontend automatically sends Supabase JWT in headers:

```typescript
axios.interceptors.request.use(config => {
  const token = getSupabaseToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

## Testing

### Unit Tests

```tsx
import { render, screen } from '@testing-library/react';
import { OrganizationList } from './OrganizationList';

test('renders organization list', () => {
  render(<OrganizationList />);
  expect(screen.getByText('Organizations')).toBeInTheDocument();
});
```

### Integration Tests

```tsx
import { QueryClient, QueryClientProvider } from 'react-query';

const queryClient = new QueryClient();

test('creates organization', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <OrganizationForm onSubmit={mockSubmit} />
    </QueryClientProvider>
  );
  // ... creation test
});
```

## Performance

### Optimizations

1. **Lazy loading**: Components are loaded on demand
2. **Memoization**: React.memo for heavy components
3. **Virtualization**: react-window for long lists
4. **Debounce**: Search with delay 300ms
5. **Caching**: React Query automatically caches

### Bundle size

```
@universo/organizations-frt
├── CJS: 15.18 kB
└── ESM: 14.04 kB
```

## Roadmap

- [ ] Drag & drop for hierarchy changes
- [ ] Bulk operations (mass delete/edit)
- [ ] Export to CSV/Excel
- [ ] Hierarchy visualization (org chart)
- [ ] Customizable metadata fields
- [ ] Webhooks for events

## Related Documentation

- [Organizations Backend](backend.md) - Backend API
- [Organizations Overview](README.md) - Overview
- [@universo/template-mui](../../universo-template-mui/README.md) - UI components
- [@universo/auth-frt](../auth/frontend.md) - Authentication
