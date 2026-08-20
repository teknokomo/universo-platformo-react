# Interpretation Network GitBook Documentation Research - 2026-08-20

## Research Question

How should the existing Interpretation Network implementation be documented as a complete GitBook-style EN/RU user guide with locale-specific screenshots, while preserving the project runtime UX, security, fixture, and testing contracts?

## Source Inventory

### Local Project Sources

- `docs/en/guides/interpretation-network.md` and `docs/ru/guides/interpretation-network.md`: current overview-level Interpretation Network documentation.
- `docs/en/architecture/interpretation-network-data-model.md` and `docs/ru/architecture/interpretation-network-data-model.md`: current architecture contract.
- `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`: GitBook navigation structure.
- `docs/en/.gitbook/assets/**` and `docs/ru/.gitbook/assets/**`: existing locale-specific screenshot asset layout.
- `tools/testing/e2e/specs/generators/docs-lms-user-guide-screenshots.spec.ts`: existing pattern for EN/RU documentation screenshot generation.
- `tools/docs/check-lms-user-guide-docs.mjs` and `tools/docs/check-gitbook-screenshot-assets.mjs`: existing docs quality gates.
- `tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts`: canonical Interpretation Network snapshot generator.
- `tools/testing/e2e/support/interpretationNetworkFixtureContract.ts`: strict fixture contract and template/runtime metadata assertions.
- `tools/testing/e2e/support/runInterpretationNetworkVerificationLocalSupabase.mjs`: existing minimal-local-Supabase verification wrapper.
- `tools/testing/e2e/specs/flows/interpretation-network-*.spec.ts` and `tools/testing/e2e/specs/visual/interpretation-network-workspace.spec.ts`: existing browser flows and visual proof.
- `packages/universo-react-apps-template-mui/README.md` and `README-RU.md`: runtime widget and Interpretation Network package contracts.
- `packages/universo-react-metahubs-backend/README.md` and `README-RU.md`: template seeding and fixture contract.
- `packages/universo-react-applications-backend/README.md`: runtime command, permission, and workspace isolation contracts.
- `packages/universo-react-types/src/common/interpretationNetworkLayout.ts`: shared config schema for structure mode and Matrix view settings.
- `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/**`: runtime workspace, Matrix, template, material, and dialog implementation.
- `packages/universo-react-applications-backend/src/services/interpretationNetwork/**`: backend aggregate command boundary.

### Tool/External Source Status

- Context7 MCP was requested by the user, but no callable Context7 resolve/query tools were available in this session after tool discovery. No Context7-derived library claims are used in this research artifact.
- Web search was attempted for current GitBook, Playwright, TanStack Query, and MUI documentation patterns, but the web tool returned no usable result body in this session. No external web claims are used here.
- Implementation should refresh external primary docs if the Context7 or web tools become available before code changes. The likely refresh topics are Playwright screenshots/visual assertions, MUI TextField multiline/localization, TanStack Query mutation invalidation, and GitBook image/navigation conventions.

## Key Findings

1. The repository already has an EN/RU GitBook structure with locale-local assets under `docs/<locale>/.gitbook/assets/`.
2. The current Interpretation Network guide is detailed for architecture and behavior, but it is not a step-by-step user guide with screenshots for the full workflow.
3. The LMS documentation system is the strongest reusable precedent:
   - a generator creates locale-specific screenshots from real browser flows;
   - a checker validates docs, assets, screenshot uniqueness, localization, and technical leakage;
   - package scripts provide screenshot, check, and local-Supabase verification commands.
4. The Interpretation Network verification wrapper already runs the minimal local Supabase lifecycle, fixture generation, fixture contract, fixture drift, focused flows, visual proof, i18n check, link check, and screenshot asset check.
5. Existing browser oracles already cover the runtime UX concerns needed for documentation evidence:
   - no page-level horizontal overflow;
   - no technical leakage;
   - localized validation;
   - semantic field controls;
   - runtime viewport matrix.
6. The plan must not rely on hand-edited fixture JSON. The canonical snapshot stays generated through Playwright and contract-checked.
7. Documentation screenshots must be generated from actual UI in both English and Russian. They must not show raw UUIDs, raw JSON, internal field names, `ParentCellId`, `OwnerId`, or hidden workflow knowledge.
8. Existing implementation risk areas that documentation can expose are:
   - hidden Matrix placement fields accidentally appearing in dialogs;
   - templates or materials showing raw structured values;
   - Application Matrix settings exposing raw widget config;
   - Russian UI fallback to English/internal validation;
   - page-level horizontal overflow in Matrix/table views;
   - screenshot generator drift from the canonical imported snapshot.

## Conflicts And Uncertainty

- The current codebase has substantial existing Interpretation Network functionality and tests, but the live browser state was not run during this PLAN turn.
- The Context7 and web documentation refresh could not be completed in this session, so external library guidance must be refreshed before implementation if tools are available.
- Existing tasks indicate some verification items can remain pending in `memory-bank/tasks.md`; implementation should re-run the current wrapper rather than relying on old results.

## Project Implications

- Add a dedicated Interpretation Network user guide section instead of overloading the current overview page.
- Reuse the LMS documentation screenshot pattern rather than inventing a new docs pipeline.
- Extend the existing Interpretation Network E2E wrapper to include the new docs screenshot generator and docs checker.
- Keep user-facing documentation focused on workflows, not backend IDs, snapshot internals, or debug-only details.
- Treat screenshot generation as a QA surface: failing UX or localization oracles should block documentation regeneration.

## Recommended Decision

Create a dedicated GitBook user guide for Interpretation Network under `docs/en/interpretation-network/` and `docs/ru/interpretation-network/`, with locale-specific screenshots under `docs/<locale>/.gitbook/assets/interpretation-network/`. Implement a Playwright docs screenshot generator and a docs checker modeled on the LMS guide, then wire them into package scripts and the Interpretation Network local-Supabase verification wrapper.

## Open Questions

- Whether the user wants the current `docs/<locale>/guides/interpretation-network.md` to remain as a high-level guide or become a short redirect/overview to the new user guide section.
- Whether screenshot baselines should be committed as only PNG assets or also paired with a generated manifest/provenance file for traceability.
- Whether the implementation should also include a separate administrator-focused page for Application Matrix settings, or keep it in the same user guide section.
