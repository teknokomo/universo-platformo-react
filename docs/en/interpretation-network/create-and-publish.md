---
description: Create an Interpretation Network application from the template or from the controlled snapshot.
---

# Create And Publish

Use this workflow to create a stable MVP application that can be opened by editors and checked through the same route as production users.

![Create and publish workflow](../.gitbook/assets/interpretation-network/create-and-publish.png)

## Role And Goal

This page is for an owner who prepares the application shell, synchronizes the schema, and publishes the first workspace.

## Prerequisites

-   You can create metahubs and applications.
-   You know whether you are starting from the built-in template or from the prepared demonstration snapshot.
-   You can grant application membership to the users who will author content.

## Workflow

1. Create the metahub from the Interpretation Network template, or import the prepared demonstration snapshot when you need the exact verification baseline.

![Publication ready after import or creation](../.gitbook/assets/interpretation-network/create-and-publish-step-1.png)

2. Create a linked application from the publication, open its settings from the application list, and verify that the application is ready.

![Linked application settings](../.gitbook/assets/interpretation-network/create-and-publish-step-2.png)

3. Confirm that the Start page, workspace switcher, and Structures navigation are visible before inviting editors.

![Published application check](../.gitbook/assets/interpretation-network/create-and-publish-step-3.png)

## Expected Result

Editors open one application URL, choose a workspace, and work in the Matrix. The source configuration remains owned by the template and publication, while user content is authored inside the application workspace.

Public visibility is a separate access mode: anonymous visitors receive the published Dashboard and the same shared Interpretation Network workspace controls in read-only mode. The public view follows the placement's Structure mode, allowed Matrix views, and pane layout. The server uses the configured public-entry Workspace, or the only active shared Workspace when exactly one exists. With no shared Workspace or an ambiguous choice, the app remains public and shows a localized empty state. The visitor cannot select a Workspace or mutate cells, Materials, templates, Favorites, or settings. Keep the authenticated member route for authoring and workspace selection. See [Applications](../platform/applications.md) for the application access boundary.

## What To Check

-   The application opens through the normal published app route.
-   The Structures item leads to the Matrix workspace.
-   No setup screen asks editors to edit technical configuration.
-   Verify public visibility and the intended published entry view separately from authenticated editor access.

## Related Pages

-   [Application Settings](application-settings.md)
-   [Application layouts](../guides/application-layouts.md)
-   [Snapshot Export & Import](../guides/snapshot-export-import.md)
