# Technology Stack

## Core Technologies
- **Node.js**: >=18.15.0 <19.0.0 || ^20
- **PNPM**: >=9 (package manager - NOT npm)
- **TypeScript**: ^5.8.3
- **React**: ^18.2.0
- **Express**: ^4.17.3

## Build System
- **Turbo**: Monorepo build orchestration
- **Gulp**: Asset processing for frontend apps
- **TSC**: TypeScript compilation
- **Vite**: Frontend development server (UI package)

## Database & Storage
- **Supabase**: Authentication and multi-user functionality
- **TypeORM**: Database ORM (^0.3.6)
- **PostgreSQL**: Primary database (pg ^8.11.1)
- **MySQL**: Alternative database support (mysql2 ^3.11.3)
- **SQLite**: Development database (sqlite3 ^5.1.6)

## Key Libraries
- **Flowise Components**: Core node system
- **LangChain**: ^0.3.5 (AI/LLM integration)
- **Material-UI**: ^5.15.0 (UI components)
- **ReactFlow**: ^11.5.6 (node editor)
- **Redis**: ^4.6.7 (caching/sessions)

## Common Commands

### Installation & Setup
```bash
pnpm install                    # Install all dependencies
```

### Development
```bash
pnpm dev                        # Start all apps in development mode
pnpm --filter <app-name> dev    # Start specific app in dev mode
```

### Building
```bash
pnpm build                      # Build all packages and apps
pnpm build-force               # Clean build (with --force)
pnpm --filter <app-name> build # Build specific app
```

### Starting Production
```bash
pnpm start                     # Start production server
pnpm start-worker             # Start worker process
```

### Maintenance
```bash
pnpm clean                     # Clean build artifacts
pnpm clean:all                # Clean everything including node_modules
pnpm nuke                     # Nuclear clean (packages only)
```

### Code Quality
```bash
pnpm lint                     # Run ESLint
pnpm lint-fix                 # Fix linting issues
pnpm format                   # Format with Prettier
```

## Environment Setup
- Create `.env` in `packages/flowise-core-backend/base/` with Supabase configuration
- Optionally create `.env` in `packages/flowise-core-frontend/base/` for UI settings
- Use `VITE_PORT` for UI port configuration