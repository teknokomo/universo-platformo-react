# @universo/flowise-leads-frontend

Frontend module for Leads management in Universo Platformo.

## Overview

This is a minimal package that provides namespace exports for leads functionality. The actual UI components remain in `@flowise/template-mui` and will be migrated in future iterations.

## Package Information

- **Package**: `@universo/flowise-leads-frontend`
- **Version**: `0.1.0`
- **Type**: Frontend (Modern)
- **Framework**: React, TypeScript
- **Dependencies**: `@universo/api-client`, `@flowise/template-mui`

## Current State

This package currently serves as a placeholder for future leads UI components. The actual components are located in:

- **ViewLeadsDialog**: `@flowise/template-mui/ui-components/dialog/ViewLeadsDialog.jsx`
- **Leads**: `@flowise/template-mui/ui-components/extended/Leads.jsx`

## i18n Namespaces

Translations are located in `@universo/i18n`:
- `viewLeads` - Dialog translations (`locales/*/dialogs/view-leads.json`)
- `canvas:configuration.leads` - Configuration translations (`locales/*/views/canvas.json`)

## Installation

```bash
pnpm add @universo/flowise-leads-frontend
```

## Exports

### Constants
- `LEADS_NAMESPACE` - Namespace identifier for leads functionality

### Types (re-exported from @universo/flowise-leads-backend)
- `ILead` - Lead entity interface
- `CreateLeadBody` - Create request body type

## File Structure

```
packages/flowise-leads-frontend/
├── base/
│   ├── src/
│   │   └── index.ts           # Entry point with exports
│   ├── package.json
│   ├── README.md              # This file
│   └── README-RU.md           # Russian documentation
└── package.json               # Workspace configuration
```

## Future Plans

In future iterations, the following components will be migrated to this package:
- ViewLeadsDialog component
- Leads configuration component
- Dedicated i18n namespace

## License

Omsk Open License
