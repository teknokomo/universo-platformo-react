# Workspace Management (Uniks)

> Updated Q3 2025: Migrated to Passport.js + Supabase session bridge, TypeORM repositories, dedicated `uniks` schema with RLS, and expanded role model (owner/admin/editor/member).

The Uniks workspace management system provides comprehensive functionality for creating, organizing, and managing collaborative workspaces within the Universo Platformo ecosystem.

## Updated Overview

The Uniks system now consists of clearly separated components with stricter security and access control layers:

- **uniks-frt**: Frontend application (React + Material UI + i18n) providing workspace UI
- **uniks-srv**: Backend package exposing workspace/member APIs and TypeORM entities
- **Main Server**: Passport.js session + Supabase auth bridge + global middleware

Key 2025 Enhancements:
- Migrated from Supabase REST queries to TypeORM Repository pattern
- Introduced dedicated Postgres schema `uniks` with RLS policies
- Replaced implicit (owner/member) model with strict roles: `owner`, `admin`, `editor`, `member`
- Added per-request membership caching via `WorkspaceAccessService`
- Implemented dual-check strategy (membership fetch + entity fetch) for cross-schema safety

## Architecture

```
┌───────────────┐    ┌────────────────┐    ┌────────────────┐
│   uniks-frt   │◄──►│   uniks-srv    │◄──►│  Main Server    │
│ (Frontend)    │    │ (Workspace API)│    │ (platform core)│
└───────────────┘    └────────────────┘    └────────────────┘
    │                    │                      │
    ▼                    ▼                      ▼
┌───────────────┐    ┌────────────────┐    ┌────────────────┐
│ React/MUI/i18n │    │ TypeORM +      │    │ Passport.js +   │
│ TypeScript     │    │ Schema `uniks` │    │ Supabase Auth   │
└───────────────┘    └────────────────┘    └────────────────┘
               │
               ▼
           RLS (membership)
```

### Role Model (2025)

| Role  | Purpose                    | Examples |
|-------|----------------------------|----------|
| owner | Full control               | Delete workspace, promote roles |
| admin | Administrative management  | Add/remove members, update meta |
| editor| Content contribution       | Create/update internal resources |
| member| Basic participation        | View and perform basic actions |

Role constants are defined in a strict union to prevent typos (`roles.ts`).

### Access Validation Pattern
```typescript
const membership = await WorkspaceAccessService.ensure(userId, unikId, ['admin','owner'])
// membership contains validated role (cached per request)
```

## Frontend Application (uniks-frt)

### Key Features

- Workspace CRUD management UI
- Member management with live role constraints
- Multi-role awareness (owner/admin/editor/member)
- Responsive Material UI layout
- EN/RU internationalization
- Integrated navigation & auth state awareness

### Components

#### UnikList.jsx

Main workspace listing page that displays all user workspaces with:

-   Grid and list view options
-   Search and filtering capabilities
-   Quick access to workspace actions
-   Visual workspace status indicators

#### UnikDetail.jsx

Detailed workspace view showing:

-   Workspace information and settings
-   Member list with role management
-   Activity feed and recent updates
-   Quick action buttons for common tasks

#### UnikDialog.jsx

Modal dialog for workspace operations:

-   Create new workspace with name and description
-   Edit existing workspace properties
-   Configure workspace settings
-   Manage workspace visibility and permissions

### Technology Stack

-   **React**: Frontend framework
-   **Material-UI**: Component library for consistent UI
-   **i18next**: Internationalization framework
-   **TypeScript**: Type safety and development experience

## Backend Package (uniks-srv)

### Key Features

- CRUD operations (TypeORM repositories)
- Membership + role validation (central service)
- RLS-enforced data isolation via `uniks` schema
- Passport.js session + Supabase JWT validation
- Cached membership resolution per request
- Strict role union enforcement

### API Endpoints

#### Workspace Management

```
GET    /uniks              # List user's workspaces
POST   /uniks              # Create new workspace
GET    /uniks/:id          # Get workspace details
PUT    /uniks/:id          # Update workspace
DELETE /uniks/:id          # Delete workspace
```

#### Member Management

```
POST   /uniks/members      # Add member to workspace
DELETE /uniks/members/:userId  # Remove member from workspace
GET    /uniks/:id/members  # List workspace members
```

### Database Schema (Updated)

#### Unik Entity (TypeORM)
```typescript
@Entity({ schema: 'uniks', name: 'uniks' })
export class Unik {
    @PrimaryGeneratedColumn('uuid') id!: string
    @Column({ type: 'text' }) name!: string
    @Column({ type: 'text', nullable: true }) description?: string
    @CreateDateColumn({ name: 'created_at' }) createdAt!: Date
    @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date
    @OneToMany(() => UnikUser, (uu) => uu.unik) memberships!: UnikUser[]
}
```

#### UnikUser Entity (Membership)
```typescript
@Entity({ schema: 'uniks', name: 'uniks_users' })
export class UnikUser {
    @PrimaryGeneratedColumn('uuid') id!: string
    @Column({ name: 'user_id', type: 'uuid' }) userId!: string
    @Column({ name: 'unik_id', type: 'uuid' }) unikId!: string
    @Column({ type: 'text' }) role!: UnikRole // 'owner' | 'admin' | 'editor' | 'member'
    @ManyToOne(() => Unik, (unik) => unik.memberships) @JoinColumn({ name: 'unik_id' }) unik!: Unik
    @CreateDateColumn({ name: 'created_at' }) createdAt!: Date
}
```

### Technology Stack

-   **Express.js**: Web framework for API endpoints
-   **TypeORM**: Database ORM for entity management
-   **PostgreSQL**: Primary database
-   **Supabase**: Authentication and user management
-   **TypeScript**: Type safety and development experience

## Integration Points

### Main Platform Integration

The Uniks system integrates with the main Flowise platform through:

-   **Route Mounting**: Workspace routes are mounted under `/:unikId` prefix
-   **Authentication**: Uses Supabase JWT tokens for user authentication
-   **Navigation**: Provides menu items for workspace access
-   **Data Flow**: Exchanges workspace data with main platform components

### Database Integration

-   **TypeORM Entities**: Shared entity definitions with main platform
-   **Migration System**: Coordinated database migrations
-   **Connection Pooling**: Efficient database connections
-   **Row Level Security**: Supabase RLS policies for data protection

### Authentication Integration

- Passport.js session management + Supabase token validation
- Per-request user context passed to TypeORM services
- Membership fetched once and cached
- Role-based permission gate applied before business logic

## Security Features

### Authentication & Authorization

- Hybrid Passport.js (session) + Supabase JWT bridge
- Expanded role-based access control (owner/admin/editor/member)
- Central membership verification service
- Type-safe role guards preventing typo-based bypass

### Data Protection

- RLS policies enforcing membership-based visibility
- TypeORM parameterization for SQL injection prevention
- Input validation + sanitized error surfaces
- Least privilege role design

### API Security

-   Rate limiting on all endpoints
-   CORS configuration
-   Request validation middleware
-   Error message sanitization

## Development Workflow

### Prerequisites

-   Node.js 18+
-   PNPM package manager
-   PostgreSQL database
-   Supabase project access

### Installation

```bash
# Install dependencies
pnpm install

# Build both applications
pnpm build --filter @universo/uniks-frt
pnpm build --filter @universo/uniks-srv

# Run in development mode
pnpm --filter @universo/uniks-frt dev
pnpm --filter @universo/uniks-srv dev
```

### Build Commands

```bash
# Build frontend
pnpm build --filter @universo/uniks-frt

# Build backend
pnpm build --filter @universo/uniks-srv

# Build both
pnpm build --filter @universo/uniks-*
```

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Supabase
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...

# JWT
JWT_SECRET=...
```

### TypeScript Configuration

-   Strict type checking enabled
-   Path aliases for clean imports
-   External module declarations
-   Type safety for all API operations

## Testing Strategy

### Frontend Testing

-   Component unit tests with React Testing Library
-   Integration tests for workspace workflows
-   Internationalization testing
-   Responsive design testing

### Backend Testing

- API endpoint testing (workspace + membership routes)
- Membership role matrix (owner/admin/editor/member) scenarios
- RLS behavior validation (positive + negative cases)
- Caching behavior tests (single-request membership reuse)

### Integration Testing

-   End-to-end workspace creation flow
-   Member management workflows
-   Cross-application data flow
-   Performance and load testing

## Deployment

### Production Build

```bash
# Clean build
pnpm clean
pnpm build --filter @universo/uniks-*

# Deploy to production
pnpm deploy
```

### Environment Setup

-   Database migrations
-   Supabase configuration
-   Environment variables
-   SSL certificate setup

## Monitoring & Analytics

### Application Metrics

-   Workspace creation rates
-   User engagement metrics
-   API performance monitoring
-   Error tracking and alerting

### User Analytics

-   Workspace usage patterns
-   Member activity tracking
-   Feature adoption rates
-   User satisfaction metrics

## Future Enhancements

### Planned Features

- Real-time presence + collaboration updates
- Granular permission flags (feature-level ACL)
- Workspace templates & cloning
- Bulk invitation workflows

### Technical Improvements

- Redis caching layer for membership hydration
- Auditing trail for administrative actions
- Enhanced migration automation + idempotency checks
- API versioning & deprecation strategy

## Troubleshooting

### Common Issues

#### Build Errors

-   Ensure all dependencies are installed
-   Check TypeScript configuration
-   Verify environment variables

#### Database Issues

-   Run migrations: `pnpm migration:run`
-   Check database connection
-   Verify Supabase configuration

#### Authentication Issues

-   Validate JWT token format
-   Check Supabase project settings
-   Verify user permissions

### Debug Mode

```bash
# Enable debug logging
DEBUG=uniks:* pnpm dev

# Check application logs
pnpm logs --filter @universo/uniks-*
```

## Related Documentation

-   [Main Applications Guide](../README.md)
-   [UPDL System](../updl/README.md)
-   [Publication System](../publish/README.md)
-   [Profile Management](../profile/README.md)
-   [Platform Architecture](../../../docs/en/applications/README.md)

---

**Universo Platformo | Workspace Management System**
