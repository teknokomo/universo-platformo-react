# Resources Frontend (resources-frt)

Frontend application for managing clusters, domains, and resources in the Universo Platformo ecosystem.

## Overview

The Resources Frontend provides comprehensive UI workflows for managing the three-tier architecture of Clusters → Domains → Resources. Users can organize resources within domain contexts, maintain strict data isolation by clusters, and manage hierarchical resource compositions with full validation and security.

## Key Features

- **Cluster Management**: Create and manage resource clusters with isolated data contexts
- **Domain Management**: Organize domains within clusters with automatic cluster association
- **Resource Management**: Create and manage resources with mandatory domain association
- **Data Isolation**: Complete data separation between clusters - resources and domains from cluster A are never visible in cluster B
- **Contextual Navigation**: Cluster-aware navigation with breadcrumbs and sidebar context preservation
- **Validation & Security**: Frontend and backend validation ensuring no orphaned resources or domains
- **Internationalization**: English and Russian translations with i18next namespace support
- **Material-UI Integration**: Consistent UI components with proper required field indicators

## Architecture

### Three-Tier Entity Model
- **Clusters**: Top-level organizational units that provide complete data isolation
- **Domains**: Logical groupings within clusters (e.g., "Web Services", "Mobile Apps")
- **Resources**: Individual assets that belong to specific domains within clusters

### Data Isolation
- Resources and domains from different clusters are completely isolated
- All operations maintain cluster context through URL routing
- No cross-cluster data visibility or operations possible

## Structure

```
src/
├── api/              # API client functions
│   ├── clusters.ts   # Cluster CRUD and domain management
│   ├── domains.ts    # Domain CRUD operations
│   ├── resources.ts  # Resource CRUD operations
│   └── index.ts      # API exports
├── components/       # Reusable UI components
│   └── index.ts      # Component exports
├── hooks/            # Custom React hooks
│   └── index.ts      # Hook exports
├── i18n/             # Internationalization
│   ├── locales/      # Language translations (en, ru)
│   └── index.ts      # i18n configuration
├── pages/            # Main page components
│   ├── ClusterDetail.tsx    # Cluster detail with domains/resources tabs
│   ├── DomainDetail.tsx     # Domain detail within cluster context
│   ├── DomainDialog.tsx     # Create/edit domain dialog
│   └── ResourceDialog.tsx   # Create/edit resource dialog
├── menu-items/       # Navigation menu configuration
│   └── clusterDashboard.ts
├── types/            # TypeScript type definitions
│   └── index.ts
└── index.ts          # Package exports
```

## Key Components

### ClusterDetail.tsx
Main cluster management interface with tabbed navigation:
- **Overview**: Cluster information and statistics
- **Domains**: List of domains within the cluster with create/edit capabilities
- **Resources**: List of resources within the cluster with create/edit capabilities
- **Clusterboard**: Cluster-specific dashboard and analytics

Features cluster-aware breadcrumb navigation and maintains cluster context throughout all operations.

### DomainDetail.tsx
Domain detail view within cluster context:
- Displays domain information and associated resources
- Maintains cluster context in navigation and breadcrumbs
- Provides access to domain-specific resource management

### ResourceDialog.tsx
Modal form for creating/editing resources with strict validation:
- **Mandatory Domain Selection**: Domain selection is required with no empty option
- **Cluster Context**: When opened in cluster context, shows only domains from that cluster
- **Validation**: Frontend validation prevents submission without domain selection
- **Material-UI Integration**: Proper required field indicators and error states

### DomainDialog.tsx
Modal form for creating/editing domains:
- **Cluster Association**: Automatically links new domains to current cluster
- **Validation**: Prevents creation of domains without cluster association
- **Context Awareness**: Operates within cluster context for proper data isolation

## API Integration

### Cluster-Scoped Operations
```typescript
// Get domains for a specific cluster
const domains = await getClusterDomains(clusterId)

// Get resources for a specific cluster
const resources = await getClusterResources(clusterId)

// Link domain to cluster
await addDomainToCluster(clusterId, domainId)
```

### Resource Creation with Validation
```typescript
// Create resource with mandatory domain association
const resource = await createResource({
  name: 'My Resource',
  description: 'Resource description',
  domainId: 'required-domain-id',  // Mandatory
  clusterId: 'optional-cluster-id' // Optional for cluster context
})
```

### Domain Creation with Cluster Context
```typescript
// Create domain with mandatory cluster association
const domain = await createDomain({
  name: 'My Domain',
  description: 'Domain description',
  clusterId: 'required-cluster-id'  // Mandatory
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
pnpm --filter @universo/resources-frt build

# Run tests
pnpm --filter @universo/resources-frt test

# Lint sources
pnpm --filter @universo/resources-frt lint
```

### Development Notes
- All operations maintain cluster context through URL routing (`/clusters/:clusterId/...`)
- Domain selection is mandatory for resource creation with proper validation
- Material-UI components use proper `required` attributes for form validation
- i18next namespace `resources` is used for all translations

### Security Notes
- API authentication currently uses a bearer token from `localStorage` (see `src/api/apiClient.ts`). This is acceptable for development but exposes token to XSS.
- Recommended migration path is HTTP‑only secure cookies with CSRF protection and strict CSP.

## Routing Structure

The application uses nested routing to maintain cluster context:

```
/clusters/:clusterId                    # Cluster detail (overview tab)
/clusters/:clusterId/domains           # Domains tab
/clusters/:clusterId/resources         # Resources tab
/clusters/:clusterId/clusterboard      # Clusterboard tab
/clusters/:clusterId/domains/:domainId # Domain detail within cluster
```

All routes maintain cluster context in breadcrumbs and sidebar navigation.

## Data Isolation & Security

- **Complete Cluster Isolation**: Resources and domains from cluster A are never visible in cluster B
- **Mandatory Associations**: Resources must be associated with domains, domains must be associated with clusters
- **Frontend Validation**: Form validation prevents creation of orphaned entities
- **Backend Validation**: Server-side validation ensures data integrity
- **Context Preservation**: Navigation maintains cluster context throughout user journey

## Related Documentation
- [Resources Backend Service](../../../apps/resources-srv/base/README.md)
- [Resources Application Docs](../../../docs/en/applications/resources/README.md)

---

**Universo Platformo | Resources Frontend Application**
