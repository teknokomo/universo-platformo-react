---
inclusion: always
---

# Product Overview

Universo Platformo is a platform for creating metahubs — structured data management systems with entity architecture, publications, and scripting capabilities. Built on an inherited upstream shell, it extends the core framework with multi-user functionality through Supabase.

## Core Functionality

- **Metahubs**: Central hubs for managing structured data with entity-component-action-event (ECAE) architecture
- **Entity System**: Flexible data modeling with catalogs, hubs, sets, and enumerations
- **Publications**: Export and share metahub content as standalone applications
- **Scripting**: Server-side and client-side scripting with isolated-vm for secure execution
- **Applications**: Create and manage applications linked to metahubs
- **LMS (Learning Management System)**: Complete learning platform with quizzes, modules, and progress tracking

## Key Domains

### Metahubs
- Create and manage metahubs with hierarchical structure
- Entity types: Hub, Catalog, Set, Enumeration
- Attributes, constants, and values management
- Layout system for UI customization
- Snapshot import/export for portability

### Applications
- Link applications to metahubs
- Runtime schema synchronization
- Application-specific layouts and widgets
- Public access links for sharing

### Publications
- Export metahubs as standalone applications
- Template-based publication system
- Version management and releases

### Scripting
- Embedded scripts with server/client execution
- Extension SDK for custom functionality
- Secure isolation with isolated-vm

### LMS
- Quiz creation and management
- Learning modules with content items
- Student progress tracking
- Public guest access for courses

## Architecture

### Entity-Component-Action-Event (ECAE)
The platform uses an ECAE architecture where:
- **Entities** are data objects with typed attributes
- **Components** define entity capabilities
- **Actions** are executable behaviors
- **Events** trigger actions based on conditions

### Package Structure
The monorepo is organized into:
- **Core shell**: `universo-core-backend`, `universo-core-frontend`
- **Feature modules**: `metahubs-*`, `applications-*`, `auth-*`, `profile-*`, `admin-*`, `start-*`
- **Infrastructure**: `universo-database`, `schema-ddl`, `universo-types`, `universo-utils`
- **UI support**: `universo-template-mui`, `apps-template-mui`, `universo-store`

## Target Use Cases

- **Learning Management Systems**: Create courses, quizzes, and track student progress
- **Enterprise Data Management**: Structured data with custom entity types
- **Business Applications**: Custom workflows and data processing
- **Content Publishing**: Export and share structured content
- **Multi-tenant Platforms**: Workspace-based isolation with shared resources

## Technical Foundation

- **Node.js** (>=18.15.0 <19.0.0 || ^20)
- **PNPM** (>=9) - Package manager
- **TypeScript** (^5.8.3)
- **React** (^18.2.0) with Material-UI
- **Express** (^4.17.3)
- **Supabase** for authentication and PostgreSQL database
- **Knex** for SQL query building
- **TanStack Query** for frontend data fetching
- **Playwright** for E2E testing

## Development Philosophy

- Minimal changes to the inherited upstream shell
- Backwards compatibility where possible
- SQL-first data access with request-scoped executors
- Fail-closed security model
- Template-based UI components for consistency
