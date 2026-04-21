---
description: Explain operating nodes, organizations, and workspace-like scopes.
---

# Nodes and Workspaces

Nodes and workspaces describe operational scopes for organizations, people,
owned resources, and collaboration rules across the platform.

## What This Scope Represents

- A boundary for people, roles, memberships, and owned resources.
- A place where operational data and collaboration rules can be attached.
- A unit that can later participate in broader distributed coordination.

## Current Implementation

The current public implementation already includes authenticated membership,
profile bootstrap, admin roles, metahub access, and request-scoped data access.

Applications now use this scope directly:

- workspace-enabled applications bootstrap personal workspaces for the owner and every member;
- the shared MUI application shell exposes a visible workspace switcher in the app navbar;
- users can create shared workspaces and manage workspace members without leaving the runtime surface;
- workspace roles are stored separately from application membership so future sharing can be added without redesigning the schema;
- runtime rows are isolated by workspace through backend predicates and runtime context;
- join, leave, member add, and member remove flows all keep workspace lifecycle in sync.

The exact domain vocabulary can still evolve, but the repository already
implements the coordination and access patterns behind this scope.

For the current user-facing contract, see [Workspace Management](../guides/workspace-management.md).
