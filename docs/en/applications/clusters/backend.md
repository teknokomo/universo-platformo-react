# Clusters Backend (`@universo/clusters-backend`)

> **📋 Notice**: This documentation is based on the original Flowise documentation and is being adapted for Universo Platformo.

## Overview

Backend for managing  cluster structure with  .   Clusters → Domains → Resources.

## Technology Stack

- **Node.js** 18+ + **Express.js**
- **TypeORM** 0.3.x
- **PostgreSQL** (via Supabase)
- **Passport.js** + Supabase JWT
- **RLS** policies

## Data Model

### Entities

**Cluster:**
```typescript
@Entity('clusters')
export class Cluster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
```

**ClusterUser (Membership):**
```typescript
@Entity('clusters_users')
@Unique(['clusterId', 'userId'])
export class ClusterUser {
  @Column({ name: 'cluster_id' })
  clusterId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: ClusterRole })
  role: ClusterRole; // owner, admin, member
}
```

**Domain:**
```typescript
@Entity('domains')
export class Domain {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;
}
```

**DomainCluster (Join Table):**
```typescript
@Entity('domains_clusters')
@Unique(['domainId', 'clusterId'])
export class DomainCluster {
  @Column({ name: 'domain_id' })
  domainId: string;

  @Column({ name: 'cluster_id' })
  clusterId: string;
}
```

**Resource:**
```typescript
@Entity('resources')
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
```

## REST API

### Clusters

**GET /api/v1/clusters**
List clusters user.

**POST /api/v1/clusters**
Create .
```json
{
  "name": "Production Cluster",
  "description": "Main production environment"
}
```

**GET /api/v1/clusters/:id**
 .

**PATCH /api/v1/clusters/:id**
 .

**DELETE /api/v1/clusters/:id**
Delete  ( owner).

### Cluster Members

**GET /api/v1/clusters/:id/members**
List member.

**POST /api/v1/clusters/:id/members**
Add member.
```json
{
  "userId": "uuid",
  "role": "member"
}
```

**PATCH /api/v1/clusters/:clusterId/members/:userId**
Change role.

**DELETE /api/v1/clusters/:clusterId/members/:userId**
Remove member.

### Domains

**GET /api/v1/domains?clusterId=uuid**
List  .

**POST /api/v1/domains**
Create .
```json
{
  "name": "API Domain",
  "description": "REST API services",
  "clusterIds": ["cluster-uuid"]
}
```

### Resources

**GET /api/v1/resources?clusterId=uuid&domainId=uuid**
List .

**POST /api/v1/resources**
Create .
```json
{
  "name": "Database Server",
  "description": "PostgreSQL instance",
  "domainId": "domain-uuid",
  "clusterId": "cluster-uuid",
  "metadata": {
    "type": "database",
    "version": "15.2"
  }
}
```

## Services

### ClusterService

```typescript
class ClusterService {
  async create(data: CreateClusterDto, userId: string) {
    const cluster = await clusterRepo.save({
      name: data.name,
      slug: generateSlug(data.name),
      description: data.description
    });
    
    await clusterUserRepo.save({
      clusterId: cluster.id,
      userId,
      role: ClusterRole.OWNER
    });
    
    return cluster;
  }

  async getByUser(userId: string, options: PaginationOptions) {
    return clusterUserRepo
      .createQueryBuilder('cu')
      .leftJoin('cu.cluster', 'cluster')
      .where('cu.userId = :userId', { userId })
      .skip(options.offset)
      .take(options.limit)
      .getMany();
  }
}
```

## Row-Level Security

```sql
--     
CREATE POLICY "Users see their clusters"
ON clusters FOR SELECT
USING (
  id IN (
    SELECT cluster_id FROM clusters_users
    WHERE user_id = auth.uid()
  )
);

--  owner  delete
CREATE POLICY "Only owners can delete clusters"
ON clusters FOR DELETE
USING (
  id IN (
    SELECT cluster_id FROM clusters_users
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);
```

## Guards

```typescript
import { createAccessGuards } from './guards';

const { requireClusterAccess } = createAccessGuards();

router.delete(
  '/clusters/:id',
  requireClusterAccess('owner'),
  async (req, res) => {
    await clusterService.delete(req.params.id);
    res.status(204).send();
  }
);
```

## Integration

** entities:**
```typescript
// packages/flowise-core-backend/base/src/database/entities/index.ts
import {
  Cluster,
  ClusterUser,
  Domain,
  DomainCluster,
  Resource,
  ResourceDomain,
  ResourceCluster
} from '@universo/clusters-backend';

export const entities = [
  ...existing,
  Cluster,
  ClusterUser,
  Domain,
  DomainCluster,
  Resource,
  ResourceDomain,
  ResourceCluster
];
```

** routes:**
```typescript
// packages/flowise-core-backend/base/src/routes/index.ts
import { registerClustersRoutes } from '@universo/clusters-backend';

registerClustersRoutes(app);
```

## Related Documentation

- [Clusters Frontend](frontend.md)
- [Clusters Overview](README.md)
- [TypeORM](https://typeorm.io/)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
