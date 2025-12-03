# @universo/projects-backend

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js and TypeORM

Backend service for managing projects, milestones, and tasks with complete data isolation and validation.

## Package Information

- **Version**: 0.1.0
- **Type**: Backend Service Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Modern with Express.js + TypeORM

## Key Features

### Three-Tier Architecture
- **Projects**: Independent organizational units with complete data isolation
- **Milestones**: Logical groupings within projects (mandatory project association)  
- **Tasks**: Individual assets within milestones (mandatory milestone association)
- **Junction Tables**: Many-to-many relationships with CASCADE delete and UNIQUE constraints

### Data Isolation & Security
- Complete project isolation - no cross-project data access
- Mandatory associations prevent orphaned tasks
- Idempotent operations for relationship management
- Comprehensive input validation with clear error messages
- Application-level authorization with project/milestone/task guards
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
pnpm --filter @universo/projects-backend build
```

## Usage

### Express Router Integration
```typescript
import express from 'express'
import { projectsRouter } from '@universo/projects-backend'

const app = express()

// Mount projects routes
app.use('/api/projects', projectsRouter)
app.use('/api/milestones', milestonesRouter) 
app.use('/api/tasks', tasksRouter)

app.listen(3000)
```

### TypeORM Setup
```typescript
import { getDataSource } from '@universo/projects-backend/database'
import { Project, Milestone, Task } from '@universo/projects-backend/tasks'

// Initialize database connection
const dataSource = await getDataSource()

// Use repositories
const projectRepo = dataSource.getRepository(Project)
const projects = await projectRepo.find()
```

## API Reference

### Projects Endpoints
```http
GET    /projects                      # List all projects
POST   /projects                      # Create project
GET    /projects/:id                  # Get project details  
PUT    /projects/:id                  # Update project
DELETE /projects/:id                  # Delete project (CASCADE)

# Project relationships
GET    /projects/:id/milestones         # Get milestones in project
POST   /projects/:id/milestones/:milestoneId  # Link milestone (idempotent)
GET    /projects/:id/tasks         # Get tasks in project
POST   /projects/:id/tasks/:taskId   # Link task (idempotent)
```

### Milestones Endpoints
```http
GET    /milestones                        # List all milestones
POST   /milestones                        # Create milestone (requires projectId)
GET    /milestones/:id                    # Get milestone details
PUT    /milestones/:id                    # Update milestone
DELETE /milestones/:id                    # Delete milestone (CASCADE)

# Milestone relationships
GET    /milestones/:id/tasks           # Get tasks in milestone
POST   /milestones/:id/tasks/:taskId # Link task (idempotent)
```

### Tasks Endpoints
```http
GET    /tasks                        # List all tasks
POST   /tasks                        # Create task (requires milestoneId)
GET    /tasks/:id                    # Get task details
PUT    /tasks/:id                    # Update task
DELETE /tasks/:id                    # Delete task
```

### Request/Response Examples

#### Create Project
```http
POST /projects
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

#### Create Task with Milestone Association
```http
POST /tasks
Content-Type: application/json

{
  "name": "Player Avatar",
  "description": "3D character model",
  "milestoneId": "660e8400-e29b-41d4-a716-446655440001",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "model": "character.fbx",
    "animations": ["idle", "walk", "run"]
  }
}
```

## Data Model

### Core Tasks

```typescript
@Entity({ name: 'projects' })
export class Project {
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

@Entity({ name: 'milestones' })
export class Milestone {
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

@Entity({ name: 'tasks' })
export class Task {
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
@Entity({ name: 'tasks_projects' })
export class TaskProject {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  task: Task

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  project: Project

  @CreateDateColumn()
  createdAt: Date
  
  // UNIQUE constraint on (task_id, project_id)
}

@Entity({ name: 'tasks_milestones' })
export class TaskMilestone {
  // Similar structure for task-milestone relationships
}

@Entity({ name: 'milestones_projects' })
export class MilestoneProject {
  // Similar structure for milestone-project relationships
}
```

## Validation & Business Rules

### Input Validation
```typescript
import { z } from 'zod'

// Task validation schema
const createTaskSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  milestoneId: z.string().uuid('Valid milestone ID required'),
  projectId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional()
})

// Milestone validation schema  
const createMilestoneSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  projectId: z.string().uuid('Valid project ID required')
})

// Project validation schema
const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional()
})
```

### Business Rules
- **Task Creation**: Requires valid `milestoneId`, optional `projectId`
- **Milestone Creation**: Requires valid `projectId` for association
- **Project Creation**: Standalone task, no dependencies
- **Atomic Operations**: All relationship creations are transactional
- **CASCADE Deletes**: Deleting parent tasks removes all children
- **Uniqueness**: Junction tables prevent duplicate relationships

## Database Schema

### Migration Integration
```typescript
// migrations are auto-registered through central system
import { projectMigrations } from '@universo/projects-backend/migrations'

// Task registration in flowise-server
export * from '@universo/projects-backend/tasks'
```

### Core Tables Structure
```sql
-- Core tasks with UUID primary keys
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction tables with CASCADE and UNIQUE constraints
CREATE TABLE tasks_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(task_id, milestone_id)  -- Prevents duplicates
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
│   ├── projects.ts   # Project CRUD operations
│   ├── milestones.ts     # Milestone management
│   └── tasks.ts     # Task operations
├── database/           # Database layer
│   ├── tasks/       # TypeORM tasks
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
describe('ProjectService', () => {
  test('creates project with valid data', async () => {
    const project = await projectService.create({
      name: 'Test Universe',
      description: 'Test description'
    })
    expect(project.name).toBe('Test Universe')
  })
})

// Integration tests for controllers
describe('POST /projects', () => {
  test('returns 201 with valid payload', async () => {
    const response = await request(app)
      .post('/projects')
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
- Application-level authorization with project/milestone/task guards
- Prevents IDOR (Insecure Direct Object Reference) attacks
- Cross-project access prevention
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
- [`@universo/projects-frontend`](../projects-frontend/base/README.md) - Frontend client
- [`@universo/auth-backend`](../auth-backend/base/README.md) - Authentication service
- [`@universo/utils`](../universo-utils/base/README.md) - Shared utilities

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive project management platform*
