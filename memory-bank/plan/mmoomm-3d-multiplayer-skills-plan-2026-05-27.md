# MMOOMM 3D And Multiplayer Skills Plan - 2026-05-27

## Overview

Create a curated project-local `.agents/skills/` set for MMOOMM implementation and QA work. The skills will preserve operational guidance for PlayCanvas Engine, Colyseus authoritative multiplayer, browser 3D runtime integration, and browser game runtime QA without importing vendor-specific skill layouts or copying upstream documentation verbatim.

Research artifact: `memory-bank/research/mmoomm-3d-multiplayer-skills-research-2026-05-27.md`.

Additional current-doc check during PLAN:

-   Context7 `/playcanvas/engine`: confirms `playcanvas` Application/Entity setup, render/camera/light components, asset loading, resize handling, and direct Engine usage.
-   Context7 `/colyseus/docs`: confirms Room lifecycle, `onAuth`, Schema state, fixed tick simulation, reconnection hooks, and authoritative multiplayer patterns.

Subagent review:

-   `plan-ux-reviewer` result: make runtime UI/QA obligations explicit. A browser 3D widget inside MUI/app-template is runtime UI and must require a UI Contract, localized user-facing states, no raw IDs/JSON/protocol leakage, no page-level horizontal overflow, keyboard focus behavior, and browser evidence.
-   `explorer` result: mirror project-local skill frontmatter and reference conventions, use `.agents/skills/SOURCES.md` as the source registry, note that the three wrapper packages already exist, and preserve module compiler/runtime target constraints.

## Final Skill Set

PLAN finalizes four skills, not three:

1. `playcanvas-engine-runtime`
2. `colyseus-authoritative-multiplayer`
3. `browser-3d-runtime-integration`
4. `browser-game-runtime-qa`

The QA skill is required, not optional, because MMOOMM runtime widgets will need independently triggerable browser evidence checks for canvas/WebGL, realtime multiplayer, reconnect, responsive layout, and user-facing runtime UX.

## Architectural Mapping

-   Domain: agent operational knowledge for MMOOMM MVP implementation and QA.
-   Platform layer: repository-local agent workflow under `.agents/skills/`, not application runtime metadata and not a new entity type preset.
-   Runtime implication: future MMOOMM widgets mount inside `apps-template-mui` widget zones and must follow the Runtime UI UX Quality Gate.
-   Source handling: external repositories and docs are source material only. New skill content must be rewritten as project-local guidance.
-   Wrapper package invariant:
    -   `@universo-react/playcanvas-engine` wraps `playcanvas@2.18.1`.
    -   `@universo-react/colyseus-client` wraps `@colyseus/sdk@0.17.42`.
    -   `@universo-react/colyseus-server` wraps `@colyseus/core@0.17.43`.
-   Existing package state: the three wrapper packages already exist. This plan does not recreate them; it uses their READMEs/package manifests as local version anchors.
-   Package runtime target invariant: current package seed metadata marks `@universo-react/colyseus-client` as client-targeted. Do not instruct agents to use it in server modules unless a separate implementation updates registry metadata and compiler/runtime contracts deliberately.
-   Documentation drift invariant: `packages/universo-react-colyseus-client/README.md` currently describes the upstream SDK as browser and Node-compatible, while registry seed metadata exposes the wrapper as `runtimeTargets: ["client"]`. IMPLEMENT must either align README/docs wording to the seeded runtime target or explicitly document that the README describes upstream capability while the runtime registry remains client-only.
-   Module compiler invariant: modules may import only `@universo-react/extension-sdk`, `@shared/*`, and declared `allowedPackageImports`; `require()`, dynamic `import()`, and `import.meta` fail closed. Skills must teach package use through the attached package/runtime dependency mechanism, not raw arbitrary imports.

## Affected Areas

-   New project-local skills:
    -   `.agents/skills/playcanvas-engine-runtime/SKILL.md`
    -   `.agents/skills/playcanvas-engine-runtime/references/playcanvas-engine-runtime-notes.md`
    -   `.agents/skills/playcanvas-engine-runtime/references/procedural-geometry-and-assets.md`
    -   `.agents/skills/colyseus-authoritative-multiplayer/SKILL.md`
    -   `.agents/skills/colyseus-authoritative-multiplayer/references/colyseus-room-lifecycle.md`
    -   `.agents/skills/colyseus-authoritative-multiplayer/references/colyseus-state-and-tick.md`
    -   `.agents/skills/colyseus-authoritative-multiplayer/references/colyseus-reconnect-and-scale.md`
    -   `.agents/skills/browser-3d-runtime-integration/SKILL.md`
    -   `.agents/skills/browser-3d-runtime-integration/references/react-mui-canvas-boundary.md`
    -   `.agents/skills/browser-3d-runtime-integration/references/browser-game-loop-and-input.md`
    -   `.agents/skills/browser-3d-runtime-integration/references/runtime-ui-contract.md`
    -   `.agents/skills/browser-game-runtime-qa/SKILL.md`
    -   `.agents/skills/browser-game-runtime-qa/references/canvas-webgl-oracles.md`
    -   `.agents/skills/browser-game-runtime-qa/references/realtime-multiplayer-oracles.md`
    -   `.agents/skills/browser-game-runtime-qa/references/qa-evidence-template.md`
-   Source registry:
    -   `.agents/skills/SOURCES.md`
-   Local wrapper package references:
    -   `packages/universo-react-playcanvas-engine/README.md`
    -   `packages/universo-react-playcanvas-engine/README-RU.md`
    -   `packages/universo-react-colyseus-client/README.md`
    -   `packages/universo-react-colyseus-client/README-RU.md`
    -   `packages/universo-react-colyseus-server/README.md`
    -   `packages/universo-react-colyseus-server/README-RU.md`
    -   `pnpm-workspace.yaml`
-   Optional developer docs, if product wants GitBook visibility beyond `.agents/skills/SOURCES.md`:
    -   `docs/en/platform/metahubs/packages.md`
    -   `docs/ru/platform/metahubs/packages.md`
    -   `docs/en/architecture/modules-system.md`
    -   `docs/ru/architecture/modules-system.md`
    -   `docs/en/contributing/creating-packages.md`
    -   `docs/ru/contributing/creating-packages.md`
    -   `docs/en/guides/browser-e2e-testing.md`
    -   `docs/ru/guides/browser-e2e-testing.md`
    -   `docs/en/SUMMARY.md`
    -   `docs/ru/SUMMARY.md`
-   Memory Bank after implementation:
    -   `memory-bank/tasks.md`
    -   `memory-bank/progress.md`

## Skill Content Contract

Each new skill must follow the local project skill pattern:

-   Required YAML frontmatter with `name`, `description`, and `metadata`.
-   Metadata should mirror local project skills: `metadata.version`, `metadata.scope`, and `metadata.file_policy: "markdown-only"` unless implementation has a concrete reason to diverge.
-   A concise `SKILL.md` entry point with triggers, required output, workflow, blocking rules, anti-patterns, and references.
-   Optional one-level `references/` files for detailed operational notes.
-   No README inside the skill directory unless a later project convention requires it.
-   No `agents/openai.yaml` unless the project decides to adopt that metadata for local skills separately.
-   No vendor-specific syntax, slash commands, plugin marketplace installation instructions, `.claude/skills`, `.codex/skills`, `.kiro/skills`, or copied external skill bodies.
-   All source-dependent content must be paraphrased and cited through `SOURCES.md` and per-skill reference sections.

## UI Contract For Future Runtime Work

The new integration and QA skills must require this UI Contract whenever a future MMOOMM task touches a screen, dialog, table, card, HUD, widget, or canvas surface:

-   User goal and primary path.
-   Visible controls, labels, and accessible names.
-   Existing primitive reuse: identify the `apps-template-mui` dashboard/widget/dialog/list/DataGrid primitive being reused; if a new primitive is proposed, document why existing primitives do not fit.
-   Loading, empty, error, disconnected, reconnecting, unauthorized, room-full, and version-mismatch states where relevant.
-   Hidden/system-owned fields and forbidden technical leakage.
-   Display values for any table/card/HUD values; no raw UUID-only labels, JSON, `[object Object]`, protocol errors, session IDs, room IDs, player IDs, or stack details.
-   Long-text behavior: semantic descriptions, room notes, scene notes, spawn rules, and debug notes use multiline controls by default when surfaced in UI.
-   Localized validation and error mapping through project i18n patterns.
-   Error mapping: map Zod, Colyseus, WebSocket, auth, room-full, reconnect, and version-mismatch failures to localized user-facing messages; never surface raw internal, Zod, protocol, or server messages.
-   Keyboard path and focus ownership, including canvas entry/exit, pointer lock escape behavior, and dialogs/text inputs.
-   Responsive proof at `1920x1080`, `768x1024`, and `390x844` unless a future feature documents a narrower support boundary.
-   Responsive overflow rule: reject document/page-level horizontal overflow at `1920x1080`, `768x1024`, and `390x844`; component-internal constrained scroll is allowed only for DataGrid/table/canvas panels with explicit bounded containers.
-   Browser evidence requirements, including Playwright UX oracles or equivalent assertions for no technical leakage, localized validation, no page overflow, viewport matrix, and keyboard path. Screenshots alone are not sufficient.

## Plan Steps

-   [ ] Step 1: Establish the implementation baseline.

    -   Confirm the worktree state and protect unrelated user changes.
    -   Re-read `memory-bank/research/mmoomm-3d-multiplayer-skills-research-2026-05-27.md`.
    -   Re-read the existing local skill patterns in `universo-platform-architecture`, `mui-runtime-ux-patterns`, `runtime-ux-qa`, and `research-before-plan`.
    -   Confirm pinned wrapper versions from `pnpm-workspace.yaml` and wrapper package READMEs.

-   [ ] Step 2: Create `playcanvas-engine-runtime`.

    -   Add `SKILL.md` with triggers for PlayCanvas Engine, WebGL canvas, MMOOMM viewport, procedural geometry, camera/light setup, asset lifecycle, resize, and cleanup.
    -   Add the version guard for `@universo-react/playcanvas-engine` -> `playcanvas@2.18.1`.
    -   Include required workflow:
        -   initialize one app/engine per mounted canvas;
        -   construct scene graph with entities, camera, lights, render components, materials, and mesh instances;
        -   use `BoxGeometry`, `SphereGeometry`, `TorusGeometry`, and `calculateNormals` for procedural geometry guidance;
        -   guard asset readiness/failure;
        -   resize to the widget container;
        -   remove listeners and dispose resources on unmount.
    -   Add blocking rules against PlayCanvas Editor, PCUI/Graph, `@playcanvas/react` assumptions, duplicate engines per mount, page-level canvas layout ownership, and heavy glTF/Draco/texture-pipeline scope.
    -   Add references:
        -   `playcanvas-engine-runtime-notes.md`
        -   `procedural-geometry-and-assets.md`

-   [ ] Step 3: Create `colyseus-authoritative-multiplayer`.

    -   Add `SKILL.md` with triggers for Colyseus rooms, realtime multiplayer, MMOOMM room state, schema state, prediction, reconciliation, reconnect, and multi-client simulation.
    -   Add version guards:
        -   `@universo-react/colyseus-server` -> `@colyseus/core@0.17.43`
        -   `@universo-react/colyseus-client` -> `@colyseus/sdk@0.17.42`
    -   Include required workflow:
        -   static `onAuth` before `onJoin`;
        -   document `ServerError`, auth payload forwarding to `onJoin`, and client-visible auth handling;
        -   initialize state in `onCreate`;
        -   cover the full room lifecycle in references: `onCreate`, `onAuth`, `onJoin`, `onDrop`, `onReconnect`, `onLeave`, and `onDispose`;
        -   mutate schema state directly instead of replacing the root state casually;
        -   design Schema state with server/client field-order compatibility, required TypeScript decorator settings, nested schemas for large models, and the Colyseus Schema serialized-field limit;
        -   validate client messages with project Zod patterns where shape matters;
        -   process client input intents on a fixed server tick;
        -   publish authoritative state;
        -   render client motion with LERP/interpolation and optionally prediction/reconciliation;
        -   use `allowReconnection` for temporary disconnects;
        -   document Redis-backed presence/driver as MVP scaling notes, not default local setup.
    -   Include package/import constraints:
        -   server room code uses the server wrapper around `@colyseus/core`;
        -   browser client code uses the client wrapper around `@colyseus/sdk`;
        -   do not assume `colyseus.js` or full `colyseus` package imports;
        -   do not tell agents to use the client SDK from server modules unless registry runtime targets and compiler rules are explicitly changed later.
    -   Add blocking rules against trusting client transforms, using React state as canonical multiplayer state, flat oversized schemas, missing auth, raw protocol errors in UI, and out-of-scope command-pattern dependency.
    -   Add references:
        -   `colyseus-room-lifecycle.md`
        -   `colyseus-state-and-tick.md`
        -   `colyseus-reconnect-and-scale.md`

-   [ ] Step 4: Create `browser-3d-runtime-integration`.

    -   Add `SKILL.md` with triggers for embedding PlayCanvas/Colyseus in `apps-template-mui`, lazy-loaded 3D widgets, game HUDs, input capture, resize, runtime Playwright proof, and responsive WebGL surfaces.
    -   Require the skill to load or reference `mui-runtime-ux-patterns`, `runtime-ux-qa`, and `playwright-best-practices` when implementation or QA touches runtime UI.
    -   Include required workflow:
        -   mount the 3D experience inside an `apps-template-mui` widget zone;
        -   do not create a parallel application shell;
        -   lazy-load engine/multiplayer client when bundle or first-paint cost matters;
        -   separate TanStack Query/platform data from Colyseus realtime state;
        -   keep HUD/dialog/list controls in MUI and render world content in canvas;
        -   keep the game loop outside React render loops and bridge summarized UI state only;
        -   handle input ownership, pointer lock, focus, Escape, dialogs, text fields, visibility change, resize observer, and connection cleanup.
    -   Include the Runtime UI Contract from this plan.
    -   Add references:
        -   `react-mui-canvas-boundary.md`
        -   `browser-game-loop-and-input.md`
        -   `runtime-ui-contract.md`

-   [ ] Step 5: Create `browser-game-runtime-qa`.

    -   Add `SKILL.md` with triggers for QA-reviewing PlayCanvas canvas widgets, WebGL/canvas evidence, Colyseus realtime flows, reconnect, responsive browser proof, multi-client Playwright scenarios, and runtime MUI UX for game surfaces.
    -   Require verdict format compatible with `runtime-ux-qa`: pass, pass-with-minor-issues, or fail; blockers; major/minor issues; browser evidence; missing evidence; required fixes.
    -   Include required evidence:
        -   canvas present, visible, bounded by its MUI container, and nonblank after load;
        -   primary object/camera is framed on desktop, tablet, and mobile;
        -   movement or animation changes over time where the feature claims interactivity;
        -   no page-level horizontal overflow;
        -   controls/HUD do not overlap incoherently;
        -   keyboard focus can enter and leave the canvas area;
        -   failure states are user-facing and localized;
        -   no raw IDs, JSON, `[object Object]`, protocol errors, room IDs, player IDs, session IDs, or server stack details;
        -   WebSocket/multiplayer assertions prove state propagation when the feature is realtime;
        -   reconnect tests prove reconnecting/disconnected/failure states where reconnection is in scope.
    -   Require browser checks to use user-facing locators and runtime UX oracle semantics:
        -   `expectNoTechnicalLeakage`;
        -   `expectLocalizedValidation`;
        -   `expectNoPageHorizontalOverflow`;
        -   `expectRuntimeUxViewportMatrix`;
        -   keyboard path checks by role, label, accessible name, or stable test id.
    -   Treat screenshots as supporting evidence only; they do not replace assertions.
    -   Add references:
        -   `canvas-webgl-oracles.md`
        -   `realtime-multiplayer-oracles.md`
        -   `qa-evidence-template.md`
    -   Reference existing Playwright guidance instead of duplicating it:
        -   `.agents/skills/playwright-best-practices/testing-patterns/canvas-webgl.md`
        -   `.agents/skills/playwright-best-practices/browser-apis/websockets.md`
        -   `.agents/skills/playwright-best-practices/advanced/multi-user.md`
        -   `.agents/skills/playwright-best-practices/references/universo-e2e.md`

-   [ ] Step 6: Update `.agents/skills/SOURCES.md`.

    -   Add a new section for MMOOMM 3D/multiplayer project-local skills.
    -   Preserve the existing registry shape:
        -   add the four new skills to `Local Project Skills` with "Local project workflow" as source and the project repository license;
        -   add a separate table for external reference sources used by these local skills, not the `Imported On ...` table.
    -   The external reference table must include source URL, license, copyright/owner where known, adaptation/use, and a "no verbatim import" note.
    -   Register external source material in that separate reference table:
        -   `freshtechbro/claudedesignskills` as MIT inspiration only, with note "paraphrased; no vendor-specific layout or verbatim skill body imported";
        -   PlayCanvas Engine docs/API and GitHub license as primary source for `playcanvas-engine-runtime`;
        -   PlayCanvas React docs/license as secondary source for integration patterns only;
        -   Colyseus docs and GitHub licenses as primary source for `colyseus-authoritative-multiplayer`;
        -   Colyseus Schema and Command repositories as source notes, with command pattern marked optional/deferred.
    -   Add a short note tying the new skills to the three existing foundation wrapper packages and pinned versions.

-   [ ] Step 7: Add optional GitBook developer documentation if maintainers want visibility outside `.agents/skills`.

    -   Prefer small notes in existing pages instead of creating a new docs section:
        -   metahub package pages: connect MMOOMM skills to the three registry packages;
        -   modules-system pages: mention allowed package imports, runtime targets, and 3D/multiplayer module constraints;
        -   creating-packages pages: note the wrapper package convention;
        -   browser E2E testing pages: point future MMOOMM browser-game QA to canvas/WebGL, WebSocket, multi-user, and local minimal Supabase evidence.
    -   Create new `docs/*/contributing/agent-skills.md` pages only if maintainers want a broader agent-skills guide.
    -   Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` only if new pages are added.
    -   Do not duplicate full skill content in GitBook; link conceptually to `.agents/skills/SOURCES.md` and the skill names.

-   [ ] Step 8: Validate the skill set as content.

    -   Search for forbidden vendor-specific content:
        -   `.claude/skills`
        -   `.codex/skills`
        -   `.kiro/skills`
        -   slash-command installation flows
        -   plugin marketplace install instructions
        -   copied `freshtechbro` wording beyond short attributed source names.
    -   Search for out-of-scope drift:
        -   PlayCanvas Editor as implementation target;
        -   PCUI / PCUI Graph;
        -   glTF/Draco/texture optimization as MVP guidance;
        -   React Three Fiber as a target stack.
    -   Verify every skill has concise trigger metadata and direct references to deeper files.
    -   Verify every source-dependent reference file has source links and license notes where needed.

-   [ ] Step 9: Run focused repository checks.

    -   Do not use the root `pnpm format` script for a focused Markdown-only change, because the root script formats the whole repository glob.
    -   Run `pnpm exec prettier --write <explicit touched markdown files>` or an equivalent explicit touched-file list.
    -   Run `pnpm docs:i18n:check` if GitBook EN/RU docs are changed.
    -   Run `node tools/docs/check-gitbook-links.mjs` if SUMMARY or docs links are changed.
    -   Run `pnpm check:runtime-ux-agents` only if agent profile mirrors are changed. This plan does not require mirror changes.
    -   No package build is required for Markdown-only skill changes unless implementation also changes code, package manifests, or wrapper READMEs.

-   [ ] Step 10: Optional browser/E2E validation path for future runtime examples.

    -   Do not run `pnpm dev`.
    -   If implementation adds only skills/docs, Playwright is not required.
    -   If implementation adds a live sample widget, fixture, or screenshot generator, use local minimal Supabase:

        ```bash
        pnpm supabase:e2e:start:minimal
        pnpm env:e2e:local-supabase
        pnpm doctor:e2e:local-supabase
        cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase pnpm run build:e2e
        cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs <target-spec-or-grep>
        ```

    -   For manual screenshots against the E2E app, target `http://127.0.0.1:3100`.

-   [ ] Step 11: Record implementation closure.
    -   Update `memory-bank/tasks.md` only if this becomes the active implementation item.
    -   Update `memory-bank/progress.md` with the final implemented skill set, source registry update, validation commands, and any intentionally deferred areas.

## Potential Challenges

-   External source contamination: `freshtechbro/claudedesignskills` is useful but vendor-specific. Implementation must paraphrase and avoid layout/workflow imports.
-   Scope creep: PlayCanvas Editor, PCUI/Graph, asset pipeline, React Three Fiber, and command-pattern dependencies can easily drift into the skills. Keep them explicit deferrals.
-   Wrapper mismatch: PlayCanvas React docs are useful but the current wrapper exposes `playcanvas`, not `@playcanvas/react`. The integration skill must not instruct agents to import React bindings unless a later plan adds them.
-   Runtime target mismatch: `@universo-react/colyseus-client` is browser/client-targeted in current seed metadata even though the upstream SDK can run in more contexts. Keep the skill aligned with current registry metadata unless a later implementation changes it deliberately.
-   Wrapper documentation drift: `@universo-react/colyseus-client` README wording is broader than current registry seed runtime targets. Skills should prefer the runtime registry contract and implementation should either clarify README wording or record the intentional distinction.
-   Compiler mismatch: attached package imports are not free-form imports. Skills must explain the allowed package/runtime target path so agents do not write module code that the compiler rejects.
-   Runtime UX under-specification: engine/network skills alone will not protect future UI. The integration and QA skills must carry the Runtime UI Contract and browser evidence requirements.
-   Overlarge skills: detailed docs should live in `references/`; `SKILL.md` files should stay concise enough to load cheaply.
-   Source registry ambiguity: `SOURCES.md` currently has imported and local tables. The implementation should extend that pattern without mixing "external inspiration" with "imported complete skill".

## Dependencies

-   Existing research artifact must remain the source-backed planning basis.
-   Existing wrapper packages and catalog versions are the version source of truth.
-   Existing local skills provide structural and UX patterns:
    -   `research-before-plan`
    -   `universo-platform-architecture`
    -   `mui-runtime-ux-patterns`
    -   `runtime-ux-qa`
    -   `playwright-best-practices`
-   System Codex skill used for authoring guidance:
    -   `skill-creator`
-   No Supabase schema, database migration, React component, i18n runtime key, or package manifest change is required for the base skill implementation.

## Acceptance Criteria

-   Four new project-local skills exist under `.agents/skills/`.
-   Every new skill has a valid `SKILL.md` and relevant `references/`.
-   `browser-game-runtime-qa` is implemented as a required skill, not deferred.
-   `.agents/skills/SOURCES.md` records local skill entries, external sources, license notes, and wrapper package relationships.
-   No new content uses vendor-specific skill layouts or installation flows.
-   No new content copies external skill/docs bodies verbatim.
-   The PlayCanvas skill is Engine-only and version-aligned to `playcanvas@2.18.1`.
-   The Colyseus skill is version-aligned to `@colyseus/core@0.17.43` and `@colyseus/sdk@0.17.42`.
-   The browser integration and QA skills require the Runtime UI Contract, localized user-facing states, no technical leakage, no page-level horizontal overflow, and browser evidence for implemented runtime UI.
-   Markdown formatting and relevant docs checks pass, or any skipped checks are documented with a clear reason.
