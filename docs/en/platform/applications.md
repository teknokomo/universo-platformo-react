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

## Design Direction

- Keep application metadata in managed platform structures.
- Use controlled schema creation for run-time data when needed.
- Link applications to publications and metahubs without collapsing boundaries.
- Preserve portability across future technology stacks.

This keeps applications close to ERP/CMS platform logic and shared platform governance.
