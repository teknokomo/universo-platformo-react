---
description: How to use the metahub Common section as the real entrypoint for layouts, shared entities, and shared library scripts.
---

# Common Section

The Common page is the real authoring entrypoint for layouts, shared entities, and shared library scripts in a metahub.
Legacy `/layouts` links still work, but they redirect into Common so existing bookmarks do not break.

## What Lives Here

- global layouts that shape shared runtime composition;
- shared attributes, constants, and enumeration values that can be inherited by target objects;
- catalog-specific layout navigation and sparse layout overrides;
- general/library scripts that expose reusable `@shared/<codename>` helpers;
- shared view behavior that belongs with layout authoring instead of separate admin settings.

## Navigation Contract

1. Open a metahub.
2. Use the sidebar item Common.
3. Switch between Layouts, Attributes, Constants, Values, and Scripts depending on the shared resource you need.
4. Open a catalog and continue into its own route when you need to inspect merged inherited rows or catalog-specific layout behavior.

## Shared Entity Workflow

1. Create shared attributes, constants, or values from the corresponding Common tab.
2. Use the Presentation and Exclusions tabs in the dialog when you need behavior locks or target-specific exclusions.
3. Open a target catalog, set, or enumeration to verify merged inherited rows and read-only action gating.
4. Publish and sync the linked application when runtime should materialize the shared rows.

## Shared Scripts Workflow

1. Open Common -> Scripts to author `general/library` helpers.
2. Import those helpers from consumer scripts through `@shared/<codename>`.
3. Keep libraries pure: they are compiled for dependency resolution, not exposed as direct runtime entrypoints.
4. Publish a version and verify the consuming widget or module on `/a/:applicationId`.

## Fail-Closed Common Rules

- shared rows stay read-only in target object lists, and per-target overrides must be configured through the Presentation and Exclusions tabs in Common;
- Common -> Scripts accepts only `general/library` authoring, so reusable helpers cannot be created as widget, module, or lifecycle drafts;
- shared library delete or codename changes fail closed while consumer scripts still import `@shared/<codename>`;
- circular `@shared/*` graphs are rejected during authoring, so publication does not ship ambiguous Common dependencies.

## Why Common Keeps Growing

The platform now keeps cross-cutting metahub authoring behind one tabbed Common surface.
This avoids splitting layout, shared-entity, and shared-library work across separate menu items and keeps future Common-level tabs expandable without another navigation refactor.

## Related Reading

- [Catalog Layouts](catalog-layouts.md)
- [Metahub Scripting](metahub-scripting.md)
- [Application Template View Settings](app-template-views.md)
- [Metahubs](../platform/metahubs.md)