# Clusters Frontend (`@universo/clusters-frt`)

> **📋 Notice**: This documentation is based on the original Flowise documentation and is being adapted for Universo Platformo.

## Overview

Frontend package for managing three-tier structure of clusters (Clusters → Domains → Resources). Provides resource isolation at cluster level.

## Technology Stack

- **React** 18.x + **TypeScript**
- **Material-UI** v5
- **React Query** (server state)
- **React Router** v6
- **i18next** (EN/RU)
- **Build**: tsdown (CJS + ESM)

## Main Components

### ClusterList
List clusters with pagination and search.

```tsx
import { ClusterList } from '@universo/clusters-frt';

<ClusterList />
```

**Features:**
- Display user's clusters
- Search by name
- Pagination (10/25/50)
- CRUD operations

### ClusterDetail
Detail page  with : Domains, Resources, Members.

### DomainList
Management domains .

### ResourceList
Management resources /.

## API Integration

```typescript
import { ClustersApi } from '@universo/clusters-frt';

const api = new ClustersApi();

// Clusters
await api.getClusters({ page, limit, search });
await api.getCluster(id);
await api.createCluster(data);
await api.updateCluster(id, data);
await api.deleteCluster(id);

// 
await api.getDomains({ clusterId, page, limit });
await api.createDomain(data);

// 
await api.getResources({ clusterId, domainId, page, limit });
await api.createResource(data);
```

## Hooks

### useClusters
```typescript
const {
  clusters,
  isLoading,
  createCluster,
  updateCluster,
  deleteCluster
} = useClusters();
```

### useDomains
```typescript
const {
  domains,
  isLoading,
  createDomain
} = useDomains(clusterId);
```

### useResources
```typescript
const {
  resources,
  isLoading,
  createResource
} = useResources({ clusterId, domainId });
```

## Internationalization

**Russian** (`i18n/ru/clusters.json`):
```json
{
  "cluster": {
    "title": "Clusters",
    "create": "Create "
  },
  "domain": {
    "title": ""
  },
  "resource": {
    "title": ""
  }
}
```

**Usage:**
```tsx
const { t } = useTranslation('clusters');
<h1>{t('cluster.title')}</h1>
```

## Integration

**1.  in package.json:**
```json
{
  "dependencies": {
    "@universo/clusters-frt": "workspace:*"
  }
}
```

**2.  routes:**
```tsx
import { ClusterList, ClusterDetail } from '@universo/clusters-frt';

const routes = [
  { path: '/clusters', element: <ClusterList /> },
  { path: '/clusters/:id', element: <ClusterDetail /> }
];
```

**3.  in menu:**
```tsx
{
  id: 'clusters',
  title: t('menu.clusters'),
  url: '/clusters',
  icon: icons.ClusterIcon
}
```

## Related Documentation

- [Clusters Backend](backend.md) - Backend API
- [Clusters Overview](README.md) - Overview
- [@universo/template-mui](../../universo-template-mui/README.md) - UI component
