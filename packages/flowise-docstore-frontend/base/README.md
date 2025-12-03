# @flowise/docstore-frontend

Frontend package for Document Store and Vector Store management in Universo Platformo.

## Overview

This package provides React components for managing document stores, including:
- Document store CRUD operations
- Document loader configuration
- Chunk management and preview
- Vector store integration
- Upsert history tracking

## Installation

```bash
pnpm add @flowise/docstore-frontend
```

## Dependencies

This package requires the following peer dependencies:
- `@flowise/template-mui` - UI components and theme
- `@universo/api-client` - API client for backend communication
- `@universo/i18n` - Internationalization support

## Usage

### Import Components

```jsx
import {
    DocumentStore,
    DocumentStoreDetail,
    AddDocStoreDialog,
    VectorStoreDialog
} from '@flowise/docstore-frontend'
```

### Import i18n Resources

```jsx
import { registerDocstoreI18n } from '@flowise/docstore-frontend/i18n'

// Add translations to your i18n instance
registerDocstoreI18n()
```

### Direct Page Imports

```jsx
// Document Store main page
import DocumentStore from '@flowise/docstore-frontend/pages/docstore'

// Vector Store dialogs
import VectorStoreDialog from '@flowise/docstore-frontend/pages/vectorstore/VectorStoreDialog'
```

## Components

### Document Store Components

| Component | Description |
|-----------|-------------|
| `DocumentStore` | Main document store list page |
| `DocumentStoreDetail` | Document store detail view |
| `AddDocStoreDialog` | Dialog for adding/editing document stores |
| `DeleteDocStoreDialog` | Confirmation dialog for deletion |
| `DocStoreAPIDialog` | API configuration dialog |
| `DocStoreInputHandler` | Input handling for document stores |
| `DocumentLoaderListDialog` | Document loader selection dialog |
| `DocumentStoreStatus` | Status indicator component |
| `ExpandedChunkDialog` | Dialog for viewing chunk details |
| `LoaderConfigPreviewChunks` | Chunk preview in loader config |
| `ShowStoredChunks` | Display stored chunks |
| `UpsertHistoryDetailsDialog` | Upsert history details |
| `UpsertHistorySideDrawer` | Side drawer for upsert history |
| `VectorStoreConfigure` | Vector store configuration |
| `VectorStoreQuery` | Vector store query interface |

### Vector Store Components

| Component | Description |
|-----------|-------------|
| `VectorStoreDialog` | Main vector store dialog |
| `VectorStorePopUp` | Pop-up for vector store actions |
| `UpsertHistoryDialog` | Upsert history dialog |
| `UpsertResultDialog` | Upsert result display dialog |

## Internationalization

This package includes translations for:
- English (`en`)
- Russian (`ru`)

Translation keys are organized under `document-store` and `vector-store` namespaces.

## Structure

```
src/
├── i18n/
│   ├── index.ts          # i18n configuration
│   └── locales/
│       ├── en.json       # English translations
│       └── ru.json       # Russian translations
├── pages/
│   ├── docstore/         # Document store pages
│   │   ├── index.jsx     # Main list page
│   │   └── ...           # Other components
│   └── vectorstore/      # Vector store pages
│       ├── VectorStoreDialog.jsx
│       └── ...           # Other components
└── index.js              # Main exports
```

## Related Packages

- `@flowise/docstore-backend` - Backend service for document stores
- `@flowise/template-mui` - Shared UI components
- `@universo/api-client` - API client

## ⚠️ Integration Notes - flowise-server & flowise-ui

### Current State

This package contains all **frontend components** for Document Store management. The components are used by:
- `packages/flowise-core-frontend/base` - Main Flowise UI application
- `packages/spaces-frontend` - Spaces management (via exports)

### What's fully in this package

| Component Category | Status |
|-------------------|--------|
| Document Store pages | ✅ Complete |
| Document Store dialogs | ✅ Complete |
| Vector Store dialogs | ✅ Complete |
| Chunk management | ✅ Complete |
| Upsert history | ✅ Complete |
| i18n translations | ✅ Complete |

### Integration with flowise-ui

The components are integrated into `flowise-ui` through lazy loading:

```jsx
// packages/flowise-core-frontend/base/src/routes/MainRoutes.jsx
const DocumentStoreDetail = Loadable(lazy(() => import('@flowise/docstore-frontend/pages/docstore/DocumentStoreDetail')))
const ShowStoredChunks = Loadable(lazy(() => import('@flowise/docstore-frontend/pages/docstore/ShowStoredChunks')))
```

### API Integration

All components use `@universo/api-client` for backend communication:

```jsx
import documentStoreApi from '@universo/api-client/documentstore'

// Example usage in components
const response = await documentStoreApi.getAllDocumentStores(unikId)
```

The API client communicates with endpoints defined in:
- `packages/flowise-core-backend/base/src/routes/documentstore/`
- `packages/flowise-core-backend/base/src/controllers/documentstore/`

### Future Considerations

For full package isolation:
1. **Theming**: Currently uses `@flowise/template-mui` for styling - this dependency is intentional
2. **API Client**: Uses `@universo/api-client` which is already a separate package ✅
3. **i18n**: Has its own translations, registered via `registerDocstoreI18n()` ✅

The frontend package is **fully extracted** - no code remains in flowise-ui except for route definitions and lazy imports.

## License

SEE LICENSE IN LICENSE-Flowise.md
