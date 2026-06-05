# Plan: PlayCanvas Editor Minimal Compatibility Backend

> Created: 2026-06-05
> Mode: PLAN
> Status: Draft for discussion
> Brief: private manager brief for the PlayCanvas Editor minimal compatibility backend slice
> Research baseline: `memory-bank/research/playcanvas-editor-minimal-compatibility-backend-research-2026-06-05.md`

## Overview

Build the first sovereign, upstream-compatible backend slice that lets the vendored upstream `playcanvas/editor` frontend boot as a useful single-user Universo authoring editor for one metahub PlayCanvas project.

This plan does not target PlayCanvas Cloud parity. The acceptance target is narrower: update the vendored upstream Editor to at least `v2.23.4`, trace the real backend contract, create a metahub-scoped PlayCanvas-compatible backend facade only for the proven required surfaces, and prove one browser-visible edit/persist/reload loop through the real upstream Editor UI.

## Research Baseline And Decisions

- Treat `playcanvas/editor` as an upstream Editor frontend that expects backend-provided shell/config, REST, realtime ShareDB documents, and messenger behavior.
- Update the vendored Editor from the current `v2.22.1` baseline to upstream `v2.23.4` before final protocol tracing.
- Treat upstream `v2.23.4` `package.json` and `.nvmrc` as authoritative for the Editor artifact toolchain: Node `>=22.22.0`, upstream `.nvmrc` `22.22.3`.
- Keep the user-facing package slug and routes as `playcanvas-editor`; do not expose a second user-facing package for the backend.
- Keep storage ownership metahub-scoped. The backend package must receive explicit ports/adapters from `metahubs-backend`; it must not import private metahub domain internals.
- Create `@universo-react/playcanvas-editor-backend` only if traced requirements include at least schema-valid shell/config plus PlayCanvas-shaped REST plus realtime or messenger protocol logic. If Phase 0 proves that only small bridge-compatible additions are required, keep the work inside `metahubs-backend` and do not create a package prematurely.
- Default to real minimal ShareDB compatibility until browser evidence proves a custom single-user adapter can boot, mutate, reconnect, and reload without patching upstream.
- Do not ship ShareDB's default in-memory backend outside tests or demos.
- Keep Colyseus/MMOOMM runtime authoring out of this slice. ShareDB belongs to the authoring editor path; Colyseus remains runtime simulation infrastructure.

## Affected Areas

- `packages/universo-react-playcanvas-editor-frontend`
  - Vendored upstream Editor source and metadata.
  - Artifact build scripts, browser-smoke tests, vendor docs, NOTICE/license review.
- Potential new package: `packages/universo-react-playcanvas-editor-backend`
  - Protocol factories, config builder, REST facade, ShareDB/messenger runtime, tests.
- `packages/universo-react-metahubs-backend`
  - Route composition, adapter implementations, package host descriptor, auth/executor integration, WebSocket attach if needed.
- `packages/universo-react-core-backend`
  - Shared HTTP server upgrade routing if WebSocket realtime/messenger endpoints are implemented.
- `packages/universo-react-metahubs-frontend`
  - MUI package settings/host states only; no rewrite of PCUI or upstream Editor DOM.
- `packages/universo-react-types`
  - Shared compatibility contracts and DTOs.
- `packages/universo-react-utils`
  - Shared token/id/security helpers only if they are truly reusable.
- `pnpm-workspace.yaml`, `turbo.json`, package scripts
  - Dependency/catalog policy and filtered build/test tasks.
- `tools/testing/e2e`
  - Deep browser E2E for metahub package flow, iframe, WebSocket, persistence, reload, security negatives, screenshots.
- `docs/`
  - GitBook-format EN/RU documentation for architecture, setup, limitations, troubleshooting, and security.

## Architecture Contract

### Package Boundaries

- `@universo-react/playcanvas-editor-frontend` stays an artifact boundary for the upstream Editor frontend.
- `@universo-react/playcanvas-editor-backend`, if created, owns only PlayCanvas-compatible protocol logic:
  - validated `window.config`/shell descriptors;
  - PlayCanvas-shaped REST facade;
  - ShareDB realtime wiring;
  - messenger stub/runtime;
  - protocol tokens and DTO schemas.
- `metahubs-backend` remains the composition owner:
  - registers routes;
  - injects adapters;
  - owns metahub schema/table access;
  - performs metahub authorization checks.
- The backend package must not import private files from `packages/universo-react-metahubs-backend/src/domains/**` or frontend vendor paths.

### Route Namespaces

- Preserve existing Universo routes:
  - `/api/v1/metahub/:metahubId/playcanvas/projects`
  - `/api/v1/metahub/:metahubId/playcanvas/editor-bridge/commands`
- Add PlayCanvas-compatible surface only under an isolated namespace:
  - REST: `/api/v1/metahub/:metahubId/playcanvas/editor-compatible/...`
  - Realtime WS: `/api/v1/metahub/:metahubId/playcanvas/editor-compatible/realtime`
  - Messenger WS: `/api/v1/metahub/:metahubId/playcanvas/editor-compatible/messenger`

### Storage Ownership

- Metahub branch authoring records own PlayCanvas projects, scenes, assets, files, scripts, and compatibility documents.
- Package attachment config owns lightweight defaults such as selected/default PlayCanvas project and launch/display mode.
- Runtime publication manifests remain separate generated outputs.
- If ShareDB persistence needs new storage, add an explicit metahub-scoped document/op-log model; do not hide persistence in memory or package attachment config.
- Do not bump the metahub template/schema version unless implementation proves that existing metahub branch system table initialization cannot cover the new tables.

### Security And Executor Tiers

- Authenticated REST uses request-scoped `DbExecutor` and existing metahub access checks.
- Tokenized artifact/session/WebSocket flows use short-lived signed tokens and re-check metahub/project access fail-closed.
- Route/executor matrix:
  - normal authenticated metahub REST: request-scoped executor through the existing metahub handler factory;
  - iframe protocol REST: token-scoped validation, origin/package/project cross-checks, then the same metahub access adapter path with the executor tier chosen and documented before implementation;
  - WebSocket protocol persistence: token-scoped handshake validation plus an explicit metahub access adapter before any document stream is attached;
  - admin/bootstrap/public pool executor use is allowed only for existing infrastructure paths or a clearly justified non-RLS route.
- Use schema-qualified parameterized SQL through `DbExecutor.query()`.
- Dynamic identifiers must go through existing quoting helpers such as `qSchema`, `qTable`, `qSchemaTable`, and `qColumn`.
- UPDATE/DELETE operations that matter must use `RETURNING` and fail closed on zero rows.
- The protocol must not leak raw session tokens, artifact tokens, storage paths, or internal IDs into normal user-facing UI.
- Preserve CSRF protections for applicable REST mutation routes, in addition to origin, replay, and idempotency checks.

## UI Contract

- MUI owns only the metahub package settings and host shell. The upstream Editor UI remains isolated in the iframe artifact.
- Before adding any new UI component, inspect and reuse existing metahub package settings/dashboard/template primitives. A new component is allowed only with a named reason and no suitable existing primitive.
- Reuse existing `packages/universo-react-template-mui` primitives for dialogs, buttons, loading states, error states, and settings forms, especially `StandardDialog`, `SettingsDialog`, existing confirmation dialogs, and existing package settings patterns.
- Package settings must show user-facing project names and statuses, not UUID-only labels.
- Default PlayCanvas project selection must be visible and editable through a standard dialog/control when multiple projects exist.
- Buttons use existing i18n keys or new namespaced i18n keys with short action labels, for example `Save` / `Сохранить`, not long one-off labels or literal strings embedded in components.
- Long descriptions/errors use multiline or wrapped text and localized EN/RU strings.
- Semantic long-text inputs such as description, details, notes, error detail, or troubleshooting text use multiline controls by default.
- Hidden/system fields include metahub id, project id, artifact/session token, nonce, origin, branch-equivalent id, and internal compatibility adapter version.
- All ID-backed values shown to normal users must have display mapping:
  - PlayCanvas project selector shows project name and status;
  - metahub/branch/project/upstream synthetic ids stay hidden;
  - tokens, nonces, origins, and storage paths appear only in explicit developer diagnostics, never in normal UI.
- Validation errors must be localized through existing metahubs frontend locale files:
  - `packages/universo-react-metahubs-frontend/src/i18n/locales/en/metahubs.json`
  - `packages/universo-react-metahubs-frontend/src/i18n/locales/ru/metahubs.json`
- Backend/Zod/internal messages must not render directly in the MUI host. Backend responses expose stable error codes/statuses; the UI maps them to localized EN/RU text.
- Package settings screen contract:
  - uses the existing packages table/action pattern;
  - settings dialog has standard title, footer spacing, and no resize/fullscreen affordances unless it is a real long-form editor;
  - default project control shows empty, selected, unavailable, and deleted-project states with localized text.
- Default project dialog/control contract:
  - supports keyboard-only open, selection, save, cancel, and close;
  - lists user-facing project names/statuses;
  - does not require typing or understanding UUIDs.
- Editor host shell contract:
  - shows loading, ready, permission denied, backend unavailable, iframe blocked/CSP, WebSocket/reconnect, save failed/retry, and reload-persisted states;
  - does not add decorative chrome around upstream PCUI;
  - does not expose raw protocol diagnostics unless an explicit developer mode is enabled.
- Launch mode control contract:
  - uses an existing select/segmented/settings control pattern;
  - modes are localized and keyboard-selectable;
  - unsupported or blocked modes show localized helper/error text, not internal URLs or protocol names unless developer diagnostics are explicitly enabled.
- Compatibility backend status contract:
  - uses existing Alert, Chip, loading, or error-state primitives from the template/dashboard patterns;
  - shows user-facing states such as ready, unavailable, reconnecting, permission denied, or unsupported;
  - does not introduce a one-off status widget without a named reason;
  - never displays raw WebSocket URLs, tokens, document ids, or JSON diagnostics.
- Mobile/tablet contract:
  - no page-level horizontal overflow at `1920x1080`, `768x1024`, and `390x844`;
  - any table overflow is constrained to the table container;
  - host actions remain reachable by keyboard and touch;
  - if upstream PlayCanvas Editor/PCUI is proven desktop-only at `390x844`, the mobile route must show a localized supported/unsupported state with a safe open-on-desktop/open-separately path and no technical dead-end.
- Browser proof must include desktop, tablet, and mobile screenshots, keyboard-open path for settings and editor launch, iframe visible state, no page-level horizontal overflow, no raw JSON/object cells, and no technical leakage.

## Plan Steps

### Phase 0 - Upstream Update And Compatibility Tracing Gate

- [ ] Re-check the latest upstream `playcanvas/editor` release before implementation starts; use `v2.23.4` as the mandatory minimum target.
- [ ] Update `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor` to upstream `v2.23.4`.
- [ ] Update `vendor/package.playcanvas-editor.json`, `vendor/UPSTREAM.md`, `NOTICE.md`, README references, artifact manifest expectations, and constants in `scripts/lib/playcanvas-editor-artifact.mjs`.
- [ ] Record the upstream commit/tag in tests and artifact manifest metadata.
- [ ] Decide dependency policy for upstream `playcanvas@2.19.5` versus workspace catalog `playcanvas@2.18.1`:
  - prefer package-local pin/override for the Editor artifact if updating the workspace catalog would risk `@universo-react/playcanvas-engine`;
  - update the central catalog only if all PlayCanvas engine/runtime wrappers are verified compatible.
- [ ] Add or update metadata tests that fail if the vendor source, manifest, Node requirement, and artifact manifest drift.
- [ ] Add tracing hooks for:
  - `window.config` required paths;
  - REST requests;
  - WebSocket URLs/messages;
  - ShareDB collection/document ids;
  - messenger auth/watch messages;
  - console errors and reconnect loops;
  - bridge fallback behavior.
- [ ] Run the frontend artifact checks after upgrade:
  - `pnpm --filter @universo-react/playcanvas-editor-frontend test`
  - `pnpm --filter @universo-react/playcanvas-editor-frontend editor:build`
  - `pnpm --filter @universo-react/playcanvas-editor-frontend editor:smoke`
  - `pnpm --filter @universo-react/playcanvas-editor-frontend editor:browser-smoke`
- [ ] Produce a short trace note in the implementation PR or docs explaining which backend surfaces were actually called by `v2.23.4`.

### Phase 1 - Shared Contracts And Backend Package Boundary

- [ ] Add `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts`.
- [ ] Define shared schemas/types for:
  - compatibility mode/version;
  - protocol token claims;
  - Editor config DTO;
  - upstream id mappings;
  - REST facade request/response DTOs;
  - ShareDB document ids;
  - messenger no-op event contracts.
- [ ] Export these types from `packages/universo-react-types/src/index.ts`.
- [ ] Create `packages/universo-react-playcanvas-editor-backend` only if Phase 0 confirms that the real requirements include schema-valid shell/config plus PlayCanvas-shaped REST plus realtime or messenger protocol logic.
- [ ] Scaffold the package with package-local scripts and Turborepo-compatible outputs:
  - `build`;
  - `lint`;
  - `test`;
  - `clean`.
- [ ] Add package exports for factories and public types only:
  - `createPlayCanvasEditorCompatibilityRoutes`;
  - `attachPlayCanvasEditorRealtimeRuntime`;
  - `attachPlayCanvasEditorMessengerRuntime`;
  - `createPlayCanvasEditorConfig`;
  - port interfaces.
- [ ] Keep the backend package out of `seed-packages.json`; it is not a user-facing package attachment.

### Phase 2 - Config, Shell Descriptor, And REST Facade

- [ ] Implement a schema-validated `EditorConfig` builder with Zod validation at the boundary.
- [ ] Build config from metahub/project/package attachment state via injected ports.
- [ ] Define the exact shell/config delivery mechanism:
  - backend-rendered HTML shell with injected `var config = {...}`;
  - or an equivalent artifact shell descriptor consumed by the existing hosted artifact script;
  - document why the chosen mechanism satisfies upstream boot expectations.
- [ ] Generate explicit single-user identity and permission config:
  - synthetic `self`;
  - synthetic `owner`;
  - project permissions for `read`, `write`, and `admin`;
  - one active branch-equivalent context;
  - teams and organizations explicitly disabled or empty.
- [ ] Include explicit dummy/no-op values for cloud-only fields such as store, metrics, sentry, AWS, jobs, teams, and collaboration.
- [ ] Fail closed if required config paths are missing after the upstream update.
- [ ] Update the authoring host descriptor so the iframe receives either:
  - the existing bounded bridge descriptor; or
  - a compatibility backend descriptor with REST/WS endpoints and short-lived protocol token.
- [ ] Implement only REST endpoints proven by Phase 0 tracing.
- [ ] Return explicit typed no-op/stub responses for unavoidable cloud-only endpoints.
- [ ] For every traced cloud-only surface, either implement a typed no-op/stub or prove it is unused in the first slice:
  - store;
  - jobs;
  - branches/checkpoints;
  - sourcefiles;
  - publishing;
  - users/collaboration;
  - asset pipeline messages.
- [ ] Keep existing Universo project CRUD/storage APIs intact unless tracing proves they must be adapted.

### Phase 3 - Realtime Compatibility

- [ ] Implement a short-lived protocol token for iframe REST/WS calls.
- [ ] Authenticate WebSocket upgrade requests and validate metahub/project access before attaching protocol streams.
- [ ] If ShareDB is required, attach a ShareDB backend through a WebSocket stream compatible with ShareDB's expected server shape.
- [ ] Provide durable metahub-scoped persistence for required documents; do not use the default in-memory ShareDB backend outside tests/demos.
- [ ] Start with required collections:
  - `scenes`;
  - `assets`;
  - `settings`.
- [ ] Defer code editor/sourcefiles entirely. If Phase 0 tracing proves a `documents` collection is boot-critical, implement only the minimal typed stub or document surface needed to boot/save the first scene loop, with no Monaco/sourcefiles UX scope.
- [ ] Implement settings documents required by upstream boot:
  - `user_<selfId>`;
  - `project_<projectId>_<selfId>`;
  - `project-private_<projectId>`.
- [ ] Implement messenger as authenticated no-op/stub unless more is proven necessary:
  - `authenticate`;
  - `welcome`;
  - `projectWatch` / `project.watch`;
  - ping/pong;
  - safe asset/job notification no-ops.
- [ ] Treat asset pipeline and job notifications as typed no-op contracts unless tracing proves they affect the first authoring loop.
- [ ] Add WebSocket upgrade routing in `core-backend` without conflicting with existing Colyseus upgrade handling.

### Phase 4 - Metahub Backend Integration

- [ ] Implement metahub adapters inside `metahubs-backend`, not inside the new compatibility package.
- [ ] Mount compatibility REST routes in `packages/universo-react-metahubs-backend/src/domains/router.ts`.
- [ ] Keep PlayCanvas-specific logic from further expanding `packagesController.ts`; split helper services if needed.
- [ ] Reuse current PlayCanvas project service/store contracts where they are sufficient.
- [ ] Add new metahub-scoped compatibility document/op storage only if required by ShareDB persistence.
- [ ] If new persistent compatibility tables are required, define the DDL/migration boundary explicitly, register platform migrations where required, and keep metahub branch ownership through injected adapters. If existing `_mhb_playcanvas_*` tables are sufficient, document that decision and the mapping.
- [ ] Ensure project copy/delete/create flows also handle compatibility documents:
  - copied projects receive fresh UUID v7 ids and remapped upstream-compatible synthetic ids;
  - deletes remove or tombstone related compatibility docs safely;
  - new projects initialize required scene/assets/settings docs once, idempotently.

### Phase 5 - Frontend Host And Settings Integration

- [ ] Keep frontend changes conditional and scoped to what is required to launch the compatibility backend and satisfy the Runtime UI UX Quality Gate. Move unrelated host cleanup to a follow-up unless it blocks the authoring loop.
- [ ] Keep the existing package slug and route surface as `playcanvas-editor`.
- [ ] Update MUI settings to expose:
  - selected/default PlayCanvas project;
  - launch mode;
  - compatibility backend status when relevant;
  - clear localized error states.
- [ ] Use TanStack Query for package/project settings fetches and invalidation where the current package UI touches server state.
- [ ] Use standard MUI dialog components from `packages/universo-react-template-mui`.
- [ ] Reuse existing `metahub-packages-resources.spec.ts` page patterns/helpers and package settings UI patterns rather than creating a parallel one-off flow.
- [ ] If separate open mode is touched because it blocks the compatibility launch path, remove any intermediate dead-end screen; otherwise defer unrelated open-mode cleanup.
- [ ] If `Ctrl+S` handling is touched because it blocks the compatibility save path, ensure it is either captured for the editor save flow or intentionally scoped to the iframe with browser evidence; otherwise defer unrelated shortcut cleanup.
- [ ] Add EN/RU i18n keys for all new user-facing states.

### Phase 6 - Security Hardening

- [ ] Validate all REST params, query params, bodies, token claims, and WebSocket handshake payloads with Zod `safeParse`.
- [ ] Use short token TTLs and bind tokens to metahub id, project id, package attachment, origin, user id, and protocol mode.
- [ ] Enforce origin/CSP isolation for the artifact iframe.
- [ ] Preserve CSRF validation for applicable REST mutation routes and prove that iframe protocol routes do not bypass existing CSRF/origin controls.
- [ ] Add replay/idempotency protection for mutation commands and save flows.
- [ ] Add rate limits suitable for editor sessions and WebSocket mutation bursts.
- [ ] Add negative tests for:
  - missing token;
  - expired token;
  - wrong metahub;
  - wrong project;
  - wrong origin;
  - missing/invalid CSRF token where applicable;
  - insufficient role;
  - forged postMessage/WebSocket messages;
  - duplicate operation/request id.

### Phase 7 - Test System

- [ ] Add backend Jest unit/integration tests for route factories, adapter contracts, token verification, no-op REST responses, and fail-closed authorization.
- [ ] Add persistence tests for scene/assets/settings documents and copy/delete/new-project id remapping.
- [ ] Add ShareDB tests if ShareDB is implemented:
  - subscribe existing doc;
  - create missing doc;
  - submit op;
  - persist/reload;
  - reject unauthorized op;
  - reconnect without data loss.
- [ ] Add Vitest tests for shared frontend/types Zod schemas and config builder fixtures where those contracts live in Vitest-based packages; use Jest for backend packages that already use Jest.
- [ ] Add frontend component tests for package settings and host states.
- [ ] Add Playwright E2E with local minimal Supabase:
  - start local minimal Supabase with `pnpm supabase:e2e:start:minimal`;
  - use E2E wrappers, not `pnpm dev`;
  - target `http://127.0.0.1:3100`;
  - create a fresh metahub;
  - attach/open PlayCanvas Editor;
  - use existing `metahub-packages-resources.spec.ts` helpers/patterns where possible;
  - verify iframe/editor boot without console errors;
  - capture targeted QA screenshots as required PR evidence, not only optional failed-run artifacts;
  - cover viewport matrix `1920x1080`, `768x1024`, and `390x844`;
  - assert no technical leakage with existing runtime UX helpers such as `expectNoTechnicalLeakage` and `expectNoVisibleTextPatterns`;
  - assert localized validation/error states in EN and RU for changed MUI surfaces;
  - verify hierarchy/inspector/viewport are visible;
  - perform one visible entity/settings mutation through the upstream UI;
  - save or wait for `whenNothingPending`/equivalent persistence;
  - reload/reopen and verify the mutation remains;
  - test security negatives;
  - verify keyboard path and no horizontal overflow.
- [ ] Store Playwright screenshots/traces as CI artifacts for failed runs and include targeted QA evidence screenshots/traces in the implementation closeout.

### Phase 8 - Documentation And OpenAPI

- [ ] Update GitBook docs:
  - `docs/en/platform/playcanvas-editor.md`;
  - `docs/ru/platform/playcanvas-editor.md`;
  - `docs/en/platform/playcanvas-projects.md` if storage behavior changes;
  - `docs/ru/platform/playcanvas-projects.md` if storage behavior changes.
- [ ] Document:
  - frontend/backend package split;
  - current first-slice limitations;
  - supported authoring loop;
  - security model;
  - local Supabase E2E workflow;
  - troubleshooting for iframe/CSP/WebSocket/config failures.
- [ ] Update package READMEs for frontend and backend packages.
- [ ] Update `vendor/UPSTREAM.md` with the new upstream tag, local patch/artifact policy, and compatibility mode summary.
- [ ] Update OpenAPI/rest-doc generation for new REST routes, if routes are part of the implementation.
- [ ] Document WebSocket protocols manually because they are not naturally covered by REST OpenAPI generation.

### Phase 9 - Verification And Closeout

- [ ] Run Prettier on touched files.
- [ ] Run focused lint/build/test commands for touched packages.
- [ ] Run frontend artifact build/smoke/browser-smoke.
- [ ] Run backend package tests and metahubs-backend affected tests.
- [ ] Run E2E with local minimal Supabase for the complete user path.
- [ ] Run isolation guard checks that prevent backend imports from frontend vendor internals.
- [ ] Review changed docs for accidental private manager workspace references outside private manager-only files.
- [ ] Record final verification commands and known limitations in the PR.

## Code Examples

### Port Boundary Without Private Imports

```ts
export interface PlayCanvasEditorProjectPort {
  resolveProject(input: {
    metahubId: string
    projectId: string
    userId: string
  }): Promise<PlayCanvasEditorResolvedProject>

  saveSceneDocument(input: {
    metahubId: string
    projectId: string
    sceneId: string
    document: unknown
    expectedRevision?: string
  }): Promise<PlayCanvasEditorSavedDocument>
}
```

### Zod Boundary Validation

```ts
const ProtocolTokenClaimsSchema = z
  .object({
    metahubId: uuidV7Schema,
    projectId: uuidV7Schema,
    userId: z.string().min(1),
    origin: z.string().url(),
    mode: z.literal('playcanvas-editor-compatible'),
    exp: z.number().int().positive()
  })
  .strict()

export const parseProtocolTokenClaims = (value: unknown) => {
  const parsed = ProtocolTokenClaimsSchema.safeParse(value)
  if (!parsed.success) {
    throw createHttpError(401, 'playcanvasEditor.protocolToken.invalid')
  }
  return parsed.data
}
```

### Express Route Factory With Injected Ports

```ts
export const createPlayCanvasEditorCompatibilityRoutes = (deps: {
  projectPort: PlayCanvasEditorProjectPort
  tokenService: PlayCanvasEditorTokenService
}) => {
  const router = Router()

  router.get('/projects/:projectId/scenes', async (req, res, next) => {
    try {
      const claims = deps.tokenService.verifyRequest(req)
      const params = ProjectScenesParamsSchema.safeParse(req.params)
      if (!params.success) {
        throw createHttpError(400, 'playcanvasEditor.request.invalidParams')
      }
      if (params.data.projectId !== claims.projectId) {
        throw createHttpError(403, 'playcanvasEditor.request.projectMismatch')
      }
      const scenes = await deps.projectPort.listScenes({
        metahubId: claims.metahubId,
        projectId: params.data.projectId,
        userId: claims.userId
      })
      res.json({ result: scenes })
    } catch (error) {
      next(error)
    }
  })

  return router
}
```

### ShareDB Attach Shape

```ts
export const attachRealtime = (deps: PlayCanvasEditorRealtimeDeps) => {
  deps.webSocketServer.on('connection', async (socket, request) => {
    const claims = await deps.auth.verifyWebSocketRequest(request)
    await deps.access.ensureCanEditProject(claims)

    const stream = new WebSocketJSONStream(socket)
    deps.shareDbBackend.listen(stream, request)
  })
}
```

### SQL Store Pattern

```ts
export const updateCompatibilityDocument = async (
  executor: DbExecutor,
  input: UpdateCompatibilityDocumentInput
) => {
  const table = qSchemaTable(input.schemaName, '_mhb_playcanvas_editor_documents')
  const result = await executor.query(
    `
      UPDATE ${table}
      SET document_payload = $4,
          revision = $5,
          updated_at = NOW()
      WHERE metahub_id = $1
        AND project_id = $2
        AND document_id = $3
      RETURNING document_id, revision, updated_at
    `,
    [input.metahubId, input.projectId, input.documentId, input.payload, input.revision]
  )

  if (result.rows.length !== 1) {
    throw createHttpError(409, 'playcanvasEditor.document.updateConflict')
  }

  return result.rows[0]
}
```

## Potential Challenges

- Upstream `v2.23.4` may require additional config keys or runtime paths that current bridge mode never exercised.
- Upstream package dependency `playcanvas@2.19.5` may conflict with workspace catalog `playcanvas@2.18.1` and the existing PlayCanvas engine wrapper.
- ShareDB persistence may require a dedicated document/op-log store rather than mapping directly to existing scene JSON tables.
- WebSocket upgrade handling must coexist with Colyseus on the shared HTTP server.
- Numeric/string upstream ids must map to UUID v7 Platformo ids without collisions and without exposing raw IDs to users.
- Messenger may create reconnect noise unless its no-op behavior precisely satisfies boot listeners.
- Browser E2E may need robust iframe and WebSocket tracing to avoid false confidence from smoke-only checks.

## Dependencies And Open Questions

- Confirm exact `v2.23.4` REST/WS contract through tracing before implementing broad endpoint lists.
- Decide whether backend compatibility is represented in package attachment config, authoring host descriptor, or both.
- Decide whether new compatibility storage tables can be initialized within existing metahub branch system table creation without a schema/template version bump.
- Defer code editor/sourcefiles entirely; if a `documents` collection is boot-critical, limit it to the minimal typed stub/document surface needed for the first scene loop.
- Decide whether a tiny upstream patch is unavoidable. Default answer is no: prefer unmodified upstream plus backend facade.

## Acceptance Criteria

- Vendored upstream Editor is updated to at least `v2.23.4` and metadata/tests prove it.
- The backend contract is based on traced runtime evidence, not static source search alone.
- The real upstream Editor iframe boots for an authenticated metahub project without console/reconnect noise.
- The generated config contains a synthetic single-user `self`/`owner`, `read/write/admin` project permissions, one branch-equivalent context, and no enabled teams/organizations.
- Cloud-only surfaces are documented and either typed no-op/stubbed or proven unused: store, jobs, branches/checkpoints, sourcefiles, publishing, users/collaboration, and asset pipeline messages.
- A user can perform one visible scene/entity/settings mutation in the Editor UI.
- The mutation persists through the compatibility backend and survives reload/reopen.
- Security negative tests reject wrong token, wrong origin, wrong role, wrong metahub/project, missing/invalid CSRF where applicable, replay, and forged messages.
- Copy/delete/new-project flows do not duplicate identifiers or leave unsafe stale compatibility documents.
- MUI settings/host UI uses shared primitives, localized EN/RU labels, per-surface UI contracts, no raw IDs/JSON, no technical leakage, keyboard paths, and no page-level horizontal overflow.
- Unit, integration, and Playwright E2E tests cover the new surface with browser screenshots/traces.
- GitBook docs and package READMEs describe the architecture, supported scope, limitations, and testing workflow.

## Verification Commands

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22.22.3
nvm use --silent 22.22.3
node -v
node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 22 || (major === 22 && minor < 22)) process.exit(1)"
```

```bash
pnpm --filter @universo-react/playcanvas-editor-frontend test
pnpm --filter @universo-react/playcanvas-editor-frontend editor:build
pnpm --filter @universo-react/playcanvas-editor-frontend editor:smoke
pnpm --filter @universo-react/playcanvas-editor-frontend editor:browser-smoke
```

```bash
# Run these two commands only if Phase 0/1 creates @universo-react/playcanvas-editor-backend.
pnpm --filter @universo-react/playcanvas-editor-backend build
pnpm --filter @universo-react/playcanvas-editor-backend test
# If the backend package is not created, run the equivalent compatibility tests in @universo-react/metahubs-backend.
pnpm --filter @universo-react/metahubs-backend test
pnpm --filter @universo-react/metahubs-frontend test
```

```bash
pnpm supabase:e2e:start:minimal
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
pnpm supabase:e2e:stop
```

## Discussion Gate

Implementation should not start until this plan is approved or adjusted. The most important decision before coding is whether Phase 0 tracing proves that a full protocol package is required immediately, or whether the first implementation can keep the existing bridge as fallback while adding only the minimum compatibility backend surfaces discovered by tracing.
