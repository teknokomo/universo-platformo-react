# @universo/Campaigns-backend

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js and TypeORM

Backend service for managing Campaigns, Events, and activities with complete data isolation and validation.

## Package Information

- **Version**: 0.1.0
- **Type**: Backend Service Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Modern with Express.js + TypeORM

## Key Features

### Three-Tier Architecture
- **Campaigns**: Independent organizational units with complete data isolation
- **Events**: Logical groupings within Campaigns (mandatory Campaign association)  
- **activities**: Individual assets within Events (mandatory Event association)
- **Junction Tables**: Many-to-many relationships with CASCADE delete and UNIQUE constraints

### Data Isolation & Security
- Complete Campaign isolation - no cross-Campaign data access
- Mandatory associations prevent orphaned activities
- Idempotent operations for relationship management
- Comprehensive input validation with clear error messages
- Application-level authorization with Campaign/Event/Activity guards
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
pnpm --filter @universo/Campaigns-backend build
```

## Usage

### Express Router Integration
```typescript
import express from 'express'
import { campaignsRouter } from '@universo/Campaigns-backend'

const app = express()

// Mount Campaigns routes
app.use('/api/Campaigns', campaignsRouter)
app.use('/api/Events', eventsRouter) 
app.use('/api/activities', activitiesRouter)

app.listen(3000)
```

### TypeORM Setup
```typescript
import { getDataSource } from '@universo/Campaigns-backend/database'
import { Campaign, Event, Activity } from '@universo/Campaigns-backend/activities'

// Initialize database connection
const dataSource = await getDataSource()

// Use repositories
const campaignRepo = dataSource.getRepository(Campaign)
const Campaigns = await campaignRepo.find()
```

## API Reference

### Campaigns Endpoints
```http
GET    /Campaigns                      # List all Campaigns
POST   /Campaigns                      # Create Campaign
GET    /Campaigns/:id                  # Get Campaign details  
PUT    /Campaigns/:id                  # Update Campaign
DELETE /Campaigns/:id                  # Delete Campaign (CASCADE)

# Campaign relationships
GET    /Campaigns/:id/Events         # Get Events in Campaign
POST   /Campaigns/:id/Events/:eventId  # Link Event (idempotent)
GET    /Campaigns/:id/activities         # Get activities in Campaign
POST   /Campaigns/:id/activities/:activityId   # Link Activity (idempotent)
```

### Events Endpoints
```http
GET    /Events                        # List all Events
POST   /Events                        # Create Event (requires campaignId)
GET    /Events/:id                    # Get Event details
PUT    /Events/:id                    # Update Event
DELETE /Events/:id                    # Delete Event (CASCADE)

# Event relationships
GET    /Events/:id/activities           # Get activities in Event
POST   /Events/:id/activities/:activityId # Link Activity (idempotent)
```

### activities Endpoints
```http
GET    /activities                        # List all activities
POST   /activities                        # Create Activity (requires eventId)
GET    /activities/:id                    # Get Activity details
PUT    /activities/:id                    # Update Activity
DELETE /activities/:id                    # Delete Activity
```

### Request/Response Examples

#### Create Campaign
```http
POST /Campaigns
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

#### Create Activity with Event Association
```http
POST /activities
Content-Type: application/json

{
  "name": "Player Avatar",
  "description": "3D character model",
  "eventId": "660e8400-e29b-41d4-a716-446655440001",
  "campaignId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "model": "character.fbx",
    "animations": ["idle", "walk", "run"]
  }
}
```

## Data Model

### Core activities

```typescript
@Activity({ name: 'Campaigns' })
export class Campaign {
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

@Activity({ name: 'Events' })
export class Event {
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

@Activity({ name: 'activities' })
export class Activity {
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
@Activity({ name: 'activities_campaigns' })
export class ActivityCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  Activity: Activity

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  Campaign: Campaign

  @CreateDateColumn()
  createdAt: Date
  
  // UNIQUE constraint on (activity_id, campaign_id)
}

@Activity({ name: 'activities_events' })
export class ActivityEvent {
  // Similar structure for Activity-Event relationships
}

@Activity({ name: 'events_campaigns' })  
export class EventCampaign {
  // Similar structure for Event-Campaign relationships
}
```

## Validation & Business Rules

### Input Validation
```typescript
import { z } from 'zod'

// Activity validation schema
const createActivitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  eventId: z.string().uuid('Valid Event ID required'),
  campaignId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional()
})

// Event validation schema  
const createEventSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  campaignId: z.string().uuid('Valid Campaign ID required')
})

// Campaign validation schema
const createCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional()
})
```

### Business Rules
- **Activity Creation**: Requires valid `eventId`, optional `campaignId`
- **Event Creation**: Requires valid `campaignId` for association
- **Campaign Creation**: Standalone Activity, no dependencies
- **Atomic Operations**: All relationship creations are transactional
- **CASCADE Deletes**: Deleting parent activities removes all children
- **Uniqueness**: Junction tables prevent duplicate relationships

## Database Schema

### Migration Integration
```typescript
// migrations are auto-registered through central system
import { campaignsMigrations } from '@universo/Campaigns-backend/migrations'

// Activity registration in flowise-server
export * from '@universo/Campaigns-backend/activities'
```

### Core Tables Structure
```sql
-- Core activities with UUID primary keys
CREATE TABLE Campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction tables with CASCADE and UNIQUE constraints
CREATE TABLE activities_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES Events(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(activity_id, event_id)  -- Prevents duplicates
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
│   ├── Campaigns.ts   # Campaign CRUD operations
│   ├── Events.ts     # Event management
│   └── activities.ts     # Activity operations
├── database/           # Database layer
│   ├── activities/       # TypeORM activities
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
describe('campaignService', () => {
  test('creates Campaign with valid data', async () => {
    const Campaign = await campaignService.create({
      name: 'Test Universe',
      description: 'Test description'
    })
    expect(Campaign.name).toBe('Test Universe')
  })
})

// Integration tests for controllers
describe('POST /Campaigns', () => {
  test('returns 201 with valid payload', async () => {
    const response = await request(app)
      .post('/Campaigns')
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
- Application-level authorization with Campaign/Event/Activity guards
- Prevents IDOR (Insecure Direct Object Reference) attacks
- Cross-Campaign access prevention
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
- [`@universo/Campaigns-frontend`](../Campaigns-frontend/base/README.md) - Frontend client
- [`@universo/auth-backend`](../auth-backend/base/README.md) - Authentication service
- [`@universo/utils`](../universo-utils/base/README.md) - Shared utilities

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive Campaign management platform*
