# MMOOMM Multi-Ship Authoritative Sync Research

**Date**: 2026-05-29  
**Scope**: Current API check for Colyseus and PlayCanvas Engine contracts used by the implementation plan.  
**Sources**: Context7 official documentation queries for `/colyseus/docs` and `/playcanvas/engine`; local codebase discovery in wrapper packages, applications backend realtime runtime, apps-template-mui PlayCanvas widget, and E2E tooling.

## Research Question

Which current Colyseus and PlayCanvas runtime APIs and local project contracts should shape the implementation plan for multi-ship authoritative synchronization in the MMOOMM flight runtime?

## Source Inventory

-   Context7 `/colyseus/docs`: room lifecycle, Schema state, `onAuth`, `onDrop`, `onReconnect`, `onLeave`, `allowReconnection`, fixed tick input queue examples, exception handling.
-   Context7 `/playcanvas/engine`: `Application(canvas)`, primitive render entities, camera/light setup, resize via `resizeCanvas`, update hook, app lifecycle and cleanup pattern.
-   `packages/universo-react-applications-backend/src/realtime/applicationsRealtimeRuntime.ts`: current single-ship `fixed_tick_scene` runtime.
-   `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx`: current published runtime PlayCanvas widget.
-   `packages/universo-react-colyseus-server/src/movement.ts`, `packages/universo-react-colyseus-client/src/interpolation.ts`, `packages/universo-react-playcanvas-engine/src/runtime.ts`: generic wrapper helpers.
-   `tools/testing/e2e/specs/flows/snapshot-import-mmoomm-flight-runtime.spec.ts`: current browser proof for the flight runtime.

## Key Findings

-   Colyseus supports the lifecycle needed for the feature: initialize state in `onCreate`, attach authenticated player state in `onJoin`, keep temporary disconnects via `onDrop` + `allowReconnection`, restore status in `onReconnect`, and remove state in permanent `onLeave`.
-   Colyseus Schema examples use `MapSchema<Player>` for multiple synchronized player records. The current project room instead exposes a singleton `state.ship`, so multi-ship sync requires a schema migration to keyed player/ship maps.
-   Colyseus fixed-tick examples enqueue client input and process it during the simulation tick. The current project mutates the singleton movement target immediately in the message handler; multi-ship prediction/reconciliation needs queued intents with sequence numbers.
-   PlayCanvas Engine runtime remains compatible with the existing wrapper approach: one `Application` per canvas, primitive `render` components for ships/stations, camera/light entities, container-driven resize, `app.on('update')` for per-frame transforms, and `app.destroy()` on unmount.
-   The current `PlayCanvasCanvasWidget` already has useful UX and QA foundations: bounded canvas, localized realtime status states, no protocol leakage tests, pointer release on Escape, canvas pixel evidence, and test-only dataset probes. It must be generalized from one controlled entity to local plus remote ship entities.
-   The local Supabase minimal E2E stack is sufficient for this feature because MMOOMM realtime uses app-owned Colyseus WebSockets rather than Supabase Realtime, Storage, Edge Functions, or logging services.

## Conflicts And Uncertainty

-   Context7 Colyseus examples show lifecycle APIs, but local wrappers use `@colyseus/core@0.17.43` and `@colyseus/sdk@0.17.42`; implementation must verify exact method signatures in local TypeScript after editing.
-   The current client reconnect UX retries join manually after `onLeave`. The feature brief requires Colyseus reconnection semantics; PLAN should make `onDrop` / `allowReconnection` / `onReconnect` the server-side source of truth while preserving user-friendly client states.
-   Current fixture snapshot names and module codenames are flight-simulator-specific. The plan should avoid renaming the entire fixture unless needed, but it may need new module code and contract checks for multi-ship behavior.

## Project Implications

-   The main implementation boundary is `@universo-react/applications-backend`, not a new MMOOMM package. Generic math/spawn/input helpers can live in `@universo-react/colyseus-server`; generic interpolation buffers can live in `@universo-react/colyseus-client`; rendering remains in `apps-template-mui`.
-   The server must use auth-derived user identity, not room/session IDs, for ownership. UI must never show room/session/player UUIDs to normal users.
-   Test coverage must include pure movement/spawn tests, realtime room tests, widget component tests, and Playwright multi-user browser evidence.

## Recommended Decision

Proceed with PLAN directly. Implement a multi-ship extension of the existing `fixed_tick_scene` room contract: `MapSchema` state keyed by stable ship IDs, per-client ownership based on authenticated user identity, queued movement intents with sequence acknowledgements, safe server-side spawn placement, and client rendering with local prediction plus remote interpolation.

## Open Questions

-   Whether the first Playwright proof should create two fully separate seeded users or one seeded user plus one generated role/user. Existing E2E helpers support generated users; use the least brittle option that proves separate authenticated accounts.
-   Exact reconnect window: use 30 seconds as the plan default unless implementation discovery suggests a different existing project convention.
