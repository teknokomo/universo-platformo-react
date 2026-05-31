# Plan: PlayCanvas Editor Package Foundation

> Created: 2026-05-31
> Mode: PLAN
> Status: Draft for discussion
> Brief: `.manager/specs/platformo/playcanvas-editor-package-foundation-spec-2026-05-31.md`
> Research: `memory-bank/research/playcanvas-editor-package-foundation-research-2026-05-31.md`
> QA update: 2026-05-31, strengthened dependency strategy, CI gates, CSP composition, static serving constraints, and browser oracles after plan QA.

## Overview

Create the first isolated Universo package for the official PlayCanvas Editor frontend: `packages/universo-react-playcanvas-editor/` with npm name `@universo-react/playcanvas-editor`.

This plan keeps the Editor as a standalone upstream application artifact, not a React/MUI component library. The first implementation must prove upstream tracking, package-local install/build/smoke, license hygiene, repository guard compatibility, and a minimal smoke serving/host contract. Metahub persistence, PlayCanvas backend emulation, `postMessage`, Colyseus authoring, module external-file integration, MCP, and AI scene editing remain later briefs.

## Inputs And Verification Used

- Brief: `.manager/specs/platformo/playcanvas-editor-package-foundation-spec-2026-05-31.md`.
- Research: `memory-bank/research/playcanvas-editor-package-foundation-research-2026-05-31.md`.
- Current upstream `playcanvas/editor` `package.json`, queried 2026-05-31:
  - package version `2.22.1`;
  - package name `@playcanvas/editor`;
  - `engines.node` is `>=22.22.0`;
  - build scripts are Vite-based: `build`, `develop`, `serve`, `watch`, `type:check`, `test`, `test:api`;
  - dependencies include PCUI, PCUI Graph, Observer, PlayCanvas `2.18.1`, TypeScript `5.9.3`, Vite `7.3.2`, ESLint `9.39.4`, and direct git dependency `ot-text github:playcanvas/ot-text`.
- Current upstream README, queried 2026-05-31:
  - still says Node 18+;
  - documents `npm install`, `npm run develop`, and `use_local_frontend` loading `http://localhost:3487` inside `https://playcanvas.com/editor/scene/<SCENE_ID>?use_local_frontend`.
- Current upstream LICENSE, queried 2026-05-31:
  - MIT license;
  - copyright notice `Copyright (c) 2011-2026 PlayCanvas Ltd.` must be preserved.
- Context7:
  - no Editor-specific Context7 library was available;
  - `/playcanvas/engine` and `/playcanvas/pcui-graph` confirm Engine/PCUI runtime boundaries but do not replace direct upstream Editor source verification.
- Subagent reviews:
  - package/build explorer found nested manifest, root Turbo build, global lint, CI, and pnpm policy risks;
  - Runtime UI UX reviewer required an explicit UI contract, i18n, Playwright UX oracles, screenshot matrix, and local Supabase prerequisites when a MUI smoke host is added.

## Affected Areas

- New package:
  - `packages/universo-react-playcanvas-editor/`
  - `packages/universo-react-playcanvas-editor/package.json`
  - `packages/universo-react-playcanvas-editor/README.md`
  - `packages/universo-react-playcanvas-editor/README-RU.md`
  - `packages/universo-react-playcanvas-editor/NOTICE.md`
  - package-local scripts/config/tests under `src/`, `scripts/`, `tests/`, or `e2e/`.
- Repository build and guardrails:
  - `package.json`
  - `pnpm-workspace.yaml`
  - `turbo.json`
  - `.nvmrc`
  - `.github/workflows/main.yml`
  - `tools/check-catalog-versions.mjs`
  - `tools/check-package-naming-convention.mjs`
  - `tools/check-no-package-base-paths.mjs`
  - `tools/check-apps-template-isolation.mjs`
  - possible new `tools/check-playcanvas-editor-isolation.mjs`.
- Optional smoke serving/host:
  - `packages/universo-react-core-backend/src/index.ts`
  - `packages/universo-react-core-backend/src/utils/XSS.ts` or nearby static-header utilities
  - a small MUI smoke route only if needed for browser evidence, using existing shell primitives.
- Tests:
  - package-local Vitest config and tests;
  - Jest tests only if backend static serving is added in this slice;
  - Playwright spec(s) through `tools/testing/e2e/run-playwright-suite.mjs`.
- Documentation:
  - `docs/en/platform/playcanvas-editor.md`
  - `docs/ru/platform/playcanvas-editor.md`
  - `docs/en/SUMMARY.md`
  - `docs/ru/SUMMARY.md`
  - package README files.
- Explicitly not affected in this foundation slice:
  - `packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json`
  - metahub template schema/version files
  - module external-file storage implementation
  - Colyseus runtime packages
  - PlayCanvas Engine wrapper behavior.

## Architecture Decisions

### 1. Package Boundary

Create an Universo-owned workspace package at:

```text
packages/universo-react-playcanvas-editor/
```

The root package manifest belongs to Universo:

```json
{
    "name": "@universo-react/playcanvas-editor",
    "private": true,
    "description": "Universo package boundary for the PlayCanvas Editor frontend artifact",
    "license": "Omsk Open License",
    "scripts": {
        "clean": "rimraf dist build .tmp",
        "editor:build": "node scripts/build-editor.mjs",
        "editor:serve": "node scripts/serve-editor.mjs",
        "editor:smoke": "node scripts/smoke-editor-artifact.mjs",
        "test": "vitest run --config vitest.config.ts"
    }
}
```

Do not add a normal `build` script on day one unless implementation proves all root build gates pass under Node, pnpm, Turbo, CI, and catalog policy. A normal `build` script makes root `pnpm build`, `build:e2e`, `start:clean`, `build:clean`, and CI pick up the package through `turbo run build`.

### 2. Upstream Tracking Strategy

Use a committed vendor snapshot or Git subtree for the first implementation, with an explicit upstream metadata file:

```text
packages/universo-react-playcanvas-editor/
  vendor/playcanvas-editor/
  vendor/UPSTREAM.md
  vendor/LICENSE.playcanvas-editor
  vendor/package.playcanvas-editor.json
```

Do not keep an unmodified upstream `package.json` named `package.json` below `packages/universo-react-playcanvas-editor/vendor/**` unless repository scanners are explicitly updated to ignore only that vendor path. `tools/check-catalog-versions.mjs` recursively scans every `package.json` under `packages/`, so a nested upstream manifest can fail catalog checks because upstream pins TypeScript, ESLint, React, and other prioritized dependencies.

Preferred first-slice rule:

- Store upstream manifest as `vendor/package.playcanvas-editor.json`.
- Store upstream commit/release and source URLs in `vendor/UPSTREAM.md`.
- Keep local patches in a dedicated `patches/` or `scripts/` layer, not scattered through upstream source.
- If upstream tooling requires the file to be named `package.json` during build, generate/copy it into `.tmp/upstream-package/package.json` during `editor:build` and keep `.tmp/` ignored.

Example upstream metadata:

```md
# Upstream PlayCanvas Editor

- Repository: https://github.com/playcanvas/editor
- Snapshot date: 2026-05-31
- Upstream package version: 2.22.1
- Upstream commit: <pinned commit>
- License: MIT, Copyright (c) 2011-2026 PlayCanvas Ltd.
- Local changes: none outside wrapper scripts unless listed below.
```

### 3. Build Enrollment Strategy

Keep the package isolated from root Turbo build until these gates pass:

- local shell uses Node `>=22.22.0`;
- `pnpm install` succeeds with upstream dependencies and pnpm supply-chain policy;
- `pnpm check:catalog-versions` stays meaningful and green;
- global `pnpm lint` does not lint raw vendored upstream source, or the vendored path is deliberately excluded;
- `pnpm --filter @universo-react/playcanvas-editor editor:build` writes only to `dist/**` or `build/**`;
- `pnpm --filter @universo-react/playcanvas-editor editor:smoke` passes;
- CI can reproduce the package-local checks.

Only after those gates pass, decide whether to add:

```json
{
    "scripts": {
        "build": "pnpm run editor:build"
    }
}
```

If added, update `turbo.json` only if the default `dist/**` and `build/**` outputs are insufficient. Prefer package tasks over root task logic.

### 4. Runtime Boundary

The package exposes a static artifact contract, not React component exports.

Allowed:

- `dist/editor/**` or `build/editor/**` artifact;
- package-local preview server;
- optional backend static mount under a reserved route;
- optional iframe host route that points at the artifact route.

Forbidden in this slice:

- direct imports of PlayCanvas Editor DOM, PCUI, Observer, or upstream app state into `@universo-react/template-mui`, `@universo-react/apps-template-mui`, core frontend, metahubs frontend, or applications frontend;
- adding `@universo-react/playcanvas-editor` to metahub package seed data;
- using the metahub Modules subsystem as the transport for the Editor application.

## Runtime UI Contract

If the implementation adds only package-local artifact smoke, no normal user UI is touched. The smoke must be documented as `artifact-only`.

If the implementation adds a MUI smoke host, it must use this contract.

### Surface: Artifact Route

- Path: reserve a developer/static namespace such as `/_artifacts/playcanvas-editor/`.
- Purpose: serve the built Editor artifact from the backend before the core frontend SPA fallback.
- Controls: none.
- Visible user text: none unless the route returns an unavailable page.
- Forbidden visible data: raw stack traces, raw JSON, raw UUID-only labels, raw upstream exception dumps.
- Security headers: explicit content type, `nosniff`, cache policy, and a deliberate CSP for static scripts/assets.
- Authentication: decide explicitly. If public, document why only static build assets are exposed. If authenticated, include local Supabase E2E setup.
- Navigation exposure: this route must not be linked from normal user navigation in this foundation slice. If exposed through any shell route, it must be developer/admin-only and covered by the Optional MUI Smoke Host contract.

### Surface: Artifact Unavailable Page

Applies only if backend/static serving returns HTML for missing or unavailable artifact states.

- Title and message must be localized in EN/RU.
- The page must explain that the Editor artifact is not built or unavailable.
- It may show a safe diagnostic code only.
- It must not show raw JSON, stack traces, absolute filesystem paths, raw UUID-only labels, hidden route parameters, or raw upstream/Vite/Zod/internal error text.
- Technical details, if any, must be collapsed by default and rendered as multiline/pre-wrapped long text.
- It must have no page-level horizontal overflow at `1920x1080`, `768x1024`, and `390x844`.

### Surface: Optional MUI Smoke Host

- Path: a developer-only route such as `/playcanvas-editor-smoke` or a metapanel/admin diagnostics route.
- Purpose: prove the shell can host the isolated Editor artifact in an iframe without importing Editor source.
- Components: existing `@universo-react/apps-template-mui` route/dashboard widgets and `@universo-react/template-mui` shell primitives; no one-off route shell, card system, toolbar, or visual layout unless no existing primitive fits and the reason is documented.
- Visible states:
  - loading artifact;
  - artifact loaded;
  - artifact missing/not built;
  - backend/static route unavailable;
  - unsupported persistence mode;
  - developer diagnostics collapsed by default.
- Controls:
  - open artifact in a new tab;
  - reload iframe;
  - back/navigation via existing shell;
  - optional copy diagnostics button only inside collapsed developer diagnostics.
- Iframe:
  - stable accessible title;
  - explicit sandbox/allow policy;
  - does not require users to know or paste a PlayCanvas `sceneId`.
- Forbidden:
  - raw `sceneId`, `projectId`, `ownerId`, UUID-only business labels;
  - raw JSON/object cells;
  - `[object Object]`;
  - internal/Zod/Vite/upstream exception text as primary user message;
  - single-line long text fields for diagnostics;
  - page-level horizontal overflow.
- Responsive proof:
  - `1920x1080`, `768x1024`, `390x844`;
  - iframe may scroll internally, but the document must not have page-level horizontal overflow.
- Keyboard path:
  - tab to open/reload/back controls;
  - focus indicator visible;
  - iframe has an accessible name/title.
- DataGrid/table/card surfaces: none in this foundation slice. If later added, they must not show raw IDs, object cells, or raw JSON.
- i18n:
  - all shell labels/errors in English and Russian;
  - common text should live in `packages/universo-react-i18n` if shared, otherwise in the owning frontend package namespace;
  - validation/unavailable states use localized keys;
  - technical details are collapsed developer diagnostics.

## Plan Steps

### Phase 1: Baseline And Decision Gates

- [ ] Confirm the implementation shell uses Node `>=22.22.0` before touching the package:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use --silent 22
node -v
```

- [ ] Decide whether to raise repository runtime guidance from `.nvmrc`/root `engines.node >=22.6.0` to a concrete Node `>=22.22.0`, or keep the Editor package excluded from root build until CI image and developer docs are updated.
- [ ] If root build enrollment is approved, pin CI and developer tooling to Node `22.22.x` or newer explicitly. A generic `22.x` matrix is acceptable only after CI proves it resolves to `>=22.22.0`.
- [ ] Pin the upstream Editor revision, not mutable `main`.
- [ ] Record source URL, commit, upstream package version, Node requirement, build scripts, and license in `vendor/UPSTREAM.md`.
- [ ] Document the README/package conflict: upstream README says Node 18+, but upstream `package.json` requires `>=22.22.0`; implementation treats `package.json` as authoritative.

### Phase 2: Package Skeleton

- [ ] Create `packages/universo-react-playcanvas-editor/`.
- [ ] Add Universo-owned `package.json`:
  - `name: "@universo-react/playcanvas-editor"`;
  - `private: true`;
  - no compatibility aliases;
  - no React/MUI component exports;
  - package-local scripts only: `editor:build`, `editor:serve`, `editor:smoke`, `test`, `clean`.
- [ ] Add README files:
  - purpose and non-goals;
  - package-local commands;
  - root build participation status;
  - upstream tracking/update procedure;
  - smoke operating mode and limitations.
- [ ] Add `NOTICE.md` or equivalent attribution that preserves the upstream MIT notice.
- [ ] Add `.gitignore` entries for package-local generated folders such as `.tmp/`, `dist/`, `build/`, `coverage/`.
- [ ] Add root ignore/cleanup coverage for generated temporary directories:
  - root `.gitignore` must ignore `**/.tmp/`;
  - root `clean:all` must delete `**/.tmp`;
  - package-local `clean` must delete `.tmp`, `dist`, `build`, and `coverage`.

### Phase 3: Vendor Snapshot And Guard Compatibility

- [ ] Add upstream source under the chosen isolated location.
- [ ] Avoid a nested file named `package.json` under `packages/**` unless guard exceptions are deliberately implemented.
- [ ] If an exception is necessary, update `tools/check-catalog-versions.mjs` with a narrow ignored path and a test/fixture proving only `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/**` is ignored.
- [ ] Run all repository guard dry-runs immediately after vendoring:
  - `pnpm check:no-package-base-paths`;
  - `pnpm check:package-naming`;
  - `pnpm check:catalog-versions`;
  - `pnpm check:apps-template-isolation`;
  - `pnpm lint`.
- [ ] If vendored upstream source breaks naming/no-base/catalog checks, add narrow ignored-path support only for `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/**`, with tests or fixtures proving active package code is still scanned.
- [ ] Prevent global lint from scanning raw vendored upstream source:
  - add `packages/universo-react-playcanvas-editor/vendor/**` and `packages/universo-react-playcanvas-editor/.tmp/**` to root ESLint ignore or root lint ignore-patterns;
  - keep package-local wrapper lint focused on local wrapper code;
  - run upstream lint only through an explicit package-local command that uses upstream config.
- [ ] Add an Editor isolation guard, modeled after `tools/check-apps-template-isolation.mjs`, that fails if forbidden packages import upstream Editor source directly.
- [ ] The isolation guard must scan every `packages/universo-react-*` package except `packages/universo-react-playcanvas-editor/**`.
- [ ] Backend/static serving code may reference only the documented artifact route/path contract, not `vendor/playcanvas-editor/**`, `@playcanvas/editor`, `@playcanvas/pcui`, or `@playcanvas/observer`.

Example guard shape:

```js
const ALLOWED_PACKAGE_PREFIXES = ['packages/universo-react-playcanvas-editor']
const SCANNED_PACKAGE_GLOB = 'packages/universo-react-*'

const FORBIDDEN_PATTERNS = [
    '@playcanvas/editor',
    '@universo-react/playcanvas-editor/vendor',
    '@playcanvas/pcui',
    '@playcanvas/observer',
    '../universo-react-playcanvas-editor/vendor',
    '../../universo-react-playcanvas-editor/vendor'
]
```

- [ ] Add isolation guard fixtures that must fail for:
  - direct `@playcanvas/editor` imports;
  - relative imports into `vendor/playcanvas-editor`;
  - PCUI/Observer imports outside the Editor vendor/build wrapper;
  - re-exported Editor internals from `@universo-react/playcanvas-editor`;
  - package exports that expose upstream DOM/PCUI/Observer internals.
- [ ] Ensure generated upstream manifests cannot be seen by recursive repository checks:
  - prefer a temporary build directory outside `packages/**`; or
  - delete `.tmp/upstream-package/package.json` before `editor:build` exits; and
  - update `tools/check-catalog-versions.mjs` to ignore `.tmp` with a fixture proving real package manifests are still scanned.

### Phase 4: Dependency And Supply-Chain Gate

- [ ] Choose a reproducible dependency strategy before implementing `editor:build`.
- [ ] Preferred strategy for this repository: declare the upstream build dependencies needed by the wrapper in `packages/universo-react-playcanvas-editor/package.json` so they are resolved by the root `pnpm-lock.yaml`, while keeping the upstream manifest as metadata under `vendor/package.playcanvas-editor.json`.
- [ ] Alternative strategy, only if wrapper dependencies cannot reproduce upstream build: isolated upstream install with a committed/pinned lockfile in the vendor snapshot. In that mode, ordinary `editor:build` must not run a network install; install/update must be a separate explicit maintenance command.
- [ ] Add a build guard proving `editor:build` does not perform an unpinned install and does not mutate lockfiles.
- [ ] Normalize dependencies through pnpm workspace policy where appropriate, but do not force upstream pins into shared catalogs unless the dependency becomes a shared repository dependency.
- [ ] Verify `minimumReleaseAge`, `trustPolicy`, and `blockExoticSubdeps` behavior with upstream dependencies.
- [ ] Treat `ot-text github:playcanvas/ot-text` as an explicit direct git dependency decision. If pnpm blocks it or it creates unacceptable lockfile risk, document whether to:
  - keep it as direct dependency in the wrapper package;
  - vendor/pin it with attribution;
  - patch upstream build to use a registry alternative if one exists;
  - defer root build enrollment.
- [ ] Verify `onlyBuiltDependencies` for packages that need lifecycle builds, especially `@swc/core`, `sass-embedded`, `esbuild`, and jsquash packages.
- [ ] Run `pnpm install --frozen-lockfile` after dependency changes and inspect lockfile churn.
- [ ] Add closeout evidence for supply-chain behavior:
  - Node version `>=22.22.0`;
  - frozen install success;
  - `ot-text` git dependency decision;
  - `onlyBuiltDependencies` requirements;
  - no unreviewed pnpm policy relaxation.

### Phase 5: Build Artifact Contract

- [ ] Implement `scripts/build-editor.mjs`.
- [ ] The script must:
  - fail fast when Node is below upstream requirement;
  - prepare an isolated temporary build directory if upstream expects its own manifest layout;
  - run upstream Vite build through pnpm-compatible commands;
  - copy or emit final artifact to `dist/editor/**` or `build/editor/**`;
  - preserve source maps only if they do not leak sensitive local paths in production serving;
  - write a small artifact manifest with upstream version, commit, build time, and output root.

Example artifact manifest:

```ts
export interface PlayCanvasEditorArtifactManifest {
    upstreamRepository: 'https://github.com/playcanvas/editor'
    upstreamCommit: string
    upstreamPackageVersion: string
    nodeRequirement: string
    outputRoot: 'dist/editor'
    smokeMode: 'artifact-only' | 'mui-iframe-host'
}
```

- [ ] Implement `scripts/smoke-editor-artifact.mjs`.
- [ ] Smoke checks:
  - artifact root exists;
  - entry HTML exists;
  - hashed JS/CSS assets exist;
  - upstream attribution file exists;
  - artifact manifest matches pinned upstream metadata;
  - no generated artifact imports local MUI packages.
- [ ] Add package-local browser smoke for artifact execution, not only file presence:
  - start the package preview/static server;
  - open the generated Editor HTML;
  - wait for a settled state;
  - assert no `pageerror`;
  - assert no unexpected console errors;
  - assert no failed JS/CSS/map/image requests;
  - assert expected Editor root DOM is present, or if the upstream shell cannot fully initialize without PlayCanvas backend context, assert the safe documented unavailable state;
  - if a canvas/WebGL surface appears, include a nonblank pixel check.

### Phase 6: Optional Static Serving

- [ ] Default first-slice recommendation: keep backend static serving out of scope until package artifact build is reproducible and either root build enrollment is approved or a separate startup/CI contract builds the artifact before serving.
- [ ] If backend static serving is still added in this first slice, it must be optional and fail safe:
  - core backend startup must not fail when the Editor artifact is missing;
  - missing artifact must return a localized/safe unavailable response;
  - `clean:all && pnpm build` must not leave a route pointing at a deleted artifact without a safe unavailable state;
  - CI must run `editor:build` before any serving/browser test that expects the artifact.
- [ ] If any backend route or MUI smoke host is added, define the access gate before implementation: development-only feature flag, authenticated admin/developer role, or documented public-static policy. Jest/Playwright must verify unauthorized behavior when the route is not public.
- [ ] If serving is approved, mount the artifact before the core frontend SPA fallback in `packages/universo-react-core-backend/src/index.ts`.
- [ ] Use a reserved path such as `/_artifacts/playcanvas-editor/`.
- [ ] Add explicit headers:
  - JavaScript/CSS/content type;
  - `X-Content-Type-Options: nosniff`;
  - cache policy;
  - CSP appropriate for the static Editor artifact.
- [ ] Do not overwrite the global `frame-ancestors` CSP set by core backend. Implement or reuse a CSP composer/helper that combines the existing `frame-ancestors` directive with Editor artifact directives.
- [ ] Keep this route separate from metahub package runtime module serving.
- [ ] Add Jest tests for route ordering, unavailable artifact behavior, and headers if backend code is touched.

Example header helper shape:

```ts
const playcanvasEditorStaticHeaders = (res: Response, filePath: string) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', filePath.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
    res.setHeader('Content-Security-Policy', composePlayCanvasEditorCsp(res.getHeader('Content-Security-Policy')))
}
```

### Phase 7: Optional MUI Smoke Host

- [ ] Add a minimal developer/admin smoke route only if artifact route evidence is insufficient.
- [ ] Reuse existing `@universo-react/apps-template-mui` route/dashboard widgets and `@universo-react/template-mui` shell primitives first. Do not create a new route shell, card system, toolbar, or visual layout unless no existing primitive fits and the reason is documented.
- [ ] Add a MUI primitive reuse oracle: component test, lint/AST guard, or Playwright assertion against existing shell landmarks/data attributes so a one-off visual shell fails.
- [ ] Add EN/RU i18n keys for every visible label and state.
- [ ] Keep technical diagnostics collapsed and localized.
- [ ] All semantic long text, diagnostics, copied technical reports, unavailable details, CSP diagnostics, and error details must render as multiline or pre-wrapped long-text regions by default, not as single-line inputs.
- [ ] Never require a user to know a PlayCanvas-hosted `sceneId` in normal UI.
- [ ] Do not claim metahub persistence, asset upload, collaboration, backend bridge, or self-hosted PlayCanvas backend support.

Example localized state model:

```ts
type EditorSmokeState =
    | { kind: 'loading' }
    | { kind: 'ready'; artifactUrl: string }
    | { kind: 'missingArtifact' }
    | { kind: 'unsupportedPersistenceMode' }
    | { kind: 'unavailable'; diagnosticCode: string }
```

### Phase 8: Vitest Coverage

- [ ] Add package-local `vitest.config.ts`.
- [ ] Add the package to `vitest.workspace.ts` only if the tests are stable and do not require upstream build artifacts.
- [ ] Test:
  - upstream metadata parser;
  - Node version gate;
  - artifact manifest validation;
  - forbidden output/import checks;
  - license/NOTICE presence;
  - smoke script failure modes;
  - path normalization and no cross-package relative imports.

Example Vitest assertion:

```ts
it('rejects artifacts that do not match the pinned upstream commit', () => {
    expect(() =>
        validateEditorArtifactManifest({
            upstreamRepository: 'https://github.com/playcanvas/editor',
            upstreamCommit: 'unexpected',
            upstreamPackageVersion: '2.22.1',
            nodeRequirement: '>=22.22.0',
            outputRoot: 'dist/editor',
            smokeMode: 'artifact-only'
        })
    ).toThrow(/upstream commit/i)
})
```

### Phase 9: Jest Coverage

- [ ] If no backend route is added, document that Jest is not applicable in the foundation slice and covered by future serving integration.
- [ ] If backend static serving is added, add Jest coverage in the owning backend package for:
  - static route registered before SPA fallback;
  - missing artifact returns localized/safe unavailable response, not stack trace;
  - exact headers on HTML/JS/CSS/source maps/images;
  - `Content-Type`, `X-Content-Type-Options`, `Cache-Control`, CSP, and `frame-ancestors` preservation;
  - no SPA fallback for missing artifact assets;
  - 404/unavailable response headers;
  - path traversal rejection;
  - disabled feature flag behavior if route is gated.

Example Jest target:

```ts
describe('PlayCanvas Editor static artifact route', () => {
    it('serves editor assets before the SPA fallback with defensive headers', async () => {
        const response = await request(app).get('/_artifacts/playcanvas-editor/index.html')
        expect(response.headers['x-content-type-options']).toBe('nosniff')
        expect(response.text).not.toContain('[object Object]')
    })
})
```

### Phase 10: Playwright And Screenshot Evidence

- [ ] Do not use `pnpm dev` for E2E evidence.
- [ ] Use the repository Playwright wrapper:

```bash
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "playcanvas editor smoke"
```

- [ ] If the test is artifact-only and does not start the Universo app, document why Supabase is not required and run package-local Playwright only against the preview server.
- [ ] If the smoke host is inside the Universo shell, local minimal Supabase is required.
- [ ] Test matrix:
  - desktop `1920x1080`;
  - tablet `768x1024`;
  - mobile `390x844`;
  - English and Russian smoke state if MUI text exists.
- [ ] Assertions:
  - artifact route loads and executes successfully, or reports a localized unavailable state;
  - no `pageerror`, unexpected console errors, or failed JS/CSS/map/image requests;
  - iframe has accessible title/name if used;
  - iframe uses the expected sandbox/allow policy if used;
  - frame load succeeds and the frame body is nonblank, or it shows the documented localized unavailable state;
  - shell and iframe-visible content contain no raw JSON, `[object Object]`, stack traces, raw UUID/ULID/CUID-only labels, `sceneId`, `projectId`, `ownerId`, `recordId`, raw `artifactUrl`, or internal field names;
  - `expectRuntimeUxViewportMatrix`-style helper verifies page-level horizontal overflow is zero across all three viewports while allowing only bounded iframe/internal scroll;
  - keyboard reaches primary controls by role/name;
  - EN/RU forced error scenarios for missing artifact, backend unavailable, and unsupported persistence mode reject raw English/internal phrases in localized surfaces;
  - screenshots are taken after the settled state.
- [ ] Prefer or add scoped UX helpers instead of broad body-only checks:
  - `expectNoTechnicalLeakage`;
  - `expectLocalizedValidation`;
  - `expectNoPageHorizontalOverflow`;
  - `expectRuntimeUxViewportMatrix`.
- [ ] Lifecycle CRUD proof is not applicable to this foundation slice because it has no create/edit/copy/delete surface. QA must mark CRUD as N/A rather than silently omitting it.
- [ ] Store screenshots/traces under standard Playwright output, with stable names such as:

```text
test-results/playcanvas-editor-smoke/desktop.png
test-results/playcanvas-editor-smoke/tablet.png
test-results/playcanvas-editor-smoke/mobile.png
```

Example Playwright oracle:

```ts
const iframe = page.locator('iframe[title="PlayCanvas Editor"]')
await expect(iframe).toBeVisible()
await expect(iframe).toHaveAttribute('sandbox', /allow-scripts/)

const frame = page.frameLocator('iframe[title="PlayCanvas Editor"]')
await expect(frame.locator('body')).not.toBeEmpty()
await expectNoTechnicalLeakage(page.locator('body'), { label: 'PlayCanvas Editor smoke shell', checkUuidSubstrings: true })
await expectNoTechnicalLeakage(frame.locator('body'))

await expectRuntimeUxViewportMatrix(page, 'PlayCanvas Editor smoke host', {
    viewports: [
        { name: 'desktop', width: 1920, height: 1080 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'mobile', width: 390, height: 844 }
    ],
    beforeEachViewport: async () => {
        await expectNoTechnicalLeakage(page.locator('body'), { label: 'PlayCanvas Editor smoke shell', checkUuidSubstrings: true })
    }
})
```

### Phase 10.5: CI And Agent Gates

- [ ] Update `.github/workflows/main.yml` to run:
  - `pnpm check:catalog-versions`;
  - `pnpm check:playcanvas-editor-isolation` once the guard exists;
  - package-local `test`, `editor:build`, and `editor:smoke` for every PR touching `packages/universo-react-playcanvas-editor/**`, `pnpm-lock.yaml`, root package policy, CI, static serving, or the Editor isolation guard.
- [ ] CI must run `pnpm --filter @universo-react/playcanvas-editor test`, `editor:build`, and `editor:smoke` unconditionally once the package is added, or via a path filter that triggers on the package, root pnpm/turbo config, CI workflow, and relevant guard scripts. Do not rely on root `pnpm build` until the package has an approved normal `build` script.
- [ ] Update `test:e2e:agent` or add a focused agent closeout script so agent verification includes catalog, editor isolation, package tests, package build, package smoke, and the browser smoke required by the chosen mode: package-local Playwright for artifact-only, repository Playwright wrapper for backend static serving or MUI smoke host.
- [ ] Add CI Node compatibility proof for `>=22.22.0` before root build enrollment.
- [ ] Keep backend static serving tests out of CI until serving is actually implemented; once implemented, include route/header/path-traversal Jest tests and browser smoke.

### Phase 11: Documentation

- [ ] Add package `README.md` and `README-RU.md`.
- [ ] Add GitBook docs:
  - `docs/en/platform/playcanvas-editor.md`;
  - `docs/ru/platform/playcanvas-editor.md`;
  - update `docs/en/SUMMARY.md`;
  - update `docs/ru/SUMMARY.md`.
- [ ] Document:
  - foundation package purpose;
  - upstream tracking;
  - Node requirement and README/package conflict;
  - package-local commands;
  - root build enrollment status;
  - smoke mode limitations;
  - future integration points: iframe host, metahub storage adapter, asset pipeline, Editor API bridge, module external files, Colyseus authoring, MCP/AI tools.
- [ ] Run docs checks:

```bash
pnpm docs:i18n:check
pnpm docs:gitbook-screenshot-assets:check
```

### Phase 12: Closeout Verification

- [ ] Package naming:

```bash
pnpm check:no-package-base-paths
pnpm check:package-naming
```

- [ ] Catalog and isolation:

```bash
pnpm check:catalog-versions
pnpm check:apps-template-isolation
```

- [ ] New editor isolation guard:

```bash
pnpm check:playcanvas-editor-isolation
```

- [ ] Package checks:

```bash
node -e "const [major,minor,patch]=process.versions.node.split('.').map(Number); if (major < 22 || (major === 22 && (minor < 22 || (minor === 22 && patch < 0)))) process.exit(1)"
pnpm install --frozen-lockfile
pnpm --filter @universo-react/playcanvas-editor test
pnpm --filter @universo-react/playcanvas-editor editor:build
pnpm --filter @universo-react/playcanvas-editor editor:smoke
pnpm lint
```

- [ ] Backend Jest checks, only if static route is added.
- [ ] Playwright evidence, using local minimal Supabase if the Universo shell is involved.
- [ ] Root build only after explicit enrollment decision:

```bash
pnpm build
```

## Potential Challenges

- Upstream Node requirement is stricter than the current repository engine floor. This must be resolved before root build enrollment.
- Upstream README and `package.json` disagree on Node support. Treat upstream `package.json` as authoritative.
- Nested upstream `package.json` files can break recursive repository checks.
- Global `pnpm lint` can accidentally lint raw vendored upstream source with the wrong project config.
- pnpm supply-chain policy can block or complicate upstream git/native dependencies.
- Static artifact smoke does not prove self-hosted Editor backend, project persistence, collaboration, asset upload, or metahub integration.
- Static serving before root build enrollment can point at a deleted artifact after `clean:all`; either defer serving or make it optional and fail safe.
- CSP for the artifact route must compose with the existing core backend `frame-ancestors` directive rather than replacing it.
- A MUI smoke host can become accidental product UI. Keep it developer/admin-only and localized, with explicit limitations.
- CSP may need iteration because upstream Editor can assume browser capabilities and asset paths not yet known in the Platformo route.

## Dependencies And Coordination

- No metahub schema/template version bump.
- No test DB preservation requirement; E2E may use a fresh local Supabase database.
- No legacy compatibility preservation requirement for this new package.
- Future briefs may integrate with:
  - `modules-external-files-spec-2026-05-27.md`;
  - PlayCanvas Editor metahub storage adapter;
  - iframe/postMessage bridge;
  - asset pipeline and runtime scene loading;
  - Colyseus authoring;
  - MCP/AI scene editing.

## Approval Checkpoint

Implementation should not start until the following decisions are approved:

- upstream tracking mechanism: vendor snapshot, subtree, or submodule;
- whether to raise Node requirement now or keep package excluded from root build;
- whether first slice includes backend static serving;
- whether first slice includes a MUI smoke host or remains artifact-only;
- whether `ot-text` stays a direct git dependency or is handled through a separate supply-chain decision.

## QA Verdict Requirements

Final QA for implementation must state explicitly:

- whether the package remains isolated from MUI shell imports and metahub package seed data;
- whether `editor:build` is reproducible and does not perform unpinned installs;
- whether static serving, if implemented, is safe when the artifact is missing after clean builds;
- whether a normal developer/admin user can load or understand the smoke surface without knowing raw IDs, reading JSON, or interpreting internal errors;
- whether browser evidence proves nonblank artifact or iframe content, not only file existence.
