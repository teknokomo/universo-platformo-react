# QA: Unified Entity-Backed Widget Authoring / Marketing Hero Plan

> Date: 2026-09-23
> Reviewed plan: `memory-bank/plan/unified-entity-backed-widget-authoring-hero-pilot-plan-2026-09-22.md`
> Inputs: source TZ, technical brief, research, historical `.backup/Архитектура-виджетов.md`, and current repository source
> Disposition: material plan defects found and incorporated into the reviewed plan; implementation has not started

## Evidence and method

Three independent read-only reviews checked (1) requirement traceability,
(2) backend binding/lifecycle/security feasibility, and (3) existing MUI
authoring UX reuse. The main review verified their findings against current
source. The historical backup study was analyzed in research section 11,
which identifies what remains valid and why JSONB content-per-widget and
renderer-side Entity queries do not fit the current platform. Official MUI
9.2.0 and TanStack Query v5 documentation was checked through Context7; MUI
Autocomplete, TanStack Query invalidation, and PostgreSQL concurrency guidance
were also checked from primary web sources.

This was a document and source QA pass. Product code, a fresh Supabase database,
new Hero UI, screenshots, and E2E behavior were not validated. Those remain
implementation acceptance gates in the plan.

## Historical research cross-check

The complete 38-line `.backup/Архитектура-виджетов.md` was read directly in
this QA pass. Its six numbered recommendations map to the amended plan as
follows:

| Historical recommendation                                      | Current decision                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One structured Entity content model and reusable relationships | Hero content is an Object/Components record; widget placements hold references, not a copy of text or action data. Other Entity kinds remain possible through capability-based slots.                                                                                           |
| Widgets as no-code Entity editors                              | The Hero entry point reuses the generic record editor and mutation, while presentation is saved separately in the existing widget dialog.                                                                                                                                       |
| JSONB flexibility                                              | JSONB remains a bounded layout/binding envelope, not a new canonical Hero document. Strict typed Components and server validation prevent the flexibility claim from becoming unrestricted content storage. The backup's general performance claim is not a measured guarantee. |
| Modular packages                                               | Shared serializable contracts live in `@universo-react/types`, reusable UI in `template-mui`, SQL/services in existing backend packages, and the published renderer in isolated `apps-template-mui`.                                                                            |
| API boundary for Entity data                                   | The existing REST/SQL-first service path serves record authoring and server-side binding resolution. The renderer receives a typed view model; a new GraphQL layer is unnecessary.                                                                                              |
| Migration/export for a new start                               | The current brief explicitly orders a disposable database rebuild without legacy migration or schema/template-version increase. Fresh template seed and snapshot/lifecycle tests replace the backup's speculative data conversion.                                              |

Thus the backup's central headless/content-ownership argument is retained,
while its broader JSONB, independent renderer fetch, new storage and migration
ideas are narrowed by the present codebase and the user's clean-break brief.

## Findings resolved in the plan

| Severity | Finding                                                                                                                                    | Resolution                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical | Research/plan changed the brief's repeatable Hero into a singleton, leaving extra records unusable.                                        | Keep the existing repeatable registry contract. Seed one Hero, add labelled record select/create for further metahub placements, and test two records rendered independently. |
| High     | The plan treated `EntityFormDialog` as the record editor, although generic records use `DynamicEntityFormDialog` through `RecordList`.     | Route the specialized entry point through the existing record-edit adapter, schema, mutation and locale controls.                                                             |
| High     | Proposed `createContent` did not match the current metahub record-create guard (`editContent`).                                            | Align the permission matrix with the route; require layout permission independently for placement and `editContent` when creating content.                                    |
| High     | Local application presentation overrides could preserve an old binding after source sync; ordinary app writes could drop neutral metadata. | Keep the full trusted envelope in persistence, audit update/batch/move/copy writers, and compose the new source binding with allowed local presentation fields.               |
| High     | Required EN/RU content, typed JSON actions and protected `default` were described as UI metadata rather than a direct-API guarantee.       | Add a server-side record policy for create/update/copy/delete, including full localized/action validation and live-binding protection.                                        |
| High     | The public resolver example did not establish the existing published-read boundary.                                                        | Extend the current published runtime store and same repeatable-read transaction, retaining publication/workspace/field allowlists and `no-store`.                             |
| High     | Published Hero records would remain writable through generic application runtime row APIs despite a read-only Workspace UI.                | Carry a source-owned record policy through materialization and reject all runtime mutation variants server-side.                                                              |
| High     | Application layout copy and `copy_source_as_application` could create Hero placements without source lineage or binding baseline.          | Reject both Hero-containing copy paths atomically in this pilot; test source-derived Exclude/Restore separately.                                                              |
| High     | A new Object-row lock taken before the existing layout graph lock could deadlock record-delete versus placement-bind.                      | Require graph lock before Object-row lock on both paths and prove the ordering with concurrent real-PostgreSQL tests.                                                         |
| High     | The layout widget response lacks a binding target, so repeated Hero cards could open the wrong record.                                     | Add an authorized placement-to-record read contract returning a bounded editor target and optimistic version.                                                                 |
| High     | The brief requires one serializable definition for labels, presentation fields and validation across both authoring hosts.                 | Add bounded presentation editor metadata to the shared widget definition and a cross-host contract test.                                                                      |
| Medium   | Architecture documentation was planned only after implementation.                                                                          | Publish the EN/RU slot/instance/ownership contract in Phase 0, then update it with implemented details in Phase 11.                                                           |
| Medium   | `maxInstances` refactored unrelated Dashboard/Marketing registries.                                                                        | Preserve the existing `repeatable` to `multiInstance` mapping; remove the broad refactor from the pilot.                                                                      |
| Medium   | Example Zod names were not defined; app re-add and E2E command were ambiguous.                                                             | Define bounded example schemas, distinguish metahub re-add from app Exclude/Restore, and use the repository's marketing verification wrapper.                                 |
| Medium   | The picker and table had no proven option source, display Component or empty/unavailable UX.                                               | Inventory route/anchor sources in Phase 0; use existing MUI/dialog/record primitives, set `Title` display metadata, and add loading/empty/unavailable states.                 |

## Traceability verdict

The amended plan covers the original TZ's Entity-owned content and widget
authoring model, the brief's seeded `MarketingPageHero` Object, repeatable
placement with different records, clean removal of Hero SiteSettings and
copy-source fields, two distinct slot/instance contracts, source-owned binding
policy, lifecycle propagation, server/public trust boundaries, existing MUI
authoring and renderer package boundaries, EN/RU UX, Jest/Vitest/real-Postgres/
Playwright evidence, and GitBook/README updates. The one seeded record is a
template default, not a cardinality restriction.

Deliberate pilot limits remain explicit: no generic ad-hoc backing-model
provisioning, arbitrary Entity-model picker, application rebind, workspace
content CRUD, or other marketing-widget migration. Canonical extra Hero
records belong to the metahub and publication scope; private workspace
records cannot enter its picker. These limits do not weaken the brief's
repeatable Hero requirement.

## Implementation proof still required

Before claiming release readiness, implementation must demonstrate a fresh
seed, concurrent bind/delete safety, record-policy enforcement through direct
API calls, neutral envelope survival across every app mutation, source sync
with local presentation changes, published-read isolation, two different Hero
records in EN/RU runtime, runtime write denial for source-owned Hero, atomic
denial of both application layout-copy paths, correct placement-to-record
editor targeting, actual browser screenshots at the planned viewports,
keyboard/a11y checks, and the full local marketing verification wrapper.
No currently observed test or screenshot establishes the new behavior.

Primary framework checks:

-   MUI Autocomplete: https://mui.com/material-ui/react-autocomplete/
-   TanStack Query mutation invalidation: https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations
-   PostgreSQL transaction isolation: https://www.postgresql.org/docs/current/transaction-iso.html
