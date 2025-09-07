# Resources Frontend (resources-frt)

Frontend application for managing reusable resources in the Universo Platformo ecosystem.

## Overview

The Resources Frontend provides UI workflows to browse, create and compose resources. Users can filter resources by category,
inspect revision history and build hierarchical compositions.

## Key Features

- **Resource Listing**: Table view with category tree filter
- **Resource Details**: Tabs for information, revision history and child resources
- **Creation & Editing**: Dialog form with localized titles and descriptions, metadata selectors and embedded composition editor
- **Internationalization**: English and Russian translations
- **Navigation**: Integrates with main platform menu

## Structure

```
src/
├── i18n/             # Internationalization resources
│   ├── locales/      # Language-specific translations
│   └── index.js      # i18n configuration
├── components/
│   └── ResourceConfigTree.tsx   # Recursive composition editor
├── pages/            # React page components
│   ├── ResourceList.tsx         # Resource table with category filter
│   ├── ResourceDetail.tsx       # Detail view with tabs
│   └── ResourceDialog.tsx       # Create/edit dialog
├── menu-items/
│   └── resourcesDashboard.js    # Dashboard menu items
└── index.ts          # Package exports
```

## Components

### ResourceList.tsx
Displays resources in a table and allows filtering by hierarchical categories.

### ResourceDetail.tsx
Shows resource information with tabs for metadata, revision history and child composition tree.

### ResourceDialog.tsx
Modal form for creating or editing resources. Provides separate English and Russian titles and descriptions, dropdowns for category, state and storage type, client-side validation, and embeds the `ResourceConfigTree`.

### ResourceConfigTree.tsx
Recursive UI component that lets users add or remove `ResourceComposition` nodes to define nested resource structures.

## Development

### Prerequisites
- Node.js 18+
- PNPM package manager

### Commands
```bash
# Install dependencies
pnpm install

# Build the application
pnpm --filter @universo/resources-frt build

# Lint sources
pnpm --filter @universo/resources-frt lint
```

### API Usage

Use the shared `useApi` hook for server requests. Include the returned `request` function in effect dependency arrays to trigger calls once on mount:

```javascript
const { request } = useApi(fetchList)

useEffect(() => {
    request()
}, [request])
```

## Related Documentation
- [Resources Application Docs](../../../docs/en/applications/resources/README.md)
- [Backend Service](../resources-srv/base/README.md)

---

**Universo Platformo | Resources Frontend Application**
