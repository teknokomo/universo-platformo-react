# `packages/uniks-frontend` — Uniks Frontend — [Status: MVP]

Frontend application for workspace management in Universo Platformo.

## Purpose

Provides user interface for creating, organizing, and managing collaborative workspaces.

## Key Features

- **Workspace CRUD management**: Create, read, update, delete workspaces
- **Member management**: Add/remove members with role management
- **Multi-role system**: Support for owner/admin/editor/member roles
- **Responsive Material UI**: Adaptive interface
- **Internationalization**: EN/RU localization
- **Integrated navigation**: Built into main platform

## Components

### UnikList.jsx

Main workspace listing page with:
- Grid and list views
- Search and filtering
- Quick access to actions
- Visual status indicators

### UnikDetail.jsx

Detailed workspace view:
- Information and settings
- Member list with role management
- Activity feed
- Quick actions

### UnikDialog.jsx

Modal dialog for operations:
- Create new workspace
- Edit properties
- Configure settings
- Manage visibility and permissions

## Technologies

- **React**: Frontend framework
- **Material-UI**: Component library
- **i18next**: Internationalization
- **TypeScript**: Type safety

## Integration

### Navigation

Workspace routes mounted under `/:unikId` prefix with main platform menu integration.

### Authentication

Uses Supabase JWT tokens for user authentication.

## Development

```bash
# Install dependencies
pnpm install

# Build for production
pnpm build --filter @universo/uniks-frontend

# Development mode
pnpm --filter @universo/uniks-frontend dev
```

## See Also

- [Uniks Backend](./backend.md) - Backend component
- [Uniks README](./README.md) - System overview
