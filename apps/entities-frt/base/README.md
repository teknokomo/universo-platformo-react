# Entities Frontend (entities-frt)

Frontend application for managing entities and templates within the Universo Platformo ecosystem.

## Overview

The Entities Frontend provides UI components to browse, create and configure entities based on reusable templates.

## Key Features

- **Entity Listing**: Table view with search and filters by template and status
- **Entity Details**: Tabs for information, owners and assigned resources
- **Creation & Editing**: Dialog form with template selection, root resource picker and owner assignment
- **Template Management**: List and dialog for editing `EntityTemplate` with embedded `ResourceConfigTree`
- **Internationalization**: English and Russian translations
- **Navigation**: Integrates with main platform menu

## Structure

```
src/
├── i18n/                      # Internationalization resources
│   ├── locales/               # Language-specific translations
│   └── index.ts               # i18n configuration
├── menu-items/
│   └── entitiesDashboard.js   # Dashboard menu items
├── pages/                     # React page components
│   ├── EntityList.tsx         # Entity table with search and filters
│   ├── EntityDetail.tsx       # Detail view with tabs
│   ├── EntityDialog.tsx       # Create/edit dialog
│   ├── TemplateList.tsx       # Template list
│   └── TemplateDialog.tsx     # Template create/edit dialog
└── index.ts                   # Package exports
```

## Components

### EntityList.tsx
Displays entities in a table with search and filter controls for template and status.

### EntityDetail.tsx
Shows entity information across tabs: general info, owners and assigned resources tree.

### EntityDialog.tsx
Modal form for creating or editing entities with template selection, root resource picker and owner assignment.

### TemplateList.tsx
Lists available `EntityTemplate` records with basic details.

### TemplateDialog.tsx
Modal dialog for creating or updating `EntityTemplate`. Embeds the `ResourceConfigTree` to edit resource schema.

## Development

### Prerequisites
- Node.js 18+
- PNPM package manager

### Commands
```bash
# Install dependencies
pnpm install

# Build the application
pnpm --filter @universo/entities-frt build

# Lint sources
pnpm --filter @universo/entities-frt lint
```

## Related Documentation
- [Entities Application Docs](../../../docs/en/applications/entities/README.md)
- [Backend Service](../entities-srv/base/README.md)

---

**Universo Platformo | Entities Frontend Application**
