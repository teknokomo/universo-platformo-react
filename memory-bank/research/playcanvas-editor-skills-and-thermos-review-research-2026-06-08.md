# Research: PlayCanvas Editor Skills And Thermos Review

> Created: 2026-06-08
> Status: Draft
> Trigger: RESEARCH command for `.manager/specs/cross-project/playcanvas-editor-skills-and-thermos-review-spec-2026-06-08.md`
> Follow-up plan: TBD

## Research Question

Which project-local Skills, agent profiles, source-attribution records, and review workflow changes should be planned before continuing PlayCanvas Editor integration, and what additional implementation risks appear when the brief is checked against current local code, prior research, official PlayCanvas sources, Context7, and the Cursor Thermos trail?

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
| --- | --- | --- | --- |
| `.manager/specs/cross-project/playcanvas-editor-skills-and-thermos-review-spec-2026-06-08.md` | Local brief | 2026-06-08 | Defines the requested PlayCanvas Editor Skills family and Thermos integration scope. |
| `.backup/PlayCanvas-Editor-Skills.md` | Prior deep research | Provided with brief | Recommends a 9-skill Editor family and Thermos integration through project-local agent infrastructure. |
| `.backup/Исследование-PlayCanvas-Editor-Skills.md` | Prior deep research | Provided with brief | Adds broader PlayCanvas Editor, VS Code extension, OT/ShareDB, MCP, and Thermos context; some claims need source-strength separation. |
| `memory-bank/currentResearch.md` | Local research index | Current local file | Shows earlier PlayCanvas Editor package, storage, bridge, and backend decisions that this research must not contradict. |
| `memory-bank/tasks.md` | Local implementation ledger | Current local file | Shows which PlayCanvas Editor slices are already closed and which ones remain future work. |
| `memory-bank/progress.md` | Local progress log | Current local file | Confirms the Editor compatibility/backend/full-boot closure history and the current project state. |
| `memory-bank/research/playcanvas-editor-minimal-compatibility-backend-research-2026-06-05.md` | Prior local research | 2026-06-05 | Establishes the current backend direction: minimal compatible surface, not PlayCanvas Cloud parity. |
| `memory-bank/productContext.md` and `memory-bank/techContext.md` | Local canonical context | Current local files | Anchor the broader platform direction, Node baseline, metahub/application/workspace split, and DB/service conventions that Skills and review rubrics must respect. |
| `docs/en/platform/playcanvas-editor.md` and `docs/en/platform/playcanvas-projects.md` | Local docs | Current local files | Current English-facing project docs for the Editor artifact boundary, bridge, and PlayCanvas project storage model. |
| `packages/universo-react-playcanvas-editor-frontend/README.md` | Local package docs | Current local file | Defines the frontend package as an isolated upstream artifact boundary and lists the current artifact modes and security boundary. |
| `packages/universo-react-playcanvas-editor-frontend/package.json` | Local package manifest | Current local file | Confirms the local frontend package dependency surface, including the upstream Editor stack dependencies on `sharedb` and `ot-text`. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/UPSTREAM.md` | Local vendoring record | Snapshot 2026-06-05 | Pins upstream Editor `v2.23.4`, commit `c4916f...`, Node `>=22.22.0`, and the no-`package.json` vendor boundary. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/package.playcanvas-editor.json` | Vendored upstream manifest | Snapshot 2026-06-05 | Hard local source for upstream package version, dependency stack, and Node requirement. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/AGENTS.md` | Vendored upstream agent guidance | Snapshot 2026-06-05 | Documents the upstream load model: backend-rendered shell, injected `window.config`, page variants, Caller pattern, side-effect imports, and `editor-api`. |
| `packages/universo-react-playcanvas-editor-frontend/scripts/lib/playcanvas-editor-artifact.mjs` | Local artifact builder | Current local file | Defines the current artifact modes, default `universo-full-upstream-ui`, config validation, and hosted/full-boot config generation. |
| `packages/universo-react-playcanvas-editor-backend/README.md` | Local package docs | Current local file | Defines the backend as a protocol boundary with REST/WebSocket/ShareDB-compatible snapshot persistence, not full cloud parity. |
| `packages/universo-react-playcanvas-editor-backend/package.json` | Local package manifest | Current local file | Confirms the backend direct dependency surface: `sharedb`, `ws`, Express, Zod, and no direct `ot-text` dependency. |
| `packages/universo-react-playcanvas-editor-backend/src/index.ts` | Local source | Current local file | Shows the current single-file backend surface, token service, route factories, realtime runtime deps, and ShareDB collections. |
| `.agents/skills/playcanvas-engine-runtime/SKILL.md` | Existing local Skill | Current local file | Explicitly excludes PlayCanvas Editor, PCUI, and related tooling; anchors the runtime/editor separation. |
| `.agents/skills/browser-3d-runtime-integration/SKILL.md` | Existing local Skill | Current local file | Reinforces that browser 3D runtime guidance is separate from Editor authoring and package-boundary work. |
| `.agents/skills/autoreview/SKILL.md` | Existing local Skill | Current local file | Existing closeout review runner that Thermos should extend rather than bypass. |
| `.agents/skills/SOURCES.md` | Local source registry | Current local file | Required location for imported/adapted Skill attribution, versions, and license notes. |
| `.agents/agent-profiles/README.md` | Local profile conventions | Current local file | Requires self-contained native copies in `.codex/agents`, `.gemini/agents`, `.claude/agents`, `.github/agents`, `.qoder/agents`, and `.kiro/steering/agent_profiles`. |
| `https://developer.playcanvas.com/user-manual/` and `https://developer.playcanvas.com/user-manual/editor/` | Primary vendor docs | Checked 2026-06-08 | Official Editor user manual entry point for interface, assets, scenes, scripts, project settings, publishing, version control, and editor extensions. |
| `https://developer.playcanvas.com/user-manual/editor/interface/`, `/assets/`, `/scenes/`, `/scripting/`, `/settings/`, `/version-control/`, `/teams/`, `/extensions/`, and `/scripting/vscode-extension/` | Primary vendor docs | Checked 2026-06-08 | Direct section-level sources for the proposed Editor Skill taxonomy. |
| `https://developer.playcanvas.com/user-manual/editor/editor-api/` | Primary vendor docs | Checked 2026-06-08 | Official description of the Editor API as the programmable surface for editor extension and automation. |
| `https://api.playcanvas.com/editor/` | Primary vendor API reference | Checked 2026-06-08 | API reference linked by the upstream Editor README; complements the Editor API manual page. |
| `https://github.com/playcanvas/editor` and `https://github.com/playcanvas/editor/blob/main/README.md` | Primary upstream source | Checked 2026-06-08, moving `main` | Open-source PlayCanvas Editor frontend repository and README; useful but less stable than the vendored commit. |
| `https://github.com/playcanvas/editor/blob/main/package.json` and `https://raw.githubusercontent.com/playcanvas/editor/main/package.json` | Primary upstream source | Checked 2026-06-08, moving `main` | Latest upstream package manifest; confirms version/dependency/Node hard source when compared with README prose. |
| `https://github.com/playcanvas/editor/tree/c4916f4973963341984499f2d919f8bfd38e417c` | Primary upstream source | Pinned vendored commit | Stable upstream snapshot matching the local `vendor/UPSTREAM.md` record. |
| `https://github.com/playcanvas/editor-mcp-server` and `https://github.com/playcanvas/editor-mcp-server/blob/main/README.md` | Primary upstream source | Checked 2026-06-08, moving `main` | Official external PlayCanvas MCP server for AI automation of the Editor; relevant as future tool integration or reference source. |
| `https://github.com/cursor/plugins/tree/main/thermos`, `thermos/README.md`, `thermos/skills`, `thermos/agents`, `thermos/CHANGELOG.md`, and `thermos/LICENSE` | Primary upstream source | Checked 2026-06-08, moving `main` | Canonical Thermos plugin layout: correctness/security skill, strict maintainability skill, orchestrator skill, two subagents, MIT license, and migration guidance from team-kit. |
| `https://github.com/cursor/plugins/blob/main/cursor-team-kit/agents/thermo-nuclear-code-quality-review.md` | User-provided upstream link | Checked 2026-06-08, still present legacy/team-kit source | Team-kit agent requested by the user; useful for migration history, while canonical migration target is `cursor/plugins/thermos`. |
| `https://github.com/cursor/plugins/tree/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review` | User-provided upstream link | Checked 2026-06-08, still present legacy/team-kit source | Team-kit Skill requested by the user; useful for rubric preservation, while canonical migration target is `cursor/plugins/thermos`. |
| Context7 `/playcanvas/engine` | MCP docs source | Checked 2026-06-08 | Context7 exposes PlayCanvas Engine docs only, not Editor docs; useful for boundary confirmation, not for Editor authoring content. |

## Key Findings

- Fact: the current local PlayCanvas runtime Skill is deliberately engine-only and version-guarded to `@universo-react/playcanvas-engine` / `playcanvas@2.18.1`; it explicitly excludes PlayCanvas Editor, PCUI, PCUI Graph, React Three Fiber, and heavy asset pipelines. Therefore Editor Skills must not be added as a section inside `playcanvas-engine-runtime`.
- Fact: `docs/en/platform/playcanvas-editor.md` and `docs/en/platform/playcanvas-projects.md` now describe the current Editor artifact boundary, bridge contract, and storage model. They are more current than the older 2026-05/2026-06 research notes and should be treated as immediate source-of-truth docs for implementation planning.
- Fact: the local Editor frontend package is an artifact boundary, not a React/MUI component library. It vendors upstream `playcanvas/editor` at `v2.23.4`, stores upstream metadata in `vendor/package.playcanvas-editor.json`, keeps upstream `package.json` out of the workspace tree, and defaults to `universo-full-upstream-ui`.
- Fact: upstream Editor frontend depends on a backend-rendered shell, injected `window.config`, URL configuration, page variants for full Editor / blank / code editor / launch, side-effect module registration, and the Caller pattern. Skills must document this boot contract because editing only React/MUI host code is not enough to reason about the Editor.
- Fact: the local backend package already implements a minimal compatible namespace for config, scenes, assets, settings, realtime, messenger, and relay. It uses signed compatibility tokens and ShareDB-compatible snapshot persistence through injected ports, but it explicitly does not provide PlayCanvas Cloud parity, multi-user collaboration, durable operation history, or broad binary asset support.
- Fact: local backend `src/index.ts` is a large cross-cutting file that owns route contracts, token handling, origin handling, realtime runtime setup, and helper normalization. This is a concrete Thermos candidate because the brief's maintainability threshold is already relevant to current Editor backend code.
- Fact: official PlayCanvas Editor docs organize knowledge around Editor interface, assets, scenes, scripting, project settings, launch/publishing, version control, teams/permissions, extensions, VS Code extension, and Editor API. This supports the proposed split into multiple Editor Skills rather than one broad Skill.
- Fact: upstream source structure also supports domain-specific Skills: `src/editor`, `src/code-editor`, `src/editor-api`, `src/launch`, `src/plugins`, `src/workers`, `src/texture-convert`, `sass`, and static assets are separate concerns. The vendored `AGENTS.md` adds project-specific warnings about side-effect imports, workers, and `window.config`.
- Fact: Editor realtime code uses ShareDB collections for `scenes` and `assets`; local backend abstractions also include `settings`. This means a future `playcanvas-editor-api-and-realtime` Skill must cover document collections, snapshot vs operation-log limits, token-authenticated WebSockets, and `whenNothingPending`/`submitOp` style flows.
- Fact: the local frontend package carries upstream Editor `sharedb` and `ot-text` dependencies in the vendored/upstream stack, while the local backend package directly depends on `sharedb` for the current single-user snapshot-compatible WebSocket runtime. Skills should state this split precisely instead of saying both packages use both libraries in the same way.
- Fact: Context7 currently resolves PlayCanvas only as `/playcanvas/engine`; it does not expose PlayCanvas Editor docs. The research used Context7 only to confirm engine/runtime concepts and to reinforce the boundary between runtime application lifecycle and Editor authoring.
- Fact: the official PlayCanvas MCP Server exists as an external MCP + Chrome extension workflow and exposes AI automation hooks for Editor entities, assets, scenes, store, and viewport-style operations. It should be recorded as a primary upstream reference and a future integration candidate, but it should not be confused with the current Universo compatibility backend or treated as a direct backend API.
- Fact: the repo already has a portable agent instruction layer: `.agents/skills`, `.agents/skills/SOURCES.md`, `.agents/agent-profiles`, native copies in `.codex/agents`, and the existing `autoreview` Skill. New PlayCanvas Editor and Thermos assets should follow that structure instead of introducing a separate Cursor-only plugin subtree.
- Fact: Cursor's current Thermos plugin contains three Skills (`thermo-nuclear-review`, `thermo-nuclear-code-quality-review`, `thermos`) and two subagents (`thermo-nuclear-review-subagent`, `thermo-nuclear-code-quality-review-subagent`). Its README states that `cursor-team-kit` previously included only `thermo-nuclear-code-quality-review` and that Thermos is the migration target to avoid duplicate thermo entries.
- Inference: the 9-skill taxonomy in the brief is sound, but the first PLAN should prioritize `playcanvas-editor-authoring` and `playcanvas-editor-upstream-frontend-and-universo-compat` because those two prevent the highest-cost mistakes: confusing Editor with Engine, and confusing Universo's minimal backend with PlayCanvas Cloud.
- Inference: Thermos should be integrated as a reviewer/rubric family within or alongside `autoreview`, not as a competing runner. The existing helper already supports branch/local/commit modes, multi-reviewer panels, tool controls, and structured closeout reporting.
- Inference: Thermos should be treated as a two-layer review system: correctness/security review plus strict maintainability review, with an orchestrator only if the existing `autoreview` runner can pass a bundle to multiple reviewers and synthesize findings without duplicating execution logic.

## Conflicts And Uncertainty

- Upstream `playcanvas/editor` README still says local development requires Node 18 or later, while the upstream package manifest and the local vendored manifest require Node `>=22.22.0`. PLAN should treat `package.json` as the hard source and document README prose as stale or broad guidance.
- The brief lists `https://developer.playcanvas.com/editor-api/` as the Editor API docs URL, but that URL returned HTTP 404 on 2026-06-08. Use `https://developer.playcanvas.com/user-manual/editor/editor-api/` for the manual page and `https://api.playcanvas.com/editor/` for the API reference linked by upstream README.
- The brief says both Editor packages depend on `sharedb` and `ot-text`. Current package manifests are more precise: the frontend/upstream Editor stack includes both `sharedb` and `ot-text`, while `@universo-react/playcanvas-editor-backend` directly depends on `sharedb` and not `ot-text`.
- Prior backup research includes PlayCanvas VS Code extension and local disk-mapped file structure details. Those are useful for future local editing workflows, but they are not the same as the current vendored Editor frontend or the current Universo backend contract. Skills should label them as adjacent/future references unless PLAN explicitly includes VS Code extension support.
- The prior research mentions old `cursor-team-kit` Thermos entries and newer Thermos packaging. The user-provided team-kit links are still present legacy/team-kit sources, but the current canonical migration target is `cursor/plugins/thermos`. PLAN should preserve the rubric intent and source attribution while adapting the layout to project-local `.agents/*`.
- The official PlayCanvas Editor docs describe logical project structure and cloud/editor workflows, but they do not provide a stable public on-disk project tree for Universo to treat as immutable. Skills should describe logical Editor structures and local compatibility contracts, not invent a guaranteed disk layout.
- The current `@universo-react/playcanvas-editor-backend` supports snapshot persistence but not durable ShareDB operation history. Any Skill or reviewer profile that says "realtime collaboration is implemented" would be misleading.
- The official MCP Server can complement AI-agent workflows, but integrating it into Universo is a separate product/security decision. It should not be added as an implicit tool dependency in the first Skill implementation.
- The older PlayCanvas Editor research and plan files in `memory-bank/research/` and `.manager/specs/platformo/archive/` are still useful context, but they are stale relative to the current docs and package state. Their package names, artifact mode wording, and upstream version notes should not be reused uncritically.
- The repo currently has no explicit local Thermos source artifact or skill trail. The safest assumption is that the requested Thermos integration should be derived from the user-provided upstream links and then adapted to the repo's existing `autoreview` infrastructure.

## Project Implications

- Create Editor Skills as project-local markdown under `.agents/skills/playcanvas-editor-*`, with source references under each Skill's `references/` directory where needed.
- Keep `playcanvas-engine-runtime` unchanged except for possible cross-reference wording; do not broaden its trigger to Editor work.
- Add source attribution to `.agents/skills/SOURCES.md` for PlayCanvas Editor docs, PlayCanvas Editor API docs/reference, `playcanvas/editor`, `playcanvas/editor-mcp-server`, Cursor Thermos, and Cursor team-kit migration sources. Use "reference/adaptation" wording unless verbatim content is imported.
- Planned `SOURCES.md` records should include: PlayCanvas Editor docs/API reference as documentation references; `playcanvas/editor` as MIT, PlayCanvas Ltd., pinned to `v2.23.4` / commit `c4916f4973963341984499f2d919f8bfd38e417c`; `@playcanvas/editor-mcp-server` as MIT, PlayCanvas Ltd., package version `0.1.0`; Cursor Thermos as MIT, Copyright 2026 Cursor, canonical `thermos` plugin; and cursor-team-kit thermo entries as legacy/migration context.
- If PLAN creates `playcanvas-editor-reviewer`, `thermo-nuclear-code-quality-review`, or `thermo-nuclear-review` shared profiles in `.agents/agent-profiles`, create self-contained native copies for all configured runtime directories named by `.agents/agent-profiles/README.md`: `.codex/agents`, `.gemini/agents`, `.claude/agents`, `.github/agents`, `.qoder/agents`, and `.kiro/steering/agent_profiles`. Existing `pnpm check:runtime-ux-agents` is Runtime-UX-specific; PLAN should either extend drift checks or document a new check for Editor/Thermos profile copies.
- Add Thermos as project-local Skills/profiles, but connect them to `autoreview` as rubrics/reviewers where possible. Avoid a second review command unless PLAN proves the existing helper cannot express the workflow.
- Update AGENTS-style trigger guidance after the Skills exist so work touching `packages/universo-react-playcanvas-editor-frontend`, `packages/universo-react-playcanvas-editor-backend`, vendored `playcanvas-editor`, Editor API, ShareDB, messenger, relay, asset import, scene authoring, or Editor package docs loads the Editor Skills.
- Include a Thermos follow-up candidate for backend decomposition: `packages/universo-react-playcanvas-editor-backend/src/index.ts` should be reviewed for route/token/realtime/helper boundaries, but decomposition belongs to a later implementation plan, not this research file.
- Skills must preserve the current security boundary: upstream DOM/PCUI/Observer state stays inside the isolated artifact iframe, MUI host code must not import upstream Editor internals, and same-origin/sandbox decisions remain explicit.

## Recommended Decision

Proceed to PLAN with a project-local Skill family and review integration:

1. Create the 9 PlayCanvas Editor Skills proposed in the brief, but allow phased implementation. Phase 1 should include the routing/version guard Skill and the upstream-frontend/Universo-compat Skill; Phase 2 can fill interface, assets, scenes/templates, scripting, settings/publishing, version control, and API/realtime detail.
2. Use official PlayCanvas docs and vendored upstream source as primary sources. Use Context7 only for Engine/runtime boundary references until Context7 exposes Editor docs.
3. Treat `vendor/package.playcanvas-editor.json` and upstream `package.json` as hard version/dependency sources. Record README/package conflicts explicitly in the Skills.
4. Use Cursor `plugins/thermos` as the canonical upstream for Thermos, with `cursor-team-kit` kept as migration/history evidence. Adapt the two review rubrics and optional orchestrator into `.agents/skills` and `.agents/agent-profiles`, then wire them into the existing `autoreview` workflow as reviewer rubrics/panels. Keep one project review runner unless a concrete gap requires a separate command.
5. Preserve `.agents/*` as the source of truth and, when shared reviewer profiles are created, generate or maintain self-contained native copies for all configured runtime directories required by `.agents/agent-profiles/README.md`. Do not vendor a Cursor plugin subtree as the canonical implementation.

## Open Questions Before PLAN

- Should Phase 1 create all 9 Editor Skills, or only the two high-leverage routing/compat Skills plus skeletons for the rest?
- Should Thermos be exposed as a standalone Skill invocation, an `autoreview` mode, or both with one shared rubric source?
- Should PLAN extend the existing Runtime-UX-specific profile drift checker or add a separate drift checker for new PlayCanvas Editor and Thermos native profile copies?
- Should the PlayCanvas MCP Server be treated only as source material for Skills, or should PLAN include a future MCP integration spike with explicit authentication and capability boundaries?
- Should backend file decomposition be included in the Thermos integration plan, or tracked as a separate downstream refactor after the Skills and review rubrics exist?

## Sources

- `.manager/specs/cross-project/playcanvas-editor-skills-and-thermos-review-spec-2026-06-08.md`
- `.backup/PlayCanvas-Editor-Skills.md`
- `.backup/Исследование-PlayCanvas-Editor-Skills.md`
- `memory-bank/currentResearch.md`
- `memory-bank/research/playcanvas-editor-minimal-compatibility-backend-research-2026-06-05.md`
- `packages/universo-react-playcanvas-editor-frontend/README.md`
- `packages/universo-react-playcanvas-editor-frontend/package.json`
- `packages/universo-react-playcanvas-editor-frontend/vendor/UPSTREAM.md`
- `packages/universo-react-playcanvas-editor-frontend/vendor/package.playcanvas-editor.json`
- `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/AGENTS.md`
- `packages/universo-react-playcanvas-editor-backend/README.md`
- `packages/universo-react-playcanvas-editor-backend/package.json`
- `packages/universo-react-playcanvas-editor-backend/src/index.ts`
- `.agents/skills/playcanvas-engine-runtime/SKILL.md`
- `.agents/skills/autoreview/SKILL.md`
- `.agents/skills/SOURCES.md`
- `.agents/agent-profiles/README.md`
- `https://developer.playcanvas.com/user-manual/`
- `https://developer.playcanvas.com/user-manual/editor/`
- `https://developer.playcanvas.com/user-manual/editor/editor-api/`
- `https://api.playcanvas.com/editor/`
- `https://github.com/playcanvas/editor`
- `https://raw.githubusercontent.com/playcanvas/editor/main/package.json`
- `https://github.com/playcanvas/editor/tree/c4916f4973963341984499f2d919f8bfd38e417c`
- `https://github.com/playcanvas/editor-mcp-server`
- `https://github.com/playcanvas/editor-mcp-server/blob/main/README.md`
- `https://github.com/cursor/plugins/tree/main/thermos`
- `https://github.com/cursor/plugins/blob/main/thermos/README.md`
- `https://github.com/cursor/plugins/tree/main/thermos/skills`
- `https://github.com/cursor/plugins/tree/main/thermos/agents`
- `https://github.com/cursor/plugins/blob/main/thermos/LICENSE`
- `https://github.com/cursor/plugins/blob/main/cursor-team-kit/agents/thermo-nuclear-code-quality-review.md`
- `https://github.com/cursor/plugins/tree/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review`
- Context7 MCP query for `/playcanvas/engine`
