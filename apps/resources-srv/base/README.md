# Resources Service (resources-srv)

Backend service for managing clusters, domains, and resources with complete data isolation and validation in the Universo Platformo ecosystem.

## Overview

The Resources Service implements a three-tier architecture (Clusters → Domains → Resources) with strict data isolation, comprehensive validation, and secure relationship management. All operations ensure data integrity through TypeORM Repository pattern and PostgreSQL constraints.

## Architecture

### Entity Relationships
- **Clusters**: Independent organizational units with complete data isolation
- **Domains**: Logical groupings within clusters (mandatory cluster association)
- **Resources**: Individual assets within domains (mandatory domain association)
- **Junction Tables**: Many-to-many relationships with CASCADE delete and UNIQUE constraints

### Data Isolation & Security
- Complete cluster isolation - no cross-cluster data access
- Mandatory associations prevent orphaned entities
- Idempotent operations for relationship management
- Comprehensive input validation with clear error messages

## API Endpoints

### Clusters
- `GET /clusters` – List all clusters
- `POST /clusters` – Create a cluster
- `GET /clusters/:id` – Get cluster details
- `PUT /clusters/:id` – Update cluster
- `DELETE /clusters/:id` – Delete cluster (CASCADE deletes domains/resources)
- `GET /clusters/:id/domains` – Get domains in cluster
- `POST /clusters/:id/domains/:domainId` – Link domain to cluster (idempotent)
- `GET /clusters/:id/resources` – Get resources in cluster
- `POST /clusters/:id/resources/:resourceId` – Link resource to cluster (idempotent)

### Domains
- `GET /domains` – List all domains
- `POST /domains` – Create domain (requires clusterId)
- `GET /domains/:id` – Get domain details
- `PUT /domains/:id` – Update domain
- `DELETE /domains/:id` – Delete domain (CASCADE deletes resources)
- `GET /domains/:id/resources` – Get resources in domain
- `POST /domains/:id/resources/:resourceId` – Link resource to domain (idempotent)

### Resources
- `GET /resources` – List all resources
- `POST /resources` – Create resource (requires domainId, optional clusterId)
- `GET /resources/:id` – Get resource details
- `PUT /resources/:id` – Update resource
- `DELETE /resources/:id` – Delete resource

## Data Model

### Core Entities

```typescript
@Entity({ name: 'clusters' })
export class Cluster {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

@Entity({ name: 'domains' })
export class Domain {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

@Entity({ name: 'resources' })
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
```

### Junction Tables (Many-to-Many Relationships)

```typescript
@Entity({ name: 'resources_clusters' })
export class ResourceCluster {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Resource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resource_id' })
  resource: Resource

  @ManyToOne(() => Cluster, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cluster_id' })
  cluster: Cluster

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE constraint on (resource_id, cluster_id)
}

@Entity({ name: 'resources_domains' })
export class ResourceDomain {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Resource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resource_id' })
  resource: Resource

  @ManyToOne(() => Domain, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'domain_id' })
  domain: Domain

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE constraint on (resource_id, domain_id)
}

@Entity({ name: 'domains_clusters' })
export class DomainCluster {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Domain, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'domain_id' })
  domain: Domain

  @ManyToOne(() => Cluster, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cluster_id' })
  cluster: Cluster

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE constraint on (domain_id, cluster_id)
}
```

## Validation Rules

### Resource Creation
- `name` is required (non-empty string)
- `domainId` is required and must reference existing domain
- `clusterId` is optional but if provided must reference existing cluster
- Atomic creation of resource-domain relationship
- Atomic creation of resource-cluster relationship (if clusterId provided)

### Domain Creation
- `name` is required (non-empty string)
- `clusterId` is required and must reference existing cluster
- Atomic creation of domain-cluster relationship

### Cluster Creation
- `name` is required (non-empty string)
- No additional constraints

## Database Structure

```sql
-- Core tables
CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction tables with CASCADE delete and UNIQUE constraints
CREATE TABLE resources_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(resource_id, cluster_id)
);

CREATE TABLE resources_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(resource_id, domain_id)
);

CREATE TABLE domains_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(domain_id, cluster_id)
);
```

## Development

### Prerequisites
- Node.js 18+
- PNPM package manager
- PostgreSQL database

### Commands
```bash
# Install dependencies (from project root)
pnpm install

# Build the service
pnpm --filter @universo/resources-srv build

# Run tests
pnpm --filter @universo/resources-srv test

# Lint code
pnpm --filter @universo/resources-srv lint
```

### Security Notes
- Application-level authorization is strictly enforced in all routes via cluster/domain/resource guards to prevent IDOR and cross-cluster leaks.
- Database RLS policies are provisioned as defense-in-depth, but when connecting via TypeORM they are not active unless request JWT context is propagated; do not rely on RLS alone.
- Rate limiting is enabled on `/resources`, `/clusters`, and `/domains` endpoints.
- HTTP security headers are applied with Helmet (CSP deferred for API-only usage).

### Database Setup
The service uses TypeORM with PostgreSQL. Migrations are automatically registered and can be run through the main application's migration system.

### Environment Variables
Configure database connection through the main application's environment configuration.

## Related Documentation
- [Resources Frontend Application](../../../apps/resources-frt/base/README.md)
- [Resources Application Docs](../../../docs/en/applications/resources/README.md)

---

**Universo Platformo | Resources Backend Service**
