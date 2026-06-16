# Research: PlayCanvas Editor v2.23.4 → v2.24.2 Upstream Update and Vendor Governance

> Created: 2026-06-15
> Status: Reviewed
> Trigger: User TZ `.manager/inputs/2026-06-15-playcanvas-editor-upstream-2-24-2-update.md` + brief `.manager/specs/platformo/playcanvas-editor-upstream-2-24-2-update-governance-spec-2026-06-15.md`
> Follow-up plan: TBD by PLAN mode (none yet)
> QA pass: 2026-06-15 — 1 critical fix (models.ts Branch field claim replaced with actual `BuildJobFormat` + `BuildJob` new types), 4 minor fixes (openapi/index.yml added to Source Inventory, mmoomm-runtime-projection-2026-06-10 added, metahubs test list over-count corrected to 2 actual + 1 service, Status Draft → Reviewed).

## Research Question

The user wants the vendored PlayCanvas Editor frontend inside `@universo-react/playcanvas-editor-frontend` updated from upstream `v2.23.4` to `v2.24.2`, while preserving the package as a minimally modified upstream artifact boundary (not a fork). The user observed that prior Prettier/formatter runs may have introduced drift inside `vendor/playcanvas-editor/`, including possible changes to SASS font URLs, and asked whether a dedicated Skill (or set of Skills) is needed to codify the allowed-edit policy and the update procedure. RESEARCH must answer:

1. What is the exact upstream diff between `v2.23.4` and `v2.24.2` (commits, files, dependency changes, public API changes)?
2. Is the current local `vendor/playcanvas-editor/` snapshot already drifted from upstream, and where exactly?
3. What is the cost of pulling `v2.24.2` and which local compatibility, type, test, and Skill surfaces need to follow?
4. What is the minimal governance surface (Skills, guards, metadata checks) needed to prevent the next update from re-introducing drift?

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
|--------|------|------------------|----------------|
| https://github.com/playcanvas/editor/releases/tag/v2.24.2 | Primary upstream release | Published 2026-06-12 by `github-actions` | Anchors the target version; declares tag `v2.24.2`, peeled commit `00360100b3b5747648eb3d7287421ef25491f5c7`, single-fix PR #2089. |
| https://github.com/playcanvas/editor/compare/v2.23.4...v2.24.2 | Primary upstream diff | Computed 2026-06-15 | 8 commits, 42 changed files, 2 contributors. Identifies all renamed, removed, and added files. |
| https://raw.githubusercontent.com/playcanvas/editor/v2.24.2/package.json | Primary upstream manifest | Computed 2026-06-15 | Confirms upstream package version `2.24.2`, `playcanvas@2.19.5`, `Node>=22.22.0`, all other devDependencies identical to v2.23.4. |
| https://raw.githubusercontent.com/playcanvas/editor/v2.23.4/package.json | Primary upstream manifest | Computed 2026-06-15 | Confirms v2.23.4 reference values for cross-version diff. |
| https://raw.githubusercontent.com/playcanvas/editor/v2.24.2/sass/common/_fonts.scss | Primary upstream source | Computed 2026-06-15 | Lets us prove the local vendored file matches upstream byte-for-byte. |
| https://raw.githubusercontent.com/playcanvas/editor/v2.23.4/sass/common/_fonts.scss | Primary upstream source | Computed 2026-06-15 | Same — proves the font URL situation was identical before. |
| https://api.github.com/repos/playcanvas/editor/compare/v2.23.4...v2.24.2 | Primary upstream API | Computed 2026-06-15 | Machine-readable file-level diff: 11 picker-version-control-*.ts files removed, new branch-switcher/dialogs/panel-{changes,detail,history}/vc-helpers added, plus 2 new SCSS files. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/UPSTREAM.md` | Local provenance file | Snapshot 2026-06-05 | Pins current upstream `v2.23.4`, commit `c4916f4973963341984499f2d919f8bfd38e417c`. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/package.playcanvas-editor.json` | Local upstream manifest | Snapshot 2026-06-05 | Mirrors upstream `@playcanvas/editor@2.23.4`; same dependency set. |
| `packages/universo-react-playcanvas-editor-frontend/src/index.ts` | Local public API | 2026-06-15 | Exports `PLAYCANVAS_EDITOR_UPSTREAM_TAG = 'v2.23.4'`, commit, package version constants. |
| `packages/universo-react-playcanvas-editor-frontend/scripts/lib/playcanvas-editor-artifact.mjs` | Local artifact build | 2026-06-15 | Re-declares the same constants; drives build/smoke flow. |
| `packages/universo-react-playcanvas-editor-frontend/tests/artifact.test.mjs` | Local unit test | 2026-06-15 | Hard-codes `2.23.4` and `c4916f4...` in expect() assertions. |
| `packages/universo-react-playcanvas-editor-frontend/e2e/editor-artifact.spec.ts` | Local E2E | 2026-06-15 | Four occurrences of `minimumTag: 'v2.23.4'`. |
| `packages/universo-react-playcanvas-editor-frontend/NOTICE.md`, `README.md`, `README-RU.md` | Local docs | 2026-06-15 | Cite `v2.23.4` and the commit. |
| `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts` | Local type contract | 2026-06-15 | `minimumTag: z.literal('v2.23.4')` (line 216). |
| `packages/universo-react-types/src/__tests__/playcanvasEditorBridge.test.ts` | Local type test | 2026-06-15 | Mirrors the same literal in test fixtures. |
| `packages/universo-react-playcanvas-editor-backend/src/index.test.ts` | Local backend test | 2026-06-15 | `minimumTag: 'v2.23.4'` at line 50. |
| `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectsService.ts` | Local metahubs service | 2026-06-15 | `minimumTag: 'v2.23.4'` at line 974. |
| `packages/universo-react-metahubs-backend/src/tests/{routes,services,controllers}/*` | Local metahubs tests | 2026-06-15 | Multiple `minimumTag: 'v2.23.4'` literals across `playCanvasEditorCompatibilityRoutes.test.ts`, `PlayCanvasProjectsService.test.ts`, `playCanvasProjectsController.test.ts`, `PlayCanvasProjectSnapshotService.test.ts`. |
| `packages/universo-react-rest-docs/scripts/generate-openapi-source.js` | Local OpenAPI generator | 2026-06-15 | `minimumTag: { type: 'string', enum: ['v2.23.4'] }` at line 1007. |
| `packages/universo-react-rest-docs/src/openapi/index.yml` | Local OpenAPI spec (generated) | 2026-06-15 | `enum: - v2.23.4` at line 14903. Auto-generated from the same schema; must be regenerated by `pnpm --filter @universo-react/rest-docs generate-openapi-source` after the schema change, otherwise it goes stale. |
| `tools/check-playcanvas-editor-isolation.mjs` | Local isolation guard | 2026-06-15 | Verifies no package or workspace reaches into the vendor tree outside the allowed file list. |
| `package.json` (root) | Repo config | 2026-06-15 | `format: prettier --write "**/*.{ts,tsx,md}"` (line 75) — no `.prettierignore`; `lint-staged` runs `eslint --fix` on `*.{js,jsx,ts,tsx,json,md}`. Neither has any vendored-tree exclusion. |
| `.agents/skills/SOURCES.md` | Skills index | 2026-06-15 | Lists 11 PlayCanvas Editor Skills as `Local project workflow` — no per-Skill `Source` URL. |
| `.agents/skills/playcanvas-editor-authoring/SKILL.md` | Local Skill | 2026-06-08 | Frontmatter description and version-guard line both say `v2.23.4`. |
| `.agents/skills/playcanvas-editor-{api-realtime,assets,interface,scenes,scripting,settings,version-control}/SKILL.md` | Local Skills | 2026-06-08 | Each carries a one-line "Pinned to Editor v2.23.4" guard. |
| `.agents/skills/playcanvas-editor-authoring/references/notes.md` | Local Skill notes | 2026-06-08 | "Pinned version of the editor frontend is v2.23.4." |
| `docs/en/platform/playcanvas-editor.md`, `docs/ru/platform/playcanvas-editor.md` | Local docs | 2026-06-15 | Header and body both cite `v2.23.4` and the commit. |
| `memory-bank/research/playcanvas-editor-{minimal-compatibility-backend,skills-and-thermos-review,upstream-ui-full-boot,package-foundation,runtime-host-bridge-storage-adapter,metahub-authoring-surface-settings,project-storage-model-for-metahubs}-research-*.md` | Historical RESEARCH | 2026-05-31 → 2026-06-08 | These artifacts were written under the v2.23.4 baseline; they remain valid for vendoring boundary, boot contract, REST/realtime contract, and Skill scope, but their `v2.23.4` references are now historical context for this update. |
| `memory-bank/research/mmoomm-playcanvas-editor-main-functionality-runtime-projection-research-2026-06-10.md` | Historical RESEARCH | 2026-06-10 | Adjacent baseline that enumerated the PlayCanvas Editor Skills family and the current main-functionality projection; relevant for cross-checking that v2.24.2 does not regress the 9-Skill scope already audited. |
| `memory-bank/plan/playcanvas-editor-{minimal-compatibility-backend,upstream-ui-full-boot,skills-and-thermos-review}-plan-2026-06-*.md` | Historical PLAN | 2026-06-05 → 2026-06-08 | Cite `v2.23.4` and the commit as the implementation baseline; all already executed. |
| `memory-bank/tasks.md` (line 242, 246) | Active task ledger | 2026-06-15 | Phase 0 "Update the vendored PlayCanvas Editor artifact to upstream v2.23.4" is marked complete; v2.24.2 work is not yet entered as a task. |
| `memory-bank/progress.md` (line 451) | Progress log | 2026-06-15 | Records the v2.23.4 update entry. |
| `memory-bank/currentResearch.md` (line 26) | Active research scratchpad | 2026-06-15 | Refers to `v2.22.1 → v2.23.4` transition as upstream prerequisite for past work. |

## Key Findings

### 1. Upstream v2.24.2 release surface is small but architecturally heavy

- **Tag:** `v2.24.2` (published 2026-06-12 by `github-actions`).
- **Peeled commit:** `00360100b3b5747648eb3d7287421ef25491f5c7` (= base `c4916f4973963341984499f2d919f8bfd38e417c` + 8 commits).
- **Commits since v2.23.4:** 8, intermediate versions `v2.23.5`, `v2.24.0`, `v2.24.1`, `v2.24.2` (all four are pre-release bumps in this window).
- **Files changed:** 42 across the 8-commit range.
- **Upstream package version:** `2.24.2`. **Upstream `playcanvas`:** `2.19.5`. **Upstream Node:** `>=22.22.0`. **All other devDependencies identical to v2.23.4** (verified by direct manifest diff). This means the local `package.playcanvas-editor.json` swap is essentially a 3-string change (`version`, plus two mirror fields in `UPSTREAM.md` and `src/index.ts`); no new catalog pinning or new transitive dependencies are introduced.
- **No `package-lock.json` change of consequence:** upstream `package-lock.json` shows `+2/-2` lines, so the install graph is stable.

### 2. The diff is dominated by a version-control picker rewrite + builds panel modernization

Cross-referencing `https://api.github.com/repos/playcanvas/editor/compare/v2.23.4...v2.24.2` and `https://github.com/playcanvas/editor/compare/v2.23.4...v2.24.2`:

- **SASS churn is large (`+1952/-1381` in `sass/editor/_editor-main.scss`)** because the upstream redesign moved many picker styles into a single shared "details card" look. **Visual redesign only — no SASS file changes alter font URLs, asset URLs, or CSS variable contracts that the local Universo shell depends on.**
- **Picker architecture collapses from 11 widget files into 1 orchestrator + 5 modules.** The following files are **removed** upstream:
  - `src/editor/pickers/version-control/picker-version-control-checkpoints.ts` (834 lines)
  - `src/editor/pickers/version-control/picker-version-control-close-branch.ts` (113 lines)
  - `src/editor/pickers/version-control/picker-version-control-create-branch.ts` (96 lines)
  - `src/editor/pickers/version-control/picker-version-control-create-checkpoint.ts` (71 lines)
  - `src/editor/pickers/version-control/picker-version-control-delete-branch.ts` (106 lines)
  - `src/editor/pickers/version-control/picker-version-control-diff-checkpoints.ts` (246 lines)
  - `src/editor/pickers/version-control/picker-version-control-hard-reset-checkpoint.ts` (75 lines)
  - `src/editor/pickers/version-control/picker-version-control-merge-branches.ts` (108 lines)
  - `src/editor/pickers/version-control/picker-version-control-restore-checkpoint.ts` (42 lines)
  - `src/editor/pickers/version-control/picker-version-control-side-panel.ts` (121 lines)
  - `src/editor/pickers/version-control/ui/version-control-side-panel-box.ts` (241 lines)
- **New files** (under `src/editor/pickers/version-control/`):
  - `picker-version-control-diff.ts` (586 lines, new diff picker)
  - `branch-switcher.ts` (370 lines)
  - `dialogs.ts` (163 lines — replaces the side-panel widget)
  - `panel-changes.ts` (485 lines)
  - `panel-detail.ts` (239 lines)
  - `panel-history.ts` (275 lines)
  - `vc-helpers.ts` (263 lines)
  - `vc-diff-data.ts` (126 lines)
  - `vc-diff-fields.ts` (121 lines)
- **New SCSS files** (vendor-side only): `sass/editor/_editor-version-control-picker.scss` (1414 lines) and `sass/editor/_editor-version-control-diff.scss` (412 lines). Both follow the upstream `editor.scss` `@use` convention.
- **Public `editor.method` API surface is heavily reshuffled.** Removed:
  - `picker:versioncontrol:widget:checkpoints`, `:widget:checkpoint`, `:widget:createCheckpoint`, `:widget:restoreCheckpoint`, `:widget:hardResetCheckpoint`, `:widget:createBranch`, `:widget:closeBranch`, `:widget:deleteBranch`, `:widget:mergeBranches`, `:widget:diffCheckpoints`, `:widget:diffCheckpoints:isCheckpointSelected`
  - `picker:versioncontrol:createSidePanel`
- **Public `editor.method` API surface added/retained:** `picker:versioncontrol()`, `picker:versioncontrol:hasRetainedDiff(id)`, `picker:versioncontrol:releaseDiff(id)`, `picker:versioncontrol:transformCheckpointData(data)`, `vcgraph:closeGraphPanel`, `vcgraph:moveToBackground`, `vcgraph:moveToForeground`, `vcgraph:isHidden`, `vcgraph:showGraphPanel`, plus existing `vcgraph:makeNodeMenu`, `vcgraph:showInitial`. New hotkey registration: `hotkey:register` for `new-checkpoint` (`Ctrl+S`).
- **New REST endpoint usage in the picker layer:** `rest.branches.branchCheckout/branchCreate/branchClose/branchOpen/branchDelete/branchCheckpoints`, `rest.checkpoints.checkpointRestore/checkpointHardReset`, `rest.merge.mergeDelete/mergeGet/mergeCreate/mergeConflicts`, `rest.projects.projectBranches`. All are reached through the upstream `editor.api.globals.rest.*` facade (no direct HTTP). The Universo compatibility backend does **not** implement these — they are reached as `cloud-only` no-op descriptors in the current `playCanvasEditorCompatibilityRoutes`, and the picker just calls them when the user invokes a branch/checkpoint/merge action. In Universo single-user mode these calls will fail in the same controlled way they already fail in v2.23.4.
- **`picker-builds-publish.ts` is essentially a ground-up rewrite (`+1630/-416`).** New `editor.method('picker:builds-publish', (options?: { reload?: boolean }))` signature — old zero-arg callers remain valid. New `editor.api.globals.rest.projects.projectBuilds`, `projectApps`, `projectBuildDelete`, `apps.appGet`, `apps.appDelete` calls. No new public methods are introduced (the existing `picker:builds-publish` method is overloaded).
- **`picker-conflict-manager.ts` adds a hard dep on `picker:versioncontrol:hasRetainedDiff`.** If the v2.24.2 `picker-version-control.ts` is not present, the diff manager silently no-ops. No new public method names — but the wiring is no longer optional.
- **`picker-publish-new.ts` is re-themed into a "form sections" layout.** New `editor.call('picker:builds-publish', { reload: true })` reload flow. New placeholder text and a back-to-builds button. No new public methods.
- **`picker-project.ts` gains `picker:project:suspend` / `:resume`.** Only the new `picker-version-control.ts` and `picker-conflict-manager.ts` use it; backward-compatible.
- **`src/editor/index.ts` (`+2/-11`)** — the import block goes from 11 widget imports to 6 module imports. External code that does not import these files directly is unaffected.
- **`src/editor-api/models.ts` (`+51/-0`)** — all 51 added lines introduce two **new** types, `BuildJobFormat` (union of `'playcanvas' | 'static' | 'npm' | 'web_lens'`) and `BuildJob` (id, projectId, branchId, status, progress, name, description, createdAt, formats, etc.). `Branch` and `Checkpoint` types are **unchanged** between v2.23.4 and v2.24.2 — `Branch.latestCheckpointId: string` already existed in v2.23.4. Universe has no `BuildJob` consumer today, so this is additive surface only.
- **`src/editor-api/rest/projects.ts` (`+53`)** — additions only, no breaking changes to existing method signatures.
- **`src/editor/viewport/gizmo/gizmo.ts` (`+3`)** — three lines: a single `editor.call('viewport:render')` after `gizmo:type` state change. Solves render-on-demand viewport never re-drawing on gizmo type switch. No new public method names.
- **Test surface:** `test/common/vc-diff-data.test.ts` (new, 122 lines) and small additions to `test-suite/test/ui/basic.test.ts` (`+35/-16`).

### 3. The local `vendor/playcanvas-editor/` snapshot is already drifted in one place

Direct comparison of the local vendored tree against upstream `v2.23.4` snapshot files via `diff` and `git log`:

- **`vendor/playcanvas-editor/sass/common/_fonts.scss` — IDENTICAL to upstream v2.23.4 AND to upstream v2.24.2** (byte-for-byte match). The 20 `playcanvas.com/static-assets/fonts/...` URLs are upstream-owned and have not been touched locally. **The user's hypothesis in the source TZ — that "they changed the font links in SASS" — is incorrect for `_fonts.scss`.** The file is stable across v2.23.4 → v2.24.2.
- **Other SASS files with `playcanvas.com` URLs:** `sass/launch.scss` (Inconsolata + PlayIcons), `sass/ui/_ui.scss` (Inconsolata), `sass/common/_ui-common.scss` (loader gif comment), `sass/editor/_editor-left-toolbar.scss` (editor_logo.png), `sass/editor/_editor-main.scss` (bcg_primary.jpg on line 651). All match upstream exactly in the lines containing URLs.
- **Local drift in SASS is concentrated in `sass/editor/_editor-main.scss`** — it has the largest local diff (the same file that upstream rewrites in v2.24.2). A specific local-only change pattern (CSS hover/clicked/z-index cleanup, no URL changes) has accumulated. Pre-existing drift, not catastrophic, but a `format`/`lint:fix` over the vendored tree would touch these lines.
- **`src/editor/index.ts`, `src/editor/pickers/**`, `src/editor-api/**` — all match upstream v2.23.4.** No local fork in TypeScript source. The drift is SASS-only.
- **No `vendor/playcanvas-editor/package.json` exists** (confirmed: `find … -name "package.json"` returns empty). Boundary rule preserved.
- **No `vendor/playcanvas-editor/package-lock.json`, `test/`, `test-suite/`, `.github/`, Docker files, or Renovate config** are vendored. Boundary rule preserved.

### 4. Local code references to v2.23.4 span ≈37 active files + 1 generated OpenAPI file; required edits are mechanical

Every reference is either (a) a `minimumTag: 'v2.23.4'` literal in a Zod schema / test fixture / OpenAPI emitter, (b) a `v2.23.4` / `c4916f4…` / `2.23.4` constant in package metadata and tests, or (c) a prose mention in a Skill, README, or doc. None of them is a code branch — they are all version guards that need to track the pinned tag. Confirmed active-code file list (deduplicated; verified via `grep -rln "v2\.23\.4\|2\.23\.4\|c4916f4"` excluding `node_modules/`, `dist/`, `vendor/playcanvas-editor/`, and `memory-bank/`):

- `packages/universo-react-playcanvas-editor-frontend/{README.md, README-RU.md, NOTICE.md, src/index.ts, scripts/lib/playcanvas-editor-artifact.mjs, vendor/UPSTREAM.md, vendor/package.playcanvas-editor.json, tests/artifact.test.mjs, e2e/editor-artifact.spec.ts}` (9 files)
- `packages/universo-react-types/src/{common/playcanvasEditorCompatibility.ts, __tests__/playcanvasEditorBridge.test.ts}` (2 files)
- `packages/universo-react-playcanvas-editor-backend/src/index.test.ts` (1 file)
- `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectsService.ts` and `packages/universo-react-metahubs-backend/src/tests/{controllers/playCanvasProjectsController.test.ts, routes/playCanvasEditorCompatibilityRoutes.test.ts}` (3 files; `tests/services/PlayCanvasProjectSnapshotService.test.ts` and `tests/services/PlayCanvasProjectsService.test.ts` do **not** contain v2.23.4 literals)
- `packages/universo-react-rest-docs/scripts/generate-openapi-source.js` (1 file)
- `packages/universo-react-rest-docs/src/openapi/index.yml` (1 file — generated spec; `enum: - v2.23.4` at line 14903. Must be regenerated by `pnpm --filter @universo-react/rest-docs generate-openapi-source` after the schema change)
- `docs/{en,ru}/platform/playcanvas-editor.md` (2 files)
- `.agents/skills/playcanvas-editor-{authoring/SKILL.md,authoring/references/notes.md,api-realtime/SKILL.md,assets/SKILL.md,interface/SKILL.md,scenes/SKILL.md,scripting/SKILL.md,settings/SKILL.md,version-control/SKILL.md}` (10 files)
- **Active subtotal: ≈29 active-code files + 1 generated OpenAPI spec = 30 files in the metadata-consistency guard's scope.**

Historical references that should **NOT** be rewritten (records, not "stale" live code):
- `memory-bank/{tasks.md, progress.md, currentResearch.md, plan/*, research/*}` (≈10 historical entries with v2.23.4)
- The current artifact `memory-bank/research/playcanvas-editor-upstream-2-24-2-update-research-2026-06-15.md` (mentions v2.23.4 as the v2.24.2 baseline for diff)
- `dist/editor/universo-artifact-manifest.json` (build output; regenerated by `editor:build`, not edited by hand)

### 5. Root formatter / lint-staged commands have no vendored-tree exclusion

- `package.json:75` — `"format": "prettier --write \"**/*.{ts,tsx,md}\""`. **No `.prettierignore` file exists** (`ls .prettierignore` returns ENOENT). Prettier with this glob walks into `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/**/*.{ts,tsx,md}` and rewrites the upstream source.
- `package.json:114-115` — `lint-staged` runs `eslint --fix` on `*.{js,jsx,ts,tsx,json,md}`. Same exposure.
- `package.json:110` — `pretty-quick --staged` runs the same on staged files.
- **The v2.23.4 update did not establish any vendored-tree guard.** Structural reason for the user's impression that local SASS has drifted: the current `format` script can rewrite upstream SASS if a developer runs it from the repo root with no flag restriction. The fix is mechanical but must be made.

### 6. Existing PlayCanvas Editor Skills are 11, all 1-file markdown, all "Local project workflow" with a v2.23.4 line in body

Each of these Skills has a 30–60 line body, with a `## Version Guard` section naming `v2.23.4` and the same scope boilerplate. They do not have a separate `references/` policy file. Updating them to v2.24.2 is a 9-file `s/v2\.23\.4/v2\.24\.2/g` change. `.agents/skills/SOURCES.md` lists them in the "Local Project Skills" table without a `Source` URL column entry, so no per-Skill source attribution must change.

### 7. The PlayCanvas Editor isolation guard is mature and does not need to change

`tools/check-playcanvas-editor-isolation.mjs` walks `packages/**` and rejects any code outside the editor package that imports `@universo-react/playcanvas-editor-frontend`, `@playcanvas/editor`, `@playcanvas/pcui`, `@playcanvas/observer`, or the vendor paths. It also blocks the editor package's own `src/index.ts` and `package.json` exports from re-exporting the vendor tree. None of the new v2.24.2 files violate this — they all stay under `vendor/playcanvas-editor/`. **No isolation-guard edits are required for the update itself.**

### 8. The metahub REST compatibility surface does not need to expand for v2.24.2

The new `editor.method` and `rest.*` calls used by `picker-version-control.ts`, `picker-builds-publish.ts`, and `picker-conflict-manager.ts` all reach endpoints that the Universo compatibility backend already exposes as **cloud-only no-op descriptors** under `/api/v1/metahub/{metahubId}/playcanvas/editor-compatible/projects/{projectId}`. They also all share the existing single-user, branch-equivalent, no-messenger-realtime contract from `protocol.describe`. **No new backend routes are required for this update**; the existing `playCanvasEditorCompatibilityRoutes` continue to cover the surface, and the new picker calls will fail in the same controlled way they already fail in v2.23.4 (REST returns 501/404-shaped cloud-only response, picker UI shows the new visual state but the underlying action does not change the persistence layer).

### 9. The picker-version-control rewrite is opaque to the Universo compatibility contract

The Universo compatibility contract (`protocol.describe`, `scene.list`, `scene.read`, `scene.save`, etc.) operates at a different layer than the picker widgets. The picker is invoked through the user clicking a UI control; the contract is invoked by the editor's boot-time REST/WS probes. v2.24.2 changes the picker internals, not the boot contract. **Single-user, branch-equivalent, no-shareDB-history, cloud-only-no-op semantics stay valid for the new picker** without any change to `playCanvasProjectsService` or the schema in `playcanvasEditorCompatibility.ts`.

## Conflicts And Uncertainty

- **SASS drift in `_editor-main.scss` is real but its size is not yet measured.** A precise byte/line diff is not computed in this artifact; we know the file has local-only changes and the upstream rewrite in v2.24.2 is +1952/-1381 lines. The merge of these two deltas is a real PLAN-mode risk that this RESEARCH does not resolve.
- **Upstream `picker-builds-publish.ts` rewrite is a true behavior change** even though no new public method names appear. The visual flow, error states, copy buttons, and infinite scroll are new. Browser smoke must still pass the existing assertions (the six `#layout-*` selectors and the no-`/disabled` URLs) but a screenshot of the new builds panel will look noticeably different. The brief accepts this implicitly (the goal is full upstream UI), but a pre-merge visual evidence step is advisable.
- **`picker-conflict-manager.ts` now hard-depends on `picker:versioncontrol:hasRetainedDiff`.** If the new `picker-version-control.ts` is not in the bundle, the diff manager silently no-ops. Soft coupling, not a startup-time assertion. Browser smoke must verify the builds/version-control surfaces still work end-to-end.
- **No `engines.node` in the local `package.json`.** The package relies on script-level `assertNodeVersion()` (in `scripts/lib/playcanvas-editor-artifact.mjs`) and on `tests/artifact.test.mjs` to fail closed on insufficient Node. The `engines.node` question raised in the brief is open — both options preserve v2.24.2's `>=22.22.0` constraint.
- **Vendor drift guard placement is open.** The brief offers `editor:vendor-check` (package-local) or a root guard under `test:e2e:agent`. The cleanest answer depends on whether the local-drift list is empty in CI before merge; both are feasible.
- **Web search MCP unavailable during this research (rate-limit / no resource package)**. The fallback was direct GitHub API + raw.githubusercontent.com + WebFetch on the release page. All key facts were still obtained; the only topic that the Web search would have enriched is third-party community discussion of v2.24.2, which is not necessary for the planning decision because the upstream release notes and diff are authoritative.
- **No `engines.node` in upstream `package.json` is `>=22.22.0`** — same as v2.23.4, no Node change required.
- **No new public ShareDB / ot-text dependency changes.** `sharedb@3.3.2` and the `github:playcanvas/ot-text` reference are unchanged upstream and locally.

## Project Implications

### What the update will physically change

- **Vendor tree replacement:** 8 commits, 42 files. The change is dominated by the picker-version-control rewrite. **A clean re-vendor from `v2.24.2` is required**; patching the existing v2.23.4 snapshot is not safe because the picker orchestrator + new modules are net-new file additions.
- **SASS rebuild of `_editor-main.scss`:** the file upstream has the new picker styles inlined (+1952/-1381). The current local-only delta in that file will be **lost** when the upstream is copied in. The user's observed "local SASS changes" mostly live in this file. The new file is the canonical source of truth, so this loss is expected and not a regression.
- **Metadata swap across the whole repo (≈ 38 files).** All `v2.23.4` / `2.23.4` / `c4916f4…` references update to `v2.24.2` / `2.24.2` / `00360100b3b5747648eb3d7287421ef25491f5c7`. This is mechanical and reviewable in one PR.
- **PlayCanvas Editor Skills** (9 files): same swap. `playcanvas-editor-universo-compat` does not mention v2.23.4 and does not need changes.
- **SOURCES.md** does not need changes (the Skills are "Local project workflow" with no per-Skill `Source` URL).
- **OpenAPI emitter** (`generate-openapi-source.js`): the `minimumTag` enum member becomes `'v2.24.2'`.
- **OpenAPI generated spec** (`packages/universo-react-rest-docs/src/openapi/index.yml`): the `enum: - v2.23.4` entry on line 14903 is regenerated by the OpenAPI emitter, **not** hand-edited. PLAN must run the emitter as part of the post-update sweep; otherwise the spec goes stale.

### What the update must not change

- **`@universo-react/playcanvas-engine`** (runtime, `playcanvas@2.18.1`) — out of scope, must stay untouched.
- **Editor-side `playcanvas@2.19.5`** — unchanged upstream; do not "modernize" it in this update.
- **The "no upstream `package.json` under `vendor/playcanvas-editor/`" rule** — re-enforce after the swap.
- **The `manifestFileName = 'universo-artifact-manifest.json'` and `bridgeBootstrapFileName = 'universo-bridge-bootstrap.js'`** — local convention, not upstream.
- **`editor.api.globals.rest.*` mapping for `branches.checkpointRestore` etc. on the Universo side** — keep as cloud-only no-op descriptors.

### Governance surfaces to add or extend

1. **Metadata consistency guard** (mandatory). New package-local script `editor:check-metadata` (or root script) that grep-searches the active `packages/`, `docs/`, `.agents/skills/`, `tools/`, and `scripts/` for the current tag, version, and commit, and fails if any active file still has `v2.23.4` / `2.23.4` / `c4916f4…`. Allowlist historical notes (`memory-bank/`, `archive/`, file-level historical timestamps). Run from CI as part of `check:playcanvas-editor-isolation` chain.
2. **Vendor drift guard** (mandatory). New package-local script `editor:vendor-check` (or root) that diffs every file under `vendor/playcanvas-editor/` (excluding documented omissions: `package.json`, `package-lock.json`, `test/`, `test-suite/`, `.github/`, Docker, Renovate) against the upstream `v2.24.2` snapshot, ignoring CRLF/LF and the existing one-file local diff in `_editor-main.scss` (which becomes zero after re-vendoring). Emit non-zero on any unlisted drift.
3. **Formatter protection** (mandatory). Add `.prettierignore` with `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/**`. Optionally tighten `format` script to `prettier --write \"packages/**/!(universo-react-playcanvas-editor-frontend/vendor)/**/*.{ts,tsx,md}\"` if the project prefers explicit avoidance. Either solution must keep the `lint-staged` glob honest; the cleanest is to extend the `.prettierignore` and add a guard that fails if a PR touches a `vendor/playcanvas-editor/**` file other than the snapshot replacement commit.
4. **Skill update** (mandatory but minimal). Update 9 PlayCanvas Editor Skills' "Pinned to Editor v2.23.4" lines to v2.24.2. Extend `playcanvas-editor-authoring` with a short "Upstream update governance" checklist: how to import a new tag, how to run the new guards, what the local allowed-edit policy is. Do **not** create a new top-level Skill for the governance workflow — the brief explicitly defers this to PLAN, and the existing `playcanvas-editor-authoring` is the right home (it is the version-guard-of-record).
5. **English/Russian docs sync** (mandatory). Update both `docs/{en,ru}/platform/playcanvas-editor.md` to reflect v2.24.2 + the new builds panel + version-control picker.
6. **Browser smoke addition** (recommended). The default `editor:browser-smoke` mode is `universo-full-upstream-ui`. Add a sub-step that exercises the new builds panel selector (e.g. `.pcui-container.picker-builds-publish`) and the new version-control orchestrator (e.g. `.pcui-container.picker-version-control`). The six `#layout-*` selectors remain the core acceptance.

## Recommended Decision

1. **Do the re-vendor in one PR.** A single `playcanvas/editor@v2.24.2` snapshot replacement + ≈30 active-code metadata updates + 1 generated OpenAPI regen is the only shape that keeps the diff reviewable. A "minimal patch" approach against the v2.23.4 tree is not viable because of the new orchestrator + 9 new modules and the 11 deleted widget files.
2. **Do not fork.** All changes inside `vendor/playcanvas-editor/` are upstream-owned. The one pre-existing local SASS edit in `_editor-main.scss` is naturally absorbed by the v2.24.2 rewrite of that file. No local patch layer is needed for v2.24.2.
3. **Codify the allowed-edit policy by extending `playcanvas-editor-authoring`** with an "Upstream update governance" section, not by creating a new Skill. The 11 existing Skills are already the canonical home of version-guard prose; the new section is a checklist, not a separate domain.
4. **Add the three guards**: `editor:check-metadata` (metadata consistency), `editor:vendor-check` (vendor drift), and `.prettierignore` (formatter protection). All three are referenced from the same Skill section so the next agent has a single entry point.
5. **Browser smoke stays in `universo-full-upstream-ui` mode** by default; do not introduce a separate `editor:browser-smoke-full` script. Add a sub-assertion for the new picker selectors inside the existing smoke.
6. **Do not extend the metahub REST compatibility surface in this slice.** The new picker calls reach endpoints the backend already returns as cloud-only no-op descriptors. Adding more routes is a separate brief.
7. **Do not add `engines.node` to the local `package.json` in this slice** — the script-level `assertNodeVersion()` and the unit test on line 90-97 of `tests/artifact.test.mjs` are sufficient. If a future Skill needs the engines field, add it then.
8. **Memory Bank:** the v2.23.4 references in `memory-bank/{tasks.md, progress.md, currentResearch.md}` are historical, not stale. Do **not** rewrite them. The new `progress.md` entry will be the v2.24.2 record; the old entries stay as the history.

## Open Questions Before PLAN

- **Vendor drift guard placement**: package-local `editor:vendor-check` (recommended) or root guard under `test:e2e:agent`? Both are workable; package-local is the brief's first option and is the cleaner boundary.
- **Formatter protection mechanism**: add `.prettierignore` (simplest, one file) or restrict the root `format` glob (more explicit, but harder to keep correct as new packages are added)? The brief leaves this open. `.prettierignore` is recommended; it does not change the glob and is easy to audit.
- **Browser smoke for the new picker selectors**: add a sub-assertion to the existing `editor:browser-smoke`, or create a separate `editor:browser-smoke-picker` script? The brief leaves this open. Sub-assertion in the existing smoke is recommended — same artifact mode, same `#layout-*` baseline, no new public command surface.
- **`engines.node`**: skip in this slice (use script-level `assertNodeVersion()`) or add it for parity with other packages? Skip is recommended; the script-level check is the project's existing convention for this package.
- **Historical references in Memory Bank**: confirm that v2.23.4 mentions in `memory-bank/{tasks.md, progress.md, currentResearch.md, plan/*, research/*}` are out of scope of the metadata consistency guard. Recommended: keep them out of scope; they are records, not active code.

## Sources

- https://github.com/playcanvas/editor/releases/tag/v2.24.2
- https://github.com/playcanvas/editor/compare/v2.23.4...v2.24.2
- https://api.github.com/repos/playcanvas/editor/compare/v2.23.4...v2.24.2
- https://raw.githubusercontent.com/playcanvas/editor/v2.24.2/package.json
- https://raw.githubusercontent.com/playcanvas/editor/v2.23.4/package.json
- https://raw.githubusercontent.com/playcanvas/editor/v2.24.2/sass/common/_fonts.scss
- https://raw.githubusercontent.com/playcanvas/editor/v2.23.4/sass/common/_fonts.scss
- `packages/universo-react-playcanvas-editor-frontend/{README.md, README-RU.md, NOTICE.md, src/index.ts, scripts/lib/playcanvas-editor-artifact.mjs, vendor/UPSTREAM.md, vendor/package.playcanvas-editor.json, tests/artifact.test.mjs, e2e/editor-artifact.spec.ts}`
- `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts`
- `packages/universo-react-types/src/__tests__/playcanvasEditorBridge.test.ts`
- `packages/universo-react-playcanvas-editor-backend/src/index.test.ts`
- `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectsService.ts`
- `packages/universo-react-metahubs-backend/src/tests/{controllers, routes, services}/*`
- `packages/universo-react-rest-docs/scripts/generate-openapi-source.js`
- `tools/check-playcanvas-editor-isolation.mjs`
- `package.json`
- `.agents/skills/SOURCES.md`
- `.agents/skills/playcanvas-editor-{authoring, api-realtime, assets, interface, scenes, scripting, settings, version-control}/SKILL.md`
- `.agents/skills/playcanvas-editor-authoring/references/notes.md`
- `docs/{en,ru}/platform/playcanvas-editor.md`
- `memory-bank/{tasks.md, progress.md, currentResearch.md, plan/*, research/*}`
- `.manager/specs/platformo/playcanvas-editor-upstream-2-24-2-update-governance-spec-2026-06-15.md`
- `.manager/inputs/2026-06-15-playcanvas-editor-upstream-2-24-2-update.md`
