# Metaverse Frontend (metaverse-frontend) — [Status: MVP]

## Purpose

Frontend console for managing metaverses: creation, configuration, links, publishing, integration with the app marketplace and MMOOMM template.

## Core features (MVP)

-   Metaverse creation wizard with an option to set default metaverse on first run
-   Uniks/Spaces tree, UPDL graph editor within Space
-   Import existing projects with conversion to the UPDL layer
-   Links configuration: child/partner metaverse; pluggable locations
-   Publish to PlayCanvas via the MMOOMM template
-   ECS overview (view entities in metaverse)

## Directory structure (expected)

```txt
packages/metaverse-frontend/base/
  src/
    app/
    components/
    pages/
    services/
    store/
```

## Integrations

-   `metaverse-backend` API
-   UPDL import/converter
-   `publish-frontend`, `template-engine-backend`
-   Supabase Auth

## UX metrics

-   Publishing time, wizard steps, links success rate
