# @universo/metaverses-srv

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js and TypeORM

Backend service for managing metaverses, sections, and entities with complete data isolation and validation.

## Package Information

- **Version**: 0.1.0
- **Type**: Backend Service Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Modern with Express.js + TypeORM

## Key Features

### Three-Tier Architecture
- **Metaverses**: Independent organizational units with complete data isolation
- **Sections**: Logical groupings within metaverses (mandatory metaverse association)  
- **Entities**: Individual assets within sections (mandatory section association)
- **Junction Tables**: Many-to-many relationships with CASCADE delete and UNIQUE constraints

### Data Isolation & Security
- Complete metaverse isolation - no cross-metaverse data access
- Mandatory associations prevent orphaned entities
- Idempotent operations for relationship management
- Comprehensive input validation with clear error messages
- Application-level authorization with metaverse/section/entity guards
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
pnpm --filter @universo/metaverses-srv build
```

## Usage

### Express Router Integration
```typescript
import express from 'express'
import { metaversesRouter } from '@universo/metaverses-srv'

const app = express()

// Mount metaverses routes
app.use('/api/metaverses', metaversesRouter)
app.use('/api/sections', sectionsRouter) 
app.use('/api/entities', entitiesRouter)

app.listen(3000)
```

### TypeORM Setup
```typescript
import { getDataSource } from '@universo/metaverses-srv/database'
import { Metaverse, Section, Entity } from '@universo/metaverses-srv/entities'

// Initialize database connection
const dataSource = await getDataSource()

// Use repositories
const metaverseRepo = dataSource.getRepository(Metaverse)
const metaverses = await metaverseRepo.find()
```

## API Reference

### Metaverses Endpoints
```http
GET    /metaverses                      # List all metaverses
POST   /metaverses                      # Create metaverse
GET    /metaverses/:id                  # Get metaverse details  
PUT    /metaverses/:id                  # Update metaverse
DELETE /metaverses/:id                  # Delete metaverse (CASCADE)

# Metaverse relationships
GET    /metaverses/:id/sections         # Get sections in metaverse
POST   /metaverses/:id/sections/:sectionId  # Link section (idempotent)
GET    /metaverses/:id/entities         # Get entities in metaverse
POST   /metaverses/:id/entities/:entityId   # Link entity (idempotent)
```

### Sections Endpoints
```http
GET    /sections                        # List all sections
POST   /sections                        # Create section (requires metaverseId)
GET    /sections/:id                    # Get section details
PUT    /sections/:id                    # Update section
DELETE /sections/:id                    # Delete section (CASCADE)

# Section relationships
GET    /sections/:id/entities           # Get entities in section
POST   /sections/:id/entities/:entityId # Link entity (idempotent)
```

### Entities Endpoints
```http
GET    /entities                        # List all entities
POST   /entities                        # Create entity (requires sectionId)
GET    /entities/:id                    # Get entity details
PUT    /entities/:id                    # Update entity
DELETE /entities/:id                    # Delete entity
```

### Request/Response Examples

#### Create Metaverse
```http
POST /metaverses
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

#### Create Entity with Section Association
```http
POST /entities
Content-Type: application/json

{
  "name": "Player Avatar",
  "description": "3D character model",
  "sectionId": "660e8400-e29b-41d4-a716-446655440001",
  "metaverseId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "model": "character.fbx",
    "animations": ["idle", "walk", "run"]
  }
}
```

## Data Model

### Core Entities

```typescript
@Entity({ name: 'metaverses' })
export class Metaverse {
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

@Entity({ name: 'sections' })
export class Section {
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

@Entity({ name: 'entities' })
export class Entity {
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
@Entity({ name: 'entities_metaverses' })
export class EntityMetaverse {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Entity, { onDelete: 'CASCADE' })
  entity: Entity

  @ManyToOne(() => Metaverse, { onDelete: 'CASCADE' })
  metaverse: Metaverse

  @CreateDateColumn()
  createdAt: Date
  
  // UNIQUE constraint on (entity_id, metaverse_id)
}

@Entity({ name: 'entities_sections' })
export class EntitySection {
  // Similar structure for entity-section relationships
}

@Entity({ name: 'sections_metaverses' })  
export class SectionMetaverse {
  // Similar structure for section-metaverse relationships
}
```

## Validation & Business Rules

### Input Validation
```typescript
import { z } from 'zod'

// Entity validation schema
const createEntitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  sectionId: z.string().uuid('Valid section ID required'),
  metaverseId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional()
})

// Section validation schema  
const createSectionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  metaverseId: z.string().uuid('Valid metaverse ID required')
})

// Metaverse validation schema
const createMetaverseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional()
})
```

### Business Rules
- **Entity Creation**: Requires valid `sectionId`, optional `metaverseId`
- **Section Creation**: Requires valid `metaverseId` for association
- **Metaverse Creation**: Standalone entity, no dependencies
- **Atomic Operations**: All relationship creations are transactional
- **CASCADE Deletes**: Deleting parent entities removes all children
- **Uniqueness**: Junction tables prevent duplicate relationships

## Database Schema

### Migration Integration
```typescript
// migrations are auto-registered through central system
import { metaverseMigrations } from '@universo/metaverses-srv/migrations'

// Entity registration in flowise-server
export * from '@universo/metaverses-srv/entities'
```

### Core Tables Structure
```sql
-- Core entities with UUID primary keys
CREATE TABLE metaverses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction tables with CASCADE and UNIQUE constraints
CREATE TABLE entities_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entity_id, section_id)  -- Prevents duplicates
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
│   ├── metaverses.ts   # Metaverse CRUD operations
│   ├── sections.ts     # Section management
│   └── entities.ts     # Entity operations
├── database/           # Database layer
│   ├── entities/       # TypeORM entities
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
describe('MetaverseService', () => {
  test('creates metaverse with valid data', async () => {
    const metaverse = await metaverseService.create({
      name: 'Test Universe',
      description: 'Test description'
    })
    expect(metaverse.name).toBe('Test Universe')
  })
})

// Integration tests for controllers
describe('POST /metaverses', () => {
  test('returns 201 with valid payload', async () => {
    const response = await request(app)
      .post('/metaverses')
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
- Application-level authorization with metaverse/section/entity guards
- Prevents IDOR (Insecure Direct Object Reference) attacks
- Cross-metaverse access prevention
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
- [`@universo/metaverses-frt`](../metaverses-frt/base/README.md) - Frontend client
- [`@universo/auth-srv`](../auth-srv/base/README.md) - Authentication service
- [`@universo/utils`](../universo-utils/base/README.md) - Shared utilities

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive metaverse management platform*
