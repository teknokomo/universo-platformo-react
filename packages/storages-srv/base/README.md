# @universo/storages-srv

> ??? **Modern Package** - TypeScript-first architecture with Express.js and TypeORM

Backend service for managing Storages, Containers, and Slots with complete data isolation and validation.

## Package Information

- **Version**: 0.1.0
- **Type**: Backend Service Package (TypeScript)
- **Status**: ? Active Development
- **Architecture**: Modern with Express.js + TypeORM

## Key Features

### Three-Tier Architecture
- **Storages**: Independent organizational units with complete data isolation
- **Containers**: Logical groupings within Storages (mandatory Storage association)  
- **Slots**: Individual assets within Containers (mandatory Container association)
- **Junction Tables**: Many-to-many relationships with CASCADE delete and UNIQUE constraints

### Data Isolation & Security
- Complete Storage isolation - no cross-Storage data access
- Mandatory associations prevent orphaned Slots
- Idempotent operations for relationship management
- Comprehensive input validation with clear error messages
- Application-level authorization with Storage/Container/Slot guards
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
pnpm --filter @universo/storages-srv build
```

## Usage

### Express Router Integration
```typescript
import express from 'express'
import { storagesRouter } from '@universo/storages-srv'

const app = express()

// Mount Storages routes
app.use('/api/Storages', storagesRouter)
app.use('/api/Containers', containersRouter) 
app.use('/api/Slots', slotsRouter)

app.listen(3000)
```

### TypeORM Setup
```typescript
import { getDataSource } from '@universo/storages-srv/database'
import { Storage, Container, Slot } from '@universo/storages-srv/Slots'

// Initialize database connection
const dataSource = await getDataSource()

// Use repositories
const storageRepo = dataSource.getRepository(Storage)
const Storages = await storageRepo.find()
```

## API Reference

### Storages Endpoints
```http
GET    /Storages                      # List all Storages
POST   /Storages                      # Create Storage
GET    /Storages/:id                  # Get Storage details  
PUT    /Storages/:id                  # Update Storage
DELETE /Storages/:id                  # Delete Storage (CASCADE)

# Storage relationships
GET    /Storages/:id/Containers         # Get Containers in Storage
POST   /Storages/:id/Containers/:domainId  # Link Container (idempotent)
GET    /Storages/:id/Slots         # Get Slots in Storage
POST   /Storages/:id/Slots/:resourceId   # Link Slot (idempotent)
```

### Containers Endpoints
```http
GET    /Containers                        # List all Containers
POST   /Containers                        # Create Container (requires clusterId)
GET    /Containers/:id                    # Get Container details
PUT    /Containers/:id                    # Update Container
DELETE /Containers/:id                    # Delete Container (CASCADE)

# Container relationships
GET    /Containers/:id/Slots           # Get Slots in Container
POST   /Containers/:id/Slots/:resourceId # Link Slot (idempotent)
```

### Slots Endpoints
```http
GET    /Slots                        # List all Slots
POST   /Slots                        # Create Slot (requires domainId)
GET    /Slots/:id                    # Get Slot details
PUT    /Slots/:id                    # Update Slot
DELETE /Slots/:id                    # Delete Slot
```

### Request/Response Examples

#### Create Storage
```http
POST /Storages
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

#### Create Slot with Container Association
```http
POST /Slots
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

### Core Slots

```typescript
@Slot({ name: 'Storages' })
export class Storage {
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

@Slot({ name: 'Containers' })
export class Container {
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

@Slot({ name: 'Slots' })
export class Slot {
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
@Slot({ name: 'resources_clusters' })
export class ResourceCluster {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Slot, { onDelete: 'CASCADE' })
  Slot: Slot

  @ManyToOne(() => Storage, { onDelete: 'CASCADE' })
  Storage: Storage

  @CreateDateColumn()
  createdAt: Date
  
  // UNIQUE constraint on (resource_id, cluster_id)
}

@Slot({ name: 'resources_domains' })
export class ResourceDomain {
  // Similar structure for Slot-Container relationships
}

@Slot({ name: 'domains_clusters' })  
export class DomainCluster {
  // Similar structure for Container-Storage relationships
}
```

## Validation & Business Rules

### Input Validation
```typescript
import { z } from 'zod'

// Slot validation schema
const createResourceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  domainId: z.string().uuid('Valid Container ID required'),
  clusterId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional()
})

// Container validation schema  
const createDomainSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  clusterId: z.string().uuid('Valid Storage ID required')
})

// Storage validation schema
const createClusterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional()
})
```

### Business Rules
- **Slot Creation**: Requires valid `domainId`, optional `clusterId`
- **Container Creation**: Requires valid `clusterId` for association
- **Storage Creation**: Standalone Slot, no dependencies
- **Atomic Operations**: All relationship creations are transactional
- **CASCADE Deletes**: Deleting parent Slots removes all children
- **Uniqueness**: Junction tables prevent duplicate relationships

## Database Schema

### Migration Integration
```typescript
// migrations are auto-registered through central system
import { clusterMigrations } from '@universo/storages-srv/migrations'

// Slot registration in flowise-server
export * from '@universo/storages-srv/Slots'
```

### Core Tables Structure
```sql
-- Core Slots with UUID primary keys
CREATE TABLE Storages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction tables with CASCADE and UNIQUE constraints
CREATE TABLE resources_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES Slots(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES Containers(id) ON DELETE CASCADE,
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
+-- controllers/        # Route controllers
¦   +-- Storages.ts   # Storage CRUD operations
¦   +-- Containers.ts     # Container management
¦   L-- Slots.ts     # Slot operations
+-- database/           # Database layer
¦   +-- Slots/       # TypeORM Slots
¦   +-- migrations/     # Database migrations
¦   L-- repositories/   # Custom repositories
+-- middleware/         # Express middleware
¦   +-- auth.ts         # Authentication
¦   +-- validation.ts   # Request validation
¦   L-- rateLimiter.ts  # Rate limiting
+-- routes/             # Express routes
+-- services/           # Business logic
+-- types/              # TypeScript definitions
L-- index.ts           # Package exports
```

### Testing Strategy
```typescript
// Unit tests for services
describe('storageService', () => {
  test('creates Storage with valid data', async () => {
    const Storage = await storageService.create({
      name: 'Test Universe',
      description: 'Test description'
    })
    expect(Storage.name).toBe('Test Universe')
  })
})

// Integration tests for controllers
describe('POST /Storages', () => {
  test('returns 201 with valid payload', async () => {
    const response = await request(app)
      .post('/Storages')
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
- Application-level authorization with Storage/Container/Slot guards
- Prevents IDOR (Insecure Direct Object Reference) attacks
- Cross-Storage access prevention
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
- [`@universo/storages-frt`](../Storages-frt/base/README.md) - Frontend client
- [`@universo/auth-srv`](../auth-srv/base/README.md) - Authentication service
- [`@universo/utils`](../universo-utils/base/README.md) - Shared utilities

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive Storage management platform*



