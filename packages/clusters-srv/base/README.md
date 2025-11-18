# @universo/clusters-srv

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js and TypeORM

Backend service for managing clusters, domains, and resources with complete data isolation and validation.

## Package Information

- **Version**: 0.1.0
- **Type**: Backend Service Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Modern with Express.js + TypeORM

## Key Features

### Three-Tier Architecture
- **Clusters**: Independent organizational units with complete data isolation
- **Domains**: Logical groupings within clusters (mandatory cluster association)  
- **Resources**: Individual assets within domains (mandatory domain association)
- **Junction Tables**: Many-to-many relationships with CASCADE delete and UNIQUE constraints

### Data Isolation & Security
- Complete cluster isolation - no cross-cluster data access
- Mandatory associations prevent orphaned resources
- Idempotent operations for relationship management
- Comprehensive input validation with clear error messages
- Application-level authorization with cluster/domain/resource guards
- Rate limiting protection against DoS attacks

### Database Integration
- TypeORM Repository pattern for all data operations
- PostgreSQL with JSONB support for metadata
- Automated migrations through central registry
- CASCADE delete relationships with UNIQUE constraints

## Installation

```bash
# Install from workspace root
pnpm install

# Build the package
pnpm --filter @universo/clusters-srv build
```

## Usage

### Express Router Integration
```typescript
import express from 'express'
import { clustersRouter } from '@universo/clusters-srv'

const app = express()

// Mount clusters routes
app.use('/api/clusters', clustersRouter)
app.use('/api/domains', domainsRouter) 
app.use('/api/resources', resourcesRouter)

app.listen(3000)
```

### TypeORM Setup
```typescript
import { getDataSource } from '@universo/clusters-srv/database'
import { Cluster, Domain, Resource } from '@universo/clusters-srv/resources'

// Initialize database connection
const dataSource = await getDataSource()

// Use repositories
const clusterRepo = dataSource.getRepository(Cluster)
const clusters = await clusterRepo.find()
```

## API Reference

### Clusters Endpoints
```http
GET    /clusters                      # List all clusters
POST   /clusters                      # Create cluster
GET    /clusters/:id                  # Get cluster details  
PUT    /clusters/:id                  # Update cluster
DELETE /clusters/:id                  # Delete cluster (CASCADE)

# Cluster relationships
GET    /clusters/:id/domains         # Get domains in cluster
POST   /clusters/:id/domains/:domainId  # Link domain (idempotent)
GET    /clusters/:id/resources         # Get resources in cluster
POST   /clusters/:id/resources/:resourceId   # Link resource (idempotent)
```

### Domains Endpoints
```http
GET    /domains                        # List all domains
POST   /domains                        # Create domain (requires clusterId)
GET    /domains/:id                    # Get domain details
PUT    /domains/:id                    # Update domain
DELETE /domains/:id                    # Delete domain (CASCADE)

# Domain relationships
GET    /domains/:id/resources           # Get resources in domain
POST   /domains/:id/resources/:resourceId # Link resource (idempotent)
```

### Resources Endpoints
```http
GET    /resources                        # List all resources
POST   /resources                        # Create resource (requires domainId)
GET    /resources/:id                    # Get resource details
PUT    /resources/:id                    # Update resource
DELETE /resources/:id                    # Delete resource
```

### Request/Response Examples

#### Create Cluster
```http
POST /clusters
Content-Type: application/json

{
  "name": "Gaming Universe",
  "description": "Virtual gaming worlds and assets"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Gaming Universe", 
    "description": "Virtual gaming worlds and assets",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Create Resource with Domain Association
```http
POST /resources
Content-Type: application/json

{
  "name": "Player Avatar",
  "description": "3D character model",
  "domainId": "660e8400-e29b-41d4-a716-446655440001",
  "clusterId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "model": "character.fbx",
    "animations": ["idle", "walk", "run"]
  }
}
```

## Data Model

### Core Resources

```typescript
@Resource({ name: 'clusters' })
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

@Resource({ name: 'domains' })
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

@Resource({ name: 'resources' })
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

### Junction Tables
```typescript
// Many-to-many relationship tables with CASCADE delete
@Resource({ name: 'resources_clusters' })
export class ResourceCluster {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Resource, { onDelete: 'CASCADE' })
  resource: Resource

  @ManyToOne(() => Cluster, { onDelete: 'CASCADE' })
  cluster: Cluster

  @CreateDateColumn()
  createdAt: Date
  
  // UNIQUE constraint on (resource_id, cluster_id)
}

@Resource({ name: 'resources_domains' })
export class ResourceDomain {
  // Similar structure for resource-domain relationships
}

@Resource({ name: 'domains_clusters' })  
export class DomainCluster {
  // Similar structure for domain-cluster relationships
}
```

## Validation & Business Rules

### Input Validation
```typescript
import { z } from 'zod'

// Resource validation schema
const createResourceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  domainId: z.string().uuid('Valid domain ID required'),
  clusterId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional()
})

// Domain validation schema  
const createDomainSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  clusterId: z.string().uuid('Valid cluster ID required')
})

// Cluster validation schema
const createClusterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional()
})
```

### Business Rules
- **Resource Creation**: Requires valid `domainId`, optional `clusterId`
- **Domain Creation**: Requires valid `clusterId` for association
- **Cluster Creation**: Standalone resource, no dependencies
- **Atomic Operations**: All relationship creations are transactional
- **CASCADE Deletes**: Deleting parent resources removes all children
- **Uniqueness**: Junction tables prevent duplicate relationships

## Database Schema

### Migration Integration
```typescript
// migrations are auto-registered through central system
import { clusterMigrations } from '@universo/clusters-srv/migrations'

// Resource registration in flowise-server
export * from '@universo/clusters-srv/resources'
```

### Core Tables Structure
```sql
-- Core resources with UUID primary keys
CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction tables with CASCADE and UNIQUE constraints
CREATE TABLE resources_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(resource_id, domain_id)  -- Prevents duplicates
);
```

## Development

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL 15+
- TypeScript 5+

### Available Scripts
```bash
# Development
pnpm build              # Compile TypeScript
pnpm dev                # Development with watch mode
pnpm clean              # Clean dist directory

# Testing  
pnpm test               # Run Jest test suite
pnpm test:watch         # Run tests in watch mode

# Code Quality
pnpm lint               # Run ESLint
pnpm type-check         # TypeScript compilation check
```

### Project Structure
```
src/
├── controllers/        # Route controllers
│   ├── clusters.ts   # Cluster CRUD operations
│   ├── domains.ts     # Domain management
│   └── resources.ts     # Resource operations
├── database/           # Database layer
│   ├── resources/       # TypeORM resources
│   ├── migrations/     # Database migrations
│   └── repositories/   # Custom repositories
├── middleware/         # Express middleware
│   ├── auth.ts         # Authentication
│   ├── validation.ts   # Request validation
│   └── rateLimiter.ts  # Rate limiting
├── routes/             # Express routes
├── services/           # Business logic
├── types/              # TypeScript definitions
└── index.ts           # Package exports
```

### Testing Strategy
```typescript
// Unit tests for services
describe('ClusterService', () => {
  test('creates cluster with valid data', async () => {
    const cluster = await clusterService.create({
      name: 'Test Universe',
      description: 'Test description'
    })
    expect(cluster.name).toBe('Test Universe')
  })
})

// Integration tests for controllers
describe('POST /clusters', () => {
  test('returns 201 with valid payload', async () => {
    const response = await request(app)
      .post('/clusters')
      .send({ name: 'Test Universe' })
    expect(response.status).toBe(201)
  })
})
```

## Security & Production

### Rate Limiting
```typescript
// Development: in-memory store
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true
})

// Production: Redis store recommended
const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'rate-limit:'
})
```

### Authentication & Authorization
- Application-level authorization with cluster/domain/resource guards
- Prevents IDOR (Insecure Direct Object Reference) attacks
- Cross-cluster access prevention
- JWT token validation for protected routes

### Database Security
- TypeORM parameterized queries prevent SQL injection
- Database RLS policies as defense-in-depth
- CASCADE delete constraints maintain referential integrity
- UNIQUE constraints prevent duplicate relationships

## Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/universo
DATABASE_SSL=false

# Rate Limiting
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:3000
```

### TypeScript Configuration
- Strict mode enabled
- ES2022 target with Node.js 18 compatibility
- Path mapping for clean imports
- Declaration files generated for library usage

## Deployment

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install --prod
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Health Checks
```typescript
// Health endpoint for load balancers
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  })
})
```

## Related Packages
- [`@universo/clusters-frt`](../clusters-frt/base/README.md) - Frontend client
- [`@universo/auth-srv`](../auth-srv/base/README.md) - Authentication service
- [`@universo/utils`](../universo-utils/base/README.md) - Shared utilities

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive cluster management platform*
