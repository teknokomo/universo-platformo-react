---
description: How to use the metahub resources workspace as the real entrypoint for layouts, reusable metadata resources, and shared library scripts.
---

# Resources Workspace

The Resources page is the real authoring entrypoint for layouts, reusable metadata resources, and shared library scripts in a metahub.
The live navigation points directly to `/resources`, and this guide documents that canonical route.

![Resources workspace](../.gitbook/assets/entities/resources-workspace.png)

## What Lives Here

- shared layouts that shape reusable runtime composition;
- shared attribute, constant, and value pools that can be inherited by compatible entity types;
- entity-specific layout navigation and sparse layout overrides;
- resources/library scripts that expose reusable `@shared/<codename>` helpers;
- shared view behavior that belongs with layout authoring instead of separate admin settings.

## Navigation Contract

1. Open a metahub.
2. Use the sidebar item Resources.
3. Switch between Layouts, Attributes, Constants, Values, and Scripts depending on the shared asset you need.
4. Open a target entity and continue into its own route when you need to inspect merged inherited rows or entity-specific layout behavior.

## Shared Resource Workflow

1. Create shared attributes, constants, or values from the corresponding Resources tab.
2. Use the Presentation and Exclusions tabs in the dialog when you need behavior locks or target-specific exclusions.
3. Open a target entity to verify merged inherited rows and read-only action gating.
4. Publish and sync the linked application when runtime should materialize the shared rows.

## Shared Scripts Workflow

1. Open Resources -> Scripts to author reusable library helpers.
2. Import those helpers from consumer scripts through `@shared/<codename>`.
3. Keep libraries pure: they are compiled for dependency resolution, not exposed as direct runtime entrypoints.
4. Publish a version and verify the consuming widget or module on `/a/:applicationId`.

## Fail-Closed Resources Rules

- shared rows stay read-only in target entity lists, and per-target overrides must be configured through the Presentation and Exclusions tabs in Resources;
- Resources -> Scripts accepts only reusable library authoring, so shared helpers cannot be created as widget, module, or lifecycle drafts;
- shared library delete or codename changes fail closed while consumer scripts still import `@shared/<codename>`;
- circular `@shared/*` graphs are rejected during authoring, so publication does not ship ambiguous shared dependencies.

## Why Resources Keeps Growing

The platform now keeps cross-cutting metahub authoring behind one dedicated Resources surface.
This keeps layout, shared-resource, and shared-library work behind one predictable entrypoint.

## Related Reading

- [Catalog Layouts](catalog-layouts.md)
- [Metahub Scripting](metahub-scripting.md)
- [Application Template View Settings](app-template-views.md)
- [Metahubs](../platform/metahubs.md)
