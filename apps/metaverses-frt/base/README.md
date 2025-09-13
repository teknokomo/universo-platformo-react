# Metaverses Frontend (metaverses-frt)

Frontend application for managing metaverses, sections, and entities in the Universo Platformo ecosystem.

## Overview

The Metaverses Frontend provides comprehensive UI workflows for managing the three-tier architecture of Metaverses → Sections → Entities. Users can organize entities within section contexts, maintain strict data isolation by metaverses, and manage hierarchical entity compositions with full validation and security.

## Key Features

- **Metaverse Management**: Create and manage entity metaverses with isolated data contexts
- **Section Management**: Organize sections within metaverses with automatic metaverse association
- **Entity Management**: Create and manage entities with mandatory section association
- **Data Isolation**: Complete data separation between metaverses - entities and sections from metaverse A are never visible in metaverse B
- **Contextual Navigation**: Metaverse-aware navigation with breadcrumbs and sidebar context preservation
- **Validation & Security**: Frontend and backend validation ensuring no orphaned entities or sections
- **Internationalization**: English and Russian translations with i18next namespace support
- **Material-UI Integration**: Consistent UI components with proper required field indicators

## Architecture

### Three-Tier Entity Model
- **Metaverses**: Top-level organizational units that provide complete data isolation
- **Sections**: Logical groupings within metaverses (e.g., "Web Services", "Mobile Apps")
- **Entities**: Individual assets that belong to specific sections within metaverses

### Data Isolation
- Entities and sections from different metaverses are completely isolated
- All operations maintain metaverse context through URL routing
- No cross-metaverse data visibility or operations possible

## Structure

```
src/
├── api/              # API client functions
│   ├── metaverses.ts   # Metaverse CRUD and section management
│   ├── sections.ts    # Section CRUD operations
│   ├── entities.ts  # Entity CRUD operations
│   └── index.ts      # API exports
├── components/       # Reusable UI components
│   └── index.ts      # Component exports
├── hooks/            # Custom React hooks
│   └── index.ts      # Hook exports
├── i18n/             # Internationalization
│   ├── locales/      # Language translations (en, ru)
│   └── index.ts      # i18n configuration
├── pages/            # Main page components
│   ├── MetaverseDetail.tsx    # Metaverse detail with sections/entities tabs
│   ├── SectionDetail.tsx     # Section detail within metaverse context
│   ├── SectionDialog.tsx     # Create/edit section dialog
│   └── EntityDialog.tsx   # Create/edit entity dialog
├── menu-items/       # Navigation menu configuration
│   └── metaverseDashboard.ts
├── types/            # TypeScript type definitions
│   └── index.ts
└── index.ts          # Package exports
```

## Key Components

### MetaverseDetail.tsx
Main metaverse management interface with tabbed navigation:
- **Overview**: Metaverse information and statistics
- **Sections**: List of sections within the metaverse with create/edit capabilities
- **Entities**: List of entities within the metaverse with create/edit capabilities
- **Metaverseboard**: Metaverse-specific dashboard and analytics

Features metaverse-aware breadcrumb navigation and maintains metaverse context throughout all operations.

### SectionDetail.tsx
Section detail view within metaverse context:
- Displays section information and associated entities
- Maintains metaverse context in navigation and breadcrumbs
- Provides access to section-specific entity management

### EntityDialog.tsx
Modal form for creating/editing entities with strict validation:
- **Mandatory Section Selection**: Section selection is required with no empty option
- **Metaverse Context**: When opened in metaverse context, shows only sections from that metaverse
- **Validation**: Frontend validation prevents submission without section selection
- **Material-UI Integration**: Proper required field indicators and error states

### SectionDialog.tsx
Modal form for creating/editing sections:
- **Metaverse Association**: Automatically links new sections to current metaverse
- **Validation**: Prevents creation of sections without metaverse association
- **Context Awareness**: Operates within metaverse context for proper data isolation

## API Integration

### Metaverse-Scoped Operations
```typescript
// Get sections for a specific metaverse
const sections = await getMetaverseSections(metaverseId)

// Get entities for a specific metaverse
const entities = await getMetaverseEntities(metaverseId)

// Link section to metaverse
await addSectionToMetaverse(metaverseId, sectionId)
```

### Entity Creation with Validation
```typescript
// Create entity with mandatory section association
const entity = await createEntity({
  name: 'My Entity',
  description: 'Entity description',
  sectionId: 'required-section-id',  // Mandatory
  metaverseId: 'optional-metaverse-id' // Optional for metaverse context
})
```

### Section Creation with Metaverse Context
```typescript
// Create section with mandatory metaverse association
const section = await createSection({
  name: 'My Section',
  description: 'Section description',
  metaverseId: 'required-metaverse-id'  // Mandatory
})
```

## Development

### Prerequisites
- Node.js 18+
- PNPM package manager

### Commands
```bash
# Install dependencies (from project root)
pnpm install

# Build the application
pnpm --filter @universo/metaverses-frt build

# Run tests
pnpm --filter @universo/metaverses-frt test

# Lint sources
pnpm --filter @universo/metaverses-frt lint
```

### Development Notes
- All operations maintain metaverse context through URL routing (`/metaverses/:metaverseId/...`)
- Section selection is mandatory for entity creation with proper validation
- Material-UI components use proper `required` attributes for form validation
- i18next namespace `entities` is used for all translations

### Security Notes
- API authentication currently uses a bearer token from `localStorage` (see `src/api/apiClient.ts`). This is acceptable for development but exposes token to XSS.
- Recommended migration path is HTTP‑only secure cookies with CSRF protection and strict CSP.

## Routing Structure

The application uses nested routing to maintain metaverse context:

```
/metaverses/:metaverseId                    # Metaverse detail (overview tab)
/metaverses/:metaverseId/sections           # Sections tab
/metaverses/:metaverseId/entities         # Entities tab
/metaverses/:metaverseId/metaverseboard      # Metaverseboard tab
/metaverses/:metaverseId/sections/:sectionId # Section detail within metaverse
```

All routes maintain metaverse context in breadcrumbs and sidebar navigation.

## Data Isolation & Security

- **Complete Metaverse Isolation**: Entities and sections from metaverse A are never visible in metaverse B
- **Mandatory Associations**: Entities must be associated with sections, sections must be associated with metaverses
- **Frontend Validation**: Form validation prevents creation of orphaned entities
- **Backend Validation**: Server-side validation ensures data integrity
- **Context Preservation**: Navigation maintains metaverse context throughout user journey

## Related Documentation
- [Metaverses Backend Service](../../../apps/metaverses-srv/base/README.md)
- [Metaverses Application Docs](../../../docs/en/applications/metaverses/README.md)

---

**Universo Platformo | Metaverses Frontend Application**
