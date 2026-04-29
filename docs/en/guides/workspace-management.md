---
description: Workspace switching, shared workspace creation, and member management in workspace-enabled applications.
---

# Workspace Management

Workspace-enabled applications expose the runtime workspace model directly in the published application MUI shell.

## What Users Can Do

![Workspace management section](../.gitbook/assets/platform/applications-list.png)

- switch between available workspaces from the app navbar;
- open the full workspace management section from the application menu or workspace switcher;
- create a shared workspace with server-side pagination and search;
- invite active application members by email and assign a runtime workspace role;
- remove members from a shared workspace;
- mark a workspace as the current default workspace.

## Why This Matters For LMS

The LMS MVP uses workspaces for collaboration boundaries.
For example, one teacher team can work in one workspace while another class team works in another, with runtime rows isolated by workspace-aware backend predicates.

## Current Roles

- `owner`
- `member`

These roles are stored in the application schema and are separate from global platform roles.

## UI Components

The current implementation uses:

- `WorkspaceSwitcher`
- `RuntimeWorkspacesPage`
- shared card/list primitives from `@universo/template-mui`

These components live in `packages/apps-template-mui`. The workspace page is rendered through the existing dashboard details content slot, so published applications keep the same header, mobile navbar, side menu, and data-view styling as other runtime sections.
