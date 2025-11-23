# Metaverse Backend (metaverse-srv) — [Status: MVP]

## Purpose

Backend for the “metaverses” domain: lifecycle management of metaverses, links (child/partner), access, publishing, integration with ECS and UPDL.

See broader context in [About Universo Platformo](../../universo-platformo/README.md).

## Service boundaries

-   Inside: `metaverse`, `unik`, `space`, `link` (meta↔meta), ACL
-   Outside: ECS (`entities-srv`), resources (`resources-srv`), economy (`economy-srv`), publishing (`template-engine-srv`, `publish-frt`)

## Interfaces

-   REST API (minimum):
    -   POST `/api/v1/metaverses` — create
    -   POST `/api/v1/metaverses/default` — initialize default metaverse for user
    -   PATCH `/api/v1/metaverses/:id` — settings/access
    -   POST `/api/v1/metaverses/:id/links` — child/partner links; pluggable locations
    -   POST `/api/v1/metaverses/:id/import` — import project with conversion to UPDL
    -   GET `/api/v1/metaverses/:id/overview` — overview (Uniks, Spaces, links)
    -   POST `/api/v1/metaverses/:id/publish` — publish via template
-   Events: `metaverse.created`, `metaverse.linked`, `metaverse.published`

## Directory structure (expected)

```txt
packages/metaverse-srv/base/
  src/
    api/
    domain/
    infra/
    integrations/
```

## Data (high-level)

-   Tables: `metaverse.metaverses`, `metaverse.uniks`, `metaverse.spaces`, `metaverse.links`
-   ECS link: `ecs.entities` (world/metaverse scope)

## Security

-   Supabase Auth, ACL at metaverse/space level
-   RLS policies for tenant separation (owner/team/org)

## Metrics

-   Count of metaverses/links, publishing latency, ACL errors

## Integrations & conversion

-   Import existing projects → convert to UPDL Space graphs
-   Manage UPDL/template version compatibility
