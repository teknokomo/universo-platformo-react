---
description: Describe applications as runtime modules built on the shared platform shell.
---

# Applications

Applications are runtime modules built on top of the shared platform shell.
They are governed execution surfaces connected to memberships, schemas,
publications, and shared services.

## Current Implementation

The repository already includes application-domain backend and frontend modules,
connector relations, memberships, schema-aware lifecycle handling, and admin or
publication integration points.

It now also includes:

- immutable application visibility (`closed` or `public`);
- optional workspace mode, with the create UI recommending workspaces for public applications;
- public discovery plus explicit join / leave membership flows;
- application settings for per-workspace catalog row limits;
- runtime schema bootstrap that keeps workspace support inside the canonical sync lineage.

## Design Direction

- Keep application metadata in managed platform structures.
- Use controlled schema creation for run-time data when needed.
- Link applications to publications and metahubs without collapsing boundaries.
- Preserve portability across future technology stacks.

## Workspace-Aware Runtime Model

When `workspacesEnabled` is enabled, runtime business data is scoped by a personal workspace:

- the owner and every current member receive a `Main` workspace during first schema bootstrap;
- new members receive a personal workspace when access is granted;
- catalog tables and TABLE child tables are stamped with `workspace_id`;
- runtime CRUD resolves the caller's default workspace before accessing rows;
- leaving an application archives the personal workspace instead of hard-deleting all rows;
- catalog limits are enforced per workspace, not globally per application.

This keeps applications close to ERP/CMS platform logic and shared platform governance.
