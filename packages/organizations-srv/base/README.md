# @universo/organizations-srv

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js and TypeORM

Backend service for managing organizations, departments, and positions with complete data isolation and validation.

## Package Information

- **Version**: 0.1.0
- **Type**: Backend Service Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Modern with Express.js + TypeORM

## Key Features

### Three-Tier Architecture
- **Organizations**: Independent organizational units with complete data isolation
- **Departments**: Logical groupings within organizations (mandatory organization association)  
- **Positions**: Individual assets within departments (mandatory department association)
- **Junction Tables**: Many-to-many relationships with CASCADE delete and UNIQUE constraints

### Data Isolation & Security
- Complete organization isolation - no cross-organization data access
- Mandatory associations prevent orphaned positions
- Idempotent operations for relationship management
- Comprehensive input validation with clear error messages
- Application-level authorization with organization/department/position guards
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
pnpm --filter @universo/organizations-srv build
```

## Usage

### Express Router Integration
```typescript
import express from 'express'
import { organizationsRouter } from '@universo/organizations-srv'

const app = express()

// Mount organizations routes
app.use('/api/organizations', organizationsRouter)
app.use('/api/departments', departmentsRouter) 
app.use('/api/positions', positionsRouter)

app.listen(3000)
```

### TypeORM Setup
```typescript
import { getDataSource } from '@universo/organizations-srv/database'
import { Organization, Department, Position } from '@universo/organizations-srv/entities'

// Initialize database connection
const dataSource = await getDataSource()

// Use repositories
const organizationRepo = dataSource.getRepository(Organization)
const organizations = await organizationRepo.find()
```

## API Reference

### Organizations Endpoints
```http
GET    /organizations                      # List all organizations
POST   /organizations                      # Create organization
GET    /organizations/:id                  # Get organization details  
PUT    /organizations/:id                  # Update organization
DELETE /organizations/:id                  # Delete organization (CASCADE)

# Organization relationships
GET    /organizations/:id/departments         # Get departments in organization
POST   /organizations/:id/departments/:departmentId  # Link department (idempotent)
GET    /organizations/:id/positions         # Get positions in organization
POST   /organizations/:id/positions/:positionId   # Link position (idempotent)
```

### Departments Endpoints
```http
GET    /departments                        # List all departments
POST   /departments                        # Create department (requires organizationId)
GET    /departments/:id                    # Get department details
PUT    /departments/:id                    # Update department
DELETE /departments/:id                    # Delete department (CASCADE)

# Department relationships
GET    /departments/:id/positions           # Get positions in department
POST   /departments/:id/positions/:positionId # Link position (idempotent)
```

### Positions Endpoints
```http
GET    /positions                        # List all positions
POST   /positions                        # Create position (requires departmentId)
GET    /positions/:id                    # Get position details
PUT    /positions/:id                    # Update position
DELETE /positions/:id                    # Delete position
```

### Request/Response Examples

#### Create Organization
```http
POST /organizations
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

#### Create Position with Department Association
```http
POST /positions
Content-Type: application/json

{
  "name": "Player Avatar",
  "description": "3D character model",
  "departmentId": "660e8400-e29b-41d4-a716-446655440001",
  "organizationId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "model": "character.fbx",
    "animations": ["idle", "walk", "run"]
  }
}
```

## Data Model

### Core Entities

```typescript
@Entity({ name: 'organizations' })
export class Organization {
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

@Entity({ name: 'departments' })
export class Department {
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

@Entity({ name: 'positions' })
export class Position {
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
@Entity({ name: 'position_organizations' })
export class PositionOrganization {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Position, { onDelete: 'CASCADE' })
  position: Position

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  organization: Organization

  @CreateDateColumn()
  createdAt: Date
  
  // UNIQUE constraint on (position_id, organization_id)
}

@Entity({ name: 'position_departments' })
export class PositionDepartment {
  // Similar structure for position-department relationships
}

@Entity({ name: 'department_organizations' })  
export class DepartmentOrganization {
  // Similar structure for department-organization relationships
}
```

## Validation & Business Rules

### Input Validation
```typescript
import { z } from 'zod'

// Position validation schema
const createPositionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  departmentId: z.string().uuid('Valid department ID required'),
  organizationId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional()
})

// Department validation schema  
const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  organizationId: z.string().uuid('Valid organization ID required')
})

// Organization validation schema
const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional()
})
```

### Business Rules
- **Position Creation**: Requires valid `departmentId`, optional `organizationId`
- **Department Creation**: Requires valid `organizationId` for association
- **Organization Creation**: Standalone entity, no dependencies
- **Atomic Operations**: All relationship creations are transactional
- **CASCADE Deletes**: Deleting parent positions removes all children
- **Uniqueness**: Junction tables prevent duplicate relationships

## Database Schema

### Migration Integration
```typescript
// migrations are auto-registered through central system
import { clusterMigrations } from '@universo/organizations-srv/migrations'

// Position registration in flowise-server
export * from '@universo/organizations-srv/positions'
```

### Core Tables Structure
```sql
-- Core positions with UUID primary keys
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction tables with CASCADE and UNIQUE constraints
CREATE TABLE position_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(position_id, department_id)  -- Prevents duplicates
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
│   ├── organizations.ts   # Organization CRUD operations
│   ├── departments.ts     # Department management
│   └── positions.ts     # Position operations
├── database/           # Database layer
│   ├── positions/       # TypeORM positions
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
  test('creates organization with valid data', async () => {
    const organization = await clusterService.create({
      name: 'Test Universe',
      description: 'Test description'
    })
    expect(organization.name).toBe('Test Universe')
  })
})

// Integration tests for controllers
describe('POST /organizations', () => {
  test('returns 201 with valid payload', async () => {
    const response = await request(app)
      .post('/organizations')
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
- Application-level authorization with organization/department/position guards
- Prevents IDOR (Insecure Direct Object Reference) attacks
- Cross-organization access prevention
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
- [`@universo/organizations-frt`](../organizations-frt/base/README.md) - Frontend client
- [`@universo/auth-srv`](../auth-srv/base/README.md) - Authentication service
- [`@universo/utils`](../universo-utils/base/README.md) - Shared utilities

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive organization management platform*
