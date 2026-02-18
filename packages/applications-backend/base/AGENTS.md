# Applications Backend — AI Agent Guide

## Overview

This package (`@universo/applications-backend`) provides the backend API for standalone application management, including CRUD operations, runtime data access, and role-based access control.

## Key Routes

### Application Routes (`src/routes/applicationsRoutes.ts`)

Main application CRUD and runtime endpoints:
- `GET /application/:id` — get application details
- `PUT /application/:id` — update application
- `DELETE /application/:id` — delete application
- `GET /application/:id/dashboard` — runtime dashboard data (layouts, widgets, settings)

**Dashboard endpoint** reads from application schema tables:
- `_app_layouts` — layout templates
- `_app_widgets` — zone widgets per layout (renamed from `_app_layout_zone_widgets`)
- `_app_settings` — key-value settings

Uses raw SQL with `information_schema` existence checks before querying dynamic schema tables.

### Access Control

- `ensureApplicationAccess` middleware — validates user role for application
- Roles: `owner`, `admin`, `editor`, `viewer`
- Exported for use by other packages (e.g., `metahubs-backend`)

## Key Entities

- `Application` — core entity with `schemaName`, `schemaStatus`, `appStructureVersion`
- `ApplicationUser` — user-role mapping
- `ApplicationSchemaStatus` enum: `PENDING`, `SYNCED`, `MAINTENANCE`, `ERROR`

## Schema Tables (Dynamic)

Application schemas (`app_{uuid}`) contain:
- `_app_layouts` — UI layout definitions
- `_app_widgets` — widgets placed in layout zones
- `_app_settings` — configuration key-value pairs
- User-defined entity tables (from metahub catalog)

Tables are created by `SchemaGenerator` from `@universo/schema-ddl`.

## Dependencies

- `@universo/types` — shared type definitions
- TypeORM for entity management
- Express for routing
