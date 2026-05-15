---
description: How Object entities use record behavior to model reference lists, documents, and posting workflows.
---

# Transactional Objects

Object entities are the platform's operational collection type.
The same standard `object` kind can stay a reference list or become a document-like collection through `config.recordBehavior`.

![Object records in a published application](../.gitbook/assets/entities/object-records.png)

## Record Behavior

`recordBehavior` is metadata, not hardcoded LMS logic.
It is authored in the metahub, published in snapshots, synchronized into the application schema, and then applied per workspace at runtime.
The authoring UI is exposed by the generic Entities constructor: any entity type whose component manifest enables
`identityFields`, `recordLifecycle`, or `posting` may add the `behavior` tab to its `ui.tabs`.
The standard Object entity type enables those components by default, so new and existing Objects expose the same shared
Behavior form instead of a Object-only dialog.

The behavior block can enable:

- identity fields for stable display and duplicate checks
- atomic record numbering
- effective dates
- lifecycle states such as draft, posted, voided, and archived
- posting into declared Ledgers
- immutability for posted rows

Reference-like objects keep these features disabled.
Transactional objects enable only the parts they need.

## Posting Flow

Posting is a platform-owned command, not a direct table write.
Runtime routes validate permissions, record state, workspace scope, and the object configuration before changing a row.

When posting is enabled:

1. `beforePost` lifecycle scripts run inside the active transaction.
2. Scripts may return declarative posting movements for Ledgers declared in `recordBehavior.posting.targetLedgers`.
3. The platform appends Ledger facts through the Ledger service and stores the resulting movement metadata on the Object row.
4. The Object row changes to the posted state only if all movements succeed.

Unpost and void commands never mutate previous Ledger facts.
They append compensating facts from the stored movement metadata and then clear the posting metadata on the row.

## Safety Rules

- Posted rows are immutable when `recordBehavior.posting.immutableWhenPosted` is enabled.
- Direct Ledger writes are rejected when a Ledger allows only registrar-origin writes.
- Posting scripts can use `ctx.ledger` only with declared capabilities.
- Runtime SQL remains schema-qualified and parameterized through the backend service layer.

## LMS Usage

The canonical LMS template uses transactional objects for enrollments, assignments, quiz attempts, attendance, certificates, and related operational events.
Those objects are still ordinary Object entities; LMS behavior comes from metadata, scripts, layouts, and Ledgers rather than a separate LMS runtime fork.
