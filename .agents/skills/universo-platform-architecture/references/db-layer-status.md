# DB Layer Status (transitional)

This reference describes the status of the platform's database layer
and the practical rules for working with it during the current
transition. Use it whenever a task involves DB access, migrations,
schema changes, or proposes any change to the data-access stack.

The canonical, authoritative source for these rules is
`.kiro/steering/recommendations.md` section 2.10. This reference
mirrors the same content so it is reachable from skills loaded by
RESEARCH, PLAN, IMPLEMENT, QA, and other modes.

## Background

The platform previously used TypeORM. TypeORM was removed because it
could not flexibly support the patterns the platform needs:

- runtime schema generation (entity types created at runtime, not
  declared statically in code);
- dynamic DDL (creating tables, columns, and indexes from
  configuration);
- multi-tenant patterns with workspace-scoped data and RLS context.

The current data-access layer is the result of that decision.

## Current State

Database access is built on two complementary pieces:

- **Knex** — connection management, transactions, pool ownership, and
  the entry point for low-level DDL through schema-ddl.
- **Raw SQL through `DbExecutor.query()`** — domain queries and
  mutations. SQL is schema-qualified, parameterized with `$1`, `$2`,
  and routed through helpers (`qSchema`, `qTable`, `qColumn`,
  `qSchemaTable`).

Two project rules sit on top of this:

- The **three-tier executor pattern**:
  - Tier 1 (`getRequestDbExecutor(req, getDbExecutor())`) — RLS-aware,
    request-scoped, used by authenticated route handlers.
  - Tier 2 (`getPoolExecutor()`) — admin/bootstrap/background work
    that intentionally runs without RLS context.
  - Tier 3 (`getKnex()`) — schema-ddl, migration runners, and explicit
    package-local DDL boundaries only.
- The **Knex boundary rule**: domain route handlers, stores, and
  services must not import `knex` or call `getKnex()` directly. Any
  package that needs DDL/runtime schema work isolates that work behind
  a dedicated boundary (for example `src/ddl/index.ts`).

`@universo-react/schema-ddl` (runtime schema generation, migration, and diff
utilities) is the load-bearing piece for DDL/migration work.

## Maturity

This layer is functional and is the canonical path for new code. The
team treats it as **work-in-progress**: it works, but parts of it are
not yet fully consolidated and may evolve. Some areas (for example,
the migration tooling, the boundary between Knex and raw SQL) are
expected to be tightened over time.

This is normal at this stage of the project. It is **not** an
invitation to rewrite the layer opportunistically.

## Possible Future Directions

The team has not picked a direction. The following options are on the
table; do not act on them without an explicit decision:

- **Lean into Knex query builder.** Move more domain code from raw SQL
  to the Knex query builder, where doing so does not lose the
  flexibility the current raw-SQL path gives us.
- **Project-specific DB subsystem on top of `pg`.** Build a custom
  data-access and migrations subsystem on top of `pg` for maximum
  flexibility, reliability, performance, and security, accepting the
  cost of owning more of the stack.
- **Keep the current split, tighten contracts.** Keep the Knex + raw
  SQL split as it is, and invest in tighter contracts (executor
  interface, parameter validation) and stronger migration tooling.

## Practical Rule

Until the team picks a direction:

- Keep new work on the **current path**:
  - three-tier executors,
  - `DbExecutor.query()` with parameterized, schema-qualified SQL,
  - `@universo-react/schema-ddl` for DDL/migrations.
- Do not propose ambitious DB-layer rewrites as part of unrelated
  tasks. A change to the data-access stack is a strategic decision;
  route it through a dedicated discussion (a brief or a design
  document), not a side change in a feature task.
- Do not extend the layer with new abstractions "in case they are
  useful later". Add only what the current task needs, in the shape
  the current contracts already use.
- If a task requires touching the layer in a way that does not fit
  the current contracts, surface that as a finding and ask before
  changing the contracts.

## Quick Sanity Check

When reviewing a change that touches DB access:

1. Does it use the right tier? Authenticated route handlers must use
   Tier 1; admin/bootstrap work uses Tier 2; only schema-ddl and
   migration runners use Tier 3. → If not, fix.
2. Does it import `knex` or call `getKnex()` from a domain route,
   store, or service? → Reject; isolate the DDL work behind a
   dedicated boundary.
3. Is the SQL schema-qualified and parameterized with `$1`, `$2`?
   → If not, fix.
4. Do mutations (`UPDATE` / `DELETE`) use `RETURNING` and fail closed
   on zero-row results when row confirmation matters? → If not, fix.
5. Does the change propose a broad rewrite of the layer (for example,
   "move everything to Knex query builder", "introduce a new ORM",
   "replace `DbExecutor`")? → Reject from this task; route through a
   dedicated discussion.

## See Also

- `.kiro/steering/recommendations.md` — sections 2.3–2.10 (canonical
  rules for DB access in new packages).
- `.agents/skills/nodejs-backend-patterns` — generic Node.js backend
  patterns; defer to the project-specific rules above when they
  conflict.
