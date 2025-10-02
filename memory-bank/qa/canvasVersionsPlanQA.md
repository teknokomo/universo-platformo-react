# QA Review: Canvas Version Editing Plan (2025-10-05)

## Scope
This review validates the proposed roadmap for enabling title and description editing inside the canvas versions dialog. The assessment cross-checks the current frontend/backend implementation, verifies the architectural fit for the MVP, and highlights potential risks or missing considerations.

## Findings
- **Frontend capabilities today**: The dialog lists versions with create/activate/delete flows but renders metadata as read-only table rows; no edit affordances exist yet, confirming the functional gap the plan targets.【F:apps/spaces-frt/base/src/views/canvas/CanvasVersionsDialog.jsx†L272-L409】
- **API surface**: The dedicated REST client already exposes list/create/activate/delete methods without an update call, so client changes are required to support metadata editing.【F:apps/spaces-frt/base/src/api/canvasVersions.ts†L1-L39】
- **Backend routing/service**: Spaces routes and service layers only handle GET/POST/POST-activate/DELETE for versions today; no update pathway exists, so adding a PUT endpoint is aligned with current structure.【F:apps/spaces-srv/base/src/routes/spacesRoutes.ts†L40-L106】【F:apps/spaces-srv/base/src/services/spacesService.ts†L508-L656】
- **Validation baseline**: Create requests trim inputs and enforce 200/2000 character caps, providing concrete constraints the update flow must mirror to avoid divergent rules.【F:apps/spaces-srv/base/src/controllers/spacesController.ts†L521-L577】

## Risks & Gaps
1. **Endpoint shape** – The router is mounted beneath `/api/v1/unik/:id`, so the new handler should follow the same prefix (`PUT /unik/:unikId/spaces/:spaceId/canvases/:canvasId/versions/:versionId`) rather than omitting the parent unik segment. The plan should explicitly call that out to prevent mismatched client calls.【F:apps/spaces-srv/base/src/routes/spacesRoutes.ts†L40-L65】
2. **Version-group guardrails** – `createCanvasVersion` and `activateCanvasVersion` both rely on `loadCanvasForSpace` to ensure versions stay within the same `versionGroupId`. The update service should reuse that guard so metadata cannot be edited across groups, otherwise orphaned records could be mutated.【F:apps/spaces-srv/base/src/services/spacesService.ts†L508-L656】
3. **State propagation after edit** – `CanvasHeader` currently reacts to `onActiveVersionChange` only by refreshing the dialog props, so a metadata edit for the active version will not update the header title unless the surrounding canvas state is refetched. The plan should mandate a refetch or store update hook upon successful edit to keep the header in sync.【F:apps/spaces-frt/base/src/views/canvas/CanvasHeader.jsx†L642-L653】
4. **`updatedDate` consistency** – Version edits should touch the record’s `updatedDate` so ordering rules that depend on timestamps remain deterministic. The existing service utility `toCanvasVersionResponse` already exposes this field, making freshness a visible attribute for users.【F:apps/spaces-srv/base/src/services/spacesService.ts†L22-L60】
5. **Optimistic UI states** – The dialog’s busy indicator aggregates create/activate/delete flags; introducing edit should fold into the same loading guard to avoid conflicting interactions during save. The plan should note this so the UX stays consistent.【F:apps/spaces-frt/base/src/views/canvas/CanvasVersionsDialog.jsx†L138-L210】

## Architecture Assessment
- **Dedicated endpoint vs. extending `updateCanvas`**: The existing `UpdateCanvasDto` omits version metadata fields and is geared toward Flowise canvas updates (flow data, deploy flags, etc.), so overloading it for version metadata would either require widening the DTO or risk collisions with Flowise legacy expectations.【F:apps/spaces-srv/base/src/types/index.ts†L24-L37】 A targeted `PUT versions/:versionId` keeps the MVP change isolated from Flowise canvases while preserving the versioned snapshot model already established by `createCanvasVersion`.
- **Data model alignment**: Versions remain first-class `Canvas` rows differentiated by `versionGroupId`, so editing label/description in place respects the snapshot architecture without introducing parallel metadata tables. This keeps the MVP lightweight and reversible because only textual fields change while the stored snapshot payload stays intact.【F:apps/spaces-srv/base/src/services/spacesService.ts†L531-L600】
- **Future flexibility**: Introducing a scoped service/controller pair for updates paves the way for additional metadata (tags, authorship, etc.) without touching legacy Flowise routes, which matches the project’s goal to avoid premature legacy entanglement.

## Recommendations
1. Amend the plan to specify the fully-qualified endpoint path and ensure both controller and client receive the unik-aware URL.
2. Implement the service update by loading both the target version and reference canvas through `loadCanvasForSpace`, rejecting cross-group edits, and updating `versionLabel`, `versionDescription`, and `updatedDate` in a single transaction.
3. Extend the dialog workflow so the active canvas state refreshes (e.g., via `onRefreshCanvases` or a dedicated Redux action) after a successful edit, guaranteeing the header reflects the latest metadata.
4. Reuse existing validation limits (200/2000) on both client and server, and surface localized snackbar feedback for success/failure to align with the current UX patterns.
5. Cover the new endpoint with controller/service tests that mirror the create/activate cases, including negative scenarios for invalid scope or overlong fields, to maintain baseline regression safety.
