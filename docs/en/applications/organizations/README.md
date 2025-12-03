# Organizations (Organizations)

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo. Some sections may still reference Flowise functionality,          Universo Platformo.

## Application Components

- **Frontend Package**: `@universo/organizations-frontend`
- **Backend Package**: `@universo/organizations-backend`

## Functionality Overview

The Organizations application provides a comprehensive organization management system with a three-level hierarchical structure. The module allows you to create organizations, manage departments within them, and control positions (roles) in each department with full data isolation between organizations.

### Architecture: Organizations → Departments → Positions

```
┌─────────────────────────────────────┐
│ Organization ()           │
│ ┌─────────────────────────────────┐ │
│ │ Department ()         │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │ Position (/)│ │ │
│ │ └─────────────────────────────┘ │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Key Features

### 🏢 Organization Management
- Creating, editing, and deleting organizations
- Hierarchical structure with full data isolation
- Role-based access control (RBAC)
- Managing organization members with roles

### 📊 Departments
- Logical groups within the organization
- Binding to a specific organization
- Managing positions within the department

### 👤 Positions (Roles)
- Individual positions in departments
- Mandatory department membership (no empty options)
- Metadata for each position
- Full isolation between organizations

### 🎨 User Interface
- Material-UI components with modern design
- Table and card data views
- Pagination and search
- Dialog forms for CRUD operations
- Responsive design for desktop and mobile

### 🌍 Internationalization
- Full support for English and Russian languages
- i18next integration
- Centralized translations in `@universo/i18n`

## Technical Details

### Frontend
- **[More about frontend package →](frontend.md)**
- React 18 + TypeScript + Material-UI
- React Query for data caching
- Dual build (CJS + ESM)

### Backend
- **[More about backend package →](backend.md)**
- Express.js + TypeORM
- PostgreSQL with migrations
- RESTful API endpoints

## Integration with Other Applications

### Dependencies
- **Workspaces (Uniks)**: Organizations work in the workspace context
- **Authentication**: Passport.js + Supabase for authentication
- **Profile**: Connection to user profiles through roles

### Infrastructure Packages Used
- `@universo/types` - Common types (OrganizationRole, validation schemas)
- `@universo/i18n` - Translations (organizations namespace)
- `@universo/template-mui` - UI components (ItemCard, tables, dialogs)
- `@universo/api-client` - HTTP client for API requests 

## Database Schema

### Tables

#### `organizations`
- `id` (uuid, PK)
- `name` (text, NOT NULL)
- `description` (text)
- `createdDate` (timestamp)
- `updatedDate` (timestamp)

#### `organizations_users` (many-to-many relationship)
- `id` (uuid, PK)
- `organizationId` (uuid, FK)
- `userId` (uuid, FK)
- `role` (OrganizationRole: 'owner' | 'admin' | 'editor' | 'member')
- `@Unique(['organizationId', 'userId'])`

#### `departments`
- `id` (uuid, PK)
- `name` (text, NOT NULL)
- `description` (text)
- `organizationId` (uuid, FK) - mandatory relationship

#### `departments_organizations` (many-to-many relationship)
- `id` (uuid, PK)
- `departmentId` (uuid, FK)
- `organizationId` (uuid, FK)
- `@Unique(['departmentId', 'organizationId'])`

#### `positions`
- `id` (uuid, PK)
- `name` (text, NOT NULL)
- `description` (text)
- `metadata` (jsonb) - additional fields
- `departmentId` (uuid, FK) - mandatory relationship

#### `positions_departments` (many-to-many relationship)
- `id` (uuid, PK)
- `positionId` (uuid, FK)
- `departmentId` (uuid, FK)
- `@Unique(['positionId', 'departmentId'])`

#### `positions_organizations` (many-to-many relationship)
- `id` (uuid, PK)
- `positionId` (uuid, FK)
- `organizationId` (uuid, FK)
- `@Unique(['positionId', 'organizationId'])`

## Usage Examples

### Creating Organization via API
```typescript
POST /api/v1/organizations
{
  "name": "Acme Corp",
  "description": "Main company organization"
}
```

### Adding Department
```typescript
POST /api/v1/organizations/:orgId/departments
{
  "name": "IT Department",
  "description": "Information Technology"
}
```

### Creating Position in Department
```typescript
POST /api/v1/organizations/:orgId/departments/:deptId/positions
{
  "name": "Senior Developer",
  "description": "Experienced developer",
  "metadata": {
    "level": "senior",
    "experience": "5+ years"
  }
}
```

## Security

### Data Isolation
- Full isolation of positions and departments between organizations
- No cross-organization visibility
- Frontend and backend validation to prevent data leaks

### Access Control
- Role-based access rights (Owner, Admin, Editor, Member)
- TypeORM middleware for membership checking
- Row-Level Security (RLS) policies as an additional layer

### Role Hierarchy
- **Owner** (4): Full control over the organization
- **Admin** (3): Managing members and structure
- **Editor** (2): Editing content
- **Member** (1): Viewing data  

## Development Status

- ✅ Backend entities (Organizations, Departments, Positions)
- ✅ TypeORM migrations (PostgreSQL)
- ✅ RESTful API endpoints
- ✅ Frontend components (List, Board, Forms)
- ✅ i18n (EN, RU)
- ✅ Integration with flowise-ui
- ✅ Dual build (CJS + ESM)
- ✅ Vitest tests

**Launch Date**: Q4 2024
**Current Version**: 0.1.0

## Next Steps

- Study [Frontend Package](frontend.md) to understand UI components
- Study [Backend Package](backend.md) to understand API and database
- See [Applications Main Page](../README.md) to understand overall architecture    
