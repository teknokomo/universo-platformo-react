# Clusters (Clusters)

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo. Some sections may still reference Flowise functionality,          Universo Platformo.

## Application Components

- **Frontend package**: `@universo/clusters-frt`
- **Backend package**: `@universo/clusters-srv`

## Functionality Overview

The Clusters application provides a cluster management system with a three-level hierarchical structure: Clusters → Domains → Resources. The module provides complete data isolation between clusters and role-based access control.

### Architecture
```
Cluster (Cluster)
  └── Domain (Domain)
        └── Resource (Resource)
```

## Key Features

- Cluster management with hierarchical structure
- Logical groups (domains) within clusters
- Resource management in domains
- Complete data isolation between clusters
- Material-UI interface with pagination and search
- Internationalization (EN, RU)

## Technical Details

- **[Frontend package →](frontend.md)**: React 18 + TypeScript + Material-UI
- **[Backend package →](backend.md)**: Express.js + TypeORM + PostgreSQL

## Integration

- **Workspaces (Uniks)**: Works in workspace context
- **Authentication**: Passport.js + Supabase
- **Infrastructure**: `@universo/types`, `@universo/i18n`, `@universo/template-mui`

## Status

✅ Active (Q4 2024) | Version: 0.1.0
