# Entity Types Mapping

This reference details the platform-level entity type presets and how Object's
`recordBehavior` covers the work that 1C:Enterprise 8.x splits across multiple
metadata objects. Use it when scoping a domain model, drafting a brief, or
reviewing a plan that introduces new entities.

## Two-Level Type System

Universo separates two concepts:

1. **Entity type presets** — the platform-wide catalog of reusable entity
   types. Each preset carries an `EntityTypeCapabilities` set that drives
   its behavior. Presets can be added (via the Entity Type Constructor) or
   shipped with the platform (`builtinEntityTypePresets`).
2. **Metahub templates** — curated subsets of presets that bootstrap a new
   metahub (`builtinTemplates`). The default template (`basic`) ships with
   five presets; an `empty` template ships with none and lets the user
   pick or build their own.

This is the inverse of how 1C:Enterprise works: 1C ships a fixed set of
metadata-object types and configurations choose which to use. Universo
ships a small, opinionated default set plus a constructor, and a future
"1C-compatible" template will deliver the full 1C metadata map for users
who explicitly want it.

## Platform Presets

The seven presets registered today in `builtinEntityTypePresets`:

### Hub (`hub`, internal alias `tree-entity`)

A hierarchical container with `treeAssignment` and `hierarchy` capabilities.
Hubs group other entities and provide nesting. Analog of a 1C information
base or a top-level 1C subsystem.

Use Hub when you need:

-   A logical root or branch in a hierarchy.
-   A boundary for navigation, ownership, or visibility.

### Object (`object`)

The core entity type. Object alone covers what 1C splits across Catalog,
Document, and Register types via three mechanisms:

-   **`recordBehavior` mode** on the entity instance:
    -   `reference` — Catalog-style reference data (people, products, courses).
    -   `transactional` — Document-style event records (orders, sessions,
        submissions) with date/number identity.
    -   `hybrid` — both reference and transactional behavior in one Object.
-   **`posting` capability** — Document-style posting (`Проведение`) into
    one or more target ledgers.
-   **`ledgerSchema` capability** — when an Object itself acts as an
    append-only register (balance, turnover, projection). LMS uses this
    pattern: every "ledger" entity in the LMS template is `kind: 'object'`
    with `config.ledger`, not a separate Ledger entity.

Object's full capability set (from `OBJECT_TYPE_CAPABILITIES`):
`dataSchema`, `records`, `treeAssignment`, `hierarchy`, `relations`,
`actions`, `events`, `modules`, `layoutConfig`, `runtimeBehavior`,
`physicalTable`, `identityFields`, `recordLifecycle`, `posting`,
`ledgerSchema`.

Use Object whenever the domain object has structured fields and a
lifecycle: directories, transactions, balances, projections.

### Page (`page`)

A content-first entity type. Carries the `blockContent` capability for
Editor.js-authored content. There is no direct 1C analog; Pages are how
the platform exposes rich, authored content (lessons, knowledge-base
articles, course overviews).

Capability set: `dataSchema`, `treeAssignment`, `actions`, `events`,
`modules`, `blockContent`, `layoutConfig`, `runtimeBehavior`.

Use Page when the dominant primitive is structured authoring (headings,
paragraphs, lists, embeds), not relational data.

### Set (`set`, internal alias `value-group`)

Typed fixed values (constants). Direct analog of 1C:Enterprise _Constants_
(`Константы`).

Capability set: `dataSchema`, `treeAssignment`, `fixedValues`, `actions`,
`events`, `modules`, `layoutConfig`.

Use Set for: feature flags, configuration parameters, fixed business
rules, license thresholds.

### Enumeration (`enumeration`, internal alias `option-list`)

A closed list of named values. Direct analog of 1C:Enterprise _Enumeration_
(`Перечисление`).

Capability set: `dataSchema`, `treeAssignment`, `optionValues`, `actions`,
`events`, `modules`.

Use Enumeration for: priority levels, status codes, kinds, types of
_something_ with a fixed set of options.

### Ledger (`ledger`)

A specialized preset for append-only registers. Available on the platform,
but **not included in the base templates** (`basic`, `basic-demo`, `lms`).
Will be a first-class member of the future 1C-compatible template.

Capability set includes `dataSchema`, `records`, `ledgerSchema`,
`posting`. Functionally similar to 1C Information / Accumulation /
Calculation Registers.

In the base templates, the same need is solved by Object +
`config.ledger` (see Object section above). That keeps the default
configuration smaller and avoids two parallel ways to express posting.

### Constants Library (`fixed-values-library`)

A specialized preset built on Set capabilities for typed constants
without runtime publication widgets. Use it when the deployment needs a
neutral constants store independent of the publication surface.

## Cross-Cutting Capabilities

### Attached Modules

TypeScript code that runs inside `isolated-vm`. Server-side or client-side,
scoped to the entity type or to specific actions/events. Equivalent in
role to module code in 1C:Enterprise (object module, form module).

Use modules for: validation that exceeds metadata declarative checks,
computed values, domain transitions (a module attached to a posting
action), workspace-bound automation.

### Workspaces

Multi-tenant runtime isolation for data produced by the published
configuration. Each workspace has its own data, its own membership, and
its own role-based access. There is no 1C analog; this is platform-level
multi-tenancy.

User-authored content lives in workspaces, not in the metahub.

## Metahub Templates and Their Preset Sets

| Template                    | Default presets                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `basic` (default)           | hub, page, object, set, enumeration                                                                              |
| `basic-demo`                | basic + seeded sample data                                                                                       |
| `empty`                     | _(none)_ — user picks via constructor                                                                            |
| `lms`                       | hub, page, object, set, enumeration; ledger-style Objects via `config.ledger`                                    |
| _(planned)_ `1c-compatible` | full 1C metadata map: hub, page, set, enumeration, plus separate Catalog / Document / Register / Charts entities |

Templates can:

-   Pre-include a subset of the platform presets;
-   Seed initial entities, layouts, settings, and modules;
-   Apply default `recordBehavior` and capability values for those entities.

The platform manifest type is `MetahubTemplateManifest`; presets are
declared via `MetahubTemplatePresetReference`
(`{ presetCodename, includedByDefault }`).

## Entity Type Constructor

The metahubs-frontend UI exposes a constructor that lets a user define a
custom entity type by selecting capabilities. Custom entity types:

-   Live alongside platform presets in the metahub where they are created;
-   Are validated against the dependency rules between capabilities (for
    example, `posting` requires `records`);
-   Can be exported as `EntityTypePresetManifest` and promoted to platform
    presets if they prove broadly useful.

Prefer the constructor over proposing a new built-in kind.

## Decision Flow

1. Is the data structurally rich and relational, with attributes and
   links? → **Object**, with `recordBehavior: reference`.
2. Is it a date-stamped event or transaction? → **Object**, with
   `recordBehavior: transactional`.
3. Does it aggregate values into balances or turnovers (in the base
   templates)? → **Object**, with `posting` and `config.ledger`.
4. Does the configuration explicitly want a 1C-style separate register
   entity? → **Ledger** preset (only in templates that opt in, such as the
   future 1C-compatible template).
5. Is the dominant primitive authored content (Editor.js)? → **Page**.
6. Is it a fixed configuration value with no lifecycle? → **Set** (or
   **Constants Library** for runtime-publication-free deployments).
7. Is it a closed list of named options? → **Enumeration**.
8. Otherwise: ask whether an existing preset plus capability tuning, or a
   custom entity type via the constructor, can cover the need before
   proposing a new built-in kind.

## Anti-Patterns

-   Inventing a new built-in kind when a custom entity type via the
    constructor can express the need.
-   Adding a separate Ledger entity to a base template just because the
    domain has registers; in base templates, posting flows go through
    Object + `config.ledger`.
-   Putting end-user-authored content into the metahub. The metahub holds
    seeded/default content; user content lives in workspaces.
-   Treating Set as a substitute for Object. Set holds values without a
    per-record lifecycle; if the user creates, edits, or deletes records
    at runtime, the type is Object.
-   Saying "behavior is added through Components" — Components are fields
    after the 2026-05-14 rename. Behavior comes from capabilities and from
    `recordBehavior` configuration.

## Components vs. Capabilities

After the 2026-05-14 rename:

-   **Components** = fields/attributes on an entity type. Authored in the
    metahub UI, stored as the entity's data schema, surfaced as form
    controls and data-grid columns at runtime.
-   **Capabilities** = infrastructure toggles
    (`EntityTypeCapabilities`) that drive entity-type behavior. They live
    on the entity type definition, not on individual records.

A brief that needs to add a new field to an Object talks about adding a
Component. A brief that needs to enable posting talks about turning on
the `posting` capability for the relevant entity type.
