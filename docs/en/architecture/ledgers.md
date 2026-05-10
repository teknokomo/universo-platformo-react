---
description: Standard Ledger entity kind and its platform boundaries.
---

# Ledgers

`ledger` is a standard metahub entity kind for append-oriented operational facts.
It is the platform term for universal registers: information, accumulation, score, progress, accounting-like, and calculation-like behavior is modeled through one typed configuration block instead of separate entity families.

## Authoring Model

Ledgers are authored through the same Entity workspace as other standard kinds.
The metahub menu places Ledgers after Enumerations, and Ledgers use the shared generic entity list, dialog, search, pagination, and settings surfaces.

Ledger fields are ordinary field definitions.
The `config.ledger.fieldRoles` block classifies those fields as dimensions, resources, measures, attributes, period fields, source references, or workspace scope.
This keeps Ledger authoring compatible with the existing field editor and avoids a parallel Ledger-only schema designer.

## Snapshot Model

Ledger definitions are metadata, so they are exported in publication snapshots with their entity definition, fields, presentation, and `config.ledger`.
Operational ledger facts are not normal Catalog records and are not exported as seeded runtime rows by default.

Catalogs can also carry `config.recordBehavior`.
This block describes reference, transactional, or hybrid behavior, including identity fields, numbering, effective dates, lifecycle states, and posting policy.

## Runtime Boundary

Ledgers are excluded from generic runtime row CRUD.
Runtime Catalog rows remain the user-editable operational surface, while Ledgers are intended for posting, reporting, projections, and script-controlled fact append flows.

Transactional Catalog behavior is platform-owned.
Runtime schema generation adds `_app_record_*` and `_app_post*` columns for Catalogs with enabled `recordBehavior`, plus `_app_record_counters` for atomic numbering.
The row command API is:

- `POST /api/v1/applications/:applicationId/runtime/rows/:rowId/post`
- `POST /api/v1/applications/:applicationId/runtime/rows/:rowId/unpost`
- `POST /api/v1/applications/:applicationId/runtime/rows/:rowId/void`

These commands use row locks, optimistic version checks when provided, lifecycle hooks, atomic numbering through one upsert statement, and fail closed for invalid transitions.
Posted or voided rows are immutable for ordinary row and tabular mutations when `recordBehavior.immutability` requires it.

The generic runtime Ledger API is mounted under:

- `GET /api/v1/applications/:applicationId/runtime/ledgers`
- `GET /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts`
- `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts`
- `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts/reverse`
- `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/query`
- `GET /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/projections/:projectionCodename`

Append and reverse routes validate that the target object is a `ledger`, validate table and column identifiers, reject unknown fields, enforce required field roles, and only insert new facts.
Reversal creates compensating facts and never mutates the original facts.
They do not expose generic update or delete operations for Ledger facts.

Scripts may request `posting`, `ledger.read`, and `ledger.write` capabilities.
Capability checks remain fail-closed: a script without the required capability must not read or write Ledger facts.
Runtime scripts receive `this.ctx.ledger` with `list`, `facts`, `query`, `append`, and `reverse` methods only through those capability checks.

`beforePost` lifecycle handlers may also return a declarative movement result:

```ts
return {
  movements: [
    {
      ledgerCodename: 'ProgressLedger',
      facts: [{ data: { Learner: learnerId, ProgressDelta: 1 } }]
    }
  ]
}
```

The runtime accepts this contract only for ledgers declared in `config.recordBehavior.posting.targetLedgers`.
Movements are appended through the generic Ledger service inside the same posting transaction.
Invalid movement shape, undeclared ledgers, unknown Ledger fields, or Ledger append failures abort posting and prevent `afterPost`.

## LMS Usage

The canonical LMS template defines `ProgressLedger` and `ScoreLedger`.
They model progress and assessment facts while keeping LMS behavior as configuration, not a runtime fork.
Generic dashboard widgets and reports should read ledger projections through shared datasource contracts rather than LMS-specific widgets.
