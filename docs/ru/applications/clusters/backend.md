# Clusters Backend (`@universo/clusters-srv`)

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и адаптируется для Universo Platformo.

## Обзор

Backend для управления трёхуровневой структурой кластеров с изоляцией ресурсов. Реализует архитектуру Clusters → Domains → Resources.

## Технологический стек

- **Node.js** 18+ + **Express.js**
- **TypeORM** 0.3.x
- **PostgreSQL** (через Supabase)
- **Passport.js** + Supabase JWT
- **RLS** policies

## Модель данных

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
Список кластеров пользователя.

**POST /api/v1/clusters**
Создать кластер.
```json
{
  "name": "Production Cluster",
  "description": "Main production environment"
}
```

**GET /api/v1/clusters/:id**
Получить кластер.

**PATCH /api/v1/clusters/:id**
Обновить кластер.

**DELETE /api/v1/clusters/:id**
Удалить кластер (только owner).

### Cluster Members

**GET /api/v1/clusters/:id/members**
Список участников.

**POST /api/v1/clusters/:id/members**
Добавить участника.
```json
{
  "userId": "uuid",
  "role": "member"
}
```

**PATCH /api/v1/clusters/:clusterId/members/:userId**
Изменить роль.

**DELETE /api/v1/clusters/:clusterId/members/:userId**
Удалить участника.

### Domains

**GET /api/v1/domains?clusterId=uuid**
Список доменов кластера.

**POST /api/v1/domains**
Создать домен.
```json
{
  "name": "API Domain",
  "description": "REST API services",
  "clusterIds": ["cluster-uuid"]
}
```

### Resources

**GET /api/v1/resources?clusterId=uuid&domainId=uuid**
Список ресурсов.

**POST /api/v1/resources**
Создать ресурс.
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
-- Пользователи видят только свои кластеры
CREATE POLICY "Users see their clusters"
ON clusters FOR SELECT
USING (
  id IN (
    SELECT cluster_id FROM clusters_users
    WHERE user_id = auth.uid()
  )
);

-- Только owner может удалить
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

## Интеграция

**Регистрация entities:**
```typescript
// packages/flowise-server/src/database/entities/index.ts
import {
  Cluster,
  ClusterUser,
  Domain,
  DomainCluster,
  Resource,
  ResourceDomain,
  ResourceCluster
} from '@universo/clusters-srv';

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

**Регистрация routes:**
```typescript
// packages/flowise-server/src/routes/index.ts
import { registerClustersRoutes } from '@universo/clusters-srv';

registerClustersRoutes(app);
```

## Связанная документация

- [Clusters Frontend](frontend.md)
- [Clusters Overview](README.md)
- [TypeORM](https://typeorm.io/)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
