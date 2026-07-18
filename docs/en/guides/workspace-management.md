---
description: Workspace switching, shared workspace creation, and member management in workspace-enabled applications.
---

# Workspace Management

Workspace-enabled applications expose the runtime workspace model directly in the published application MUI shell.

## What Users Can Do

![Workspace management section](../.gitbook/assets/platform/applications-list.png)

-   switch between available workspaces from the app navbar;
-   open the full workspace management section from the application menu or workspace switcher;
-   create a shared workspace with server-side pagination and search;
-   invite active application members by email and assign a runtime workspace role;
-   remove members from a shared workspace;
-   mark a workspace as the current default workspace.
-   open Workspace Settings for settings that the application administrator allows to be overridden per workspace.

## Why This Matters For LMS

The LMS MVP uses workspaces for collaboration boundaries.
For example, one teacher team can work in one workspace while another class team works in another, with runtime rows isolated by workspace-aware backend predicates.

## Current Roles

-   `owner`
-   `member`

These roles are stored in the application schema and are separate from global platform roles.

## Workspace Settings

Workspace Settings are explicit per-workspace overrides on top of application settings.
They are available only for setting keys allowed by the application workspace override policy.
If a key is locked by the application, the workspace page does not expose an editor for it and the runtime uses the application value.

Workspace owners can change allowed workspace settings for their workspace.
Application administrators can manage workspace settings from the runtime API even when they are not members of the target workspace.
Non-admin users who are not workspace members remain denied.

Copying a workspace copies only active overrides that are still allowed by the current application policy.
This prevents stale or locked setting keys from being carried into new workspaces.

## UI Components

The current implementation uses:

-   `WorkspaceSwitcher`
-   `RuntimeWorkspacesPage`
-   shared card/list primitives from `@universo-react/template-mui`

These components live in `packages/universo-react-apps-template-mui`. The workspace page is rendered through the existing dashboard details content slot, so published applications keep the same header, mobile navbar, side menu, and data-view styling as other runtime sections.
