# Universo Platformo Applications

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo React. Some sections may still reference Flowise functionality that has not yet been fully updated for Universo Platformo-specific features.

This section documents the modular applications that extend the main Flowise platform, providing additional functionality without modifying the core codebase.

## Overview

The Universo Platformo applications directory (`apps/`) contains specialized modules that implement the unique features of the platform. These applications work together to provide a comprehensive ecosystem for creating AI agents, 3D/AR/VR experiences, and managing user interactions.

## Application Architecture

All applications follow a consistent modular structure designed for scalability and maintainability:

```
apps/
├── updl/                # UPDL node system for universal 3D/AR/VR spaces
├── publish-frt/         # Publication system frontend
├── publish-srv/         # Publication system backend
├── profile-frt/         # User profile management frontend
├── profile-srv/         # User profile management backend
├── analytics-frt/       # Analytics and reporting frontend
└── auth-frt/           # Authentication system frontend
```

## Core Applications

### UPDL (Universal Platform Definition Language)
The foundation of Universo Platformo's 3D/AR/VR capabilities, providing a unified node system for describing interactive spaces.

**Key Features:**
- 7 core high-level nodes for universal scene description
- Legacy nodes for backward compatibility
- Pure Flowise integration
- TypeScript interfaces and type safety

[Learn more about UPDL →](updl/README.md)

### Publication System
A comprehensive system for exporting UPDL spaces to various platforms and sharing them with public URLs.

**Frontend (publish-frt):**
- Client-side UPDL processing
- Template-based builders (AR.js, PlayCanvas)
- MMOOMM space MMO template
- Supabase integration

**Backend (publish-srv):**
- Raw data provider
- Publication management
- Centralized type definitions
- Asynchronous route initialization

[Learn more about Publication System →](publish/README.md)

### Profile Management
Complete user profile and authentication system with secure data management.

**Frontend (profile-frt):**
- Email and password updates
- JWT token-based authentication
- Mobile-friendly responsive design
- Internationalization support

**Backend (profile-srv):**
- Secure endpoints for user data
- SQL functions with SECURITY DEFINER
- Row Level Security (RLS) policies
- TypeORM integration

[Learn more about Profile Management →](profile/README.md)

### Analytics System
Frontend module for displaying quiz analytics and user interaction data.

**Features:**
- Quiz performance analytics
- User engagement metrics
- Data visualization components
- Integration with main platform

[Learn more about Analytics →](analytics/README.md)

### Authentication System
Modern Supabase-based authentication system replacing legacy authentication.

**Features:**
- Email/password authentication
- JWT token management
- Route protection
- Centralized error handling

[Learn more about Authentication →](auth/README.md)

## Application Interactions

The applications work together in a coordinated ecosystem:

```
┌──────────────┐       ┌────────────────┐        ┌────────────────┐
│              │       │                │        │                │
│   Flowise    │──────▶│  UPDL Module   │───────▶│ Publish Module │
│   Editor     │       │  (Space Graph) │        │  (Export/Share)│
│              │       │                │        │                │
└──────────────┘       └────────────────┘        └────────┬───────┘
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │                │
                                                 │  Public URL    │
                                                 │  /p/{uuid}     │
                                                 │                │
                                                 └────────────────┘
```

## Development Guidelines

### Modular Design Principles

1. **Self-Contained Applications**: Each application is independent with clear interfaces
2. **Minimal Core Changes**: Avoid modifying the main Flowise codebase
3. **Shared Type Definitions**: Use common types for inter-application communication
4. **Consistent Documentation**: Maintain README files in each application directory

### Build System

All applications use a unified build system:

```bash
# Install dependencies for entire workspace
pnpm install

# Build all applications
pnpm build

# Build specific application
pnpm build --filter <app-name>

# Development mode with file watching
pnpm --filter <app-name> dev
```

### Directory Structure Standards

Each application follows this structure:

```
app-name/
├── base/                # Core functionality
│   ├── src/             # Source code
│   │   ├── components/  # React components (frontend)
│   │   ├── controllers/ # Express controllers (backend)
│   │   ├── services/    # Business logic
│   │   ├── types/       # TypeScript interfaces
│   │   ├── utils/       # Utility functions
│   │   └── index.ts     # Entry point
│   ├── dist/            # Compiled output
│   ├── package.json     # Package configuration
│   ├── tsconfig.json    # TypeScript configuration
│   └── README.md        # Application documentation
```

## Integration Points

### Database Integration
- **TypeORM Entities**: Shared entity definitions
- **Migration System**: Coordinated database migrations
- **Connection Pooling**: Efficient database connections

### Authentication Integration
- **JWT Tokens**: Consistent authentication across applications
- **Supabase Integration**: Centralized user management
- **Route Protection**: Unified access control

### API Integration
- **RESTful Endpoints**: Standardized API design
- **Error Handling**: Consistent error responses
- **Type Safety**: Shared TypeScript interfaces

## Security Considerations

### Authentication & Authorization
- JWT token-based authentication
- Row Level Security (RLS) policies
- Secure password hashing with bcrypt
- Input validation and sanitization

### Data Protection
- HTTPS-only communication
- Secure token storage
- SQL injection prevention
- XSS protection

### API Security
- Rate limiting
- CORS configuration
- Request validation
- Error message sanitization

## Deployment Architecture

### Development Environment
```bash
# Start all applications in development mode
pnpm dev

# Start specific application
pnpm --filter <app-name> dev
```

### Production Build
```bash
# Clean build all applications
pnpm clean
pnpm build

# Deploy to production environment
pnpm deploy
```

### Environment Configuration
- Database connection strings
- Supabase configuration
- JWT secrets
- API endpoints

## Monitoring & Logging

### Application Monitoring
- Performance metrics
- Error tracking
- User analytics
- System health checks

### Logging Strategy
- Structured logging
- Error aggregation
- Audit trails
- Debug information

## Future Expansion

### Adding New Applications

When creating new applications:

1. **Follow Naming Convention**: Use descriptive names with `-frt` (frontend) or `-srv` (backend) suffixes
2. **Implement Standard Structure**: Follow the established directory structure
3. **Add Documentation**: Include comprehensive README.md files
4. **Update Integration**: Add to build system and routing configuration
5. **Test Integration**: Ensure compatibility with existing applications

### Planned Enhancements

- **Real-time Communication**: WebSocket integration for live updates
- **Microservices Architecture**: Further modularization of services
- **Container Deployment**: Docker containerization for scalability
- **API Gateway**: Centralized API management and routing

## Next Steps

- [UPDL System](updl/README.md) - Learn about the Universal Platform Definition Language
- [Publication System](publish/README.md) - Explore content publishing and sharing
- [Profile Management](profile/README.md) - Understand user management features
- [Analytics System](analytics/README.md) - Discover analytics capabilities
- [Authentication System](auth/README.md) - Learn about security features
