# Flowise Server

🚨 **LEGACY CODE WARNING** 🚨  
This package is part of the legacy Flowise architecture and is scheduled for removal/refactoring after the Universo Platformo migration is complete (estimated Q2 2026). New features should be developed in the modern `@universo/*` packages instead.

## Overview

The main backend server for Universo Platformo, providing the foundational Express-based REST API, database management, and authentication services. This package serves as the central hub for all Flowise functionality and integrates with the modern `@universo/*` service packages.

## Package Information

- **Package**: `flowise`
- **Version**: `2.2.8` (frozen legacy version)
- **Type**: Backend Server (Legacy)
- **Framework**: Express.js + TypeORM + OCLIF CLI
- **Database**: PostgreSQL via Supabase
- **Authentication**: Passport.js + JWT + Supabase integration

## Key Features

### 🎯 Core Server Functionality
- **Express API Server**: Complete REST API with rate limiting and middleware
- **Database Management**: TypeORM integration with PostgreSQL and Supabase
- **Authentication System**: Passport.js sessions with JWT token verification
- **Entity Registry**: Centralized TypeORM entity and migration management
- **Queue Management**: Redis-based job queue for background processing
- **Metrics & Telemetry**: Prometheus and OpenTelemetry integration

### 🔐 Security Features
- **CSRF Protection**: Token-based CSRF protection using `csurf`
- **Rate Limiting**: Express rate limiting with Redis backend
- **XSS Protection**: Request sanitization middleware
- **Session Management**: Secure cookie-based sessions
- **API Key Validation**: Multi-layer authentication with fallback to API keys

### 🏗️ Architecture Integration
- **Modern Service Integration**: Imports and uses `@universo/*` packages
- **Flowise Node System**: Integration with legacy `flowise-components` and `flowise-ui`
- **Multiplayer Support**: Colyseus multiplayer server integration
- **Canvas System**: Integration with `@universo/spaces-srv` for flow execution

## CLI Commands (OCLIF)

### Basic Commands
```bash
# Start the server
pnpm start

# Start in development mode
pnpm dev

# List all available commands
pnpm flowise --help

# User management
pnpm user                              # List all users
pnpm user --email admin@example.com --password newpass  # Reset password
```

### Environment Variables
```bash
# Core Configuration
PORT=3000
HOST=localhost
NODE_ENV=production

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Session Management
SESSION_SECRET=your-strong-secret
SESSION_COOKIE_NAME=up.session
SESSION_COOKIE_MAXAGE=86400000
SESSION_COOKIE_SAMESITE=lax
SESSION_COOKIE_SECURE=false

# Rate Limiting
REDIS_URL=redis://localhost:6379

# File Handling
FLOWISE_FILE_SIZE_LIMIT=50mb

# Metrics (Optional)
ENABLE_METRICS=true
METRICS_PROVIDER=prometheus
```

## Architecture Components

### Main Server (`src/index.ts`)
- **App Class**: Central application management
- **Database Initialization**: TypeORM setup and migrations
- **Middleware Stack**: Authentication, CORS, rate limiting, session management
- **Route Registration**: API v1 routes and authentication endpoints

### Authentication System
- **JWT Verification**: Supabase JWT token validation
- **Session Management**: Passport.js + express-session
- **Multi-tier Auth**: Session tokens → Bearer tokens → API keys
- **CSRF Protection**: Cross-site request forgery protection

### Database Layer
- **Entity Registry**: Central registration in `src/database/entities/index.ts`
- **Migration Registry**: PostgreSQL migrations in `src/database/migrations/postgres/index.ts`
- **TypeORM Integration**: Full repository pattern implementation
- **Supabase Connection**: Direct PostgreSQL connection via Supabase

### CLI Framework (OCLIF)
- **Commands Directory**: `src/commands/` contains all CLI implementations
- **Base Command**: Shared functionality in `src/commands/base.ts`
- **Start Command**: Main server startup in `src/commands/start.ts`
- **User Management**: User CRUD operations for authentication

## Dependencies

### Core Framework Dependencies
```json
{
  "express": "^4.18.2",
  "@oclif/core": "^3.18.1",
  "typeorm": "^0.3.20",
  "passport": "^0.7.0",
  "express-session": "^1.17.3"
}
```

### Universo Integration Dependencies
```json
{
  "@universo/auth-srv": "workspace:*",
  "@universo/spaces-srv": "workspace:*",
  "@universo/metaverses-srv": "workspace:*",
  "@universo/multiplayer-colyseus-srv": "workspace:*",
  "@universo/utils": "workspace:*"
}
```

### AI & LangChain Dependencies
```json
{
  "langchain": "~0.1.25",
  "@langchain/core": "~0.1.52",
  "llamaindex": "^0.1.12",
  "chromadb": "^1.8.1"
}
```

## File Structure

```
packages/flowise-server/
├── bin/                    # OCLIF CLI executables
│   ├── run                 # Main CLI entry point
│   ├── run.cmd            # Windows CLI wrapper
│   ├── dev                # Development CLI entry
│   └── dev.cmd            # Windows dev wrapper
├── src/
│   ├── commands/          # OCLIF command implementations
│   │   ├── base.ts        # Base command class
│   │   ├── start.ts       # Server start command
│   │   └── user.ts        # User management commands
│   ├── database/          # Database layer
│   │   ├── entities/      # TypeORM entity registry
│   │   └── migrations/    # Migration registry
│   ├── middlewares/       # Express middleware
│   ├── routes/           # API route definitions
│   ├── utils/            # Utility functions
│   ├── metrics/          # Metrics providers
│   ├── queue/            # Queue management
│   ├── DataSource.ts     # TypeORM data source
│   ├── Interface.ts      # Type definitions
│   └── index.ts          # Main server application
├── cypress/              # E2E testing with Cypress
├── .env.example         # Environment variables template
├── package.json         # Package configuration
└── README.md           # This file
```

## Legacy Status & Migration Plan

### Current State (2024)
- ✅ **Functional**: Fully operational legacy server
- ✅ **Integrated**: Successfully integrated with modern `@universo/*` packages
- ✅ **Secured**: Updated authentication system with Supabase integration
- ⚠️ **Frozen**: Version locked at 2.2.8, no new major features

### Migration Timeline
- **Q1 2025**: Continue modernization of `@universo/*` packages
- **Q2 2025**: Begin gradual migration of server functionality
- **Q3 2025**: Deprecation warnings and migration documentation
- **Q4 2025**: Feature freeze and migration preparation
- **Q1 2026**: Begin server refactoring
- **Q2 2026**: Complete migration and legacy removal

### Replacement Strategy
1. **API Layer**: Migrate to modern Express setup in new `@universo/server` package
2. **Database Layer**: Retain TypeORM patterns but modernize entity management
3. **Authentication**: Keep Supabase integration but simplify middleware stack
4. **CLI Tools**: Migrate essential commands to new package structure
5. **Queue System**: Modernize background job processing

## Testing

### E2E Testing with Cypress
```bash
# Install Cypress
./node_modules/.bin/cypress install

# Build project first
pnpm build

# Run E2E tests
pnpm run e2e

# Open Cypress GUI (development only)
pnpm run cypress:open
```

### Test Structure
- **Cypress Tests**: Located in `cypress/` directory
- **Support Files**: Custom commands and utilities in `cypress/support/`
- **Integration Tests**: Full flow testing for API endpoints

## Development

### Local Development
```bash
# Install dependencies
pnpm install

# Start in development mode
pnpm dev

# Build project
pnpm build

# Start production server
pnpm start
```

### Adding New Features (Legacy Package)
⚠️ **Important**: This is legacy code. New features should be developed in modern `@universo/*` packages when possible.

If you must add features to this legacy package:
1. Follow existing patterns and architecture
2. Ensure compatibility with modern packages
3. Add appropriate deprecation notices
4. Document migration path for the feature

## Rate Limiting & Production Deployment

For production deployments with Redis-based rate limiting, refer to the comprehensive guide:

**[Rate Limiting Deployment Guide](../universo-utils/base/DEPLOYMENT.md)**

This guide covers:
- Redis configuration and connection setup (`REDIS_URL`)
- Docker, Kubernetes, and PM2 deployment examples
- Health checks and monitoring
- Troubleshooting common issues

## Integration Points

### Modern Package Integration
- **Authentication**: Uses `@universo/auth-srv` for Passport.js configuration
- **Spaces**: Integrates `@universo/spaces-srv` for canvas flow execution
- **Metaverses**: Uses `@universo/metaverses-srv` for rate limiter initialization
- **Multiplayer**: Coordinates with `@universo/multiplayer-colyseus-srv`
- **Utils**: Leverages `@universo/utils` for networking and rate limiting

### Legacy Package Dependencies
- **UI**: Serves static files from `flowise-ui` package
- **Components**: Integrates with `flowise-components` node system
- **Templates**: Uses `flowise-template-mui` for UI components

## Documentation

- **API Documentation**: See `/docs/en/api-reference/` for REST API details
- **Deployment Guides**: Check `/docs/en/getting-started/` for setup instructions
- **Migration Guides**: Refer to `/docs/en/migration-guide/` for version updates

## Contributing

⚠️ **Legacy Package Notice**: This package is in maintenance mode. For new contributions:
1. Consider if the feature belongs in a modern `@universo/*` package instead
2. Follow existing code patterns if changes are necessary
3. Add appropriate tests for any modifications
4. Document the migration path for new features

## License

Apache License Version 2.0 - See the [LICENSE](../../LICENSE) file for details.

---

**Migration Support**: If you need help migrating features from this legacy package to modern alternatives, please refer to the migration documentation or create an issue for guidance.
