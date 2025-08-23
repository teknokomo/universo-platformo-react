# Project Structure

## Monorepo Architecture
This is a PNPM workspace with Turbo build orchestration. The project extends Flowise AI with modular applications.

## Root Structure
```
universo-platformo-react/
├── packages/              # Original Flowise packages
│   ├── components/        # Flowise components and UPDL nodes
│   ├── server/           # Backend server (Express + TypeORM)
│   └── ui/               # Frontend React application
├── apps/                 # Modular applications (NEW architecture)
│   ├── */base/           # Each app has a base/ subdirectory
│   └── README.md         # Apps documentation
├── docs/                 # Documentation (en/es/ru)
├── docker/               # Docker configurations
└── memory-bank/          # Project context and progress tracking
```

## Apps Architecture
Each application follows this structure:
```
apps/{app-name}/
└── base/                 # Core functionality
    ├── src/              # Source code
    │   ├── api/          # API clients (frontend)
    │   ├── assets/       # Static resources (icons, SVGs)
    │   ├── components/   # React components (frontend)
    │   ├── controllers/  # Express controllers (backend)
    │   ├── features/     # Feature modules
    │   ├── i18n/         # Internationalization
    │   ├── interfaces/   # TypeScript types
    │   ├── nodes/        # UPDL node definitions
    │   ├── pages/        # Page components (frontend)
    │   ├── routes/       # Express routes (backend)
    │   ├── services/     # Business logic (backend)
    │   └── index.ts      # Entry point
    ├── dist/             # Compiled output
    ├── package.json      # Dependencies and scripts
    ├── tsconfig.json     # TypeScript config
    ├── gulpfile.ts       # Asset processing (frontend apps)
    └── README.md         # App documentation
```

## Current Applications
- **updl**: UPDL node system for 3D/AR/VR scene definition
- **uniks-frt/uniks-srv**: Workspace management (frontend/backend)
- **profile-frt/profile-srv**: User profile management (frontend/backend)
- **publish-frt/publish-srv**: Publication system (frontend/backend)
- **space-builder-frt/space-builder-srv**: AI prompt-to-flow generation
- **metaverse-frt/metaverse-srv**: Metaverse functionality
- **analytics-frt**: Analytics frontend
- **auth-frt**: Authentication frontend

## Workspace Configuration
- **pnpm-workspace.yaml**: Defines workspace packages
- **turbo.json**: Build pipeline configuration
- **package.json**: Root dependencies and scripts

## Key Conventions
- Use `pnpm` not `npm`
- Frontend apps end with `-frt`, backend with `-srv`
- All apps are in `apps/*/base/` structure
- Shared types are exported from backend packages
- Assets (SVGs, icons) processed via Gulp in frontend apps
- TypeScript compilation via `tsc`, then Gulp for assets

## Integration Points
- Apps integrate with main Flowise via workspace dependencies
- Backend apps export as `@universo/{app-name}` packages
- Frontend apps integrate into main UI via dynamic imports
- UPDL nodes are registered in the components package

## Development Workflow
1. Work in individual app directories
2. Use `pnpm --filter {app-name} dev` for development
3. Build specific apps with `pnpm --filter {app-name} build`
4. Root `pnpm build` builds entire workspace