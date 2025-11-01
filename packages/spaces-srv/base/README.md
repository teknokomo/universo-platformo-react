# Spaces Service (@universo/spaces-srv)

> 🧬 **TypeScript-first** | Modern Express.js backend for Spaces and Canvases management

Backend service for Spaces domain in Universo Platformo. This service manages Spaces (formerly Chatflows) and their associated Canvases in a multi-canvas architecture.

## Package Information

| Property          | Value                   |
| ----------------- | ----------------------- |
| **Version**       | `0.1.0`                 |
| **Package Type**  | Workspace Package       |
| **Status**        | ✅ Active Development   |

### Key Features
- 🗂️ Multi-canvas architecture with space-canvas relationships
- 📊 PostgreSQL database with TypeORM integration
- 🛡️ Row Level Security (RLS) with Supabase authentication
- 🔄 Canvas ordering and reordering capabilities
- 🏢 Integration with Unik workspace system
- 📦 RESTful API for spaces and canvases management

## Overview

The Spaces service provides:
- **Spaces**: Top-level containers that group related canvases
- **Canvases**: Individual flow editors within a space (equivalent to the old Chatflow concept)
- **Space-Canvas relationships**: Many-to-many relationships with ordering support

## Architecture

### Database Schema

- `spaces` - Main space entities with metadata
- `canvases` - Individual canvas entities containing flow data
- `spaces_canvases` - Junction table managing space-canvas relationships with sort ordering

### Key Features

- Multi-canvas support within spaces
- Canvas ordering and reordering
- RLS (Row Level Security) integration with Supabase
- Integration with existing Unik workspace system

## API Endpoints

### Spaces
- `GET /api/v1/spaces` - List all spaces
- `POST /api/v1/spaces` - Create new space
- `GET /api/v1/spaces/:id` - Get space details with canvases

### Canvases
- `GET /api/v1/spaces/:id/canvases` - Get canvases for space
- `POST /api/v1/spaces/:id/canvases` - Create new canvas in space

## Development

### Build
```bash
pnpm --filter @universo/spaces-srv build
```

### Development Mode
```bash
pnpm --filter @universo/spaces-srv dev
```

## Integration

This service integrates with:
- **Uniks Service**: For workspace management and user permissions
- **Main Flowise Server**: For core functionality and routing
- **Supabase**: For authentication and RLS policies

## Migration from Chatflows

This service is part of the migration from the single Chatflow concept to the multi-canvas Spaces architecture. The migration preserves all existing functionality while adding support for multiple canvases per space.