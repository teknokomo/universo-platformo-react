# Research: Release Screenshot Coverage And EN/RU Capture Plan

> Created: 2026-11-17
> Status: Reviewed research; current-build captures prepared for 0.86-0.90; publication pending
> Trigger: Audit all GitHub releases and propose English/Russian screenshots with local sources.

## Research Question

Which published releases lack embedded images, and which existing screenshots or new captures best illustrate their actual changes?

## Sources And Method

- [GitHub releases](https://github.com/teknokomo/universo-platformo-react/releases): live GitHub connector `list_releases`, page 1 with 100 items returned 90 releases; page 2 returned an empty array. Release range: `0.1.0-pre-alpha` through `0.90.0-alpha`.
- Release bodies were checked for Markdown images and HTML `img`/`picture` elements. This is an embedding audit, not a network-availability check for existing images or an assessment of their languages.
- The web reader returned an old cached releases page ending at 0.76; the live connector supersedes it.
- Local tracked documentation assets, their dimensions, relevant screenshot generators, and historical tag trees were inspected. Candidate images were visually inspected in contact sheets. No application, database, or browser test suite was started. No GitHub content was changed.
- OntoIndex workspace search failed with `workspace_build_failed/input_refused`. Explicit committed search returned a stale index (`3d2fac43`, local HEAD `aac43aea`) with unknown source provenance. Source inspection is authoritative for this audit.

## Coverage Result

User follow-up narrowed the action scope to the latest five releases. Missing images before 0.20 are intentional and require no work. Fresh 1920x1080 EN/RU capture pairs are available in [the release screenshot gallery](../../artifacts/release-screenshots-2026-11-17/README.md), together with two block-introduction alternatives and a checksummed provenance manifest. These current-build captures supersede the reuse-only recommendations below. No GitHub release was edited.

**24 releases lack embedded images; 66 have images.**

- Recent missing: `0.86.0-alpha`, `0.87.0-alpha`, `0.88.0-alpha`, `0.89.0-alpha`, `0.90.0-alpha`.
- Historical missing: every release from `0.1.0-pre-alpha` through `0.19.0-pre-alpha`, inclusive.
- Every release from `0.20.0-alpha` through `0.85.0-alpha` has an embedded image.

## Recent Release Plan

All paths below are relative to the repository root. Use `docs/en/.gitbook/assets/` for EN and `docs/ru/.gitbook/assets/` for RU unless noted. Current assets can include later changes: validate each against its target tag before treating it as a historically exact release capture.

| Release | Actual release scope | Main image and existing source | Additional capture / caveat |
| --- | --- | --- | --- |
| [0.90](https://github.com/teknokomo/universo-platformo-react/releases/tag/0.90.0-alpha) | MMOOMM economy dialog, ledger read scoping, runtime page polish | `mmoomm-economy/mmoomm-economy-panel-en.png` and `mmoomm-economy/mmoomm-economy-panel-ru.png`: actual localized economy panels with wallet, cargo, capacity, market actions, and recent operations; 600×756 EN and 600×796 RU | Recommended new main shot: 1920×1080 flight runtime with Economy dialog visibly open after a successful trade. Existing `mmoomm-economy-page-en.png` / `-ru.png` are 1920×1080 flight-only shots with no visible dialog, despite the guide caption. Ledger access scoping is backend behavior and should be described in text, not claimed as proven by a screenshot. |
| [0.89](https://github.com/teknokomo/universo-platformo-react/releases/tag/0.89.0-alpha) | Theme Presets and layout appearance | `theme-presets/theme-presets-appearance-tab.png`: EN appearance form with light/dark preview, palette, spacing and shape controls; 1176×989 | `theme-presets/theme-presets-preset-manager-dialog.png` is an optional 600×432 EN preset-management shot. Both RU files are byte-identical copies of EN files, confirmed with SHA-256; **no genuine RU screenshot exists in those paths**. Capture the localized RU form and manager, and preferably replace E2E sample names with readable demo names. Add an EN/RU runtime before/after theme comparison to show user benefit. |
| [0.88](https://github.com/teknokomo/universo-platformo-react/releases/tag/0.88.0-alpha) | Messenger App, catalog visibility, secure bot bindings | `messenger-app-template/messenger-app-runtime-en.png` and `messenger-app-template/messenger-app-runtime-ru.png`: localized 390×844 mobile public runtime with cards; reusable now | Optional new shot: application settings showing a configured bot binding and public address, without tokens, plus a real Telegram/MAX client view. Existing files show a browser-rendered runtime and do not demonstrate actual launch in a messenger. A browser stub is not external-client acceptance. |
| [0.87](https://github.com/teknokomo/universo-platformo-react/releases/tag/0.87.0-alpha) | Public Dashboard, Interpretation Network runtime, Sixth Muse fixture policy | Recommended new main shot: anonymous public Dashboard with a populated read-only Structure/Matrix and selected Material. Existing `interpretation-network/cells-and-materials.png` is a useful EN/RU authoring illustration, with a child cell and material editor | `interpretation-network/workspace-and-matrix.png` has just the root cell and an empty-material warning; `overview.png` is mostly empty. Neither is a strong release cover or proof of anonymous access. The generator already attaches `anonymous-public-dashboard-en` / `-ru` in test output; these are generated artifacts, not committed docs PNGs. Capture or recover artifacts from an appropriate run, and choose a populated state. |
| [0.86](https://github.com/teknokomo/universo-platformo-react/releases/tag/0.86.0-alpha) | Block-based LMS quiz, Sixth Muse assessment, personal-to-shared Workspace lifecycle | `lms-user-guide/guest-access-step-2.png` shows block introduction and timer; `guest-access-step-3.png` shows the first question and answer choices, under both locales | RU images are usable. EN images have English interface controls but preserve Russian Sixth Muse source content; do not describe them as fully English screenshots. For fully English copy, capture an English demo assessment with the same block/timer behavior. Keep the source assessment intact. Optional extra: personal-to-shared Workspace conversion confirmation and resulting shared Workspace; current source screenshots do not cover that change. |

## Local Documentation And Reproduction Sources

- `docs/en/guides/mmoomm-economy.md` and RU equivalent; `tools/testing/e2e/specs/flows/snapshot-import-mmoomm-app-economy.spec.ts` writes EN/RU docs panel/page assets from its viewport matrix.
- `docs/en/platform/theme-presets.md` and RU equivalent; `tools/testing/e2e/specs/visual/theme-presets.visual.spec.ts` explicitly uses the authenticated English Chromium project. It is an EN baseline source, not evidence of RU coverage.
- `docs/en/platform/messenger-app-template.md` and RU equivalent; `tools/testing/e2e/specs/flows/snapshot-import-messenger-app-public-runtime.spec.ts` contains localized responsive runtime captures and a desktop public Welcome shot.
- `docs/en/interpretation-network/workspace-and-matrix.md`, `cells-and-materials.md` and RU equivalents; `tools/testing/e2e/specs/generators/docs-interpretation-network-screenshots.spec.ts` contains the anonymous public capture flow.
- `docs/en/lms/guest-access.md` and RU equivalent; `tools/testing/e2e/specs/generators/docs-lms-user-guide-screenshots.spec.ts` contains `captureGuestBlockFlowGuide`, generating steps 2 and 3 in an anonymous guest context.

## Historical Releases: Capture Storyboard

No verified, release-specific EN/RU image pairs were found in the current documentation for these early product states. The `0.19.0-pre-alpha` tree includes generic Flowise `assets/Demo.png`, `images/flowise.png`, and `images/flowise.gif`, but these are not verified Universo release-specific screenshots and should not be represented as such. Look for original author captures in historical issues/PR attachments and archives, then recover from a matching tag in an isolated environment if needed. Historical attachments were not exhaustively searched in this audit.

The following are **proposed capture subjects inferred from release notes**, not claims that those screens remain available on current main. Prepare separate English and Russian UI/content captures where localization existed in that release. Do not retrofit modern screens onto early releases.

| Release | Proposed screenshot subject, EN and RU | Availability / historical qualification |
| --- | --- | --- |
| 0.19 | UPDL graph using Space/Data nodes, PlayCanvas publication tab with MMOOMM selected, then generated 3D scene | Most visually informative early release. Recover exact tab/nodes from the tag or original captures. |
| 0.18 | Chat Flow editor with a small working flow after Flowise 2.2.8 migration | Primarily migration/fixes; use a real workflow rather than inventing a new UI feature. |
| 0.17 | Expanded Profile fields and updated Documentation / Chat Flows / Agent Flows navigation | Capture profile fields with synthetic data and navigation visible. |
| 0.16 | User Profile, account update controls, optionally Analytics | Show successful normal state; hide personal account values. |
| 0.15 | Compact UPDL Data nodes and the initial scoring workflow/result | Verify exact scoring surface at the tag; avoid modern LMS imagery. |
| 0.14 | AR.js publishing settings with library loading source selection | Capture selector in context. |
| 0.13 | UPDL Space graph with multiple objects and resulting AR scene; saved publication settings | Prefer graph + actual output pair. |
| 0.12 | The working simplified UPDL publishing flow after legacy removal | No clear new visual feature; recover a normal published output or use a clearly labeled historical overview. |
| 0.11 | UPDL editor, AR.js publishing panel and generated AR output | Module/build refactoring is explained in release text. |
| 0.10 | Publish app and authentication screen | Choose the completed user flow, not implementation/build logs. |
| 0.9 | Initial UPDL editor and Publish app inside a Unik | Capture graph and publication result with period-appropriate UI. |
| 0.8 | Multi-user sign-in and available Uniks/workspaces | Authorization changes need textual explanation; do not expose real users. |
| 0.7 | First AR.js scene with marker and object | Capture the real AR output; keep any original nonlocalized output intact, with EN/RU captions if UI has no language-specific text. |
| 0.6 | Registration/login and chatbot inside a Unik | Capture both locale variants if supported at that tag. |
| 0.5 | Populated Document Store and template gallery inside Uniks | Release explicitly mentions core i18n; make separate locale captures. |
| 0.4 | Complete Uniks list/detail workflow | Use period-correct demo workspaces. |
| 0.3 | Basic Uniks list and creation/detail view | Avoid showing later functionality. |
| 0.2 | Multi-user entry/account experience | Confirm which account screens existed before selecting the frame. |
| 0.1 | Original initial application screen or first working prototype | Historical archival capture preferred; do not invent a fully localized initial UI if unavailable. |

## Execution Plan

1. Fill the current releases first: reuse the EN/RU Economy panel for 0.90, mobile Messenger runtime for 0.88, and RU quiz steps for 0.86. Use EN Theme screenshot for 0.89 as an interim asset, clearly recognizing missing RU localization.
2. Capture gaps: true RU Theme form/manager; populated anonymous Dashboard/Matrix for 0.87; full MMOOMM page with dialog visibly open; fully English block-quiz content if required. Supplement with an actual messenger-client frame only after a real launch.
3. Store curated release pairs under a dedicated versioned location such as `docs/<locale>/.gitbook/assets/releases/<tag>/`. Record source tag/commit, date, locale, viewport and whether the frame is historical or a later illustrative capture. Do not overwrite current documentation during selection.
4. Use one main frame per locale per release; add one secondary frame where it explains a second workflow. Desktop default: 1920×1080; Messenger mobile: 390×844. Verify text readability, loaded data, complete dialogs, absence of page-level overflow, and locale parity. Use existing product primitives and the runtime UX quality gate if capture infrastructure/UI needs modification.
5. Review the selected files, then embed EN and RU frames in the corresponding release sections. Current request covers research/planning only; no release publication has been performed.
6. Handle 0.19→0.1 as a separate historical recovery pass. Use isolated checkouts/instances and historical dependencies; do not reset the active checkout or feed historical code the current database. If a tag has no localized UI, preserve historical fidelity and provide translated captions instead of fabricating a localized screen.

## Uncertainty

- Existing release image URLs were not checked for broken links. Image presence does not mean the image works or has both locales.
- Current docs screenshots are not automatically historically exact at a release tag.
- Historical GitHub issue/PR attachments and CI artifact retention require a follow-up recovery pass.
- No new captures or functional acceptance tests were executed.
