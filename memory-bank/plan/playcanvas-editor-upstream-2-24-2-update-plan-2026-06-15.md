# Plan: PlayCanvas Editor v2.23.4 → v2.24.2 Upstream Update and Vendor Governance

> Created: 2026-06-15
> Source research: `memory-bank/research/playcanvas-editor-upstream-2-24-2-update-research-2026-06-15.md` (Status: Reviewed)
> Source brief: `.manager/specs/platformo/playcanvas-editor-upstream-2-24-2-update-governance-spec-2026-06-15.md`
> Source TZ: `.manager/inputs/2026-06-15-playcanvas-editor-upstream-2-24-2-update.md`
> Target branch: `feature/playcanvas-editor-v2-24-2-update`
> Plan layout: 8 phases, sequential. Each phase ends with a green build and a focused test command. The plan is reviewable as a single PR, which the analysis below recommends. If a maintainer prefers to split, the natural two-PR cut is: **PR 1 = phases 0, 1, 2, 6** (snapshot + metadata + governance; build goes green on PR-1 merge); **PR 2 = phases 3, 4, 5, 7, 8** (cross-package metadata, Skills, docs, E2E proof, closeout).

---

## Overview

Update the vendored PlayCanvas Editor frontend in `@universo-react/playcanvas-editor-frontend` from upstream `v2.23.4` to `v2.24.2`. The upstream delta is dominated by a version-control picker rewrite (11 widget files removed, 9 new modules added) and a builds-panel rewrite; no dependency changes. The package must remain a minimally modified upstream artifact boundary (not a fork), so the only permanent local changes are the constants in `src/index.ts` + `scripts/lib/playcanvas-editor-artifact.mjs`, the `vendor/UPSTREAM.md` provenance record, the generated `dist/editor` artifact, and the `check:playcanvas-editor-vendor-drift` governance script.

Three governance primitives must land with the update so the next upstream bump is mechanical:

1. `check:playcanvas-editor-metadata` — root-level grep guard that fails if any active file still cites the **previous** upstream tag / version / commit (e.g. `v2.23.4` / `2.23.4` / `c4916f4…`). Matches the existing `check:playcanvas-editor-isolation` naming convention.
2. `check:playcanvas-editor-vendor-drift` — root-level diff guard that compares `vendor/playcanvas-editor/` against the pinned upstream tag (ignoring documented omissions) and reports any drift. **Developer-local only by design** — the script reads `PC_EDITOR_UPSTREAM_DIR` (default `~/dev/pc-editor-v2.24.2`) and **no-ops gracefully with exit 0** when that directory is absent (CI does not have a sibling worktree).
3. `.prettierignore` — root-level file that excludes `vendor/playcanvas-editor/**` from `pnpm format` walks (ESLint is already protected via `.eslintrc.js` `ignorePatterns`).

The `playcanvas-editor-authoring` Skill gets a new "Upstream Update Governance" section so the next agent has a single, authoritative checklist.

---

## Affected Areas

### Vendor tree (upstream-owned; replaced wholesale)

- `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/` (full source mirror, 8 commits / 42 files)
- `packages/universo-react-playcanvas-editor-frontend/vendor/package.playcanvas-editor.json` (manifest copy, `version: "2.24.2"`)
- `packages/universo-react-playcanvas-editor-frontend/vendor/UPSTREAM.md` (provenance record)
- `packages/universo-react-playcanvas-editor-frontend/vendor/LICENSE.playcanvas-editor` (MIT text, `Copyright (c) 2011-2026 PlayCanvas Ltd.`)
- `packages/universo-react-playcanvas-editor-frontend/NOTICE.md` (copyright attribution)

### Editor package (in-tree)

- `packages/universo-react-playcanvas-editor-frontend/src/index.ts` (constants: `PLAYCANVAS_EDITOR_UPSTREAM_TAG`, `…_COMMIT`, `…_PACKAGE_VERSION`)
- `packages/universo-react-playcanvas-editor-frontend/scripts/lib/playcanvas-editor-artifact.mjs` (mirror constants + `assertVendorMetadata` consumer)
- `packages/universo-react-playcanvas-editor-frontend/tests/artifact.test.mjs` (Vitest assertions)
- `packages/universo-react-playcanvas-editor-frontend/e2e/editor-artifact.spec.ts` (Playwright, 4× `minimumTag`)
- `packages/universo-react-playcanvas-editor-frontend/README.md`, `README-RU.md`

### Cross-package metadata (Zod, OpenAPI, services)

- `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts` (line 216: `z.literal('v2.23.4')`)
- `packages/universo-react-types/src/__tests__/playcanvasEditorBridge.test.ts`
- `packages/universo-react-playcanvas-editor-backend/src/index.test.ts` (line 50)
- `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectsService.ts` (line 974)
- `packages/universo-react-metahubs-backend/src/tests/routes/playCanvasEditorCompatibilityRoutes.test.ts`
- `packages/universo-react-metahubs-backend/src/tests/controllers/playCanvasProjectsController.test.ts` (2× `minimumTag`)
- `packages/universo-react-rest-docs/scripts/generate-openapi-source.js` (line 1007, OpenAPI enum)
- `packages/universo-react-rest-docs/src/openapi/index.yml` (line 14903, generated)

### Agent governance (Skills + repo config)

- `.agents/skills/playcanvas-editor-authoring/SKILL.md` (frontmatter `description`, "Version Guard" block — plus new "Upstream Update Governance" section)
- `.agents/skills/playcanvas-editor-authoring/references/notes.md`
- `.agents/skills/playcanvas-editor-{api-realtime,assets,interface,scenes,scripting,settings,version-control}/SKILL.md` (8 files; one-line "Pinned to Editor v2.23.4" guard)

### Public docs (EN/RU GitBook)

- `docs/en/platform/playcanvas-editor.md`
- `docs/ru/platform/playcanvas-editor.md`

### Repo-wide governance (NEW tools)

- `tools/check-playcanvas-editor-metadata.mjs` (NEW — metadata consistency)
- `tools/check-playcanvas-editor-vendor-drift.mjs` (NEW — vendor drift)
- `.prettierignore` (NEW — formatter protection)
- `package.json` (root): `scripts.check:playcanvas-editor-metadata`, `scripts.check:playcanvas-editor-vendor-drift`, `scripts.test:e2e:agent` chain

### Memory Bank (records, not guards)

- `memory-bank/tasks.md` (new H1 "PlayCanvas Editor Upstream Update v2.24.2 Implementation Tasks")
- `memory-bank/progress.md` (new "2026-06-15: v2.24.2 update complete ✅" entry)
- `memory-bank/techContext.md` (Canon Refresh — bump "PlayCanvas Editor Skills" section anchor; `Last Reviewed: 2026-06-15`)

### Out of scope (intentional)

- `@universo-react/playcanvas-engine` (runtime, `playcanvas@2.18.1`) — not touched.
- Editor `playcanvas@2.19.5` — already current, not "modernized" further. **Do not touch** `packages/universo-react-playcanvas-editor-frontend/package.json:devDependencies.playcanvas` (line 54, value `2.19.5`) or `pnpm-workspace.yaml:catalog.playcanvas` (line 104, value `2.18.1`). No catalog changes are required for v2.24.2.
- Metahub REST compatibility surface — no new routes; new picker calls land as `cloud-only` no-op descriptors.
- `engines.node` field on `packages/universo-react-playcanvas-editor-frontend/package.json` — script-level `assertNodeVersion()` remains the gate.
- `dist/editor/universo-artifact-manifest.json` — regenerated by `editor:build`, not hand-edited (but the regenerated file IS committed; see Quick Reference).
- `apps-template-mui`, `template-mui`, i18n package — no PlayCanvas-version-guard references.
- New top-level Skill for vendor governance — `playcanvas-editor-authoring` remains the home.

---

## Plan Steps

### Phase 0 — Pre-flight verification (≈ 10 min, must end green)

Goal: confirm the upstream archive and LICENSE text are safe to vendor before we copy them in.

- [ ] **0.1** Activate Node 22 and verify E2E tooling per the Playwright Skill:
      ```bash
      export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --silent 22; node -v
      # expected: v22.22.x or newer
      ```
- [ ] **0.2** Confirm the v2.24.2 LICENSE still carries the assertion string we depend on:
      ```bash
      curl -sL https://raw.githubusercontent.com/playcanvas/editor/v2.24.2/LICENSE | head -1
      # expected: Copyright (c) 2011-2026 PlayCanvas Ltd.
      ```
      If the year range changes, update `scripts/lib/playcanvas-editor-artifact.mjs:assertVendorMetadata()` to match the new string.
- [ ] **0.3** Confirm `engines.node` in upstream v2.24.2 is still `>=22.22.0`:
      ```bash
      curl -sL https://raw.githubusercontent.com/playcanvas/editor/v2.24.2/package.json \
        | node -e "process.stdin.on('data', d => { const j = JSON.parse(d); console.log(j.engines) })"
      # expected: { node: '>=22.22.0' }
      # If higher (e.g. >=22.23.0), STOP and update:
      #   1. scripts/lib/playcanvas-editor-artifact.mjs:assertNodeVersion() floor constant
      #   2. tests/artifact.test.mjs:91-96 expect() assertions
      # Re-run step 0.6 after the change.
      ```
- [ ] **0.4** Confirm the sibling worktree pattern (the only safe way to do `git archive` from inside a `assertBuildScriptsDoNotInstall`-protected tree):
      ```bash
      # In a dev dir OUTSIDE packages/**, e.g. ~/dev/playcanvas-editor-worktree
      cd ~/dev && git clone --depth 1 --branch v2.24.2 https://github.com/playcanvas/editor.git pc-editor-v2.24.2
      cd pc-editor-v2.24.2 && git rev-parse HEAD
      # save the peeled commit SHA for use in 1.1 and 1.2
      ```
      The `assertBuildScriptsDoNotInstall` blocklist in `scripts/lib/playcanvas-editor-artifact.mjs` is read at every build; `git clone` is forbidden inside the package tree but allowed outside it.
- [ ] **0.5** Capture upstream file inventory to drive the diff guard, and confirm the research-verified byte-identical `_fonts.scss` (the user's TZ hypothesis about local SASS font changes is *falsified* — this check makes it explicit):
      ```bash
      cd ~/dev/pc-editor-v2.24.2 && \
        find . -type f \
          -not -path './package.json' \
          -not -path './package-lock.json' \
          -not -path './test/*' \
          -not -path './test-suite/*' \
          -not -path './.github/*' \
          -not -name 'Dockerfile*' \
          -not -name 'renovate.json*' \
        | sort > /tmp/upstream-v2.24.2-inventory.txt
      wc -l /tmp/upstream-v2.24.2-inventory.txt
      # Confirm _fonts.scss is byte-identical to v2.23.4 (research finding #3)
      PKG=packages/universo-react-playcanvas-editor-frontend
      diff <(curl -sL https://raw.githubusercontent.com/playcanvas/editor/v2.24.2/sass/common/_fonts.scss) \
           $PKG/vendor/playcanvas-editor/sass/common/_fonts.scss
      # expected: empty output (no diff). If non-empty, stop and re-investigate the user's TZ hypothesis.
      ```
- [ ] **0.6** Run the current local baseline check (must pass before any edit):
      ```bash
      pnpm run check:playcanvas-editor-isolation
      pnpm --filter @universo-react/playcanvas-editor-frontend test
      ```

### Phase 1 — Vendor snapshot replacement (≈ 30 min, mechanical)

Goal: replace the vendored source tree with `v2.24.2` and refresh every locally owned file that mirrors upstream identity.

- [ ] **1.1** Extract the v2.24.2 archive into a staging directory:
      ```bash
      mkdir -p /tmp/pc-editor-vendor-stage
      cd ~/dev/pc-editor-v2.24.2 && git archive v2.24.2 | tar -x -C /tmp/pc-editor-vendor-stage
      # Sanity: must contain src/editor/pickers/version-control/branch-switcher.ts
      ls /tmp/pc-editor-vendor-stage/src/editor/pickers/version-control/branch-switcher.ts
      ```
- [ ] **1.2** Replace the local vendor tree atomically (preserve the `vendor/` directory itself). Use a `.next` rename pattern so a partial `cp` failure does not lose the old tree:
      ```bash
      PKG=packages/universo-react-playcanvas-editor-frontend
      # Stage into a sibling .next directory first
      cp -R /tmp/pc-editor-vendor-stage $PKG/vendor/playcanvas-editor.next
      # Re-apply local omissions on the staged copy
      rm -f  $PKG/vendor/playcanvas-editor.next/package.json
      rm -rf $PKG/vendor/playcanvas-editor.next/test
      rm -rf $PKG/vendor/playcanvas-editor.next/test-suite
      rm -rf $PKG/vendor/playcanvas-editor.next/.github
      rm -f  $PKG/vendor/playcanvas-editor.next/package-lock.json
      rm -f  $PKG/vendor/playcanvas-editor.next/Dockerfile*
      rm -f  $PKG/vendor/playcanvas-editor.next/renovate.json*
      rm -f  $PKG/vendor/playcanvas-editor.next/.dockerignore
      # Verify staged copy is well-formed (required new modules present)
      test -f $PKG/vendor/playcanvas-editor.next/src/editor/pickers/version-control/branch-switcher.ts || \
        { rm -rf $PKG/vendor/playcanvas-editor.next; echo "ERROR: staged copy missing v2.24.2 files; aborting"; exit 1; }
      # Atomic swap: rm old, mv new. If mv fails after rm, restore from a single `git checkout` (the tree is in git).
      rm -rf $PKG/vendor/playcanvas-editor
      mv $PKG/vendor/playcanvas-editor.next $PKG/vendor/playcanvas-editor
      # Verify git status is clean apart from the expected file churn
      git status --short $PKG/vendor/playcanvas-editor/ | head -5
      ```
- [ ] **1.3** Refresh the upstream manifest:
      ```bash
      cp /tmp/pc-editor-vendor-stage/package.json $PKG/vendor/package.playcanvas-editor.json
      node -e "const fs=require('fs');const p='$PKG/vendor/package.playcanvas-editor.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.version='2.24.2';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n')"
      ```
- [ ] **1.4** Refresh `vendor/UPSTREAM.md` (replace `v2.23.4` → `v2.24.2`, `c4916f4…` → `<new-sha>`, `Snapshot date: 2026-06-05` → `2026-06-15`). Confirm `Copyright (c) 2011-2026 PlayCanvas Ltd.` and `Node: >=22.22.0` stay correct.
- [ ] **1.5** Refresh `vendor/LICENSE.playcanvas-editor` and package `NOTICE.md` (LICENSE text identical between v2.23.4 and v2.24.2; verify with `diff`):
      ```bash
      diff /tmp/pc-editor-vendor-stage/LICENSE $PKG/vendor/LICENSE.playcanvas-editor
      cp /tmp/pc-editor-vendor-stage/LICENSE $PKG/vendor/LICENSE.playcanvas-editor
      ```
- [ ] **1.6** Verify boundary rule preserved (no upstream `package.json`):
      ```bash
      test ! -f $PKG/vendor/playcanvas-editor/package.json && echo OK
      ```
- [ ] **1.7** First artifact build, no JS metadata changes yet (we expect `assertVendorMetadata` to fail because the manifest now says `2.24.2` while constants still say `2.23.4`):
      ```bash
      pnpm --filter @universo-react/playcanvas-editor-frontend editor:build 2>&1 | tail -30
      # expected: throws "Unexpected upstream package version: 2.24.2" — this is the planned failure
      ```

### Phase 2 — Bump in-tree metadata constants (≈ 15 min, mechanical)

Goal: re-establish green build by aligning all `v2.23.4` / `c4916f4…` constants to `v2.24.2` / `<new-sha>`.

- [ ] **2.1** Update constants in `packages/universo-react-playcanvas-editor-frontend/src/index.ts` (lines 2-4):
      ```ts
      export const PLAYCANVAS_EDITOR_UPSTREAM_TAG = 'v2.24.2'
      export const PLAYCANVAS_EDITOR_UPSTREAM_COMMIT = '<new-sha>'  // from 0.4
      export const PLAYCANVAS_EDITOR_UPSTREAM_PACKAGE_VERSION = '2.24.2'
      ```
- [ ] **2.2** Mirror the same change in `packages/universo-react-playcanvas-editor-frontend/scripts/lib/playcanvas-editor-artifact.mjs` (lines 10-12).
- [ ] **2.3** Update `packages/universo-react-playcanvas-editor-frontend/tests/artifact.test.mjs` — the three expect() assertions (lines 42-43, 53-54) and the build-time constants in `manifest` fixtures. Also verify the `assertNodeVersion` test on lines 90-97 (it block; specifically the `expect(...)` calls on lines 91-96) still passes — `assertNodeVersion('22.22.0')` must continue to be the floor (unless Phase 0.3 detected a higher upstream `engines.node` and the floor was bumped in lockstep).
- [ ] **2.4** Run artifact build + smoke + browser smoke (must pass on first run):
      ```bash
      pnpm --filter @universo-react/playcanvas-editor-frontend editor:build
      pnpm --filter @universo-react/playcanvas-editor-frontend editor:smoke
      pnpm --filter @universo-react/playcanvas-editor-frontend test
      ```
- [ ] **2.5** Run the full editor-frontend Vitest unit suite (must pass):
      ```bash
      pnpm --filter @universo-react/playcanvas-editor-frontend test
      ```
- [ ] **2.6** Run `check:playcanvas-editor-isolation` (must pass — vendor tree is fully replaced, no new public-API exports added):
      ```bash
      pnpm run check:playcanvas-editor-isolation
      ```

### Phase 3 — Bump cross-package metadata + OpenAPI (≈ 25 min, mechanical)

Goal: update every `minimumTag: 'v2.23.4'` literal outside the editor package and regenerate the OpenAPI spec.

- [ ] **3.1** Update `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts:216` from `z.literal('v2.23.4')` to `z.literal('v2.24.2')`.
- [ ] **3.2** Update `packages/universo-react-types/src/__tests__/playcanvasEditorBridge.test.ts` (the matching `minimumTag: 'v2.23.4'` fixture in the bridge test).
- [ ] **3.3** Update `packages/universo-react-playcanvas-editor-backend/src/index.test.ts:50`.
- [ ] **3.4** Update `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectsService.ts:974` and the matching `minimumTag` in `playCanvasEditorCompatibilityRoutes.test.ts` and `playCanvasProjectsController.test.ts` (2 occurrences).
- [ ] **3.5** Update `packages/universo-react-rest-docs/scripts/generate-openapi-source.js:1007` (`enum: ['v2.23.4']` → `enum: ['v2.24.2']`).
- [ ] **3.6** Regenerate the OpenAPI spec (script name: `generate:openapi`, defined at `packages/universo-react-rest-docs/package.json:6`; the script body invokes `node scripts/generate-openapi-source.js`):
      ```bash
      pnpm --filter @universo-react/rest-docs generate:openapi
      # verify the regenerated line:
      grep -n "v2.24.2" packages/universo-react-rest-docs/src/openapi/index.yml | head -5
      # also run redocly lint to keep CI green:
      pnpm --filter @universo-react/rest-docs validate
      ```
- [ ] **3.7** Run the targeted backend/type test suites (must all pass):
      ```bash
      pnpm --filter @universo-react/types test
      pnpm --filter @universo-react/playcanvas-editor-backend test
      pnpm --filter @universo-react/metahubs-backend test -- \
        --testPathPattern="(playCanvasEditorCompatibility|PlayCanvasProjectsService|playCanvasProjectsController)"
      ```
- [ ] **3.8** Update `packages/universo-react-playcanvas-editor-frontend/e2e/editor-artifact.spec.ts` (lines 222, 529, 672, 853) — the four `minimumTag: 'v2.23.4'` strings in the test bootstrap.

### Phase 4 — Skill + README + NOTICE + UPSTREAM refresh (≈ 20 min, mechanical)

Goal: every human-readable reference to `v2.23.4` and `c4916f4…` is updated; the 9 PlayCanvas Editor Skills no longer claim `v2.23.4` is the active version.

- [ ] **4.1** Update `.agents/skills/playcanvas-editor-authoring/SKILL.md`:
  - frontmatter `description:` line 3 — replace `vendoring playcanvas/editor v2.23.4` with `vendoring playcanvas/editor v2.24.2`.
  - `## Version Guard` block lines 16-19 — bump `v2.23.4` → `v2.24.2`, `c4916f4…` → `<new-sha>`.
  - Leave `playcanvas@2.19.5`, `playcanvas@2.18.1`, `Node >=22.22.0` untouched.
- [ ] **4.2** Update `.agents/skills/playcanvas-editor-authoring/references/notes.md:3` (`Pinned version … v2.23.4` → `v2.24.2`).
- [ ] **4.3** Update the 8 other PlayCanvas Editor Skills (`api-realtime`, `assets`, `interface`, `scenes`, `scripting`, `settings`, `version-control`) — bump the `v2.23.4` literal inside the existing `## Version Guard` block to `v2.24.2`. The version literal appears in body text (e.g. line 16-17 of `playcanvas-editor-version-control/SKILL.md`), not in a single line — replace it where it appears, keeping the surrounding sentence structure. Also `universo-compat` if it mentions a specific version (verified at file head — current `playcanvas-editor-universo-compat/SKILL.md` does NOT mention a specific Editor version, so no change required).
- [ ] **4.4** Update `packages/universo-react-playcanvas-editor-frontend/README.md` (lines 10-12) and `README-RU.md` (lines 10-12).
- [ ] **4.5** Update `packages/universo-react-playcanvas-editor-frontend/NOTICE.md:8` (`Tag: v2.23.4` → `v2.24.2`).
- [ ] **4.6** Confirm `.agents/skills/SOURCES.md` still has the correct row for `playcanvas-editor-*` Skills ("Local project workflow" — no per-Skill `Source` URL change needed).

### Phase 5 — EN/RU docs sync (≈ 25 min, prose + code blocks)

Goal: `docs/en/platform/playcanvas-editor.md` and `docs/ru/platform/playcanvas-editor.md` reflect v2.24.2 + the new builds panel + version-control picker.

- [ ] **5.1** Update `docs/en/platform/playcanvas-editor.md`:
  - "Current Scope" section: `Upstream tag: v2.23.4` → `v2.24.2`, `Upstream commit: c4916f4…` → `<new-sha>`, `Upstream package version: 2.23.4` → `2.24.2`.
  - "Typed Bridge Contract" section: replace the inline `current compatibility descriptor for the upstream v2.23.4 Editor slice` with `v2.24.2`. Add a one-paragraph note that v2.24.2's `editor-api/models.ts` adds two **new** types (`BuildJobFormat`, `BuildJob`) — these are not exposed to Universo today (the artifact's bridge bootstrap does not serialize `BuildJob`; the picker calls reach REST endpoints that the compatibility backend already returns as `cloud-only` no-op descriptors, so the new types do not require new routes).
  - "Full Upstream UI Boot" section: add a "Builds panel" sub-bullet (`.pcui-container.picker-builds-publish`) and a "Version control picker" sub-bullet (`.pcui-container.picker-version-control`) alongside the existing six `#layout-*` selectors. **Mark these sub-bullets as "TBD — verify after first browser smoke"** in the PR description; the exact PCUI class names are inferred and may be refined in a follow-up commit.
  - "Troubleshooting": add one bullet — "If the new picker (VC / builds) renders empty after a v2.24.2 swap, ensure `playcanvas/editor@v2.24.2` is in the bundle; `picker-conflict-manager` no-ops silently if the new `picker:versioncontrol:hasRetainedDiff` is missing."
- [ ] **5.2** Apply the same edits to `docs/ru/platform/playcanvas-editor.md` in the corresponding Russian sections (`## Текущий охват`, `## Типизированный bridge-контракт`, `## Full Upstream UI Boot`, `## Устранение неполадок`). Use the existing Russian terminology that already appears in the file — do not introduce new words.
- [ ] **5.3** Run the docs i18n check (must pass):
      ```bash
      pnpm run docs:i18n:check
      ```
- [ ] **5.4** Run the GitBook screenshot-assets check (must pass — even if no screenshot changed):
      ```bash
      pnpm run docs:gitbook-screenshot-assets:check
      ```

### Phase 6 — Governance: 3 guards + Skill extension (≈ 60 min, new code)

Goal: make the next upstream bump mechanical. The 3 guards must be green on a clean checkout of `main` after this PR lands.

- [ ] **6.1** Add `tools/check-playcanvas-editor-metadata.mjs` — fail if any of the active paths contains the **previous** upstream tag, version, or commit. The script reads the *current* constants from `src/index.ts` (single source of truth) and constructs the *previous* literals by decrementing the package minor (e.g. `2.24.2` → `2.23.4`, `v2.24.2` → `v2.23.4`, commit SHA is not checkable, so the version and tag are sufficient). Discipline: the agent must update the constants in `src/index.ts` *and* the version-decoding logic in the script in the same commit. The script greps across:
      ```
      packages/
      docs/en/platform/
      docs/ru/platform/
      .agents/skills/playcanvas-editor-*/
      tools/
      scripts/
      ```
      Allowlist: `node_modules/`, `dist/`, `vendor/playcanvas-editor/**`, `memory-bank/`, `**/build/`, `**/.turbo/`, `**/.tmp/`, `**/coverage/`. Exit non-zero on any match.
- [ ] **6.2** Wire it in `package.json` (root):
      ```json
      "check:playcanvas-editor-metadata": "node tools/check-playcanvas-editor-metadata.mjs"
      ```
      and add to the `test:e2e:agent` chain (next to the existing `check:playcanvas-editor-isolation`).
- [ ] **6.3** Add `tools/check-playcanvas-editor-vendor-drift.mjs` — **developer-local only by design**. The script:
      1. Reads `PC_EDITOR_UPSTREAM_DIR` (default `~/dev/pc-editor-v2.24.2`, set up in Phase 0.4 as a one-time manual step OUTSIDE `packages/**` to satisfy `assertBuildScriptsDoNotInstall`).
      2. If that directory does not exist or `git archive` cannot find the pinned tag, **exit 0 with a one-line informational log** ("`[check:playcanvas-editor-vendor-drift] PC_EDITOR_UPSTREAM_DIR not found; skipping developer-local check`"). This makes the script safe to run in CI: CI does not have a sibling worktree, so the guard silently no-ops.
      3. If the directory exists, run `git archive v2.24.2` (allowed by `assertBuildScriptsDoNotInstall`'s regex, which blocks only `git clone/fetch/pull/submodule update`), stage the result into `/tmp/pc-editor-vendor-stage-<pid>` with the same local omissions applied, then `diff -r --brief staging vendor/playcanvas-editor/`. Exit non-zero on differences.
      4. Always clean up the temp dir in `finally`. Never invoke `git clone/fetch/pull/submodule update` from inside `packages/**/scripts/`.
      5. The script reads the current tag from `src/index.ts` and dynamically resolves the upstream repo (the same single source of truth as the metadata guard).
- [ ] **6.4** Wire it the same way:
      ```json
      "check:playcanvas-editor-vendor-drift": "node tools/check-playcanvas-editor-vendor-drift.mjs"
      ```
      Also add to `test:e2e:agent`.
- [ ] **6.5** Create `.prettierignore` at repo root with:
      ```
      **/dist/**
      **/build/**
      **/coverage/**
      **/.turbo/**
      **/.tmp/**
      **/node_modules/**
      packages/universo-react-playcanvas-editor-frontend/vendor/**
      packages/universo-react-playcanvas-editor-frontend/.tmp/**
      packages/universo-react-playcanvas-editor-frontend/dist/**
      ```
      Verify that `pnpm format` no longer touches any vendored file. Use the **direct prettier invocation** (the root `format` script is `prettier --write` and does not support `--check`):
      ```bash
      # Use --check (not --write) so we only inspect, never modify
      pnpm prettier --check "**/*.{ts,tsx,md}" 2>&1 | head -20
      # Verify the count of "vendor/playcanvas-editor" matches in the output is 0
      pnpm prettier --check "**/*.{ts,tsx,md}" 2>&1 | grep -c "vendor/playcanvas-editor" || echo "OK: no vendored files were reformatted"
      ```
- [ ] **6.6** Extend `.agents/skills/playcanvas-editor-authoring/SKILL.md` with a new `## Upstream Update Governance` section (between `## Workflow` and `## Blocking Rules`). The section is a checklist:
  1. Confirm the sibling worktree is at the target tag.
  2. Run the script in step 1.1 to extract the archive.
  3. Apply the local omissions (step 1.2, atomic `.next` rename).
  4. Update the manifest, `UPSTREAM.md`, `LICENSE`, `NOTICE.md` (steps 1.3-1.5).
  5. Bump the 3 in-tree constants (step 2.1-2.2).
  6. Bump the cross-package metadata + OpenAPI (phase 3).
  7. Bump the 9 Skills + 2 READMEs + 2 docs (phases 4-5).
  8. Run the 3 governance guards (this phase).
  9. Run the focused E2E + Playwright evidence (phase 7).
  10. Update Memory Bank records (phase 8).
  11. **Update the existing `## Workflow` step 4** ("Run ESLint/Prettier on all package-local files before validation") to add a parenthetical: "ESLint/Prettier exclusions for `vendor/playcanvas-editor/**` are enforced by `.prettierignore` and `.eslintrc.js ignorePatterns`; do not extend the format glob to vendor." This avoids contradicting the new governance section.
- [ ] **6.7** Document the new scripts in `package.json`. **Do NOT use `//` line comments** — `package.json` is strict JSON and rejects them. Document the script purpose in the `## Upstream Update Governance` Skill section (added in 6.6) and in the `## Commands` section of `packages/universo-react-playcanvas-editor-frontend/README.md`. The script bodies themselves should have a top-of-file comment (`// Read src/index.ts ...`).
- [ ] **6.8** Self-test the guards: revert one Skill temporarily, run `pnpm run check:playcanvas-editor-metadata` — must fail with a clear violation pointing to the Skill file. Restore the Skill, re-run — must pass.

### Phase 7 — Browser E2E + local Supabase proof (≈ 60-90 min, requires local stack)

Goal: prove the v2.24.2 UI actually works inside Universo on a real browser, against a real backend, with the new picker surface visible.

- [ ] **7.1** Update `e2e/editor-artifact.spec.ts` to add a new sub-assertion for the v2.24.2 picker selectors, modelled on the existing `'PlayCanvas Editor hosted upstream UI saves serializable entities'` test. The new test should:
  - Boot the full upstream UI mode (existing helper `expectHostedEditorApiReady`).
  - Open the version-control picker via `editor.call('picker:versioncontrol')`.
  - Assert that `.pcui-container.picker-version-control` is visible inside the iframe.
  - Open the builds panel via `editor.call('picker:builds-publish', { reload: true })`.
  - Assert that `.pcui-container.picker-builds-publish` is visible.
  - Capture a screenshot of the iframe (`page.locator('iframe[title="PlayCanvas Editor"]').screenshot({ path: 'e2e/screenshots/v2-24-2-picker.png' })`). The `e2e/screenshots/` directory does not exist yet — Playwright will create it on first write.
- [ ] **7.2** Add the new test to the `editor:browser-smoke` script chain.
- [ ] **7.3** Start the local minimal Supabase E2E stack:
      ```bash
      pnpm supabase:e2e:start:minimal
      pnpm env:e2e:local-supabase
      pnpm doctor:e2e:local-supabase
      ```
- [ ] **7.4** Build E2E artifacts and run the editor browser smoke:
      ```bash
      pnpm run build:e2e
      pnpm --filter @universo-react/playcanvas-editor-frontend editor:build
      pnpm --filter @universo-react/playcanvas-editor-frontend editor:smoke
      pnpm --filter @universo-react/playcanvas-editor-frontend editor:browser-smoke
      ```
      Confirm all 4 new assertions in the v2.24.2 picker test pass, and the existing 6 `#layout-*` selectors still resolve.
- [ ] **7.5** Open the captured screenshot in a real browser (Playwright CLI `playwright open <png>` is fine for a quick visual sanity check) and confirm:
  - The new builds panel uses the modern card layout (single primary build card, kebab menus, infinite scroll region).
  - The new version-control picker renders the branch switcher in the top bar and a "details card" on the right.
  - No console errors related to `picker:versioncontrol:hasRetainedDiff` being undefined.
- [ ] **7.6** Run the cross-package runtime gate (this is the closest to the user-facing E2E):
      ```bash
      pnpm run test:e2e:mmoomm-app-gate:local-supabase
      ```
      This runs the MMOOMM Playwright generator + runtime proof. **Documented behavior on this gate** (per brief acceptance criterion "any blocked command is documented with the exact blocker and remaining risk"):
      1. The MMOOMM fixture under `tools/fixtures/metahubs-mmoomm-app-snapshot.json` is the canonical fixture the gate regenerates. v2.24.2 should not change the fixture's `protocol.describe` payload (per research: the bridge contract is opaque to the picker rewrite).
      2. If the gate **fails** with a `protocol.describe` diff: classify the diff as expected (no semantic change) or unexpected (real picker regression). If expected, regenerate the fixture and commit the diff. If unexpected, **stop the PR** and write a follow-up brief.
      3. If the gate **fails** with an unrelated error (browser timing, supabase timeout): re-run once; if still failing, capture the failure log and write a `progress.md` "blocked/known-difference" block before merging.
      4. If the gate **fails** with a hard-to-classify error: consult the browser console network log; the most likely cause is a `protocol.describe` payload assumption the new picker rewrote.
- [ ] **7.7** Tear down the local Supabase E2E instance to keep CI parity:
      ```bash
      pnpm supabase:e2e:stop
      ```

### Phase 8 — Memory Bank records + closeout (≈ 25 min)

Goal: leave Memory Bank in a state that the next session can start from.

- [ ] **8.1** Add a new H1 block in `memory-bank/tasks.md` titled "PlayCanvas Editor Upstream Update v2.24.2 Implementation Tasks" with a `> Date: 2026-06-15` and `> Source plan: memory-bank/plan/playcanvas-editor-upstream-2-24-2-update-plan-2026-06-15.md` frontmatter. Checklist:
      ```
      - [ ] 2026-06-15: Replace vendor/playcanvas-editor/ snapshot with v2.24.2 (commit <new-sha>), update vendor/UPSTREAM.md, vendor/package.playcanvas-editor.json, vendor/LICENSE.playcanvas-editor, NOTICE.md.
      - [ ] 2026-06-15: Bump upstreamTag / upstreamCommit / upstreamPackageVersion constants in scripts/lib/playcanvas-editor-artifact.mjs (lines 10-12) and src/index.ts (lines 2-4).
      - [ ] 2026-06-15: Update test expectations in tests/artifact.test.mjs (lines 42-43, 53-54) and e2e/editor-artifact.spec.ts (lines 222, 529, 672, 853).
      - [ ] 2026-06-15: Update minimumTag literal in packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts:216 and the four other minimumTag sites in metahubs-backend + playcanvas-editor-backend tests.
      - [ ] 2026-06-15: Regenerate OpenAPI via `pnpm --filter @universo-react/rest-docs generate:openapi`; commit src/openapi/index.yml.
      - [ ] 2026-06-15: Update 9 PlayCanvas Editor Skills, 2 READMEs, 2 GitBook docs (en+ru).
      - [ ] 2026-06-15: Add tools/check-playcanvas-editor-metadata.mjs, tools/check-playcanvas-editor-vendor-drift.mjs, .prettierignore; wire into root package.json scripts and test:e2e:agent.
      - [ ] 2026-06-15: Extend .agents/skills/playcanvas-editor-authoring/SKILL.md with new "## Upstream Update Governance" section.
      - [ ] 2026-06-15: Add v2.24.2 picker sub-assertion + screenshot to e2e/editor-artifact.spec.ts.
      - [ ] 2026-06-15: Run all 3 governance guards, focused E2E on local minimal Supabase, and thermos/autoreview closeout.
      ```
- [ ] **8.2** Add a new `progress.md` entry:
      ```markdown
      ### 2026-06-15: PlayCanvas Editor v2.24.2 upstream update ✅

      - Snapshot replaced (v2.23.4 → v2.24.2, peeled commit <new-sha>).
      - All active-code metadata (30 files) updated to v2.24.2.
      - 3 governance guards added (metadata, vendor-drift, formatter).
      - E2E + local minimal Supabase Playwright proof passed.
      - Files: ~38 active-code + 4 governance + 2 docs. Pattern: systemPatterns.md#upstream-update-governance.
      ```
- [ ] **8.3** Canon Refresh `techContext.md`:
  - Update `Last Reviewed: 2026-05-22` → `Last Reviewed: 2026-06-15 (refreshed: PlayCanvas Editor Skills version anchor bumped v2.23.4 → v2.24.2; new governance primitives: check:playcanvas-editor-metadata, check:playcanvas-editor-vendor-drift, .prettierignore)`.
  - Bump the "PlayCanvas Editor Skills" section's version anchor.
  - Add a one-line note about the 3 new governance primitives.
- [ ] **8.4** Run the closeout review:
      ```bash
      # Precondition: lockfile must be unchanged in this slice (research: all devDependencies
      # identical between v2.23.4 and v2.24.2). If pnpm install mutates the lockfile,
      # assertRootLockfileHash() in tests/artifact.test.mjs will fail; re-run install and try again.
      pnpm install --frozen-lockfile
      pnpm run check:playcanvas-editor-isolation
      pnpm run check:playcanvas-editor-metadata
      pnpm run check:package-naming  # parity with test:e2e:agent chain
      pnpm run check:playcanvas-editor-vendor-drift  # no-ops in CI; runs only when PC_EDITOR_UPSTREAM_DIR is set
      pnpm --filter @universo-react/playcanvas-editor-frontend test
      pnpm --filter @universo-react/playcanvas-editor-frontend editor:build
      pnpm --filter @universo-react/playcanvas-editor-frontend editor:smoke
      pnpm --filter @universo-react/playcanvas-editor-frontend editor:browser-smoke
      pnpm run docs:i18n:check
      pnpm run docs:gitbook-screenshot-assets:check
      pnpm format  # uses the root format script; .prettierignore protects vendor
      ```
- [ ] **8.5** Run Thermos / autoreview for the final security + maintainability pass. Address any `critical` findings before requesting user review.

---

## UI Contract (Runtime UI UX Quality Gate)

This plan does not add any new user-facing MUI screens. The picker UI is **upstream-owned** and rendered inside an iframe with `allow-scripts allow-same-origin`. Therefore the standard MUI UX Quality Gate does not apply to the picker itself. However, the new test in `e2e/editor-artifact.spec.ts` (step 7.1) must include the standard elements that the host MUI shell exposes for the iframe:

- **Controls exercised:** `editor.call('picker:versioncontrol')`, `editor.call('picker:builds-publish', { reload: true })`. No new MUI controls added.
- **Display values:** the new builds panel shows `BuildJob` / `BuildJobFormat` labels (upstream-owned). The host shell does not surface these as data — they remain inside the iframe.
- **Hidden / system-owned fields:** none. The host MUI shell still treats the Editor artifact as opaque.
- **Defaults:** artifact mode remains `universo-full-upstream-ui` (no change).
- **Localization:** all visible host-shell copy around the iframe is already localized in `metahubs-frontend`. The v2.24.2 update does not introduce new host-shell strings; the `bridge.saveError` / `bridge.dirtyState` text already exists. No new i18n keys required.
- **Validation:** the new picker calls are `cloud-only` no-op descriptors; validation is the existing `playCanvasEditorCompatibilityRoutes` 501/404 contract — no change.
- **Responsive proof:** the new picker is inside an iframe that fills the host viewport — responsive behavior is upstream-owned and unchanged.

The plan-ux-reviewer checklist applies to any new MUI shell around the iframe. **None added.**

---

## Potential Challenges

1. **SASS drift in `_editor-main.scss` is real and gets absorbed silently.** The pre-existing local edits in that file are wiped out by the upstream rewrite (+1952/-1381). This is the desired behavior per the brief, but the diff will look like a single large `git rm` + `git add` of one file. Reviewers should be told to expect this; the QA pass must verify the v2.24.2 file is byte-for-byte upstream and the local delta is gone. **Mitigation:** include the byte-for-byte `diff` output in the PR description.

2. **`picker-conflict-manager` silent-no-op risk.** If the new `picker-version-control.ts` is not in the bundle (e.g. a stale cache, a botched merge), `picker-conflict-manager` no-ops with no error. Browser smoke must verify the diff manager UI works end-to-end. **Mitigation:** the new sub-assertion in step 7.1 + the `dist/editor` cleanup (`pnpm --filter @universo-react/playcanvas-editor-frontend clean`) before each test run.

3. **OpenAPI `index.yml` regen can fail silently.** If the `generate:openapi` script errors on a schema change, CI may pass on the previous version of the spec. **Mitigation:** the `validate` step (redocly lint) in 3.6 catches schema-drift; always run both `generate:openapi` AND `validate` together.

4. **Local minimal Supabase timing on cold cache.** The full `test:e2e:mmoomm-app-gate:local-supabase` is 8-15 minutes cold. **Mitigation:** keep the script chain modular — phase 7 lets the maintainer run only the editor browser smoke first and only the full gate as the final pre-merge proof.

5. **`engines.node` year-string assertion in `assertVendorMetadata`.** The literal string `Copyright (c) 2011-2026 PlayCanvas Ltd.` is hard-coded. v2.24.2 still uses the same string (verified in 0.2), but if upstream ever changes it, the build will fail closed. **Mitigation:** phase 0 step 0.2 is a hard precondition; if the string changes, phase 2 must be adjusted.

6. **Lint-staged + `git archive` gotcha.** The `lint-staged` glob `*.{js,jsx,ts,tsx,json,md}` does not exclude `vendor/**`, but ESLint's `.eslintrc.js` `ignorePatterns` does. Functionally safe today, but the chain is fragile. **Mitigation:** the `.prettierignore` added in 6.5 protects Prettier, and the `check:playcanvas-editor-metadata` guard in 6.1 will catch any `v2.23.4` literal that a botched `format` run might leave in the vendor tree.

7. **`git archive` from inside `assertBuildScriptsDoNotInstall`.** The script blocklist is `git clone/fetch/pull/submodule update` only — `git archive` is allowed. The sibling-worktree pattern in step 0.4 keeps the `git clone` out of the package tree entirely. **Mitigation:** the new `check:playcanvas-editor-vendor-drift.mjs` script uses the same pattern; never invoke `git clone` from inside `packages/**/scripts/`.

8. **Browser smoke sub-assertion selector drift.** The exact PCUI class names for the new picker (`.pcui-container.picker-version-control` etc.) are inferred from the existing pattern. The first real browser run may reveal different classes. **Mitigation:** phase 7.1 sub-assertion is `…toBeVisible({ timeout: 30_000 })` — tolerant of cold start. If it fails, the screenshot at `tests/screenshots/v2-24-2-picker.png` is the diagnostic artifact.

9. **Skill `playcanvas-editor-universo-compat` may not need an update.** It does not mention a specific Editor version, but a quick re-read is required to confirm. **Mitigation:** step 4.3 explicitly includes a `universo-compat` check; if it mentions a version, include it; if not, skip.

11. **localStorage scope inside the iframe.** v2.24.2's new version-control orchestrator persists selected scene IDs to `localStorage` (research finding). The iframe sandbox is `allow-scripts allow-same-origin`, so the picker shares the host's `localStorage` namespace. This is a **pre-existing behavior** (v2.23.4's per-widget pickers did the same), not a v2.24.2 regression, and is outside the scope of this PR. The new orchestrator only consolidates the writes; it does not introduce a new surface. No action required.

10. **Two PRs vs one PR.** The plan is structured as 8 phases that can land in one PR. If a maintainer prefers two PRs, the natural split is:
    - **PR 1 (snapshot + governance):** phases 0, 1, 6, 7 (vendor replacement, 3 guards, browser smoke). The build is broken between phase 1 and phase 2 by design, so PR 1 must include phase 2 to keep CI green.
    - **PR 2 (metadata + skills + docs):** phases 2, 3, 4, 5, 8. Lands cleanly behind PR 1.

    **Recommendation: one PR.** The snapshot replacement without metadata updates breaks the build; landing them together keeps CI green at all times.

---

## Dependencies

### Cross-team / cross-module coordination

- **Universo compat backend (no change required):** the new picker calls reach REST endpoints the existing `playCanvasEditorCompatibilityRoutes` already returns as `cloud-only` no-op descriptors. No backend code change in this slice. A future brief may add explicit `branches` / `checkpoints` / `merge` compatibility routes; that is out of scope here.
- **Metahub frontend `PlayCanvasEditorHostPage.tsx` (no change required):** the host shell consumes the `protocol.describe` descriptor and the iframe; v2.24.2's picker rewrite is opaque to the host.
- **`apps-template-mui` (no change required):** consumes published PlayCanvas runtime manifests, not the vendored Editor.
- **TanStack Query (no change required):** not used inside the vendored Editor; the host MUI shell's TanStack Query usage is outside the editor package.
- **i18n package (no change required):** no Editor-version-guard references in `packages/universo-react-i18n/`.
- **`@universo-react/types` and `@universo-react/utils`:** only the `minimumTag` literal in `playcanvasEditorCompatibility.ts:216` is touched. The new `BuildJob` / `BuildJobFormat` types from upstream v2.24.2 are not yet added to `packages/universo-react-types/src/common/playcanvasProjects.ts`; a follow-up brief can add them when the MMOOMM authoring path needs build-status semantics. The vendored Editor's bridge bootstrap (`writeBridgeBootstrap` in `playcanvas-editor-artifact.mjs`) is a vanilla JS string injected at runtime — it has no TypeScript surface that needs updating, and `createUuidV7()` is preserved as-is per the UUID v7 pattern in `techContext.md:259-264`.

### Cross-repo dependencies

- **Upstream `playcanvas/editor@v2.24.2`:** must be published and immutable. Verified: tag exists at peeled commit `00360100b3b5747648eb3d7287421ef25491f5c7`, published 2026-06-12 by `github-actions[bot]`.
- **Sibling worktree `~/dev/pc-editor-v2.24.2`:** must be cloned outside the package tree (per `assertBuildScriptsDoNotInstall`). One-time setup; the drift guard reuses it.
- **Node 22.22+:** required for the vendored Vite build. Verified by `assertNodeVersion` test.

### Skill dependencies

- `playcanvas-editor-authoring` — extended in phase 4.1 and 6.6.
- `playcanvas-editor-{api-realtime,assets,interface,scenes,scripting,settings,version-control}` — version-guard updated in phase 4.3.
- `playwright-best-practices` — used to model the new picker test in phase 7.1.
- `mui-runtime-ux-patterns` — not required; no new MUI screens added.
- `thermos` / `autoreview` — used in phase 8.5 closeout.

---

## Risk Register (post-merge stability)

- **Low:** runtime regression from new picker rewrite. Mitigated by phase 7.6 full E2E + phase 8.4 final smoke.
- **Low:** silent formatter drift into vendor tree. Mitigated by phase 6.5 `.prettierignore` + 6.1 metadata guard.
- **Low:** future upstream tag change without metadata bump. Mitigated by phase 6.1 `check:playcanvas-editor-metadata` + 6.3 vendor-drift guard.
- **Medium:** new `BuildJob` types in `editor-api/models.ts` are not added to `packages/universo-react-types/src/common/playcanvasProjects.ts`. Currently safe (Universe has no consumer) but could become a hot spot in 2026-Q3 when MMOOMM authoring starts to depend on build status. Out of scope here; flagged for the next brief.

---

## What this plan does NOT touch (intentional)

- `@universo-react/playcanvas-engine` (runtime, `playcanvas@2.18.1`).
- Editor-side `playcanvas@2.19.5` (already at the latest version that the Editor supports).
- The metahub REST compatibility surface (no new routes).
- `engines.node` field on `packages/.../package.json` (script-level check stays).
- `apps-template-mui`, `template-mui`, i18n package internals.
- `dist/editor/universo-artifact-manifest.json` (generated by `editor:build`).
- A new top-level Skill for vendor governance.
- The schema version of the metahub template (per the TZ, the test DB is recreated from scratch).
- A bump of the application version (`upr-0.69.0-alpha` in `package.json` stays).

---

## Quick reference — files to be created, modified, or regenerated

### Created (4)

- `tools/check-playcanvas-editor-metadata.mjs` (new governance)
- `tools/check-playcanvas-editor-vendor-drift.mjs` (new governance)
- `.prettierignore` (new formatter protection)
- `packages/universo-react-playcanvas-editor-frontend/e2e/screenshots/v2-24-2-picker.png` (new test artifact)

### Modified (~ 38 active-code + 9 Skills + 2 docs + 4 governance + 2 Memory Bank + 1 manifest + 1 generator)

- `packages/universo-react-playcanvas-editor-frontend/{README.md, README-RU.md, NOTICE.md, src/index.ts, scripts/lib/playcanvas-editor-artifact.mjs, vendor/UPSTREAM.md, vendor/package.playcanvas-editor.json, vendor/LICENSE.playcanvas-editor, tests/artifact.test.mjs, e2e/editor-artifact.spec.ts}` (10 files in the editor package; `vendor/playcanvas-editor/**` is regenerated wholesale)
- `packages/universo-react-types/src/{common/playcanvasEditorCompatibility.ts, __tests__/playcanvasEditorBridge.test.ts}` (2 files)
- `packages/universo-react-playcanvas-editor-backend/src/index.test.ts` (1 file)
- `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectsService.ts` (1 file)
- `packages/universo-react-metahubs-backend/src/tests/{controllers/playCanvasProjectsController.test.ts, routes/playCanvasEditorCompatibilityRoutes.test.ts}` (2 files)
- `packages/universo-react-rest-docs/scripts/generate-openapi-source.js` (1 file)
- `packages/universo-react-rest-docs/src/openapi/index.yml` (1 file, regenerated)
- `docs/{en,ru}/platform/playcanvas-editor.md` (2 files)
- `.agents/skills/playcanvas-editor-{authoring, api-realtime, assets, interface, scenes, scripting, settings, version-control}/SKILL.md` (8 files) + `playcanvas-editor-authoring/references/notes.md` (1 file)
- `package.json` (root): 2 new scripts + 1 `test:e2e:agent` chain update
- `memory-bank/{tasks.md, progress.md, techContext.md}` (3 files)
- `dist/editor/universo-artifact-manifest.json` (regenerated by `editor:build`, **not hand-edited**, but the regenerated file IS committed because the upstream-tag bump changes the manifest's `upstreamTag` / `upstreamCommit` / `upstreamPackageVersion` fields)

### Subtotal

- **Active-code metadata: 30 files** (cross-checked against the RESEARCH's file list).
- **Active-code test/docs: 12 files** (9 Skills + 2 docs + 1 manifest copy).
- **New governance: 4 files** (2 tools + .prettierignore + 1 screenshot).
- **Memory Bank: 3 files** (records, not guards).
- **Vendor tree: 1 wholesale replacement** (the snapshot itself).
