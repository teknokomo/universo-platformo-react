# Research: 1C-Compatible Metahub Template

> Created: 2026-05-26
> Updated: 2026-05-26
> Status: Draft
> Trigger: RESEARCH request for `.manager/specs/platformo/1c-compatible-metahub-template-spec-2026-05-25.md`; follow-up decision that the template name should be `1C-Compatible`
> Follow-up plan: ../plan/1c-compatible-metahub-template-plan-2026-05-26.md

## Research Question

What metadata-object concepts from 1C:Enterprise 8.x must be represented by a new opt-in Universo metahub template named `1C-Compatible`, which concepts map to existing `Object`/`Ledger` capabilities, and which require Entity Type Constructor, runtime schema, posting, UI, legal-wording, or DB-layer extensions before implementation planning?

The repository decision this research supports is how to implement a `1C-Compatible` template as a curated set of specialized entity type presets while preserving the current default `basic`, `basic-demo`, and `lms` behavior based on `Object` plus `recordBehavior`.

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
|--------|------|------------------|----------------|
| `.manager/specs/platformo/1c-compatible-metahub-template-spec-2026-05-25.md` | Local brief | 2026-05-25 | Defines the requested 12-preset scope, non-goals, DB constraints, and initial naming options. |
| User follow-up in RESEARCH mode | Product decision | 2026-05-26 | Resolves the template naming decision in favor of `1C-Compatible`. |
| `.agents/skills/universo-platform-architecture/SKILL.md` | Local architecture source | Skill version 1.3.0 | Defines the two-level type system, Object `recordBehavior`, template boundaries, layer placement, and DB-layer constraints. |
| `.agents/skills/universo-platform-architecture/references/entity-types-mapping.md` | Local architecture source | Current repository reference | Maps existing presets to 1C-style concepts and states the "strengthen existing preset" rule plus the planned 1C-compatible exception. |
| `.kiro/steering/recommendations.md` | Local engineering policy | Current steering | Requires three-tier executors, schema-qualified SQL, `DbExecutor.query()`, and `@universo-react/schema-ddl` for DDL. |
| `memory-bank/techContext.md` | Local architecture source | Last reviewed 2026-05-22 | Captures the current generic entity architecture, template registry, runtime schema, and DB executor baseline. |
| `memory-bank/systemPatterns.md` | Local architecture source | Current Memory Bank | Requires research artifacts before link/current/legal-sensitive planning and reinforces runtime UI quality rules. |
| `.backup/Типы-сущностей-1С-совместимого-метахаба.md` | Local external analysis | Provided with brief | Proposes required metadata-object types, constructor changes, and legal constraints. |
| `.backup/1С-совместимые-метахабы-анализ-и-разработка.md` | Local external analysis | Provided with brief | Adds detailed register, chart, clean-room, database-rights, and trademark analysis. |
| `packages/universo-react-types/src/common/recordBehavior.ts` | Local code | Current tree | Shows existing numbering, effective date, lifecycle, posting target, and immutability behavior on `Object`. |
| `packages/universo-react-types/src/common/ledgers.ts` | Local code | Current tree | Shows existing ledger modes, field roles, projections, periodicity, registrar policy, and validation. |
| `packages/universo-react-metahubs-backend/src/domains/templates/data/index.ts` | Local code | Current tree | Confirms the current built-in templates and entity type preset registry. |
| `https://v8.1c.ru/platforma/spravochniki/` | Primary vendor documentation | Page shows 2026 site footer/news | Defines catalogs as list data with code/name, auto-numbering, uniqueness, hierarchy, subordination, tabular parts, predefined elements, and generated forms. |
| `https://v8.1c.ru/platforma/dokumenty/` | Primary vendor documentation | Page shows 2026 site footer/news | Defines documents as business events with number/date/time, periodic numbering, tabular parts, and posting. |
| `https://v8.1c.ru/platforma/registr-svedeniy/` | Primary vendor documentation | Page shows 2026 site footer/news | Defines information registers as dimension/resource records with attributes, optional periodicity, registrar binding, uniqueness keys, and read capabilities. |
| `https://v8.1c.ru/platforma/registr-nakopleniya/` | Primary vendor documentation | Page shows 2026 site footer/news | Defines accumulation registers as dimensional numeric movements with receipt/expense direction, registrar linkage, line uniqueness, balance/turnover variants, and totals/aggregate behavior. |
| `https://v8.1c.ru/platforma/registr-buhgalterii/` | Primary vendor documentation | Page shows 2026 site footer/news | Defines accounting registers, chart-of-accounts linkage, correspondence mode, debit/credit accounts, sub-conto analytics, registrar linkage, uniqueness, and totals. |
| `https://v8.1c.ru/platforma/plan-schetov/` | Primary vendor documentation | Page shows 2026 site footer/news | Defines chart of accounts hierarchy, predefined/user accounts, characteristic-type-based sub-conto analytics, and account flags. |
| `https://v8.1c.ru/platforma/plan-vidov-harakteristik/` | Primary vendor documentation | Page shows 2026 site footer/news | Defines characteristic type plans as hierarchical characteristic catalogs with value type metadata and optional additional value catalogs. |
| `https://v8.1c.ru/platforma/plan-vidov-rascheta/` | Primary vendor documentation | Page shows 2026 site footer/news | Defines calculation type plans, base-period dependencies, displacement by action period, and leading calculation types. |
| `https://v8.1c.ru/platforma/registr-rascheta/` | Primary vendor documentation | Page shows 2026 site footer/news | Defines calculation registers with dimensions/resources, calculation type linkage, action periods, registrar binding, schedules, recalculation records, displacement, and base-period dependencies. |
| `https://sovmestimo.1c.ru/dev/` | Primary vendor documentation | Crawled last week by search result | Shows 1C has an official compatibility certification/distribution channel and grants logo use only to certified products. |
| `https://solutions.1c.ru/about-products/` | Primary vendor documentation | Page copyright 2026 | Distinguishes `1C-Compatible` certified products and `1C-Joint` products from ordinary partner/vendor products. |
| `https://www.consultant.ru/document/cons_doc_LAW_64629/be05678dc42ddc67aae5be9ba9beebd367fb9a3f/` | Legal reference | Crawled last week by search result | Article 1259 supports the idea/expression boundary: ideas, concepts, principles, methods, systems, and technical/organizational solutions are not protected by copyright. |
| `https://xn--80aafg4awbfege9o.xn--p1ai/zakon/gk/1484/index.htm` | Legal reference | Current article mirror | Article 1484 supports trademark caution: using confusingly similar signs for registered/related goods or services can infringe trademark rights. |
| `https://pravo.ppt.ru/kodeks/gk/st-1334` | Legal reference | Crawled 2 weeks ago by search result | Supports the database extraction risk noted in the local legal analysis. |
| `https://www.postgresql.org/docs/current/rules-materializedviews.html` | Primary DB documentation | PostgreSQL 18 current docs, release notice 2026-05-14 | Gives the tradeoff for materialized projection tables: faster reads but refreshed/stale data. |
| `https://www.postgresql.org/docs/current/queries-with.html` | Primary DB documentation | PostgreSQL 18 current docs | Supports recursive hierarchy querying through `WITH RECURSIVE`, relevant for catalog/account hierarchies. |
| `https://www.postgresql.org/docs/current/ddl-generated-columns.html` | Primary DB documentation | PostgreSQL 18 current docs | Relevant for generated/searchable helper columns where dynamic metadata fields need indexed derived values. |

## Key Findings

- Fact: the product naming decision is now resolved. The template should be user-facing as `1C-Compatible`; PLAN should not reopen the naming choice unless new legal or business input is provided.
- Fact: there is no source-backed blocker to independently implementing metadata-object concepts similar to 1C:Enterprise 8.x. Article 1259 says copyright does not extend to ideas, concepts, principles, methods, processes, systems, ways, or technical/organizational solutions. This supports the clean-room approach in the local backup analyses.
- Fact: the `1C` mark still requires controlled wording. Article 1484 gives the trademark owner exclusive rights and restricts use that creates likelihood of confusion for registered or related goods/services. 1C also has an official `1C-Compatible` certification/distribution program, and 1C says certified products receive the right to use the official compatibility logo. Therefore, the project can use the chosen template name as a product decision, but must avoid claiming certification, partnership, approval, official compatibility, or logo rights unless actually granted.
- Fact: the current repository already has an explicit technical foundation for this work. `ObjectRecordBehavior` includes `reference` / `transactional` / `hybrid` modes, periodic numbering, effective-date behavior, lifecycle states, posting targets, posting module codenames, and immutability. `LedgerConfig` already includes `facts` / `balance` / `accounting` / `calculation` modes, periodicity, registrar policies, field roles, projections, and idempotency.
- Fact: the current built-in template registry includes `basic`, `basic-demo`, `empty`, and `lms`; built-in entity presets are `hub`, `object`, `page`, `set`, `enumeration`, `ledger`, and `fixed-values-library`. The new template should be additive in `packages/universo-react-metahubs-backend/src/domains/templates/data/` and must not make these base templates depend on specialized accounting presets.
- Fact: catalogs require more than `recordBehavior: reference`. Official 1C documentation identifies code/name identity, auto-numbering, code uniqueness, attributes, tabular parts, two hierarchy styles, catalog subordination, predefined elements, and list/item/group/choice forms. Universo has pieces of this through Object data schema, identity fields, hierarchy, relations, nested table components, and layouts, but lacks a named catalog preset with catalog-specific defaults and owner-subordination UX.
- Fact: documents require more than `recordBehavior: transactional`. Official 1C documentation emphasizes number/date/time identity, periodic numbering, chronological ordering, tabular parts, and posting into accounting state. Universo has periodic numbering, effective date, posting targets, modules, workflow posting commands, and LMS examples, but needs a stronger posting transaction contract for multi-register movement creation, unposting/reposting, and register idempotency.
- Fact: information registers map closely to the existing `Ledger` / `config.ledger` model when `mode: facts` and projections are `latest` or `timeline`. Missing pieces are first-class dimension/resource/attribute authoring semantics, registrar-bound uniqueness rules, periodicity-specific keys, and user-friendly constructor validation.
- Fact: accumulation registers map partly to `Ledger` with `mode: balance` and movement facts. Missing pieces are a domain-specific movement direction model, explicit Balance versus Turnover subtype, register-line uniqueness by registrar plus source line, and a decision on projection maintenance. PostgreSQL materialized views are suitable for some read projections but introduce refresh/staleness semantics, so posting-time projection tables or a controlled async worker may be needed for strict accounting state.
- Fact: accounting registers are materially more specialized than generic balance ledgers. They require chart-of-accounts linkage, optional correspondence mode, debit/credit account fields, sub-conto analytics determined by account metadata, quantitative/currency flags, and registrar-bound uniqueness. This should not be squeezed into the existing generic `Ledger` UI without new constructor semantics.
- Fact: calculation registers and calculation type plans are the most complex part of the 12-preset scope. Official documentation includes action periods, base periods, displacement, leading calculation types, schedules via information registers, recalculation records, and proportional base calculations. These should be deferred behind a stable register/posting foundation.
- Fact: charts of accounts and charts of characteristic types are not mere enumerations. A chart of accounts is a hierarchical record set with account/subaccount hierarchy, predefined accounts, account flags, and sub-conto configuration. A chart of characteristic types resembles a hierarchical catalog whose key behavior is typed dynamic values, which is essentially an EAV-like capability with stricter type governance.
- Inference: the first implementation phase should seed the full preset catalog metadata only if unsupported advanced presets can be marked "preview" or hidden from runtime creation. Otherwise, the first usable phase should include the core subset: Constant, Catalog, Document, Document Journal, Information Register, and Accumulation Register. Accounting Register and Charts can follow once chart/sub-conto semantics are designed. Calculation Register and Chart of Calculation Types should be last.

## Capability Mapping

| Proposed Preset | Current Coverage | Required Enhancement | New Capability / Service Likely Needed |
|-----------------|------------------|----------------------|----------------------------------------|
| Constant | `Set` / `fixed-values-library` can store fixed values. | Top-level constant preset, single-value editor, optional periodic history, no child Set dependency. | `singleValue` or detached `fixedValues` mode; periodic key schema. |
| Enumeration | Existing `enumeration` matches the concept. | Reuse the existing preset and include it in the `1C-Compatible` template with appropriate presentation. | None for core scope. |
| Catalog | `Object` supports data schema, records, hierarchy, relations, identity fields, layouts. | Catalog defaults: code/name, uniqueness, auto-numbering, groups/elements hierarchy mode, owner subordination, predefined rows, tabular parts UX. | `catalogBehavior` config or catalog preset over Object capabilities. |
| Document | `Object` supports transactional behavior, numbering, effective date, lifecycle, posting. | Strong document defaults: number/date, periodic numbering, posted state, posting/unposting/reposting actions, tabular parts, future-date policy. | Posting transaction service and movement-builder metadata. |
| Document Journal | Existing records list widgets can list one type. | Cross-document virtual list with shared columns, filtering, sorting, and optional SQL view/UNION generation. | `virtualCollection` or `journal` capability; safe SQL view DDL boundary. |
| Information Register | `Ledger` mode `facts`, field roles, periodicity, registrar policy. | Register-specific constructor UX, uniqueness keys by dimensions/period/registrar, latest/timeline projection defaults. | `registerKind: information` preset config and validation. |
| Accumulation Register | `Ledger` mode `balance`, numeric resource validation, projections. | Movement direction, balance/turnover subtype, strict registrar/source-line idempotency, totals maintenance. | Projection maintenance strategy: posting-time table, worker, or materialized view. |
| Accounting Register | `Ledger` has `accounting` mode placeholder. | Chart linkage, debit/credit correspondence, sub-conto analytics, currency/quantity flags. | Accounting ledger schema, chart-aware validation, movement line generator. |
| Calculation Register | `Ledger` has `calculation` mode placeholder. | Action/base periods, schedule binding, recalculation records, displacement and dependency logic. | Calculation engine and interval algebra service. |
| Chart of Accounts | `Object` hierarchy and records can store account trees. | Account/subaccount hierarchy, predefined accounts, off-balance/quantity/currency flags, sub-conto settings. | `accountChartBehavior` or Object preset with chart-specific validators. |
| Chart of Characteristic Types | `Object` hierarchy and components can store metadata rows. | Typed dynamic characteristics, allowed value-type set, additional value catalogs, EAV value storage. | `dynamicCharacteristic` / typed EAV capability. |
| Chart of Calculation Types | `Object` records can store types. | Base-period dependencies, displacement relationships, leading calculation types. | `calculationTypeGraph` capability and graph validation. |

## Conflicts And Uncertainty

- The initial research recommended a neutral template name. That recommendation is superseded by the 2026-05-26 product decision to use `1C-Compatible`.
- The product decision removes the naming question for PLAN, but it does not remove wording constraints. PLAN should include user-facing copy rules: no official certification claim, no 1C logo, no partner/affiliate wording, no import of 1C configurations, and an optional disclaimer if the template appears in public or commercial UI.
- The brief asks for all 12 presets, but the repository architecture warns against adding new built-in kinds when existing presets plus capabilities can cover the need. The reconciled decision is to implement the template as opt-in specialized presets built from existing capabilities where possible, not to make them new global defaults.
- The local backup analysis sometimes frames the work as "new classes of core entities." The current repository direction is more conservative: presets, capability configurations, generic services, and constructor UX should be extended first; new hard entity kinds are justified only for behavior that cannot be represented through capabilities.
- PostgreSQL materialized views are useful for precomputed register totals, but they are stale between refreshes. Strict accounting-style balances likely need posting-time transactional projection updates or a worker with clear consistency semantics. PLAN must choose one consistency model per phase.
- Official 1C documentation confirms the behavior shape, but it is not a specification for copying wire formats, table layouts, code, forms, UI style, logos, or configuration content. The implementation must remain independently designed and documented.
- The exact runtime storage shape for top-level Constants is still open: a dedicated single-value table/capability is semantically cleaner, while a detached Set-like storage path reuses more code. This affects DDL and UI planning.

## Project Implications

- Template data belongs under `packages/universo-react-metahubs-backend/src/domains/templates/data/`, with a new `1C-Compatible` template manifest added to `builtinTemplates` and new preset manifests added to `builtinEntityTypePresets` only when their capabilities are implemented and validated.
- Product/UI copy should use `1C-Compatible` as the template name, but implementation and documentation should avoid implying 1C certification or affiliation. If the UI or docs use compatibility wording beyond the template name, include a concise non-affiliation disclaimer.
- Type contracts likely start in `packages/universo-react-types/src/common/` by extending behavior/config schemas rather than adding UI-only flags. Candidate additions are `catalogBehavior`, `documentBehavior`, `singleValue`, `journal`, `registerKind`, `accountChartBehavior`, `dynamicCharacteristic`, and `calculationTypeGraph`.
- Backend changes must follow the current DB rules: request routes use Tier 1 executors, bootstrap/template seed work uses Tier 2 when appropriate, DDL/runtime schema work stays behind `@universo-react/schema-ddl` or an explicit DDL boundary, and domain SQL remains schema-qualified, parameterized, and identifier-safe.
- Existing `ObjectRecordBehavior` and `LedgerConfig` should be strengthened before adding parallel mechanisms. This protects `basic`, `basic-demo`, and `lms`, and keeps LMS ledger-style Objects valid.
- Runtime UI should reuse `@universo-react/apps-template-mui` and current metahub MUI primitives. New screens need a UI contract in PLAN: no raw IDs, no raw JSON/object cells, localized validation, multiline long text, and browser evidence against horizontal overflow.
- Posting must be treated as a transactional service contract, not only a workflow button. The service should support post, unpost, repost, idempotent movement generation, register-line uniqueness, and commit/rollback semantics across document and register writes.
- Clean-room traceability should be kept. Research artifacts, specs, plans, ER decisions, and implementation commits should show that the platform implements generic accounting metadata concepts independently and does not import 1C configurations, table layouts, code, or UI assets.

## Recommended Decision

Use `1C-Compatible` as the user-facing template name, per the 2026-05-26 product decision. Treat this as a compatibility-oriented template name, not as a certification, endorsement, partnership, or right to use 1C compatibility logos.

Implement the work in phases:

1. Foundation: strengthen existing `ObjectRecordBehavior`, `LedgerConfig`, constructor validation, template preset manifests, and template seeding without changing base templates.
2. Core usable template: Constant, reused Enumeration, Catalog, Document, Document Journal, Information Register, and Accumulation Register.
3. Accounting layer: Chart of Accounts, Chart of Characteristic Types, and Accounting Register.
4. Calculation layer: Chart of Calculation Types and Calculation Register after interval/dependency/recalculation semantics are designed.

Prefer specialized presets that compose existing capabilities and add behavior configs. Add a wholly new capability only when the existing capability set cannot express the concept cleanly.

## Open Questions Before PLAN

- Decide whether Phase 1 must expose all 12 preset names immediately as preview metadata, or ship only the core usable subset first.
- Choose the Constant storage strategy: new `singleValue` capability versus detached Set-like fixed value storage.
- Choose the posting expression model: declarative movement mapping, `onPosting` module, or both. Recommendation: both, with declarative mapping for common movements and module hooks for complex cases.
- Choose the initial accumulation totals consistency model: synchronous posting-time projection table, async worker, or materialized view. Recommendation: synchronous posting-time projection table for strict core balances; materialized views only for non-critical reports.
- Decide whether Document Journal should be persisted as a SQL view/materialized view through DDL or computed through parameterized UNION queries at read time.
- Decide whether a non-affiliation disclaimer is required in the product UI, or only in docs/marketing. The research recommendation is to include it wherever `1C-Compatible` is visible outside internal development contexts.

## Sources

- https://v8.1c.ru/platforma/spravochniki/
- https://v8.1c.ru/platforma/dokumenty/
- https://v8.1c.ru/platforma/registr-svedeniy/
- https://v8.1c.ru/platforma/registr-nakopleniya/
- https://v8.1c.ru/platforma/registr-buhgalterii/
- https://v8.1c.ru/platforma/plan-schetov/
- https://v8.1c.ru/platforma/plan-vidov-harakteristik/
- https://v8.1c.ru/platforma/plan-vidov-rascheta/
- https://v8.1c.ru/platforma/registr-rascheta/
- https://sovmestimo.1c.ru/dev/
- https://solutions.1c.ru/about-products/
- https://www.consultant.ru/document/cons_doc_LAW_64629/be05678dc42ddc67aae5be9ba9beebd367fb9a3f/
- https://xn--80aafg4awbfege9o.xn--p1ai/zakon/gk/1484/index.htm
- https://pravo.ppt.ru/kodeks/gk/st-1334
- https://www.postgresql.org/docs/current/rules-materializedviews.html
- https://www.postgresql.org/docs/current/queries-with.html
- https://www.postgresql.org/docs/current/ddl-generated-columns.html
