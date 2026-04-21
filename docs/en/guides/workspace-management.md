---
description: Workspace switching, shared workspace creation, and member management in workspace-enabled applications.
---

# Workspace Management

Workspace-enabled applications now expose the runtime workspace model directly in the shared MUI shell.

## What Users Can Do

- switch between available workspaces from the app navbar;
- create a shared workspace;
- invite members by user id and assign a runtime workspace role;
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
- `WorkspaceManagerDialog`

Both components live in `packages/apps-template-mui` and are generic for any workspace-enabled application.
