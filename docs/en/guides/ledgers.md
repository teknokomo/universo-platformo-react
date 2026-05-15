---
description: Runtime usage guide for standard Ledger entities and append-only operational facts.
---

# Ledgers Guide

Ledgers are standard `ledger` entities for append-only operational facts.
They are intended for reporting, projections, posting, and script-controlled audit trails.

![Entity workspace for standard metadata types](../.gitbook/assets/entities/entities-workspace.png)

## Authoring

Create Ledgers in the same Entity workspace as other standard types.
The metahub menu places Ledgers after Enumerations.
Ledger fields use the shared field-definition UI, while `config.ledger.fieldRoles` classifies each field as a dimension, resource, measure, period field, source reference, workspace scope, or plain component.

Use the code-facing term `ledger` in metadata and APIs.
The Russian UI label is "Регистры".

## Runtime API

Published applications expose Ledger operations through dedicated runtime routes:

- `GET /api/v1/applications/:applicationId/runtime/ledgers`
- `GET /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts`
- `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts`
- `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts/reverse`
- `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/query`
- `GET /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/projections/:projectionCodename`

Ledgers are intentionally excluded from generic runtime row CRUD.
They are fact stores, not editable record lists.

## Source Policy

Ledger configuration controls who can append or reverse facts:

- `manual` allows direct authorized API or script calls.
- `registrar` allows platform registrar flows such as Object posting.
- `mixed` allows both when the caller has the required permission and capability.

Registrar-only Ledgers can also restrict allowed registrar kinds.
Object posting writes use registrar kind `object`.

## Reversal

Reversal is append-only.
The runtime creates a compensating fact instead of mutating or deleting the original fact.
Transactional Object unpost and void commands use stored posting movement metadata to reverse previous movements safely.

## Reporting

Projection queries accept only declared dimensions and resources.
The backend builds schema-qualified, parameterized SQL from metadata and rejects unknown fields.
Dashboard widgets should consume Ledger facts or projections through generic datasource descriptors rather than LMS-specific widget code.
