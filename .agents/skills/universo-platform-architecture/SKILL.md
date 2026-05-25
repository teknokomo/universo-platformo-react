---
name: universo-platform-architecture
description: Use when planning, implementing, or reviewing work that touches metahub configurations, the metahub→application→workspace placement of behavior, the platform-level entity type presets (Hub, Object, Page, Set, Enumeration, Ledger, Constants Library), the Entity Type Constructor, metahub templates (basic, basic-demo, empty, lms), LMS-style configurations, the legacy feature packages (metahubs-*, applications-*, admin-*, profile-*, start-*) being migrated to applications, the apps-template-mui transition, the pseudo-app bootstrap pattern, the planned first-run Setup Wizard and marketplace, or the platform DB layer status (Knex + raw SQL through DbExecutor, three-tier executors, @universo/schema-ddl, the post-TypeORM transitional state). Encodes the two-level type system, the `recordBehavior` mechanism that lets Object cover Catalog/Document/Register-style behavior, the strengthen-existing-type rule, and the practical rules for development during the architectural transition.
metadata:
    version: '1.3.0'
    scope: 'universo-platform-architecture'
    file_policy: 'markdown-only'
---

# Universo Platform Architecture

Use this skill whenever a task touches metahub configurations, the metahub
control plane, workspaces inside published applications, the platform's
entity type presets (Hub, Object, Page, Set, Enumeration, Ledger, Constants
Library), the Entity Type Constructor, metahub templates, the legacy
feature packages (`metahubs-*`, `applications-*`, `admin-*`, `profile-*`,
`start-*`) and their migration to applications, the apps-template-mui
transition, the pseudo-app bootstrap pattern, the planned first-run Setup
Wizard, or comparisons to 1C:Enterprise 8.x.

This skill is project-wide and shared by every mode that needs the
architectural context (for example, RESEARCH, PLAN, IMPLEMENT, QA, REFLECT).
It is the single source of truth for the architectural concepts and
placement rules; any file that needs to reference these concepts must link
here instead of restating them.

## What This Skill Encodes

-   The **two-level type system**: platform-level entity type presets (the
    catalog), and metahub templates (curated subsets of presets used to
    bootstrap a new metahub).
-   The set of presets currently registered on the platform and what each one
    models, including the `Constants Library` preset built on Set
    capabilities and the `Ledger` preset for specialized register-style work.
-   The `recordBehavior` mechanism on Object (`reference` /
    `transactional` / `hybrid` modes) plus `posting` and `ledgerSchema`
    capabilities — the way the base templates cover Catalog/Document/Register
    behavior without introducing new entity kinds.
-   The **Entity Type Constructor**: how custom entity types are built from
    capabilities and registered as new presets.
-   The three-layer placement of behavior: metahub → application control
    panel → workspaces inside the published application.
-   The "strengthen the existing preset/template, do not invent a new entity
    kind" rule, with the future "1C-compatible" template as a deliberate
    exception that delivers a complete 1C:Enterprise metadata-object map.
-   Components vs. Capabilities terminology after the 2026-05-14 rename:
    Components are fields/attributes on an entity type; Capabilities are the
    infrastructure-level toggles that drive entity-type behavior.
-   The anti-pattern of feature-specific (e.g. LMS-only) hardcoding in
    shared widgets.
-   The **architectural transition status**: feature areas (metahubs,
    applications, admin, profile, start) currently live as separate
    workspace packages on top of `universo-template-mui`; the long-term
    goal is "everything is an Application" rendered through
    `apps-template-mui`. Continue developing in the existing packages
    during the transition; do not block on the migration completing.
-   The **pseudo-app pattern** used to bootstrap system applications today
    and the likely move toward JSON-snapshot-shaped configurations.
-   The **Setup Wizard** that will run on first launch to install system
    applications and marketplace applications.
-   The **DB layer status**: the platform replaced TypeORM with Knex +
    raw SQL through `DbExecutor.query()`, plus `@universo/schema-ddl` for
    DDL/migrations. The layer is work-in-progress; new code stays on the
    current path (three-tier executors, parameterized schema-qualified
    SQL) and broad rewrites are routed through a dedicated discussion.

## Required Output

Before writing or reviewing a plan, brief, or implementation that touches
these concepts, confirm and record:

-   which platform preset each domain object maps to and why;
-   which metahub template the configuration starts from (`basic`,
    `basic-demo`, `empty`, `lms`, or a future template) and which presets
    that template includes;
-   which layer (metahub, application control panel, or workspace) owns each
    piece of behavior or content;
-   whether the work proposes a custom entity type via the Entity Type
    Constructor; if yes, which capabilities it enables and why an existing
    preset cannot cover the need;
-   whether the implementation reuses existing widgets/primitives or
    proposes a configuration-specific fork (the latter requires explicit
    justification).

## Blocking Rules

-   A regular user must be able to create, read, edit, copy, and delete
    configuration content from inside the **published application's
    workspace**, not from the metahub or the application control panel.
-   Domain logic and pre-seeded content live in the **metahub**. The
    application control panel exposes **global tuning** of the deployed
    instance. Confusing the layers (for example, putting end-user content
    authoring into the control panel) is a defect.
-   In the base templates (`basic`, `basic-demo`, `lms`), register-style
    behavior on Object goes through `recordBehavior` mode (`transactional`
    or `hybrid`) plus the `posting` and `ledgerSchema` capabilities. Do not
    add a separate `Ledger` entity to a configuration unless the registered
    template explicitly requires it.
-   Do not introduce a new built-in entity kind when an existing preset can
    be strengthened or when a custom entity type via the Entity Type
    Constructor can cover the need. New built-in kinds are reserved for
    needs the seven existing presets demonstrably cannot cover.
-   Do not hardcode configuration-specific behavior (for example, LMS-only
    flags, labels, icons) into shared widgets. Configuration-specific data
    belongs in metadata or i18n resources; widgets stay generic.
-   LMS-specific or any other configuration-specific UI must compose from
    the primitives in `packages/apps-template-mui` and
    `packages/universo-template-mui` (dashboards, data grids, cards, form
    dialogs). New widget types are justified only when the visual or
    interaction model truly cannot be expressed by the existing widget set.
-   During the architectural transition, do not block tasks on the
    metahub-as-application migration completing. Continue developing
    inside the existing legacy packages (`metahubs-*`, `applications-*`,
    `admin-*`, `profile-*`, `start-*`) when the work fits there. Create a
    new workspace package only when significant new functionality warrants
    its own boundary. Do not propose blanket rewrites of legacy packages
    to "get on the apps-template path early".

## Quick Reference

### Platform-Level Entity Type Presets

The platform registers seven presets in `builtinEntityTypePresets`
(`packages/metahubs-backend/src/domains/templates/data/index.ts`).
Each preset carries an `EntityTypeCapabilities` set that drives its
behavior.

| Preset                | Codename                      | Role                                                                                                                | Notable capabilities                                                                                                  |
| --------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Hub**               | `hub` (`tree-entity`)         | Top-level hierarchy / nesting                                                                                       | hierarchy, treeAssignment, layoutConfig, modules                                                                      |
| **Object**            | `object`                      | The core entity. Covers Catalog/Document/Register-style data via `recordBehavior` mode + `posting` / `ledgerSchema` | dataSchema, records, identityFields, recordLifecycle, posting, ledgerSchema, hierarchy, layoutConfig, runtimeBehavior |
| **Page**              | `page`                        | Structured content authored in Editor.js (block content)                                                            | dataSchema, blockContent, layoutConfig, runtimeBehavior                                                               |
| **Set**               | `set` (`value-group`)         | Typed fixed values (constants)                                                                                      | dataSchema, fixedValues, layoutConfig                                                                                 |
| **Enumeration**       | `enumeration` (`option-list`) | Closed list of named values                                                                                         | dataSchema, optionValues                                                                                              |
| **Ledger**            | `ledger`                      | Specialized append-only register; an alternative to Object+`recordBehavior` for the future "1C-compatible" template | dataSchema, records, ledgerSchema, posting                                                                            |
| **Constants Library** | `fixed-values-library`        | Set-style preset for typed constants without runtime publication widgets                                            | inherits Set capabilities                                                                                             |

Cross-cutting capabilities available to any preset:

-   **Attached modules** (TypeScript, isolated-vm) — server-side or
    client-side, scoped to the entity type or to specific actions/events.
-   **Workspaces** inside the published application — runtime isolation for
    the data produced by the configuration. End-user content lives here.

### Metahub Templates

Templates curate which presets a new metahub starts with. The platform
registers four templates in `builtinTemplates` (same `index.ts`):

| Template            | Codename     | Default presets                                                                             | Purpose                                            |
| ------------------- | ------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Basic** (default) | `basic`      | hub, page, object, set, enumeration                                                         | Minimal starter for most configurations            |
| **Basic Demo**      | `basic-demo` | basic + sample data                                                                         | Demonstration with seeded entities                 |
| **Empty**           | `empty`      | _(none)_                                                                                    | User picks presets manually or via the constructor |
| **LMS**             | `lms`        | basic preset set, plus seeded LMS objects (incl. ledger-style Objects with `config.ledger`) | Learning platform configuration                    |

Future templates (planned but not yet implemented) include a
**1C-compatible** template that exposes a full 1C:Enterprise metadata-object
map: separate Catalogs, Documents, Information Registers, Accumulation
Registers, Charts of Accounts, Charts of Calculation Types, Constants,
Enumerations, etc. It is **not the default path**; the base templates rely
on Object + `recordBehavior` instead.

### Entity Type Constructor

A user can author a custom entity type via the **Entity Type Constructor**
(metahubs-frontend UI). Custom types:

-   pick a subset of `EntityTypeCapabilities` (`dataSchema`, `records`,
    `posting`, `blockContent`, `ledgerSchema`, etc.);
-   become available alongside platform presets within the metahub where
    they were created;
-   can be promoted to platform-level presets if they prove broadly useful.

Prefer the Entity Type Constructor over proposing a new built-in kind.

### Layer Placement

```
Metahub                Application                Workspace
(canonical config)     (deployed instance)        (runtime isolation)
─────────────────      ────────────────────       ─────────────────────
Entity types,          Global settings:           Day-to-day end-user
relationships,         feature toggles,           content: created,
attached modules,      branding, defaults,        edited, copied, and
seeded content,        access policies            deleted by users
default layouts                                   with sufficient role
```

A piece of behavior or data goes to the layer that owns its lifecycle.
Built-in seeded content → metahub. Tuning of the deployed instance →
control panel. Real user-authored content → workspace.

### Strengthening Existing Presets

When a domain need does not fit the current set, prefer extending the
existing preset. Concrete examples:

-   Object already covers Catalog (via `recordBehavior: reference`),
    Document (via `recordBehavior: transactional`), and Register (via
    `posting` capability + `config.ledger`). For posting flows, strengthen
    Object — do not add a separate Ledger entity unless the configuration
    explicitly opts into the future 1C-compatible template.
-   Page is content authored in Editor.js. If structured content blocks are
    needed, extend Page or add a Component (field) on Object — do not
    invent a new "Article" type.
-   Set and Enumeration are intentionally minimal. Most "configuration
    option" needs map to one of these two, with `Constants Library` as a
    pre-built specialization of Set.

### Components vs. Capabilities (post-2026-05-14)

After the rename completed on 2026-05-14:

-   **Components** = fields/attributes on an entity type (formerly called
    `attributes`). They describe the data shape of the type.
-   **Capabilities** = infrastructure toggles that drive entity-type
    behavior (`dataSchema`, `records`, `posting`, `blockContent`,
    `ledgerSchema`, etc.). They are not user-visible UI entities.

When a brief or plan says "behavior is added through Components" it is
incorrect. Behavior on an entity type comes from its capabilities and
from authoring decisions (such as `config.recordBehavior` on Object).

## References

-   Read `references/entity-types-mapping.md` when scoping a domain model
    or drafting a brief that needs to map domain concepts onto presets and
    capabilities, including the 1C analogy via `recordBehavior` modes.
-   Read `references/configuration-workflow.md` when deciding which layer
    (metahub, control panel, workspace) owns a behavior or piece of
    content, or when picking a metahub template.
-   Read `references/lms-configuration-notes.md` when the work targets the
    LMS configuration specifically (Learning Content, Courses, Learning
    Tracks, ledger-style Objects in LMS).
-   Read `references/architectural-transition.md` when work touches the
    legacy feature packages, the apps-template-mui transition, the
    pseudo-app pattern, or the future Setup Wizard / marketplace.
-   Read `references/db-layer-status.md` when work touches database
    access, migrations, or proposes changes to the data-access stack
    (Knex + raw SQL through `DbExecutor.query()`, three-tier executor
    pattern, `@universo/schema-ddl`).

## Adjacent Skills

-   `mui-runtime-ux-patterns` — for UI work in the published application.
-   `runtime-ux-qa` — for User-friendly verification with browser evidence.
-   `nodejs-backend-patterns` — for backend work touching DbExecutor and SQL.
-   `research-before-plan` — for upstream research before PLAN.
