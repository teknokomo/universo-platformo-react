# Organizations (Organizations)

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo. Some sections may still reference Flowise functionality,          Universo Platformo.

##  

- **Frontend **: `@universo/organizations-frt`
- **Backend **: `@universo/organizations-srv`

## Overview 

 Organizations         .    ,        ()         .

### : Organizations → Departments → Positions

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

##  

### 🏢  
- ,    
-      
- -   (RBAC)
-     

### 📊 Departments
-    
-    
-    

### 👤 Positions ()
-    
-     (  )
-    
-    

### 🎨  
- Material-UI component   
-     
-   
-    CRUD 
- Responsive   desktop  mobile

### 🌍 Internationalization
-      
- i18next 
-    `@universo/i18n`

##  

### Frontend
- **[  frontend  →](frontend.md)**
- React 18 + TypeScript + Material-UI
- React Query   
-   (CJS + ESM)

### Backend
- **[  backend  →](backend.md)**
- Express.js + TypeORM
- PostgreSQL  
- RESTful API endpoints

## Integration   

### 
- **Workspaces (Uniks)**: Organizations    workspace
- **Authentication**: Passport.js + Supabase  
- **Profile**:      

###   
- `@universo/types` -   (OrganizationRole, validation schemas)
- `@universo/i18n` -  (organizations namespace)
- `@universo/template-mui` - UI component (ItemCard, tables, dialogs)
- `@universo/api-client` - HTTP   API 

##   

### 

#### `organizations`
- `id` (uuid, PK)
- `name` (text, NOT NULL)
- `description` (text)
- `createdDate` (timestamp)
- `updatedDate` (timestamp)

#### `organizations_users` ( many-to-many)
- `id` (uuid, PK)
- `organizationId` (uuid, FK)
- `userId` (uuid, FK)
- `role` (OrganizationRole: 'owner' | 'admin' | 'editor' | 'member')
- `@Unique(['organizationId', 'userId'])`

#### `departments`
- `id` (uuid, PK)
- `name` (text, NOT NULL)
- `description` (text)
- `organizationId` (uuid, FK) -  

#### `departments_organizations` ( many-to-many)
- `id` (uuid, PK)
- `departmentId` (uuid, FK)
- `organizationId` (uuid, FK)
- `@Unique(['departmentId', 'organizationId'])`

#### `positions`
- `id` (uuid, PK)
- `name` (text, NOT NULL)
- `description` (text)
- `metadata` (jsonb) -  
- `departmentId` (uuid, FK) -  

#### `positions_departments` ( many-to-many)
- `id` (uuid, PK)
- `positionId` (uuid, FK)
- `departmentId` (uuid, FK)
- `@Unique(['positionId', 'departmentId'])`

#### `positions_organizations` ( many-to-many)
- `id` (uuid, PK)
- `positionId` (uuid, FK)
- `organizationId` (uuid, FK)
- `@Unique(['positionId', 'organizationId'])`

##  

###    API
```typescript
POST /api/v1/organizations
{
  "name": "Acme Corp",
  "description": "  "
}
```

###  
```typescript
POST /api/v1/organizations/:orgId/departments
{
  "name": "IT Department",
  "description": "form "
}
```

###    
```typescript
POST /api/v1/organizations/:orgId/departments/:deptId/positions
{
  "name": "Senior Developer",
  "description": " ",
  "metadata": {
    "level": "senior",
    "experience": "5+ years"
  }
}
```

## Security

###  
-       
-  cross-organization 
- Frontend  backend     

###  
- -   (Owner, Admin, Editor, Member)
- TypeORM middleware   membership
- Row-Level Security (RLS)    

###  
- **Owner** (4):    
- **Admin** (3):    
- **Editor** (2):  
- **Member** (1):  

##  

- ✅ Backend entities (Organizations, Departments, Positions)
- ✅ TypeORM migrations (PostgreSQL)
- ✅ RESTful API endpoints
- ✅ Frontend components (List, Board, Forms)
- ✅ i18n (EN, RU)
- ✅ Integration  flowise-ui
- ✅   (CJS + ESM)
- ✅ Vitest 

** **: Q4 2024
** **: 0.1.0

##  

-  [Frontend ](frontend.md)   UI component
-  [Backend ](backend.md)   API   
- . [  ](../README.md)    
