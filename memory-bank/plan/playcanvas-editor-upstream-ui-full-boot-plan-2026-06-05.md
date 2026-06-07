# Plan: PlayCanvas Editor Upstream UI Full Boot

> Created: 2026-06-05
> Status: QA-refined draft
> Source research: `memory-bank/research/playcanvas-editor-upstream-ui-full-boot-research-2026-06-05.md`
> Source brief: private PlayCanvas Editor minimal compatibility backend brief supplied by the user

## Overview

Make the vendored upstream PlayCanvas Editor `v2.23.4` boot inside Universo with the real upstream UI surfaces visible and usable: toolbar, hierarchy, viewport canvas, viewport controls, assets panel, inspector, and scene mutation persistence. The goal is not PlayCanvas Cloud parity. The goal is a single-user, metahub-scoped full-boot mode that uses the upstream PCUI/DOM editor UI already present in `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor`.

This plan must not create replacement MUI hierarchy/assets/inspector panels. MUI remains the host shell around the iframe; PlayCanvas Editor UI remains isolated inside the artifact iframe.

## Planning Inputs

- Research artifact: `memory-bank/research/playcanvas-editor-upstream-ui-full-boot-research-2026-06-05.md`.
- Prior backend plan: `memory-bank/plan/playcanvas-editor-minimal-compatibility-backend-plan-2026-06-05.md`.
- Current implemented state:
  - `@universo-react/playcanvas-editor-frontend` vendors upstream `v2.23.4`.
  - `@universo-react/playcanvas-editor-backend` exposes REST-minimal compatibility routes.
  - Current artifact/E2E still proves bridge-minimal fallback, including the minimal `Add entity` path.
  - Realtime, messenger, and relay are still effectively `/disabled` for the current hosted artifact mode.

## Affected Areas

- `packages/universo-react-playcanvas-editor-frontend`
  - artifact bootstrap and mode selection;
  - `scripts/lib/playcanvas-editor-artifact.mjs`;
  - artifact smoke and Playwright tests;
  - README and upstream boundary docs.
- `packages/universo-react-playcanvas-editor-backend`
  - config builder;
  - REST compatibility contracts;
  - new realtime runtime attachment;
  - new messenger/relay stable no-op runtimes;
  - package tests.
- `packages/universo-react-metahubs-backend`
  - PlayCanvas project routes composition;
  - metahub-scoped ports/adapters;
  - project storage access through `DbExecutor.query()`;
  - optional platform migration registration only if existing tables cannot safely persist realtime documents.
- `packages/universo-react-metahubs-frontend`
  - host page mode selection and localized diagnostics only;
  - TanStack Query invalidation after full-boot saves where host state must refresh.
- `packages/universo-react-types`
  - shared protocol/config/document/token schemas and inferred types.
- `packages/universo-react-utils`
  - shared safe helpers only if reused beyond PlayCanvas packages.
- `packages/universo-react-i18n`
  - host-shell text and localized errors; upstream PCUI strings remain upstream unless a deliberate minimal patch is required.
- `docs/en/platform`
  - GitBook docs for modes, setup, security, realtime limitations, and QA evidence.

## Architecture Decisions

- Keep PlayCanvas Editor authoring state at the metahub layer. It is Platformo authoring infrastructure, not published workspace end-user content.
- Keep `@universo-react/playcanvas-editor-backend` as the protocol/runtime boundary. It receives injected ports from `metahubs-backend`; it must not import private metahub domain internals.
- Keep `metahubs-backend` as the composition owner for authentication, `manageMetahub` access checks, metahub schema resolution, project storage, file storage, rate limits, CSRF for HTTP mutations, and route/runtime mounting.
- WebSocket realtime, messenger, and relay runtimes must be attached at the actual HTTP server upgrade/composition point. They cannot be treated as normal Express `Router` routes. The implementation must first identify the existing server upgrade owner and add an explicit adapter there.
- Use existing metahub PlayCanvas storage first. Add new document/op persistence tables only if tracing proves existing scene/settings storage cannot safely implement ShareDB-compatible subscribe/load/submit/reload behavior.
- If ShareDB-compatible semantics require durable document versions and op history, add metahub-scoped `_mhb_playcanvas_editor_documents` and `_mhb_playcanvas_editor_ops` branch tables instead of hiding persistence in memory. New tables must be registered through system table definitions, platform migrations, snapshot/export/restore, project copy/delete cleanup, and direct SQL tests.
- Do not bump metahub template versions or template schema versions. If new DB persistence is unavoidable, implement it through the existing platform migration path without changing metahub template semantics.
- Use real ShareDB-compatible semantics for the first full-boot implementation unless browser tracing proves a smaller adapter satisfies upstream `subscribe`, `submitOp`, `whenNothingPending`, reconnect, and reload paths.
- Do not run root `pnpm dev` for verification. Use package commands and Playwright CLI/E2E wrappers.

## UI Contract

- The normal user-facing host is still the existing localized MUI PlayCanvas Editor host page.
- The PlayCanvas Editor iframe must show upstream PCUI/DOM surfaces, not MUI replacements.
- Full-boot success requires the iframe to expose and render:
  - `#layout-root`;
  - `#layout-toolbar`;
  - `#layout-hierarchy`;
  - `#layout-viewport`;
  - `#canvas-3d`;
  - `#layout-assets`;
  - `#layout-attributes`;
  - visible hierarchy entity rows;
  - a right-side inspector populated after entity selection.
- Full-boot failure if any of these hold:
  - `window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__.hostedEntityAdapterInstalled === true`;
  - `window.config.url.realtime.http`, `window.config.url.messenger.ws`, or `window.config.url.relay.ws` contains `/disabled`;
  - `#layout-toolbar` is absent;
  - the local fallback entity panel is the only entity UI;
  - realtime authentication fails and the scene never loads.
- Host-shell text, errors, unsupported states, and mode labels must use shared i18n keys. Do not expose raw IDs, raw JSON, tokens, internal protocol names, or hidden backend assumptions to normal users.
- Mobile/tablet behavior must be proven with screenshots. If full Editor UI is not ergonomic on narrow mobile, show a localized host-level unsupported-state before mounting the iframe rather than a broken editor.

## UI Contract By Surface

- `PlayCanvasEditorHostPage` remains an existing metahub/template MUI shell. The iframe container owns the upstream full-boot surface; do not create custom MUI hierarchy, assets, inspector, viewport, toolbar, or dashboard replacement panels.
- Host loading, ready, unavailable, permission-denied, artifact-misconfigured, realtime-unavailable, messenger-unavailable, and unsupported-viewport states must use existing shared MUI primitives: page shell, alerts, buttons, dialogs, query/error-state patterns, and normal action spacing. Do not add nested cards or one-off chrome unless an existing primitive cannot express the state.
- Package/settings/open surfaces must display project names and user-facing status. Raw `projectId`, `sceneId`, tokens, WebSocket URLs, protocol descriptors, `/disabled` markers, raw JSON, Zod text, stack traces, and wire messages are not normal user UI.
- Backend and validation failures must map stable error codes to localized EN/RU copy. Host UI must never render `safeParse` output, Zod issue messages, stack details, or internal protocol keys.
- Any new semantic diagnostics or troubleshooting notes in host UI must be multiline or read-only display surfaces by default.

## Browser UX Oracles

- Add host-level Playwright helpers or assertions for:
  - no visible technical leakage in host UI;
  - localized EN/RU error and unavailable states;
  - keyboard path for opening settings, selecting/opening a project, launching full boot, and handling unsupported/error states;
  - no page-level horizontal overflow at `1920x1080`, `768x1024`, and `390x844`.
- On mobile, either prove the upstream editor is usable inside the iframe or prove a localized unsupported state appears before iframe mount.
- Iframe assertions must still check upstream DOM ids, fallback adapter state, and `/disabled` URL rejection. Screenshots alone are not enough without these semantic assertions.

## Plan Steps

### Phase 0: Baseline, Trace, And Acceptance Oracle

- [ ] Rebuild/check the current `v2.23.4` artifact in the existing package-local flow:
  - `pnpm --filter @universo-react/playcanvas-editor-frontend test`;
  - `pnpm --filter @universo-react/playcanvas-editor-frontend editor:build`;
  - `pnpm --filter @universo-react/playcanvas-editor-frontend editor:smoke`.
- [ ] Add a temporary full-boot tracing harness for the artifact:
  - capture iframe DOM ids;
  - capture console errors;
  - capture all REST URLs;
  - capture WebSocket URLs and first messages;
  - capture `window.config` shape with secrets redacted;
  - capture bridge flags including `hostedEntityAdapterInstalled`.
- [ ] Run Playwright CLI against the artifact/host without `pnpm dev`, using the repository E2E wrappers when the platform host is needed.
- [ ] Store screenshots and traces in test artifacts, not Memory Bank.
- [ ] Classify failures:
  - layout not created;
  - layout created but hidden/broken by CSS/sizing;
  - layout created but scene not populated;
  - scene document missing;
  - realtime auth missing;
  - messenger/relay reconnect noise;
  - asset/settings document failures.
- [ ] Split current browser smoke tests into two named modes:
  - bridge-minimal fallback smoke, where absence of full toolbar remains expected;
  - full-boot smoke, where absence of full toolbar fails.

### Phase 1: Shared Contracts And Mode Boundary

- [ ] Add shared contracts in `@universo-react/types`, likely `src/common/playcanvasEditorFullBoot.ts` or a compatible extension of the existing PlayCanvas compatibility contracts:
  - discriminated union modes for existing `universo-bridge-minimal`, existing `universo-compatibility-rest-minimal`, and new `universo-full-upstream-ui`;
  - full-boot config descriptor;
  - REST endpoint descriptor;
  - realtime endpoint descriptor;
  - messenger/relay endpoint descriptors;
  - token claims;
  - ShareDB collection names and document ids;
  - scene/settings/assets document summaries;
  - typed error codes.
- [ ] Add PlayCanvas-compatible numeric id mapping contracts:
  - stable numeric ids for `self.id`, `owner.id`, `project.id`, `scene.item_id` / `scene.uniqueId`, and asset ids where upstream expects numeric identifiers;
  - reverse mapping to UUID metahub/project/scene/asset storage ids;
  - tests proving the mapping is stable across reload and does not expose raw storage ids in normal UI.
- [ ] Use Zod `safeParse()` at all system boundaries and export both schemas and inferred types.
- [ ] Keep bridge-minimal schemas backward compatible only where needed by current tests; remove ambiguous names that make REST-minimal look like full boot.
- [ ] Add token claim binding:
  - `metahubId`;
  - `projectId`;
  - `sceneId` or default scene id;
  - `userId`;
  - `packageSlug: 'playcanvas-editor'`;
  - `mode: 'universo-full-upstream-ui'`;
  - browser-facing origin;
  - expiry;
  - nonce/session id where applicable.
- [ ] Ensure full-boot descriptor, config, token claims, REST URLs, WebSocket URLs, and iframe `window.config` all agree on mode, project, scene, user, and origin.
- [ ] Add focused Vitest/Jest tests for valid and invalid contracts.

Example contract style:

```ts
import { z } from 'zod'

export const playCanvasFullBootModeSchema = z.literal('universo-full-upstream-ui')

export const playCanvasRealtimeEndpointSchema = z
  .object({
    status: z.literal('enabled'),
    wsUrl: z.string().url(),
    collections: z.tuple([z.literal('scenes'), z.literal('assets'), z.literal('settings')]),
    auth: z.object({
      scheme: z.literal('signed-query-token'),
      expiresAt: z.string().datetime()
    })
  })
  .strict()

export type PlayCanvasRealtimeEndpoint = z.infer<typeof playCanvasRealtimeEndpointSchema>
```

### Phase 2: Full-Boot Config Builder

- [ ] Implement a full-boot config builder in `@universo-react/playcanvas-editor-backend`.
- [ ] Keep existing REST-minimal config as a separate mode; do not mutate it into full-boot behavior.
- [ ] Build upstream-shaped `window.config` values:
  - `project`, `scene`, `self`, `owner`, `branch`;
  - `permissions` with read/write true and admin false;
  - `url.api`, `url.frontend`, `url.engine`, `url.images`;
  - `url.realtime.http` pointing to same-origin compatibility realtime;
  - `url.messenger.ws` pointing to same-origin messenger;
  - `url.relay.ws` pointing to a stable no-op relay or explicit safe endpoint;
  - `schema.asset`, `schema.scene`, `schema.settings`;
  - no-op values for cloud-only surfaces;
  - disabled Sentry/metrics/store values.
- [ ] Validate against the vendored `EditorConfig` required fields discovered from `src/editor-api/external-types/config.d.ts` and tracing, including at least:
  - `project.settings.id`;
  - full default `ProjectSettings`;
  - `project.masterBranch`;
  - `project.hasPrivateSettings`;
  - `project.privateAssets`;
  - `self.plan` and `owner.plan`;
  - `owner.diskAllowance`;
  - `engineVersions`;
  - `store`;
  - `aws`;
  - `wasmModules`;
  - `oneTrustDomainKey`;
  - `url.home`, `url.static`, `url.store`, `url.howdoi`, and `url.images`.
- [ ] Fail closed if a required config path is missing.
- [ ] Redact secrets in logs and browser trace artifacts.
- [ ] Unit-test the builder against the upstream `EditorConfig` expectations discovered in tracing.

Example fail-closed config build:

```ts
export const createFullBootConfig = (input: FullBootConfigInput): PlayCanvasEditorConfig => {
  const parsed = fullBootConfigInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new PlayCanvasEditorConfigError('playcanvasEditor.fullBoot.invalidInput', parsed.error.flatten())
  }

  return playCanvasEditorConfigSchema.parse({
    project: buildProjectConfig(parsed.data),
    scene: buildSceneConfig(parsed.data),
    self: buildSelfConfig(parsed.data),
    owner: buildOwnerConfig(parsed.data),
    branch: buildBranchConfig(parsed.data),
    url: buildFullBootUrls(parsed.data),
    schema: buildUpstreamSchemaFixture(parsed.data),
    sentry: null,
    metrics: { enabled: false },
    accessToken: parsed.data.accessToken
  })
}
```

### Phase 3: Frontend Artifact Full-Boot Mode

- [ ] Add an explicit artifact mode, for example `universo-full-upstream-ui`, in `playcanvas-editor-artifact.mjs`.
- [ ] In full-boot mode:
  - load `./js/editor.js`;
  - inject full-boot `window.config`;
  - do not set `/disabled` realtime/messenger/relay URLs;
  - do not install the hosted entity fallback adapter unless a deliberate diagnostic flag is set;
  - keep the secured host bootstrap/session boundary;
  - keep iframe origin isolation.
- [ ] Make fallback mode explicit in code and docs:
  - `universo-hosted` or `universo-bridge-minimal` remains diagnostic/limited;
  - `universo-full-upstream-ui` is the required mode for screenshot-level acceptance.
- [ ] Add artifact-level tests:
  - full-boot config rejects `/disabled`;
  - full-boot does not install fallback entity adapter;
  - bridge-minimal still behaves as before where explicitly tested.

### Phase 4: Realtime Runtime With ShareDB-Compatible Semantics

- [ ] Identify and implement the HTTP server upgrade/WebSocket attachment point before adding realtime code. Do not mount realtime/messenger/relay as ordinary Express routes only.
- [ ] Add `attachPlayCanvasEditorRealtimeRuntime()` to `@universo-react/playcanvas-editor-backend`.
- [ ] Add a runtime port interface injected by `metahubs-backend`:
  - resolve project and scene access;
  - load scene document snapshot;
  - persist scene snapshot/op;
  - load asset/settings documents;
  - persist settings documents;
  - audit and conflict reporting.
- [ ] Use a WebSocket runtime compatible with upstream `RealtimeConnection`:
  - accept the upstream in-band realtime handshake: client opens `config.url.realtime.http`, sends a string starting with `auth` containing `{ accessToken }`, server validates token/origin/project/scene/user, then replies with a message starting with `auth` before ShareDB traffic is bound;
  - close fail-closed with explicit non-secret close codes/reasons for invalid token, origin, project, scene, user, or expired session;
  - support `scenes`, `assets`, and `settings`;
  - support `subscribe`, `submitOp`, `whenNothingPending`, reconnect, and close semantics.
- [ ] Define required ShareDB documents before implementation:
  - `scenes/<scene.uniqueId>` with at least `item_id`, `entities`, and `settings`;
  - `settings/<config.project.settings.id>`;
  - `settings/user_<config.self.id>`;
  - `settings/project_<config.project.id>_<config.self.id>`;
  - `settings/project-private_<config.project.id>` when `hasPrivateSettings` is enabled;
  - required `assets/<assetId>` documents discovered by tracing, even if the first slice uses empty/limited assets.
- [ ] Prefer established ShareDB packages over a custom OT implementation:
  - `sharedb`;
  - `@teamwork/websocket-json-stream` or the compatible stream adapter required by ShareDB;
  - a durable persistence adapter or a project-owned persistence bridge.
- [ ] Add any new dependency through the centralized workspace dependency policy in `pnpm-workspace.yaml`.
- [ ] Do not use ShareDB's default in-memory backend outside unit tests.
- [ ] Decide persistence after tracing:
  - prove a snapshot-backed adapter with Playwright reconnect/reload evidence; or
  - add durable metahub-scoped document/op tables when existing `_mhb_playcanvas_*` tables cannot safely handle `submitOp`, reconnect, reload, and conflict semantics.
- [ ] If new tables are required, add `systemTableDefinitions.ts` entries, package migration definitions through `@universo-react/schema-ddl`, platform migration registration, snapshot/export/restore integration, project copy/delete cleanup, and direct SQL tests.

Example runtime boundary:

```ts
export interface PlayCanvasRealtimeDocumentPort {
  readSceneDocument(input: {
    metahubId: string
    projectId: string
    sceneId: string
    userId: string
  }): Promise<PlayCanvasSceneDocument>

  commitSceneOp(input: {
    metahubId: string
    projectId: string
    sceneId: string
    userId: string
    op: unknown
    expectedVersion?: number
  }): Promise<PlayCanvasSceneDocumentCommit>
}
```

Example SQL store rule:

```ts
export const readSceneDocument = async (
  exec: DbExecutor,
  schemaName: string,
  sceneId: string
): Promise<StoredSceneDocument | null> => {
  const result = await exec.query<StoredSceneDocument>(
    `
      SELECT id, project_id AS "projectId", payload, checksum, version
      FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}
      WHERE id = $1
      LIMIT 1
    `,
    [sceneId]
  )

  return result.rows[0] ?? null
}
```

### Phase 5: Messenger And Relay Stable Runtime

- [ ] Add `attachPlayCanvasEditorMessengerRuntime()` and a minimal relay endpoint.
- [ ] Implement the upstream messenger wire sequence:
  - WebSocket opens;
  - client sends JSON `{ name: 'authenticate', token, type: 'designer' }`;
  - server validates the token and replies with JSON `welcome`;
  - client sends `project.watch`;
  - server acknowledges or sends typed no-op project/asset/job/sourcefile notifications as required by tracing;
  - support ping/pong or keepalive without reconnect noise.
- [ ] Implement the upstream relay wire contract, even as single-user no-op:
  - server sends `welcome` with `userId`;
  - reply to `pong`/keepalive paths as expected by upstream;
  - accept `room:join`, `room:leave`, and `room:msg`;
  - respond to `room:join` with a message that clears upstream pending room joins, including the room name and `[selfId]` user list where required by tracing.
- [ ] Ensure messenger/relay do not reconnect noisily in the browser.
- [ ] Add tests for:
  - invalid token;
  - wrong origin;
  - wrong project;
  - messenger `authenticate` -> `welcome` -> `project.watch`;
  - relay `welcome`, ping/pong, and room join;
  - close/reconnect behavior.

### Phase 6: REST Surface Completion For Boot-Required Calls

- [ ] Trace and implement only REST endpoints required for first full boot, not all PlayCanvas Cloud APIs.
- [ ] Keep existing endpoints where compatible:
  - config;
  - scenes;
  - assets list;
  - settings documents;
  - cloud-only no-op descriptors.
- [ ] Add missing boot-required endpoints discovered by tracing:
  - user/self info if needed;
  - project settings/private settings if not covered by realtime;
  - asset file URL placeholders;
  - script/job no-op responses if boot fails without them.
- [ ] Use existing route factory pattern:
  - no private metahub imports in `playcanvas-editor-backend`;
  - Zod validation;
  - `no-store`;
  - rate limits;
  - `manageMetahub` access;
  - CSRF for HTTP mutations;
  - signed compatibility token for artifact-origin requests.

### Phase 7: Metahub Backend Composition And Storage

- [ ] Extend `PlayCanvasProjectsService.describeEditorCompatibilityProtocol()` with a full-boot descriptor mode.
- [ ] Mount REST, realtime, messenger, and relay runtimes from `playCanvasProjectsRoutes.ts` or the current backend composition layer.
- [ ] Keep all database operations in stores using `DbExecutor.query()`.
- [ ] Use schema-qualified, parameterized SQL and safe identifier helpers.
- [ ] Mutation rules:
  - use `RETURNING` where row confirmation matters;
  - zero-row update/delete fails closed;
  - detect optimistic conflicts;
  - preserve replay/idempotency where browser retries can occur.
- [ ] Add snapshot/copy/delete lifecycle handling for any new document ids or op-log records.
- [ ] Preserve UUID v7 for new ids.

### Phase 8: Host Frontend Integration

- [ ] Extend `PlayCanvasEditorHostPage` to request/open full-boot mode when the backend reports availability.
- [ ] Gate full-boot launch on a descriptor that explicitly enables full-boot REST, realtime, messenger, and relay endpoints. Do not open full-boot from a descriptor that still reports disabled/rest-minimal-only surfaces.
- [ ] Keep existing MUI components and layout primitives.
- [ ] Add localized states:
  - full boot unavailable;
  - realtime unavailable;
  - messenger unavailable;
  - unsupported narrow viewport if needed;
  - artifact misconfigured;
  - permission denied.
- [ ] Use TanStack Query invalidation after successful full-boot mutations if host-level project/scene summaries must refresh.
- [ ] Do not expose raw ids, tokens, raw JSON, or internal protocol payloads in normal UI.

### Phase 9: Test Matrix

- [ ] Unit and contract tests:
  - Zod schemas and inferred types;
  - config builder;
  - token claims/expiry/origin mismatch;
  - document id mapping;
  - fallback/full-boot mode separation;
  - messenger no-op schemas.
- [ ] Backend runtime tests:
  - REST auth failures;
  - WS auth failures;
  - realtime `auth...` prefix handshake;
  - wrong metahub/project/user;
  - scene subscribe/load;
  - scene `submitOp` persistence;
  - `whenNothingPending` or equivalent save completion;
  - reconnect/reload;
  - settings ShareDB subscribe/submitOp/reload for project, user, project-user, and project-private documents;
  - assets empty shell;
  - cloud-only no-op surfaces.
- [ ] Store tests:
  - direct SQL-first document persistence;
  - optimistic conflict;
  - zero-row fail-closed;
  - copy/restore id remap if new storage is added;
  - delete cleanup.
- [ ] Frontend artifact tests:
  - bridge-minimal fallback remains a separate tested mode;
  - full-boot rejects `/disabled`;
  - full-boot rejects fallback adapter;
  - full-boot requires upstream DOM ids.
- [ ] Playwright E2E with local minimal Supabase where required:
  - start minimal local Supabase with `pnpm supabase:e2e:start:minimal`;
  - use repository Playwright CLI wrappers, not `pnpm dev`;
  - verify desktop/tablet/mobile screenshots;
  - assert visible upstream UI shell;
  - assert full-boot descriptor/config/token/REST/WS URLs agree on mode/project/scene;
  - select a default entity;
  - inspector populates;
  - add or mutate an entity through upstream UI;
  - persist through realtime;
  - reload/reopen;
  - verify mutation is still present;
  - assert no page-level horizontal overflow in the host;
  - assert no raw ids/tokens/JSON in host UI;
  - assert localized EN/RU host error states where failures are simulated;
  - assert keyboard path for settings/open/error/unsupported states;
  - assert console/network/WS traces do not contain full-boot blockers.

Example Playwright oracle:

```ts
const editorFrame = page.frameLocator('iframe[title="PlayCanvas Editor"]')

await expect(editorFrame.locator('#layout-root')).toBeVisible()
await expect(editorFrame.locator('#layout-toolbar')).toBeVisible()
await expect(editorFrame.locator('#layout-hierarchy')).toBeVisible()
await expect(editorFrame.locator('#layout-assets')).toBeVisible()
await expect(editorFrame.locator('#layout-attributes')).toBeVisible()
await expect(editorFrame.locator('#canvas-3d')).toBeVisible()

await expect
  .poll(() =>
    editorFrame.locator('body').evaluate(() => ({
      fallback: window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.hostedEntityAdapterInstalled === true,
      realtimeUrl: window.config?.url?.realtime?.http ?? '',
      messengerUrl: window.config?.url?.messenger?.ws ?? '',
      relayUrl: window.config?.url?.relay?.ws ?? ''
    }))
  )
  .toMatchObject({ fallback: false })

const urls = await editorFrame.locator('body').evaluate(() => [
  window.config?.url?.realtime?.http ?? '',
  window.config?.url?.messenger?.ws ?? '',
  window.config?.url?.relay?.ws ?? ''
])
expect(urls).not.toContainEqual(expect.stringContaining('/disabled'))
```

### Phase 10: Documentation And GitBook Updates

- [ ] Update `packages/universo-react-playcanvas-editor-frontend/README.md` and `README-RU.md`:
  - explain bridge-minimal vs full-boot mode;
  - list verification commands;
  - document fallback as diagnostic, not success.
- [ ] Update `packages/universo-react-playcanvas-editor-backend/README.md` and `README-RU.md`:
  - REST-minimal vs full-boot runtime;
  - realtime/messenger endpoints;
  - security and storage boundaries.
- [ ] Update GitBook docs in `docs/en/platform/`:
  - PlayCanvas Editor architecture;
  - setup and environment variables;
  - artifact origin/CSP model;
  - full-boot limitations;
  - testing and troubleshooting.
- [ ] Update Memory Bank progress/tasks after implementation.
- [ ] Keep all Memory Bank and docs content in English except package `README-RU.md`.

### Phase 11: Verification And Closeout

- [ ] Run formatting:
  - Prettier for changed files.
- [ ] Run focused package checks:
  - `pnpm --filter @universo-react/types test` or relevant type checks if configured;
  - `pnpm --filter @universo-react/playcanvas-editor-backend test`;
  - `pnpm --filter @universo-react/playcanvas-editor-frontend test`;
  - `pnpm --filter @universo-react/playcanvas-editor-frontend editor:build`;
  - `pnpm --filter @universo-react/playcanvas-editor-frontend editor:smoke`;
  - `pnpm --filter @universo-react/playcanvas-editor-frontend editor:browser-smoke`;
  - focused `metahubs-backend` tests.
- [ ] Run local minimal Supabase E2E only for the full browser flow:
  - `pnpm supabase:e2e:start:minimal`;
  - repository Playwright wrapper for the PlayCanvas Editor host flow;
  - stop local E2E services after the run.
- [ ] Run focused lint/build commands rather than global lint unless needed.
- [ ] Run autoreview before final closeout.
- [ ] Final acceptance requires attached screenshots/traces proving the upstream UI shown in the screenshot class is actually rendered.

## Potential Challenges

- Upstream may require more backend surfaces than expected before layout/scene load completes. Mitigation: trace first, implement only boot-critical endpoints, keep cloud-only no-op contracts explicit.
- ShareDB persistence can become complex if mapped directly onto existing scene payload storage. Mitigation: start with single-user semantics, keep op/snapshot design isolated behind ports, and add a durable document table only if tracing proves it necessary.
- WebSocket composition can fail if implemented as ordinary Express routes. Mitigation: identify the server upgrade owner first and test realtime/messenger/relay attachment through that owner.
- Upstream expects numeric PlayCanvas-compatible ids in multiple config and protocol paths while Universo storage uses UUIDs. Mitigation: add stable numeric id mapping and reverse mapping contracts with tests.
- Upstream messenger/realtime/relay have specific wire sequences. Mitigation: trace and test `auth...`, messenger `authenticate`/`welcome`/`project.watch`, and relay room join behavior instead of generic no-op sockets.
- `Add Entity` exists in both upstream and fallback. Mitigation: use full shell ids, bridge flags, URLs, screenshots, and realtime auth evidence instead of button text.
- Messenger/relay may reconnect or emit errors even in single-user mode. Mitigation: implement stable no-op WS services rather than disabled URLs.
- Iframe `allow-scripts allow-same-origin` remains security-sensitive. Mitigation: preserve separate artifact origin, token TTLs, origin binding, CSP/referrer rules, and fail-closed misconfiguration states.
- Mobile may not support the full upstream editor comfortably. Mitigation: prove tablet/mobile screenshots; if mobile is unusable, present a localized unsupported-state before mounting full editor.
- Existing tests currently validate fallback behavior. Mitigation: split test suites by mode and require full-boot tests to fail on fallback state.

## Dependencies

- Node 22 runtime compatible with upstream Editor `v2.23.4`.
- Centralized workspace dependency registration for any ShareDB/runtime additions.
- Existing PlayCanvas project storage and metahub access-control services.
- Existing package artifact origin configuration.
- Playwright CLI wrappers and local minimal Supabase E2E workflow.

## Acceptance Criteria

- Full-boot mode opens the vendored upstream Editor and displays toolbar, hierarchy, viewport canvas, assets panel, and inspector inside the iframe.
- A default scene loads from Universo-owned storage through realtime document flow.
- Selecting an entity populates the upstream inspector.
- Adding or mutating an entity through upstream UI persists and survives reload/reopen.
- Full-boot mode does not use `/disabled` realtime/messenger/relay URLs.
- Full-boot mode does not install the hosted fallback entity adapter.
- Bridge-minimal fallback remains explicitly available only as a separate limited/diagnostic mode.
- Tests cover contracts, backend runtime, persistence, security negatives, fallback/full-boot separation, and browser screenshots.
- GitBook docs and package READMEs clearly describe mode boundaries, setup, limitations, and troubleshooting.
