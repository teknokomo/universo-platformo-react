---
name: playcanvas-editor-authoring
description: Use when planning, implementing, or reviewing work that touches PlayCanvas Editor authoring, the Editor/Engine boundary, vendored upstream artifacts, Editor boot contract, or Editor package routing. Applies to @universo-react/playcanvas-editor-frontend vendoring playcanvas/editor v2.24.2 with playcanvas@2.19.5; does NOT cover playcanvas-engine-runtime (playcanvas@2.18.1) or PlayCanvas Cloud parity.
metadata:
    version: '1.0.0'
    scope: 'playcanvas-editor-authoring'
    file_policy: 'markdown-only'
---

# PlayCanvas Editor Authoring

Use this skill when dealing with the PlayCanvas Editor integration, package boundaries, upstream vendoring, and editor execution routing.

## Version Guard

- Upstream Editor: `v2.24.2` (vendored at `packages/universo-react-playcanvas-editor-frontend/vendor/`)
- Editor Engine: `playcanvas@2.19.5` (dependency of upstream editor)
- Runtime Engine: `playcanvas@2.18.1` (separate, via `@universo-react/playcanvas-engine`)
- Node requirement: `>=22.22.0` (as defined in `package.playcanvas-editor.json`)
- Do NOT mix Editor and Engine Skills. They are separate version-guarded stacks.

## Required Output

Before modifying any editor authoring or package layout, state:
- which package boundaries are affected (frontend, backend, or types);
- the boot lifecycle phase affected (iframe mounting, config injection, websocket handshake);
- how upstream dependencies (e.g. `sharedb`, `ot-text`, `pcui`) are impacted;
- the testing plan to prevent regression in the E2E boot sequence.

## Workflow

1. Keep the editor frontend completely isolated as an upstream vendored artifact.
2. Inject configuration at boot via `window.config` in the iframe shell.
3. Keep database/backend routing separated from the frontend. The backend only handles protocol translation via injected ports.
4. Run ESLint/Prettier on all package-local files before validation. ESLint/Prettier exclusions for `vendor/playcanvas-editor/**` are enforced by `.prettierignore` and `.eslintrc.js ignorePatterns`; do not extend the format glob to vendor.

## Upstream Update Governance

When updating the vendored Editor to a new upstream tag (e.g. `v2.24.x` → `v2.25.0`):

1. **Confirm the sibling worktree** is at the target tag (`~/dev/pc-editor-v2.24.2` is the one-time manual step OUTSIDE `packages/**` to satisfy `assertBuildScriptsDoNotInstall`). Run `git rev-parse HEAD` and save the peeled SHA.
2. **Verify the upstream archive and LICENSE** (license year string `Copyright (c) 2011-2026 PlayCanvas Ltd.` and `engines.node >=22.22.0`).
3. **Capture upstream file inventory** to drive the diff guard. Confirm `_fonts.scss` is byte-identical between the new tag and the previous one (the user's hypothesis about local SASS font changes is *falsified* by research).
4. **Replace the local vendor tree atomically** using a `.next` rename pattern: stage into `vendor/playcanvas-editor.next`, apply local omissions from `tools/playcanvas-editor-omit-paths.mjs` (the single source of truth for `OMIT_DIRS` and `OMIT_FILES` shared with `tools/check-playcanvas-editor-vendor-drift.mjs`), verify the staged copy contains the required new modules, then `rm -rf` the old tree and `mv` the new one.
5. **Refresh the manifest** (`vendor/package.playcanvas-editor.json` `version` field) and `vendor/UPSTREAM.md` (tag, commit SHA, snapshot date).
6. **Bump the 3 in-tree constants** in `src/index.ts` and `scripts/lib/playcanvas-editor-artifact.mjs`. The `nodeRequirement` floor in `assertNodeVersion()` and the `tests/artifact.test.mjs` line 91-96 expectations must stay in lockstep with the upstream `engines.node` (currently `>=22.22.0`).
7. **Bump the cross-package metadata**: `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts:216` (`z.literal`), the bridge test, the editor-backend test, the metahubs `PlayCanvasProjectsService.ts:974` plus 3 metahubs test sites, and the OpenAPI emitter `generate-openapi-source.js:1007` (run `pnpm --filter @universo-react/rest-docs generate:openapi` to regen `index.yml`).
8. **Update the previous-version sentinel** `tools/playcanvas-editor-previous-version.txt` to the new previous version (e.g. when bumping to v2.25.0, write `2.24.2` — the current version). This sentinel is the single source of truth for the metadata guard's `FORBIDDEN_LITERALS`; update it in lockstep with the constants in `src/index.ts`.
9. **Bump the 9 Skills + 2 READMEs + 2 docs** (`docs/{en,ru}/platform/playcanvas-editor.md`). Mark new picker class names as "TBD — verify after first browser smoke" in the docs.
10. **Run the 3 governance guards**: `check:playcanvas-editor-isolation`, `check:playcanvas-editor-metadata`, `check:playcanvas-editor-vendor-drift` (the last is developer-local only — no-ops in CI when `PC_EDITOR_UPSTREAM_DIR` is unset).
11. **Run the focused E2E + Playwright evidence** including the new picker sub-assertion + screenshot at `e2e/screenshots/v2-24-2-picker.png`.
12. **Update Memory Bank records**: new `tasks.md` H1, new `progress.md` entry, Canon Refresh of `techContext.md` (Last Reviewed → today's date).

The next agent must update the `src/index.ts` constants, the `tools/playcanvas-editor-previous-version.txt` sentinel, the `tools/playcanvas-editor-omit-paths.mjs` if a new omission is needed, and the `src/index.ts` constants in lockstep — in the same commit. The previous-version sentinel and the `OMIT_DIRS`/`OMIT_FILES` lists are the single source of truth for their respective guards; do not duplicate them.

## Blocking Rules

- Do not import upstream Editor internals into MUI host code.
- Do not assume PlayCanvas Cloud REST/WS parity.
- Do not claim multi-user realtime collaboration is implemented.
- Do not expose authoring storage paths in runtime manifests.
- Do not let the artifact iframe access host page DOM.
- Do not issue compatibility tokens without origin binding.
