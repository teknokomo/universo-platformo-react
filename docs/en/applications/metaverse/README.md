# Metaverse Applications

Metaverse is a core domain of Universo Platformo. It provides a way to organize projects and worlds into higher‑level "metaverses" with access control, links between metaverses, and publishing pipelines (e.g., PlayCanvas MMOOMM templates).

## Status: MVP

-   Backend and frontend MVP implemented
-   List and create operations are available with strict RLS and authenticated access

## Components

-   Backend: `@universo/metaverse-srv`
-   Frontend: `@universo/metaverse-frt`

## Features (MVP)

-   List metaverses visible to the user (via membership or public visibility)
-   Create a metaverse; creator becomes the owner
-   UI entry under the left menu → "Metaverses" and route `/metaverses`

## Security

-   Per‑request Supabase client with user JWT for RLS
-   PostgreSQL schema `metaverse` with strict RLS policies on all tables

## Roadmap

-   Membership management (roles), default metaverse toggle
-   Links between metaverses (child/partner/location)
-   Import and publish integration (MMOOMM PlayCanvas)
-   Overview pages and ECS/UPDL views

## See also

-   RU docs: `docs/ru/applications/metaverse/metaverse-frt.md`, `docs/ru/applications/metaverse/metaverse-srv.md`
