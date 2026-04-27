---
description: Describe knowledge spaces, structured content, and reusable layouts.
---

# Spaces

Spaces are structured platform areas used to group content, definitions, templates,
and operational context around one domain.

![Resources workspace for structured metahub content](../.gitbook/assets/entities/resources-workspace.png)

## Current Role

- Metahubs provide design-time structure for entity types, resources, and publications.
- Applications provide runtime execution surfaces synced from publications.
- Shared schema and migration tooling keep structured content reproducible across environments.

## Operating Boundary

Use metahubs and application resources as the current authoring and runtime boundary.
Do not model spaces as a separate published object unless a package explicitly exposes that contract.
