# OntoIndex — Golden Universo Queries

Copy-ready queries that exercise the code graph against known Universo subsystems.
They double as the validation pilot checklist: run them after the first
`pnpm ontoindex:analyze` and confirm each returns the expected code paths.

All commands assume the pinned CLI is installed locally and run from the repo
root. The wrapper (`tools/ontoindex/run-ontoindex.mjs`) forwards verbs verbatim.

## Index Health

```bash
pnpm ontoindex:status
node tools/ontoindex/run-ontoindex.mjs list
```

Expect: a registered repo, an `.ontoindex/` graph, and indexed `lastCommit`
matching (or close to) `HEAD`.

## Impact / Blast Radius

```bash
# Three-tier DB executor surface — who depends on request-scoped execution?
node tools/ontoindex/run-ontoindex.mjs impact getRequestDbExecutor --include-tests --depth 2

# Entity-type resolution — fan-out across metahubs backend + consumers.
node tools/ontoindex/run-ontoindex.mjs impact EntityTypeResolver --depth 2
```

Expect: results spanning `@universo-react/database` and the metahubs backend,
plus dependent feature packages and their tests.

## Symbol / Flow Context

```bash
# Publication → application sync flow.
node tools/ontoindex/run-ontoindex.mjs query "publication sync application release bundle"

# Module runtime contract (isolated-vm / Worker boundary).
node tools/ontoindex/run-ontoindex.mjs query "module runtime sandbox isolated-vm worker"

# Metahub schema / DDL migration path.
node tools/ontoindex/run-ontoindex.mjs query "metahub schema service DDL migration branch"
```

Expect: ranked nodes grouped by process, pointing into the relevant backend
services rather than unrelated text matches.

## Routes

```bash
# Where are metahub entity-instance routes mounted?
node tools/ontoindex/run-ontoindex.mjs query "entity instances routes metahub router"
```

## Pre-Commit Audit

```bash
pnpm ontoindex:changes   # detect-changes against the working tree
```

## Known Limitation To Verify

OntoIndex's first-class support is TypeScript/JavaScript. The repository is
SQL-first, so confirm how well `DEFINES`/`CALLS` edges cover raw SQL / DDL under
`supabase/` and schema-DDL helpers. If coverage is weak, treat OntoIndex as a
TS/route/call-graph aid and keep using direct review for SQL-layer changes. Record
the observed behavior in the contributor docs "Limitations" section — do not
overclaim SQL coverage.
