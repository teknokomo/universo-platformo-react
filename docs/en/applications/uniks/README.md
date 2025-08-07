# Workspace Management (Uniks)

The Uniks workspace management system provides comprehensive functionality for creating, organizing, and managing collaborative workspaces within the Universo Platformo ecosystem.

## Overview

The Uniks system consists of two main components:

-   **uniks-frt**: Frontend application providing the user interface for workspace management
-   **uniks-srv**: Backend workspace package handling data operations and API endpoints

This system enables users to create dedicated workspaces, manage team members, and organize their projects within a collaborative environment.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   uniks-frt     │◄──►│   uniks-srv     │◄──►│   Main Server   │
│   (Frontend)    │    │   (Backend)     │    │   (Flowise)     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Material-UI   │    │   PostgreSQL    │    │   Supabase      │
│   Components    │    │   Database      │    │   Auth          │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Frontend Application (uniks-frt)

### Key Features

-   **Workspace Management Interface**: Create, edit, and delete workspaces
-   **Member Management**: Add and remove workspace members with role-based permissions
-   **Responsive Design**: Mobile-friendly interface using Material-UI components
-   **Internationalization**: Full support for English and Russian languages
-   **Navigation Integration**: Seamless integration with main platform navigation

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

-   **CRUD Operations**: Complete workspace lifecycle management
-   **Member Management**: User role assignment and permission handling
-   **Database Integration**: TypeORM entities and PostgreSQL migrations
-   **Authentication**: Supabase JWT token validation
-   **Route Integration**: Nested routing under `/:unikId` prefix

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

### Database Schema

#### Unik Entity

```typescript
interface Unik {
    id: string
    name: string
    description?: string
    owner_id: string
    created_at: Date
    updated_at: Date
}
```

#### UserUnik Entity

```typescript
interface UserUnik {
    id: string
    user_id: string
    unik_id: string
    role: 'owner' | 'member'
    created_at: Date
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

-   **JWT Tokens**: Consistent authentication across all applications
-   **Supabase Client**: Centralized user management
-   **Route Protection**: Unified access control
-   **Role-Based Permissions**: Workspace-specific authorization

## Security Features

### Authentication & Authorization

-   JWT token-based authentication via Supabase
-   Role-based access control (owner/member)
-   Workspace-specific permission validation
-   Secure token validation middleware

### Data Protection

-   SQL injection prevention through TypeORM
-   Input validation and sanitization
-   Secure password handling
-   HTTPS-only communication

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

-   API endpoint testing
-   Database operation testing
-   Authentication flow testing
-   Error handling validation

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

-   **Real-time Collaboration**: WebSocket integration for live updates
-   **Advanced Permissions**: Granular role-based access control
-   **Workspace Templates**: Pre-configured workspace setups
-   **Integration APIs**: Third-party service connections

### Technical Improvements

-   **Microservices Architecture**: Further modularization
-   **Container Deployment**: Docker containerization
-   **Caching Layer**: Redis integration for performance
-   **API Versioning**: Backward-compatible API evolution

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
