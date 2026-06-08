# Plan: PlayCanvas Editor Skills Family and Thermos Code Quality Review Integration

> Created: 2026-06-08
> Research: `memory-bank/research/playcanvas-editor-skills-and-thermos-review-research-2026-06-08.md`
> Brief: `.manager/specs/cross-project/playcanvas-editor-skills-and-thermos-review-spec-2026-06-08.md`

## Overview

Create a comprehensive family of 9 project-local Skills for PlayCanvas Editor and integrate the Thermos code quality review system into the project's agent infrastructure. This plan also includes backend decomposition of the 1908-line `playcanvas-editor-backend/src/index.ts`, creation of agent profiles with native copies across all agent runtimes, SOURCES.md attribution, AGENTS.md trigger registration, GitBook documentation, and a full testing strategy.

## Design Decisions

1. **All 9 Editor Skills in one pass** — Create all 9 Skills, not just Phase 1 skeletons. The research is complete and the content is well-defined from official docs. Skills are markdown-only, low-risk, and provide immediate value.
2. **Thermos as `autoreview` rubric integration** — Integrate Thermos as rubric families using the existing `autoreview --prompt-file` flag, pointing to the rubric definition files, rather than creating a separate review runner or patching the vendored `autoreview` script.
3. **Backend decomposition first** — The 1908-line `index.ts` must be decomposed into nested directories before Thermos reviewers would immediately flag it. This serves as both a code quality improvement and a proof-of-concept for the Thermos rubrics.
4. **Node version: `package.json` as hard source** — Skills document `>=22.22.0` from `package.json`, noting the README says Node 18+ but that is stale.
5. **MCP Server as reference only** — The PlayCanvas MCP Server is documented as a reference source and future integration candidate, not an immediate tool dependency.
6. **Native copies for all 6 agent runtimes** — Every new agent profile gets copies in `.codex/agents/`, `.gemini/agents/`, `.claude/agents/`, `.github/agents/`, `.qoder/agents/`, and `.kiro/steering/agent_profiles/`.

## Affected Areas

### New Files (Skills — 9 directories)

- `.agents/skills/playcanvas-editor-authoring/SKILL.md` + `references/`
- `.agents/skills/playcanvas-editor-interface/SKILL.md` + `references/`
- `.agents/skills/playcanvas-editor-assets/SKILL.md` + `references/`
- `.agents/skills/playcanvas-editor-scenes/SKILL.md` + `references/`
- `.agents/skills/playcanvas-editor-scripting/SKILL.md` + `references/`
- `.agents/skills/playcanvas-editor-settings/SKILL.md` + `references/`
- `.agents/skills/playcanvas-editor-version-control/SKILL.md` + `references/`
- `.agents/skills/playcanvas-editor-api-realtime/SKILL.md` + `references/`
- `.agents/skills/playcanvas-editor-universo-compat/SKILL.md` + `references/`

### New Files (Thermos Skills — 3 directories)

- `.agents/skills/thermos/SKILL.md` (orchestrator)
- `.agents/skills/thermo-nuclear-review/SKILL.md` (correctness/security)
- `.agents/skills/thermo-nuclear-code-quality-review/SKILL.md` (maintainability)

### New Files (Agent Profiles — 4 shared + 24 native copies)

- `.agents/agent-profiles/playcanvas-editor-reviewer.md`
- `.agents/agent-profiles/thermo-nuclear-review.md`
- `.agents/agent-profiles/thermo-nuclear-code-quality-review.md`
- `.agents/agent-profiles/thermos-orchestrator.md`
- Native copies in 6 directories × 4 profiles = 24 files

### Modified Files

- `.agents/skills/SOURCES.md` — new attribution records
- `AGENTS.md` — new trigger section for Editor packages
- `packages/universo-react-playcanvas-editor-backend/src/` — decomposition of `index.ts`
- `packages/universo-react-playcanvas-editor-backend/package.json` — if new entry points needed
- `docs/en/platform/playcanvas-editor-skills.md` — new GitBook page
- `docs/en/platform/thermos-review.md` — new GitBook page
- `docs/en/SUMMARY.md` — add new pages
- `docs/ru/platform/playcanvas-editor-skills.md` — Russian mirror
- `docs/ru/platform/thermos-review.md` — Russian mirror
- `memory-bank/progress.md` — closure notes
- `memory-bank/techContext.md` — agent infrastructure updates

### Testing

- Vitest: Skills markdown lint/structure validation
- Vitest: Backend decomposition unit tests
- Vitest: `autoreview` rubric integration tests
- Playwright: Smoke test that Editor still boots after backend decomposition
- Script: `pnpm check:agent-profiles` (new or extended drift checker)

---

## Plan Steps

### Phase 1: Backend Decomposition (prerequisite for Thermos)

The current `packages/universo-react-playcanvas-editor-backend/src/index.ts` (1908 lines) needs decomposition into focused modules before creating Thermos reviewers that would immediately flag it.

- [ ] **Step 1.1**: Analyze `index.ts` and create a decomposition map

  Categorize the 1908-line file into logical domains using a nested directory structure:
  - `src/config/` — config builders, mode descriptors, token claims
  - `src/routes/` — REST route factories (scenes, assets, settings, config)
  - `src/realtime/` — ShareDB runtime, WebSocket handlers, messenger, relay
  - `src/tokens/` — compatibility token service, validation, signing
  - `src/middleware/` — origin handling, auth middleware, CORS
  - `src/types/` — existing types directory (keep as-is)
  - `src/index.ts` — thin barrel re-export (~50-100 lines)

  ```typescript
  // Example: src/index.ts after decomposition (thin barrel)
  export { createPlayCanvasEditorRoutes } from './routes/index.js';
  export { createRealtimeRuntime } from './realtime/index.js';
  export { createCompatibilityTokenService } from './tokens/index.js';
  export type { PlayCanvasEditorBackendConfig } from './config/index.js';
  // ... ~20-30 exports total
  ```

- [ ] **Step 1.2**: Extract route factories into `src/routes/`

  ```typescript
  // src/routes/scenes.ts — example structure
  import { Router } from 'express';
  import { z } from 'zod';
  import type { DbExecutor } from '@universo-react/utils';

  const SceneSaveBody = z.object({
    name: z.string().min(1).max(256),
    data: z.record(z.unknown()),
    revision: z.number().int().nonnegative(),
  });

  export function createSceneRoutes(deps: SceneRouteDeps): Router {
    const router = Router();
    // ... focused route handlers
    return router;
  }
  ```

- [ ] **Step 1.3**: Extract realtime runtime into `src/realtime/`

  ```typescript
  // src/realtime/sharedb-runtime.ts
  import ShareDB from 'sharedb';
  import type { WebSocket } from 'ws';

  export interface ShareDBRuntimeConfig {
    collections: readonly string[];
    maxPendingOps: number;
    authTimeout: number;
  }

  export function createShareDBRuntime(config: ShareDBRuntimeConfig) {
    // ... focused ShareDB setup
  }
  ```

- [ ] **Step 1.4**: Extract token service into `src/tokens/`

- [ ] **Step 1.5**: Update `package.json` exports if dual-entry is needed

- [ ] **Step 1.6**: Run existing tests — all must pass without changes

  ```bash
  pnpm --filter @universo-react/playcanvas-editor-backend test
  ```

- [ ] **Step 1.7**: Run build to verify no import resolution issues

  ```bash
  pnpm --filter @universo-react/playcanvas-editor-backend build
  ```

- [ ] **Step 1.8**: Run Playwright smoke to verify Editor still boots

  ```bash
  pnpm supabase:e2e:start:minimal
  npx playwright test --grep "playcanvas-editor" --project=chromium
  ```

---

### Phase 2: PlayCanvas Editor Skills (9 Skills)

Each Skill follows the established pattern from `playcanvas-engine-runtime`:
- YAML front-matter: `name`, `description`, `metadata` (version, scope, file_policy)
- Sections: Version Guard, Required Output, Workflow, Blocking Rules, References
- Each Skill has a `references/` directory with notes extracted from official docs

- [ ] **Step 2.1**: Create `playcanvas-editor-authoring` Skill

  The routing/version guard Skill — highest priority, prevents Engine/Editor confusion.

  ```markdown
  ---
  name: playcanvas-editor-authoring
  description: >-
    Use when planning, implementing, or reviewing work that touches PlayCanvas
    Editor authoring, the Editor/Engine boundary, vendored upstream artifacts,
    Editor boot contract, or Editor package routing. Applies to
    @universo-react/playcanvas-editor-frontend vendoring playcanvas/editor
    v2.23.4 with playcanvas@2.19.5; does NOT cover playcanvas-engine-runtime
    (playcanvas@2.18.1) or PlayCanvas Cloud parity.
  metadata:
    version: '1.0.0'
    scope: 'playcanvas-editor-authoring'
    file_policy: 'markdown-only'
  ---

  # PlayCanvas Editor Authoring

  ## Version Guard
  - Upstream Editor: `v2.23.4` (vendored at `vendor/playcanvas-editor/`)
  - Editor Engine: `playcanvas@2.19.5` (dev dependency of upstream)
  - Runtime Engine: `playcanvas@2.18.1` (separate, via `@universo-react/playcanvas-engine`)
  - Node requirement: `>=22.22.0` (from upstream `package.json`, not README)
  - Do NOT mix Editor and Engine Skills. They are separate version-guarded stacks.
  ```

- [ ] **Step 2.2**: Create `playcanvas-editor-interface` Skill

  Covers Editor UI panels, layout, toolbar, hierarchy, inspector, assets panel.

- [ ] **Step 2.3**: Create `playcanvas-editor-assets` Skill

  Asset import pipeline, texture conversion, model import, audio, materials.

- [ ] **Step 2.4**: Create `playcanvas-editor-scenes` Skill

  Scene graph, components, templates, prefabs, entity hierarchy, ECS model.

- [ ] **Step 2.5**: Create `playcanvas-editor-scripting` Skill

  Script attributes, code editor (Monaco), ESM scripts, hot reload, VS Code extension.

- [ ] **Step 2.6**: Create `playcanvas-editor-settings` Skill

  Project settings, rendering, physics, audio, publishing, builds, launch page.

- [ ] **Step 2.7**: Create `playcanvas-editor-version-control` Skill

  Version control system, checkpoints, branches, merge, conflict resolution.

- [ ] **Step 2.8**: Create `playcanvas-editor-api-realtime` Skill

  Editor API (programmatic entity/asset/scene manipulation), realtime collaboration (ShareDB), document collections, OT model. Critical Universo details: current backend is single-user snapshot-only, NOT full OT collaboration.

- [ ] **Step 2.9**: Create `playcanvas-editor-universo-compat` Skill

  The most Universo-specific Skill: vendored upstream architecture, artifact boundary, `window.config` injection, bridge contract, compatibility backend surface, metahub-scoped storage, security boundary (iframe isolation, same-origin sandbox). Must reference existing docs at `docs/en/platform/playcanvas-editor.md`.

  ```markdown
  ## Blocking Rules
  - Do not import upstream Editor internals into MUI host code.
  - Do not assume PlayCanvas Cloud REST/WS parity.
  - Do not claim multi-user realtime collaboration is implemented.
  - Do not expose authoring storage paths in runtime manifests.
  - Do not let the artifact iframe access host page DOM.
  - Do not issue compatibility tokens without origin binding.
  ```

- [ ] **Step 2.10**: Create `references/` files for each Skill

  Extract key facts from official PlayCanvas docs into focused reference files.

---

### Phase 3: Thermos Skills and Agent Profiles

- [ ] **Step 3.1**: Create `thermo-nuclear-review` Skill (correctness/security)

  ```markdown
  ---
  name: thermo-nuclear-review
  description: >-
    Use for deep correctness and security review of code changes. Covers
    bugs, security vulnerabilities, breaking changes, feature-flag leaks,
    race conditions, and data exposure. Designed to run as an autoreview
    rubric via --prompt-file.
  metadata:
    version: '1.0.0'
    scope: 'thermos-correctness-security'
    file_policy: 'markdown-only'
  ---

  # Thermo-Nuclear Review (Correctness & Security)

  ## Rubric Categories
  1. **Critical Bugs** — logic errors, null derefs, off-by-one, race conditions
  2. **Security** — injection, auth bypass, token leaks, CSRF gaps, XSS
  3. **Breaking Changes** — API contract violations, schema drift, migration gaps
  4. **Data Safety** — PII exposure, log leakage, unvalidated input persistence
  5. **Concurrency** — deadlocks, lost updates, stale reads, double-processing
  6. **UUIDs** — ensure UUID v7 is used for all new entity identifiers instead of v4.

  ## Scoring
  - CRITICAL: must fix before merge
  - HIGH: should fix before merge
  - MEDIUM: fix in follow-up PR
  - LOW: advisory improvement
  - FALSE_POSITIVE: explain why finding is incorrect

  ## Integration
  Run via autoreview: `autoreview --prompt-file .agents/skills/autoreview/rubrics/thermos-correctness.md`
  ```

- [ ] **Step 3.2**: Create `thermo-nuclear-code-quality-review` Skill (maintainability)

  ```markdown
  ## Rubric Categories
  1. **File Size** — files >1000 lines need decomposition plan
  2. **Abstraction Quality** — god objects, deep inheritance, implicit coupling
  3. **Code Judo** — opportunities to restructure for simplicity/elegance
  4. **Naming** — misleading names, abbreviations, inconsistent conventions
  5. **Test Coverage** — untested critical paths, missing edge cases
  6. **Documentation** — missing/stale JSDoc, README gaps, undocumented APIs

  ## Integration
  Run via autoreview: `autoreview --prompt-file .agents/skills/autoreview/rubrics/thermos-maintainability.md`
  ```

- [ ] **Step 3.3**: Create `thermos` orchestrator Skill

  Instructions for running both rubrics together and synthesizing findings:
  ```bash
  autoreview --prompt-file .agents/skills/autoreview/rubrics/thermos-correctness.md --prompt-file .agents/skills/autoreview/rubrics/thermos-maintainability.md
  # or using the combined shorthand:
  autoreview --prompt-file .agents/skills/autoreview/rubrics/thermos.md
  ```

- [ ] **Step 3.4**: Create agent profiles in `.agents/agent-profiles/`

  4 profiles:
  - `playcanvas-editor-reviewer.md` — reviews Editor package changes
  - `thermo-nuclear-review.md` — correctness/security reviewer
  - `thermo-nuclear-code-quality-review.md` — maintainability reviewer
  - `thermos-orchestrator.md` — orchestrates both Thermos reviewers

  Each profile follows the safe defaults from `README.md`: instruction-only, read-only, invariant anchors preserved.

- [ ] **Step 3.5**: Create native agent copies (24 files)

  For each of the 4 profiles, create self-contained copies in:
  - `.codex/agents/<name>.toml`
  - `.gemini/agents/<name>.md`
  - `.claude/agents/<name>.md`
  - `.github/agents/<name>.agent.md`
  - `.qoder/agents/<name>.md`
  - `.kiro/steering/agent_profiles/<name>.md`

---

### Phase 4: SOURCES.md and AGENTS.md Updates

- [ ] **Step 4.1**: Update `.agents/skills/SOURCES.md`

  Add new sections:

  ```markdown
  ## PlayCanvas Editor Skills — Created 2026-06-08

  | Local Skill | Source | License | Notes |
  | --- | --- | --- | --- |
  | `playcanvas-editor-authoring` | Local project workflow | Project repository license | ... |
  | `playcanvas-editor-interface` | Local project workflow | Project repository license | ... |
  | ... (all 9) | | | |

  ## External Reference Sources For PlayCanvas Editor Skills

  | Used By | Source | License | Owner | Adaptation Notes |
  | --- | --- | --- | --- | --- |
  | All 9 Editor Skills | https://developer.playcanvas.com/user-manual/editor/ | Docs reference | PlayCanvas Ltd. | Primary source... |
  | `playcanvas-editor-api-realtime` | https://api.playcanvas.com/editor/ | API ref | PlayCanvas Ltd. | ... |
  | `playcanvas-editor-universo-compat` | https://github.com/playcanvas/editor v2.23.4 | MIT | PlayCanvas Ltd. | Vendored commit ... |
  | All Editor Skills | https://github.com/playcanvas/editor-mcp-server | MIT | PlayCanvas Ltd. | Reference only ... |

  ## Thermos Code Quality Review — Adapted 2026-06-08

  | Local Skill | Source | License | Notes |
  | --- | --- | --- | --- |
  | `thermos` | https://github.com/cursor/plugins/tree/main/thermos | MIT | Orchestrator adapted ... |
  | `thermo-nuclear-review` | https://github.com/cursor/plugins/tree/main/thermos/skills | MIT | Correctness/security ... |
  | `thermo-nuclear-code-quality-review` | https://github.com/cursor/plugins/tree/main/thermos/skills | MIT | Maintainability ... |
  ```

- [ ] **Step 4.2**: Update `AGENTS.md`

  Add a new trigger section after the Runtime UI UX Quality Gate:

  ```markdown
  # PlayCanvas Editor Authoring Quality Gate

  When work touches `packages/universo-react-playcanvas-editor-frontend`,
  `packages/universo-react-playcanvas-editor-backend`, vendored
  `playcanvas-editor` artifacts, Editor API, ShareDB, compatibility tokens,
  or Editor package documentation, load the project-local skills
  `.agents/skills/playcanvas-editor-authoring` and
  `.agents/skills/playcanvas-editor-universo-compat`.

  Additional Editor skills (interface, assets, scenes, scripting, settings,
  version-control, api-realtime) should be loaded when touching the
  corresponding Editor domain.

  Non-negotiable Editor rules:
  - Do not confuse Editor authoring with Engine runtime.
  - Do not assume PlayCanvas Cloud REST/WS parity.
  - Do not import upstream Editor internals into MUI host code.
  - Do not claim multi-user realtime collaboration is implemented.
  - Do not expose authoring storage paths in runtime manifests.
  ```

---

### Phase 5: Autoreview Rubric Integration

- [ ] **Step 5.1**: Use `autoreview`'s existing `--prompt-file` mechanism

  The existing `autoreview` helper supports injecting additional context via `--prompt-file`. Instead of patching the vendored script, we will use this flag to pass Thermos rubrics:

  ```bash
  # Usage examples:
  autoreview --mode local --prompt-file .agents/skills/autoreview/rubrics/thermos-correctness.md
  autoreview --mode branch --base origin/main --prompt-file .agents/skills/autoreview/rubrics/thermos.md
  autoreview --panel --prompt-file .agents/skills/autoreview/rubrics/thermos-maintainability.md
  ```

  This preserves the vendored `autoreview` script identically while injecting the rubric definitions.

- [ ] **Step 5.2**: Add rubric definitions as structured files

  ```
  .agents/skills/autoreview/rubrics/
    thermos-correctness.md
    thermos-maintainability.md
    thermos.md  (combined shorthand)
  ```

- [ ] **Step 5.3**: Test rubric integration

  ```bash
  # Dry run to verify rubric loading:
  autoreview --mode local --prompt-file .agents/skills/autoreview/rubrics/thermos.md --dry-run
  ```

---

### Phase 6: Documentation

- [ ] **Step 6.1**: Create `docs/en/platform/playcanvas-editor-skills.md`

  GitBook-format documentation explaining:
  - The 9 Editor Skills and when each is triggered
  - How Editor and Engine Skills relate (separate version stacks)
  - How to contribute to or extend Editor Skills
  - Reference links to official PlayCanvas docs

- [ ] **Step 6.2**: Create `docs/en/platform/thermos-review.md`

  GitBook-format documentation explaining:
  - Thermos review system (correctness + maintainability)
  - How to run Thermos via autoreview rubrics
  - Rubric categories and scoring
  - Integration with existing review infrastructure

- [ ] **Step 6.3**: Create Russian mirrors

  - `docs/ru/platform/playcanvas-editor-skills.md`
  - `docs/ru/platform/thermos-review.md`

- [ ] **Step 6.4**: Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`

  Add new pages to the GitBook table of contents.

- [ ] **Step 6.5**: Update package READMEs

  - `packages/universo-react-playcanvas-editor-backend/README.md` — document decomposed structure
  - `packages/universo-react-playcanvas-editor-frontend/README.md` — reference new Editor Skills

---

### Phase 7: Testing Strategy

- [ ] **Step 7.1**: Skills structure validation (Vitest)

  Create a test that validates all Skill directories:
  ```typescript
  // tests/skills-structure.test.ts
  import { readdirSync, readFileSync } from 'fs';
  import { describe, it, expect } from 'vitest';

  describe('PlayCanvas Editor Skills structure', () => {
    const EDITOR_SKILLS = [
      'playcanvas-editor-authoring',
      'playcanvas-editor-interface',
      'playcanvas-editor-assets',
      'playcanvas-editor-scenes',
      'playcanvas-editor-scripting',
      'playcanvas-editor-settings',
      'playcanvas-editor-version-control',
      'playcanvas-editor-api-realtime',
      'playcanvas-editor-universo-compat',
    ];

    for (const skill of EDITOR_SKILLS) {
      it(`${skill} has valid SKILL.md with required front-matter`, () => {
        const content = readFileSync(
          `.agents/skills/${skill}/SKILL.md`, 'utf-8'
        );
        expect(content).toMatch(/^---\nname:/);
        expect(content).toContain('description:');
        expect(content).toContain('## Version Guard');
        expect(content).toContain('## Blocking Rules');
      });
    }
  });
  ```

- [ ] **Step 7.2**: Agent profile drift checker

  Extend or create a drift check script:
  ```bash
  # scripts/check-agent-profiles.sh
  PROFILES="playcanvas-editor-reviewer thermo-nuclear-review thermo-nuclear-code-quality-review thermos-orchestrator"
  DIRS=".codex/agents .gemini/agents .claude/agents .github/agents .qoder/agents .kiro/steering/agent_profiles"

  for profile in $PROFILES; do
    for dir in $DIRS; do
      if [ ! -f "$dir/$profile"* ]; then
        echo "MISSING: $dir/$profile"
        exit 1
      fi
    done
  done
  echo "All agent profile copies present"
  ```

- [ ] **Step 7.3**: Backend decomposition tests (Vitest)

  All existing tests in `packages/universo-react-playcanvas-editor-backend/` must pass after decomposition. No new test logic needed — the decomposition is a structural refactor.

  ```bash
  pnpm --filter @universo-react/playcanvas-editor-backend test
  ```

- [ ] **Step 7.4**: Playwright E2E — Editor boot after decomposition

  Verify the Editor still boots correctly after backend decomposition:
  ```bash
  pnpm supabase:e2e:start:minimal
  npx playwright test --grep "playcanvas-editor.*full-boot" --project=chromium
  ```

  Take screenshots to visually verify:
  - Editor toolbar visible
  - Hierarchy panel populated
  - Viewport canvas rendering
  - No connection errors or fallback states

- [ ] **Step 7.5**: Autoreview rubric integration test

  Run autoreview with Thermos rubrics in dry-run mode:
  ```bash
  autoreview --mode local --prompt-file .agents/skills/autoreview/rubrics/thermos.md --dry-run
  ```

  Then run a real review on the decomposed backend:
  ```bash
  autoreview --mode local --prompt-file .agents/skills/autoreview/rubrics/thermos-maintainability.md
  ```

---

### Phase 8: Memory Bank and Progress Updates

- [ ] **Step 8.1**: Update `memory-bank/progress.md`

  Add closure notes for Skills creation and Thermos integration.

- [ ] **Step 8.2**: Update `memory-bank/techContext.md`

  Document the new agent infrastructure additions (9 Editor Skills, 3 Thermos Skills, 4 agent profiles).

- [ ] **Step 8.3**: Run final checks

  ```bash
  pnpm --filter @universo-react/playcanvas-editor-backend build
  pnpm --filter @universo-react/playcanvas-editor-backend test
  npx prettier --check ".agents/skills/playcanvas-editor-*/**/*.md"
  ```

---

## Potential Challenges

| Risk | Mitigation |
| --- | --- |
| Backend decomposition breaks import paths for consuming packages (`metahubs-backend`) | Keep the barrel `index.ts` re-exporting everything with the same public API. Only internal structure changes. |
| ShareDB/realtime module is tightly coupled to route factories | Extract with dependency injection: route factories receive realtime runtime as a typed parameter, not a direct import. |
| Autoreview script requires patching | Mitigated: we will use the existing `--prompt-file` flag instead of attempting to patch the vendored script with a custom `--rubric` flag. |
| 24 native agent copies create drift risk | Added a CI-friendly drift checker script (`pnpm check:agent-profiles`). It will be run as part of the implementation closeout. |
| Thermos rubric categories may overlap with existing autoreview heuristics | Document the boundary: autoreview covers bugs/regressions in the diff; Thermos covers structural quality across the codebase. They complement, not duplicate. |
| Official PlayCanvas docs may restructure URLs | Pin docs references to specific sections and include fallback URLs. Skills document the vendor-pinned commit as the stable source. |

## Dependencies

- `@universo-react/playcanvas-editor-backend` — must be decomposed before Thermos validation
- `.agents/skills/autoreview/` — Thermos rubric integration depends on understanding the helper's prompt injection mechanism
- Official PlayCanvas docs — primary source for all 9 Editor Skills
- Cursor Thermos plugin — canonical upstream for rubric adaptation (MIT license)

## Execution Order

```
Phase 1 (Backend Decomposition)
  ↓
Phase 2 (9 Editor Skills)      Phase 3 (Thermos Skills + Profiles)
  ↓                               ↓
Phase 4 (SOURCES.md + AGENTS.md)
  ↓
Phase 5 (Autoreview Rubric Integration)
  ↓
Phase 6 (Documentation)        Phase 7 (Testing)
  ↓                               ↓
Phase 8 (Memory Bank + Closeout)
```

Phase 2 and Phase 3 can run in parallel since they are independent. Phase 5 depends on Phase 3 (Thermos Skills must exist before rubric integration). Phase 6 and 7 can run in parallel.
