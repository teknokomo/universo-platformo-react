# Dashboard template

This directory contains the isolated MUI Dashboard runtime used by published Universo applications.

## Ownership

-   Entity/domain data owns durable business and editorial content.
-   Layout placements own widget identity, ordering, nesting and presentation configuration.
-   @universo-react/types owns the Dashboard widget registry and strict widget config schemas.
-   Host-owned widgets receive only typed, allowlisted runtime context through DashboardDetailsSlot.
-   Runtime widgets must not contain upstream MUI demo business data.

## Runtime

Dashboard.tsx renders the effective placement graph supplied by the application runtime. widgetRenderer.tsx maps registered widget keys to the existing Dashboard primitives and validates presentation configuration before rendering.

Entity-backed widgets consume typed runtime DTOs attached to placements. Host widgets such as the date picker and footer use local interaction state or allowlisted host metadata and do not invent persisted business data.

All user-facing strings are localized through the apps namespace. Responsive behavior and visible runtime changes are verified with the repository Dashboard Playwright acceptance suite.
