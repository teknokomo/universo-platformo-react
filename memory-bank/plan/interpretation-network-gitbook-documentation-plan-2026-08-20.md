# Interpretation Network GitBook Documentation Plan - 2026-08-20

## Overview

Create a complete GitBook-style EN/RU documentation set for the Interpretation Network MVP. The documentation must be step-by-step, backed by real browser screenshots, and aligned with the current generated fixture `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`.

This is a documentation and verification plan. It does not change schema or metahub template versions, and it does not preserve obsolete legacy documentation.

Research artifact: `memory-bank/research/interpretation-network-gitbook-docs-research-2026-08-20.md`.

## Affected Areas

- `docs/en/interpretation-network/**`
- `docs/ru/interpretation-network/**`
- `docs/en/guides/interpretation-network.md`
- `docs/ru/guides/interpretation-network.md`
- `docs/en/SUMMARY.md`
- `docs/ru/SUMMARY.md`
- `docs/en/.gitbook/assets/interpretation-network/**`
- `docs/ru/.gitbook/assets/interpretation-network/**`
- `tools/testing/e2e/specs/generators/docs-interpretation-network-screenshots.spec.ts`
- `tools/docs/interpretation-network-screenshot-manifest.json`
- `tools/docs/interpretation-network-screenshot-provenance.json`
- `tools/docs/check-interpretation-network-docs.mjs`
- `tools/docs/check-gitbook-screenshot-assets.mjs` if generic asset validation needs small reuse improvements
- `tools/testing/e2e/support/runInterpretationNetworkVerificationLocalSupabase.mjs`
- root `package.json` docs scripts
- Relevant package READMEs if the final doc locations or commands change
- Potential implementation stabilization only if browser screenshot generation reveals actual UX or security defects:
  - `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/**`
  - `packages/universo-react-apps-template-mui/src/components/dialogs/FormDialog.tsx`
  - `packages/universo-react-applications-backend/src/services/interpretationNetwork/**`
  - `packages/universo-react-applications-backend/src/controllers/runtimeInterpretationNetwork*.ts`

## UI Contract

| Surface | Visible controls and values | Hidden/system-owned fields | Required proof |
| --- | --- | --- | --- |
| Metahub template and app creation | Human-readable template name, localized metahub/application names, normal create/import/publication controls | Template ids, application ids, publication ids, schema ids | EN/RU screenshots, no raw IDs, no hidden setup workflow |
| Publication and snapshot import | Import/create flow by file/template label, status feedback by user text | Snapshot hash, internal entity ids, runtime schema names | Browser import proof, fixture contract, no raw JSON |
| Published start page | Sidebar links, workspace switcher, Start content, Structures entry | Widget ids, layout ids, internal codenames | EN/RU screenshots and no technical leakage |
| Single-system Matrix | Matrix tab, Templates tab, Universe/root cell, Save as template, Add child flow | `CellId`, `ParentCellId`, `RowKey`, `ColKey`, `_tp_sort_order`, `MaterialRef` | No hidden fields in forms or screenshots, viewport matrix proof |
| Child cell dialog | Localized `CellValue`, optional multiline `CellDescription`, style controls, save/cancel | Matrix placement fields and runtime row ids | `expectSemanticFieldControls`, localized validation, payload assertion excludes placement fields |
| Materials pane | Material title, multiline description, block content, create/edit/delete actions | Material row id, `TemplateOwnerId`, raw Editor.js JSON | No object cells or raw block JSON on normal surfaces |
| Templates | Template list/detail, Save as template, copy policy labels, create from template in multiple mode | Template row id, cloned material ids, provenance fields | Permission-aware screenshots and API isolation proof |
| Application Matrix settings | Structure mode select, Matrix view checkboxes/selects, split-pane toggle, template placement toggles, reset action | Widget ids, source config payload, raw layout JSON | Admin-oriented screenshots, localized validation, no raw config cells |

Blocking UX rules:

- Normal user docs and screenshots must not show raw UUIDs, raw JSON, `[object Object]`, internal field names, `ParentCellId`, `OwnerId`, widget ids, relation ids, schema names, or hidden workflow knowledge.
- Long text fields must be multiline.
- Validation must be localized in EN/RU and must not leak raw Zod/internal phrases.
- Page-level horizontal overflow is a blocker at `1920x1080`, `768x1024`, and `390x844`. Matrix/table component-local scrolling is allowed only inside the constrained component.
- If any screenshot exposes a UX leak, fix the generic runtime implementation first in `apps-template-mui` or backend command boundaries. Do not add LMS-specific forks or screenshot-only workarounds.

## Plan Steps

### Phase 1 - Baseline and Documentation Structure

- [ ] Inspect the current dirty worktree and record unrelated changes before edits.
- [ ] Re-check the exact current Interpretation Network files with `rg`/targeted reads:
  - template data and validation in `packages/universo-react-metahubs-backend/src/domains/templates/data/**`;
  - snapshot validation in `packages/universo-react-metahubs-backend/src/domains/publications/services/interpretationNetworkSnapshotValidation.ts`;
  - shared config in `packages/universo-react-types/src/common/interpretationNetworkLayout.ts`;
  - runtime UI in `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/**`;
  - backend aggregate commands in `packages/universo-react-applications-backend/src/services/interpretationNetwork/**`;
  - E2E helpers in `tools/testing/e2e/support/interpretationNetwork*.ts`.
- [ ] Use OntoIndex before any code edits to explore and run safe-edit checks on touched symbols. If OntoIndex reports stale graph evidence, coordinate a refresh before relying on graph-backed claims.
- [ ] Refresh external primary docs if tools are available:
  - Context7 for Playwright screenshots/assertions, MUI multiline/localization, TanStack Query mutation invalidation, and GitBook image/navigation conventions;
  - web fallback only from official sources if Context7 is unavailable.
- [ ] Create a dedicated GitBook user-guide section:
  - `docs/en/interpretation-network/README.md`
  - `docs/en/interpretation-network/getting-started.md`
  - `docs/en/interpretation-network/create-and-publish.md`
  - `docs/en/interpretation-network/application-settings.md`
  - `docs/en/interpretation-network/workspace-and-matrix.md`
  - `docs/en/interpretation-network/cells-and-materials.md`
  - `docs/en/interpretation-network/templates.md`
  - `docs/en/interpretation-network/troubleshooting.md`
  - exact RU mirrors under `docs/ru/interpretation-network/`.
- [ ] Keep `docs/<locale>/guides/interpretation-network.md` as a concise conceptual overview that links to the new user guide and data-model architecture page.
- [ ] Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` with a top-level Interpretation Network section.

### Phase 2 - Screenshot Generator and Asset Contract

- [ ] Add `tools/testing/e2e/specs/generators/docs-interpretation-network-screenshots.spec.ts`, modeled on the LMS docs generator.
- [ ] Generate screenshots from the actual product UI against minimal local Supabase. The generator must:
  - import `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`;
  - create/sync a linked application without `pnpm dev`;
  - run on `http://127.0.0.1:3100` through the repository Playwright wrapper;
  - capture both `en` and `ru` locales;
  - save assets to `docs/<locale>/.gitbook/assets/interpretation-network/`;
  - write `tools/docs/interpretation-network-screenshot-provenance.json`.
- [ ] Capture at least these screenshot groups:
  - overview/start page;
  - create/publish/import application setup path;
  - Application Matrix settings;
  - single-system Matrix;
  - add child cell dialog;
  - styled child cell result;
  - Materials pane create/edit;
  - Save as template dialog;
  - Templates tab/detail;
  - create from template in multi-Structure mode;
  - permission/read-only or troubleshooting state;
  - responsive mobile/tablet key view.
- [ ] Add a manifest file describing every screenshot id, EN/RU paths, doc page, required visible text, viewport, and oracle set.

Example screenshot capture helper:

```ts
const captureDocScreenshot = async (
  page: Page,
  testInfo: TestInfo,
  entry: ScreenshotEntry,
  locale: 'en' | 'ru'
) => {
  await applyBrowserPreferences(page, { language: locale, isDarkMode: false })
  await expect(entry.surface(page)).toBeVisible()
  await expectNoTechnicalLeakage(entry.surface(page), { locale })
  await expectNoPageHorizontalOverflow(page, `${entry.id}:${locale}`)
  for (const text of entry.requiredVisibleText[locale]) {
    await expect(page.getByText(text, { exact: false })).toBeVisible()
  }
  await page.screenshot({
    path: entry.outputPath(locale),
    fullPage: true,
    animations: 'disabled'
  })
}
```

### Phase 3 - Documentation Content

- [ ] Write EN docs first using user-facing language. Avoid implementation-only wording such as raw ids, raw JSON, internal codenames, schema names, or API-only steps.
- [ ] Write RU docs as a native Russian version, not a partial transliteration. Keep product/technology names only where appropriate.
- [ ] Each page should follow a stable GitBook pattern:
  - frontmatter description;
  - role and goal;
  - main screenshot;
  - prerequisites;
  - numbered workflow;
  - one screenshot per important step;
  - expected result;
  - what to check;
  - related pages.
- [ ] Document both user workflows and administrator workflows:
  - creating an Interpretation Network metahub/application from the template;
  - importing the snapshot fixture for verification/demo use;
  - opening the published app;
  - using the single-system Matrix;
  - creating child cells;
  - attaching Materials;
  - saving and instantiating templates;
  - changing Matrix settings in Application Settings;
  - troubleshooting validation, permissions, and reset conflicts.
- [ ] Preserve architectural cross-links to:
  - `docs/<locale>/architecture/interpretation-network-data-model.md`;
  - `docs/<locale>/guides/application-layouts.md`;
  - `docs/<locale>/guides/snapshot-export-import.md`;
  - `docs/<locale>/contributing/runtime-ui-ux-quality-gate.md`.

### Phase 4 - Docs Quality Gate

- [ ] Add `tools/docs/check-interpretation-network-docs.mjs`.
- [ ] The checker must validate:
  - EN/RU page parity;
  - every manifest screenshot exists and is referenced;
  - every referenced local image exists;
  - PNG dimensions and nonblank image data;
  - screenshot uniqueness where a step sequence should not duplicate the overview;
  - no TODO/FIXME/placeholders;
  - no raw UUID/JSON/internal field wording in user guide text;
  - RU user text does not unexpectedly fall back to English;
  - `SUMMARY.md` contains every new page in both locales;
  - `docs/<locale>/guides/interpretation-network.md` links to the new guide section.

Example docs leakage guard:

```js
const TECHNICAL_TEXT_PATTERNS = [
  /\\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\b/i,
  /\\b(?:ParentCellId|OwnerId|TemplateOwnerId|MaterialRef|RowKey|ColKey)\\b/,
  /\\{[\\s\\S]{0,200}"(?:type|blocks|recordId|targetId)"[\\s\\S]{0,200}\\}/i,
  /\\[object Object\\]/
]
```

- [ ] Add root scripts:
  - `docs:interpretation-network:screenshots`
  - `docs:interpretation-network:screenshots:local-supabase`
  - `docs:interpretation-network:check`
  - `docs:interpretation-network:verify`
  - `docs:interpretation-network:verify:local-supabase`

### Phase 5 - Implementation Stabilization If Screenshots Expose Defects

- [ ] If forms expose hidden/system-owned fields, fix metadata-to-control behavior generically, then add or update unit tests near:
  - `FormDialog.tsx`;
  - `useCellDialogActions.ts`;
  - `useCellMutations.ts`;
  - `InterpretationNetworkWorkspaceWidget.test.tsx`.
- [ ] If runtime tables/cards expose raw objects or ids, fix generic display formatting in `apps-template-mui` and add regression tests.
- [ ] If backend accepts direct mutation of Matrix placement/material fields through generic APIs, harden the aggregate command/controller boundary and add Jest tests.
- [ ] If Application Matrix settings expose raw widget config or unlocalized validation, fix the settings UI and locale keys in the owning frontend packages.
- [ ] Use TanStack Query patterns where touched code already uses query-driven state: prefer `useMutation`, precise query keys, optimistic updates only with rollback, and invalidate affected runtime queries after success.

Example safe mutation shape:

```ts
const mutation = useMutation({
  mutationFn: (input: SaveTemplateInput) => saveTemplate(api, input),
  onMutate: async (input) => {
    await queryClient.cancelQueries({ queryKey: interpretationNetworkTemplateKeys.list(input.applicationId, input.workspaceId) })
    const previous = queryClient.getQueryData(previousKey)
    queryClient.setQueryData(previousKey, (current) => applyOptimisticTemplate(current, input))
    return { previous }
  },
  onError: (_error, _input, context) => {
    queryClient.setQueryData(previousKey, context?.previous)
  },
  onSuccess: (_result, input) => {
    queryClient.invalidateQueries({ queryKey: interpretationNetworkTemplateKeys.list(input.applicationId, input.workspaceId) })
  }
})
```

Example backend aggregate command guard:

```ts
const result = await exec.query<{ id: string }>(
  `UPDATE ${qSchemaTable(schema, table)}
   SET ${qColumn(versionColumn)} = ${qColumn(versionColumn)} + 1
   WHERE id = $1
     AND workspace_id = $2
     AND _app_deleted = false
   RETURNING id`,
  [rowId, workspaceId]
)

if (result.rows.length !== 1) {
  throw new RuntimeDomainError(404, 'INTERPRETATION_NETWORK_ROW_NOT_FOUND')
}
```

### Phase 6 - Verification

- [ ] Run focused docs checks:
  - `pnpm docs:interpretation-network:check`
  - `pnpm docs:i18n:check`
  - `pnpm docs:gitbook-screenshot-assets:check`
  - `node tools/docs/check-gitbook-links.mjs`
- [ ] Run focused package tests after any code stabilization:
  - `pnpm --filter @universo-react/types test -- interpretationNetwork`
  - `pnpm --filter @universo-react/apps-template-mui test -- InterpretationNetworkWorkspaceWidget`
  - `pnpm --filter @universo-react/applications-backend test -- runtimeInterpretationNetwork`
  - relevant package lint/build commands.
- [ ] Run fixture checks:
  - `pnpm run check:interpretation-network-fixture-contract`
  - `pnpm run check:interpretation-network-fixture-drift`
- [ ] Run local minimal Supabase proof:
  - `pnpm run docs:interpretation-network:verify:local-supabase`
  - `pnpm run test:e2e:interpretation-network:verify:local-supabase`
- [ ] Run runtime guards:
  - `pnpm run check:apps-template-isolation`
  - `pnpm run check:runtime-no-lms-forks`
- [ ] Run `git diff --check`.
- [ ] Run OntoIndex diff verification before commit.
- [ ] Run Thermos/autoreview for any code modifications. For docs-only changes, still run docs checks and record that no product code changed.

## Potential Challenges

- Context7 was not available in this PLAN session. Refresh external primary docs during implementation if the MCP tools are available.
- EN/RU screenshot flows can become flaky if they depend on visual timing. Use role/label/test-id locators and web-first assertions before captures.
- The existing imported snapshot flow is broad. Keep the docs generator focused and reuse helper functions instead of duplicating the full product verification spec.
- Screenshots can accidentally preserve transient E2E names or test-only strings. Canonicalize user-facing labels and reject `E2E`/run ids in the docs checker unless the screenshot is explicitly a test-only artifact outside GitBook.
- The current docs checker for LMS is intentionally strict. The new Interpretation Network checker should reuse its useful ideas, but not copy LMS-specific forbidden wording that would block legitimate Interpretation Network concepts.
- Local Supabase needs Docker and port availability. If the environment blocks Docker, record the blocker and still run non-browser docs checks and focused unit tests.

## Dependencies

- Repository Playwright wrapper and E2E app startup on `http://127.0.0.1:3100`.
- Minimal local Supabase scripts:
  - `pnpm supabase:e2e:start:minimal`
  - `pnpm env:e2e:local-supabase`
  - `pnpm doctor:e2e:local-supabase`
  - `pnpm supabase:e2e:stop`
- Existing fixture generator and fixture contract.
- Existing runtime UX oracles in `tools/testing/e2e/support/browser/runtimeUx`.
- Existing i18n registration for `apps-template-mui` and shared keys.

## Discussion Checkpoint

The recommended MVP scope is documentation plus screenshot/test infrastructure first. Product code changes should be made only if the browser-backed documentation generator exposes a real UX, localization, security, or data-integrity defect.
