# Research: PlayCanvas Editor Package Foundation

> Created: 2026-05-31
> Status: Draft
> Trigger: RESEARCH request for private Manager brief
> Follow-up plan: PLAN not created yet; the future PLAN must load this artifact explicitly.

## Research Question

How should Universo Platformo introduce a first `@universo-react/playcanvas-editor` package for the official PlayCanvas Editor frontend while preserving upstream updateability, pnpm/Turbo build stability, package-boundary rules, and future iframe-based integration with metahubs?

## Source Inventory

| Source                                                                                                                                        | Type                                | Date / Freshness                                                                                                    | Why It Matters                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://github.com/playcanvas/editor`                                                                                                        | Primary upstream repository         | Queried 2026-05-31; current `main` observed at `92ce00254db223e33ee72fda3ad01979bee714b7`, package version `2.22.1` | Source of truth for Editor frontend structure, scripts, license, dependencies, and Node requirements.                                                                |
| `https://raw.githubusercontent.com/playcanvas/editor/main/package.json`                                                                       | Primary upstream manifest           | Queried 2026-05-31; current `main` mutable                                                                          | Shows current license, scripts, engine constraint, Vite/TypeScript/PCUI dependencies, and git dependency risk. PLAN should prefer a commit permalink or release tag. |
| `https://raw.githubusercontent.com/playcanvas/editor/main/LICENSE`                                                                            | Primary upstream license            | Queried 2026-05-31; current `main` mutable                                                                          | Confirms MIT text and copyright notice that must be preserved when vendoring/bundling.                                                                               |
| `https://github.com/playcanvas/editor/blob/main/README.md`                                                                                    | Primary upstream README             | Queried 2026-05-31; current `main` mutable                                                                          | Documents local development through `npm install`, `npm run develop`, `use_local_frontend`, and port `3487`. PLAN should prefer a commit permalink or release tag.   |
| `https://developer.playcanvas.com/user-manual/getting-started/open-source/`                                                                   | Primary vendor documentation        | Queried 2026-05-31                                                                                                  | Confirms PlayCanvas open-source ecosystem and MIT status for the Editor repository.                                                                                  |
| `https://developer.playcanvas.com/user-manual/editor/editor-api/` and `https://api.playcanvas.com/editor/`                                    | Primary vendor documentation        | Queried 2026-05-31                                                                                                  | Confirms Editor API exists for later bridge/automation work; not in scope for the package foundation.                                                                |
| `https://github.com/playcanvas/editor-mcp-server`                                                                                             | Primary upstream adjacent tool      | Queried 2026-05-31                                                                                                  | Confirms MCP automation exists as a separate tool; it is a later integration concern, not part of package foundation or self-hosting.                                |
| Context7 `/playcanvas/engine`                                                                                                                 | MCP documentation source            | Queried 2026-05-31                                                                                                  | Confirms Context7 currently exposes Engine documentation, not Editor package docs; useful only as a runtime/editor boundary check.                                   |
| private Manager brief                                                                                                                         | Local brief                         | Current                                                                                                             | Defines intended scope: package foundation only, no storage bridge, no Colyseus authoring, no AI/MCP.                                                                |
| `.backup/Интеграция-PlayCanvas-Editor-в-платформу.md`                                                                                         | User-provided prior research        | Current local file                                                                                                  | Recommends official Editor frontend, minimal upstream changes, iframe/postMessage/API bridge later, and Editor-specific AI skills later.                             |
| `.backup/Интеграция-PlayCanvas-Editor-в-Universo-Platformo.md`                                                                                | User-provided prior research        | Current local file                                                                                                  | Recommends iframe isolation, metadata/ECS mapping later, Colyseus edit-time/runtime separation later, and MCP adaptation later.                                      |
| `.kiro/steering/structure.md`                                                                                                                 | Local architecture rule             | Current                                                                                                             | Defines pnpm workspace, flat `packages/universo-react-*` layout, and package naming convention.                                                                      |
| `package.json`, `pnpm-workspace.yaml`, `turbo.json`                                                                                           | Local build configuration           | Current                                                                                                             | Defines root `pnpm build`, Turbo task behavior, Node/pnpm engines, catalogs, and supply-chain policy.                                                                |
| `tools/check-package-naming-convention.mjs`, `tools/check-catalog-versions.mjs`, `tools/check-apps-template-isolation.mjs`                    | Local guardrails                    | Current                                                                                                             | Identify checks that can fail if upstream Editor files are copied naively.                                                                                           |
| `packages/universo-react-core-backend/src/index.ts`                                                                                           | Local backend serving path          | Current                                                                                                             | Shows where static assets and SPA fallback are mounted today.                                                                                                        |
| `packages/universo-react-core-frontend/src/routes/MainRoutes.tsx`, `packages/universo-react-apps-template-mui/src/routes/createAppRoutes.tsx` | Local frontend route patterns       | Current                                                                                                             | Shows fullscreen route and MUI shell boundaries relevant to a future iframe host.                                                                                    |
| `packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json`                                                       | Local metahub package registry seed | Current                                                                                                             | Shows current runtime package seed pattern and why Editor should not be registered in the foundation slice.                                                          |
| `.agents/skills/research-before-plan/SKILL.md` and references                                                                                 | Local workflow skill                | Current                                                                                                             | Defines source-backed research expectations, source freshness, and template structure.                                                                               |
| `.agents/skills/universo-platform-architecture/SKILL.md`                                                                                      | Local architecture skill            | Current                                                                                                             | Confirms package/metahub placement rules and the need to avoid configuration-specific shell coupling.                                                                |
| `.agents/skills/playcanvas-engine-runtime/SKILL.md`                                                                                           | Local runtime skill                 | Current                                                                                                             | Confirms the Engine wrapper/runtime boundary and explicitly does not cover PlayCanvas Editor.                                                                        |
| `.agents/skills/browser-3d-runtime-integration/SKILL.md`                                                                                      | Local runtime integration skill     | Current                                                                                                             | Confirms iframe/runtime isolation and browser surface constraints relevant to later hosting.                                                                         |
| `memory-bank/techContext.md`, `memory-bank/productContext.md`, `memory-bank/systemPatterns.md`                                                | Local Memory Bank context           | Current                                                                                                             | Provides canonical project stack and architectural context for follow-up PLAN.                                                                                       |

## Key Findings

-   The brief's package name is aligned with local conventions: directory `packages/universo-react-playcanvas-editor/` and npm package `@universo-react/playcanvas-editor` match the `packages/universo-react-<name>/` and `@universo-react/<name>` rule.
-   Any top-level package under `packages/*` automatically enters the pnpm workspace. If it has a `build` script, root `pnpm build` will include it through `turbo run build`; Turbo expects outputs under `dist/**` or `build/**`.
-   The repository currently requires Node `>=22.6.0`, `.nvmrc` is `22`, and package manager is `pnpm@10.33.2`. Upstream `playcanvas/editor` version `2.22.1` on current `main` declares Node `>=22.22.0`, so PLAN must verify the local developer/deploy Node version before making the package part of the root build.
-   The upstream Editor README still says Node 18+ and uses `npm install` / `npm run develop`; upstream `package.json` currently says Node `>=22.22.0`. Treat this as a source conflict to resolve during PLAN, with package.json taking precedence for implementation.
-   Upstream Editor local development builds with Vite and serves `dist` on port `3487`; `use_local_frontend` loads the local frontend from `http://localhost:3487` into `https://playcanvas.com/editor/scene/<SCENE_ID>?use_local_frontend`. This is a PlayCanvas-hosted Editor session with a local frontend override, not proof of a self-contained offline Editor.
-   Upstream Editor package metadata is MIT licensed and currently uses `build`, `develop`, `lint`, `lint:fix`, `serve`, `test`, `test:api`, `type:check`, and `watch` scripts. The package is a standalone web application, not a React component library intended to be imported into Platformo MUI views.
-   The upstream MIT license includes a PlayCanvas Ltd. copyright notice. Vendoring or bundling must preserve the upstream license/copyright notice, not only copy the `license` field from `package.json`.
-   Upstream Editor dev dependencies include `@playcanvas/pcui`, `@playcanvas/pcui-graph`, `@playcanvas/observer`, `playcanvas 2.18.1`, `typescript 5.9.3`, `vite 7.3.2`, `eslint 9.39.4`, and a git dependency `ot-text github:playcanvas/ot-text`. These can conflict with local catalogs, pnpm supply-chain policy, and root guardrails.
-   `tools/check-catalog-versions.mjs` recursively scans every `package.json` under `packages/`, not only workspace package manifests. Copying upstream Editor unchanged under `packages/universo-react-playcanvas-editor/` can fail the catalog guard because upstream pins prioritized dependencies such as `typescript`, `eslint`, and `vite` instead of using `catalog:`.
-   `pnpm-workspace.yaml` sets `minimumReleaseAge: 10080`, `blockExoticSubdeps: true`, and `trustPolicy: no-downgrade`; root `package.json` also restricts allowed dependency build scripts through `pnpm.onlyBuiltDependencies`. Upstream dependencies include build/native-tooling candidates that PLAN must test under pnpm before workspace/root install.
-   `blockExoticSubdeps: true` allows only direct dependencies to use git/tarball URLs. Upstream `ot-text github:playcanvas/ot-text` is a direct dependency in upstream metadata, but PLAN still must verify whether pnpm install remains acceptable and whether any transitive exotic dependencies require policy changes.
-   Inference: the safest local package shape is an Universo-owned wrapper manifest at `packages/universo-react-playcanvas-editor/package.json` and isolated upstream source below a clearly named directory. Do not let an unmodified upstream manifest drive workspace install without checking catalog, pnpm, Turbo, and supply-chain implications.
-   Current `@universo-react/playcanvas-engine` is a thin wrapper using `playcanvas: catalog:` and standard `dist` exports. It is a good naming/build precedent for wrappers, but not a full precedent for Editor because Editor is an application artifact with PCUI and its own build pipeline.
-   `@universo-react/apps-template-mui` already depends on runtime PlayCanvas/Colyseus wrappers for published application runtime. It should not import Editor source, PCUI, or Observer state. The Editor package should produce static artifacts that are served or framed.
-   The core frontend is a MUI/React shell assembled through `@universo-react/template-mui` layouts and lazy routes. Importing Editor UI directly into this shell would mix independent app shells and contradict the brief's isolation requirement.
-   The core backend currently mounts API routes, realtime middleware, then serves `@universo-react/core-frontend/build` at `/` and falls back to `index.html`. A later serving slice should mount Editor static assets under a reserved namespace before this SPA fallback.
-   Runtime module bundles already set explicit CSP/cache/content-type headers. Editor static artifact serving should likewise define its own headers instead of relying only on generic SPA static serving.
-   Existing `check:apps-template-isolation` and `apps-template-mui` package-boundary test are useful patterns for a future `playcanvas-editor` isolation guard that prevents imports from `@universo-react/template-mui`, core frontend, metahubs UI, and applications UI.
-   The metahub package registry currently seeds runtime import packages: Colyseus client/server and PlayCanvas Engine. `@universo-react/playcanvas-editor` should not be added to this seed list in the package foundation slice unless it is meant to be selectable as a metahub runtime/module import immediately.
-   The metahub Modules subsystem and future external module files are related later, but they are not a transport for the standalone Editor app. They may become script/source integration points after the Editor package and storage/API bridge exist.
-   Prior `.backup/` research aligns with this foundation split on the important boundaries: use the official Editor frontend, isolate it from MUI through iframe/static artifact serving, and defer metahub storage/API bridge, Colyseus authoring, and AI/MCP to later slices.
-   Upstream `playcanvas/editor-mcp-server` confirms MCP automation exists as a separate tool. It is not part of the Editor package foundation and does not solve self-hosting, backend/API emulation, or metahub project persistence.
-   Context7 currently resolves PlayCanvas to `/playcanvas/engine`, not an Editor-specific library. It confirms the Engine/runtime boundary, but PLAN still needs direct upstream Editor repository/docs research for Editor-specific decisions.

## Conflicts And Uncertainty

-   Upstream README says Node 18+ while upstream `package.json` requires Node `>=22.22.0`. Local root requires Node `>=22.6.0`. PLAN must decide whether to raise local Node requirements, pin an older upstream Editor revision, or keep Editor outside the root build until Node compatibility is proven.
-   Upstream uses npm-oriented documentation, while this repository requires pnpm. PLAN must test pnpm behavior rather than assuming npm commands translate directly.
-   Submodule, subtree, and vendor snapshot each have tradeoffs. Submodule keeps upstream clean but adds checkout/update friction; subtree keeps code in the repo but makes updates heavier; vendor snapshot is simplest operationally but easiest to drift from upstream.
-   Directly copying upstream under `packages/` may trip local scanners because they walk nested package manifests. If upstream source includes its own `package.json`, PLAN must either place it where scanners intentionally ignore it, normalize it, or update guards with a narrowly justified exception.
-   Smoke mode is not a product mode. Loading the Editor shell from a local artifact does not prove metahub project persistence, asset upload, collaboration, or backend API emulation. The upstream-supported `use_local_frontend` flow still depends on PlayCanvas-hosted editor context.
-   PlayCanvas Editor API and MCP integration are real future integration points, but this research did not validate exact Editor API or MCP calls because they are not required for the package foundation.

## Project Implications

-   The first implementation should create a private workspace package with an Universo-owned manifest and scripts, not simply paste the upstream repository as the package root.
-   PLAN should start with package-local commands such as `pnpm --filter @universo-react/playcanvas-editor build` and only join root `pnpm build` after proving Node, pnpm, dependency, and output compatibility.
-   PLAN must check pnpm install lifecycle/build-script policy before adding upstream dependencies to the workspace. Changes to `minimumReleaseAge`, `blockExoticSubdeps`, `trustPolicy`, or `onlyBuiltDependencies` should be treated as explicit supply-chain decisions.
-   If the package joins Turbo, configure outputs to `dist/**` or `build/**` and keep generated artifacts out of tracked source unless the repository already tracks equivalent build products for the package type.
-   The package should expose a static artifact contract such as `build/`, `dist/`, or `dist/editor/`; it should not export React components for use in Platformo MUI routes.
-   The future serving layer should likely be an authenticated or admin-only backend static mount under a reserved path such as `/_artifacts/playcanvas-editor/*` or `/playcanvas-editor/*`, registered before the core frontend SPA fallback.
-   A thin iframe host route can be added later in core frontend or a feature package, but it should only provide URL selection, loading/error state, sandbox/allow policy, and future postMessage wiring.
-   Do not add `@universo-react/playcanvas-editor` to `seed-packages.json` during the foundation slice. Add it later only if the Editor becomes an attachable metahub authoring package or importable module dependency.
-   Add a package-boundary guard for the Editor package once it exists. The guard should forbid imports from core frontend, MUI shell packages, and metahubs/applications UI packages unless a later plan explicitly changes the architecture.
-   Treat security headers as part of the serving contract. The Editor static route should define CSP/cache/content-type behavior consciously, especially if it loads scripts/assets or later uses iframe/postMessage.
-   Preserve upstream MIT license and copyright notices in the package README, LICENSE copy, NOTICE file, or equivalent attribution mechanism chosen by PLAN.

## Recommended Decision

Proceed to PLAN with a conservative package-foundation design:

1. Create `packages/universo-react-playcanvas-editor/` as a private, Universo-owned artifact package named `@universo-react/playcanvas-editor`.
2. Keep upstream `playcanvas/editor` source isolated below the package root or in a separately managed vendor/submodule location; do not let the upstream `package.json` become the workspace package manifest without normalization.
3. Prefer package-local build/dev/smoke commands first. Do not include the package in root `pnpm build` until the implementation proves compatibility with Node 22, pnpm 10, Turbo outputs, catalog checks, and supply-chain settings.
4. Define a static artifact output contract and smoke mode. The first smoke can be "local Editor frontend artifact loads" with clearly documented limitations; it does not need metahub persistence.
5. Leave metahub storage, backend/API bridge, iframe postMessage, Colyseus authoring, and AI/MCP integration for later briefs/plans.

## Open Questions Before PLAN

-   Which upstream tracking strategy is best for the first slice: submodule, subtree, or vendor snapshot?
-   Does the current upstream Editor revision build under this repo's Node/pnpm environment without raising root Node from `>=22.6.0` to `>=22.22.0`?
-   Where can upstream source be placed so local catalog/package-name checks remain meaningful without blocking the package?
-   Should root `pnpm build` exclude the package initially by omitting/renaming `build`, using package-local scripts, or explicitly documenting the temporary behavior?
-   Which reserved route namespace should serve the static artifact in a later slice, and should it require authentication from the start?
-   What minimal CSP/cache/header set should the Editor static route use?
-   How should upstream license/copyright attribution be represented in the package?

## Sources

-   `https://github.com/playcanvas/editor`
-   `https://raw.githubusercontent.com/playcanvas/editor/main/package.json`
-   `https://raw.githubusercontent.com/playcanvas/editor/main/LICENSE`
-   `https://github.com/playcanvas/editor/blob/main/README.md`
-   `https://developer.playcanvas.com/user-manual/getting-started/open-source/`
-   `https://developer.playcanvas.com/user-manual/editor/editor-api/`
-   `https://api.playcanvas.com/editor/`
-   `https://github.com/playcanvas/editor-mcp-server`
-   Context7 `/playcanvas/engine`
-   private Manager brief
-   `.backup/Интеграция-PlayCanvas-Editor-в-платформу.md`
-   `.backup/Интеграция-PlayCanvas-Editor-в-Universo-Platformo.md`
-   `.kiro/steering/structure.md`
-   `package.json`
-   `pnpm-workspace.yaml`
-   `turbo.json`
-   `tools/check-package-naming-convention.mjs`
-   `tools/check-catalog-versions.mjs`
-   `tools/check-apps-template-isolation.mjs`
-   `packages/universo-react-core-backend/src/index.ts`
-   `packages/universo-react-core-backend/src/utils/XSS.ts`
-   `packages/universo-react-applications-backend/src/controllers/runtimeModulesController.ts`
-   `packages/universo-react-core-frontend/src/routes/MainRoutes.tsx`
-   `packages/universo-react-apps-template-mui/src/routes/createAppRoutes.tsx`
-   `packages/universo-react-apps-template-mui/src/__tests__/packageBoundary.test.ts`
-   `packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json`
-   `.agents/skills/research-before-plan/SKILL.md`
-   `.agents/skills/universo-platform-architecture/SKILL.md`
-   `.agents/skills/playcanvas-engine-runtime/SKILL.md`
-   `.agents/skills/browser-3d-runtime-integration/SKILL.md`
-   `memory-bank/techContext.md`
-   `memory-bank/productContext.md`
-   `memory-bank/systemPatterns.md`
