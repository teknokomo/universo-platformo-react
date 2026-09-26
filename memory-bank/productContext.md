> **Last Reviewed**: 2026-09-26 (refreshed: repository 0.83.0-alpha; Entity-backed Marketing Hero authoring; shared non-published MUI dropdown baseline; active configuration set rechecked)

# Product Context

## Purpose

Universo Platformo extends an inherited upstream shell into a
**configuration platform**: organizations describe their domain on a
small, stable set of entity-type primitives, attach modules, and ship
the result as an **application** that runs in workspaces with multi-user
collaboration.

The same core primitives (Hub, Object, Project, Page, Set, Enumeration, Ledger,
Constants Library) cover everything from a learning management system
to a planning tool to a custom business application — without
introducing new platform-level types for each product.

## Development Philosophy

-   **Generic over feature-specific**: configuration data and i18n drive
    behavior; widgets stay generic. LMS-specific labels, icons, and
    flows are metadata, not widget code.
-   **Entity-owned widget content**: authoring widgets are graphical/no-code
    tools over ordinary Entity data. Business/content values live in
    Objects/Components; widget placement stores the semantic binding and
    presentation configuration instead of creating a parallel content store.
-   **Strengthen the existing primitive over adding a new one**: when a
    domain need does not fit the current entity types, prefer extending
    a preset (capabilities or `recordBehavior`) or building a custom
    type via the Entity Type Constructor.
-   **Three-layer placement**: domain logic and seeded content live in
    the metahub; deployment-wide tuning lives in the application
    control panel; user-authored content lives in workspaces.
-   **Minimal changes to the inherited shell** where it still works.
-   **Backwards compatibility** when feasible.
-   **Operational stability**: pool budgets aligned with Supabase
    limits; pool error telemetry enabled.
-   **Shared runtime DDL**: all schema generation lives in
    `@universo-react/schema-ddl` to avoid coupling between feature packages.

## Primary Configuration: LMS

The first complete product on the platform is an **LMS configuration**,
benchmarked against **iSpring LMS Learning Content**. The current
implementation goal is to drive Learning Content (Projects, Standalone
Content, Courses, Learning Tracks, Quizzes) to functional parity with
iSpring LMS while staying on the platform's generic primitives.

The LMS configuration starts from the `lms` metahub template, which
includes the same five presets as the basic template (Hub, Object,
Page, Set, Enumeration). Ledger-style entities in the LMS template are
implemented as `kind: 'object'` with `config.ledger` (Learning
Activity, Enrollment, Attendance, Certificate, Points, Notification) —
demonstrating "strengthen the existing preset" rather than adding a
separate Ledger entity.

Out of scope for the current LMS slice (deferred):

-   File and SCORM/xAPI/media import.
-   AI-assisted content generation.
-   Internal messaging.

These will be revisited once the core Learning Content surface reaches
parity.

## Other Active And Planned Configurations

-   **Universo MMOOMM** (planned/early design): a massively multiplayer
    space sandbox built on the platform. Production chains, territorial
    control, corporations, and integration with Kiberplano for
    real-world execution.
-   **Universo Kiberplano** (planned/early design): an integrated
    planning system that bridges digital plans, multi-agent
    orchestration, distributed nodes, and robotic execution.
-   **1C-compatible metahub template**: active built-in template with specialized metadata presets for organizations migrating 1C-style transactional/accounting models.
-   **Interpretation Network**: active template/runtime for hierarchical structures, interpretations, cells, relations, materials, and reusable matrix/table models.
-   **Marketing Page**: active data-driven MUI 9 template proving persisted widget composition, scoped layouts, responsive runtime controls, and Entity-backed reusable authoring. The `marketing.hero` pilot binds to `MarketingPageHero` Object records and supports automatic source provisioning plus advanced source reuse/customization.
-   **PlayCanvas/MMOOMM**: active Project-bound 3D authoring/runtime path using the vendored PlayCanvas Editor, engine runtime, modules, and Colyseus realtime packages.

These configurations share the platform; they are not separate
products.

## Architectural Transition

The platform is in active transition from a "feature packages on
`universo-template-mui`" layout to an "everything is an Application on
`apps-template-mui`" layout. Today:

-   `metahubs-*`, `applications-*`, `admin-*`, `profile-*`, `start-*`,
    `auth-*` live as **separate workspace packages** rendered through
    `universo-template-mui`.
-   `apps-template-mui` is the new template for **published
    applications**. It is intentionally **isolated** from
    `universo-template-mui` and the legacy feature packages —
    component duplication is acceptable during the transition.
-   System applications are bootstrapped today via a **pseudo-app
    pattern** (hand-built base snapshots → file migrations → first-run
    install). The likely future direction is JSON-snapshot
    configurations.
-   A first-run **Setup Wizard** is planned: it will list required and
    recommended system applications and let the user choose additional
    applications from the bundled set and from a central marketplace.

Practical rule: continue developing in the existing legacy packages
when the work fits there. Do not block tasks on the
metahub-as-application migration completing.

The full description lives in
`.agents/skills/universo-platform-architecture/references/architectural-transition.md`.

## Workspace Multi-User Collaboration

Each published application carries its own **workspaces**. A workspace
provides:

-   isolated runtime data per tenant,
-   role-based membership,
-   end-user content authoring (create, edit, copy, delete) for users
    with sufficient role,
-   per-workspace preferences and overrides where applicable.

User content always lives in workspaces — never in the metahub or in
the application control panel.

## Use Cases

### LMS

-   Build courses, lessons, learning tracks, quizzes through the
    metahub authoring surface.
-   Seed default content with the configuration; let instructors author
    real courses inside the published LMS application's workspaces.
-   Track enrollments, attendance, certificates, and points through
    `config.ledger` Objects.

### Custom Business Applications

-   Model directories (catalogs), event records (documents), and
    aggregations (registers) as Objects with the appropriate
    `recordBehavior` mode and capabilities.
-   Use Pages for authored content (knowledge base, articles,
    onboarding instructions).
-   Attach TypeScript modules for validation, derived values, and
    domain transitions.

### Multi-Tenant Workspaces

-   Run a single configuration across many tenants with isolated data,
    membership, and access policies.
-   Replace legacy 1C:Enterprise 8.x deployments with a more flexible
    model that still feels familiar to 1C users (with the future
    1C-compatible template).

## Legacy Product Surface (historical context)

Earlier versions of the platform shipped a UPDL system (Universal
Description Platform Language) for AR.js and PlayCanvas applications,
along with packages such as `updl/`, `publish-frontend/`,
`publish-backend/`, and `analytics-frontend/`. Those packages were
removed from the active workspace. The current product focus is the
metahub configuration model described above. References to UPDL in
older documentation describe a historical surface, not the current
product.

## Current Status

-   **Repository version**: `0.83.0-alpha`.
-   **Recent focus**: Entity-backed Marketing Hero authoring, unified application-template widgets/scoped layouts, and shared MUI selection controls for non-published management surfaces; Interpretation Network and PlayCanvas/MMOOMM remain major runtime workloads, and LMS remains an active product configuration.
-   **Platform groundwork**: ongoing consolidation of the metahub
    configuration model, the entity type constructor, and the
    metahub-as-application transition.

## Next Development Focus

-   Continue productizing generic Entity-backed widget/layout authoring so Marketing, Interpretation Network, LMS, and future configurations share the same content-ownership, binding, and runtime contracts.
-   Continue LMS Learning Content parity work on generic primitives.
-   Continue the metahub-as-application migration: replace legacy
    feature packages (one area at a time) with applications shipped
    through `apps-template-mui`.
-   Mature the DB layer (see `.kiro/steering/recommendations.md`
    § 2.10 for the open question: deeper Knex query builder vs.
    project-specific DB subsystem).
-   Stand up the first-run Setup Wizard and the central marketplace.
-   Build out Universo MMOOMM and Universo Kiberplano on the platform.

---

_For the technical baseline see [techContext.md](techContext.md). For
the day-to-day execution focus see [activeContext.md](activeContext.md)._
