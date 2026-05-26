---
description: Build transactional accounting metahubs with entity types compatible with 1C:Enterprise 8.x.
---

# 1C-Compatible Metahub Template

`1C-Compatible` is an opt-in metahub template for transactional accounting configurations.
It exposes a curated catalog of metadata presets that model familiar enterprise accounting concepts through the generic Entity Type Constructor.

This template is not selected by default.
New metahubs still start from `Basic` unless a user explicitly chooses `1C-Compatible`.

## Non-Affiliation

This template uses entity types compatible with 1C:Enterprise 8.x.
It is not an official 1C product and is not certified by 1C.
The implementation does not import or copy 1C source code, native configuration files, database layouts, logos, or UI assets.

## Preset Catalog

The template ships the complete 1C-compatible preset catalog as design-time metadata:

| Preset                 | User-facing role                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Constants              | Top-level single-value settings through the reusable `singleValue` behavior contract.  |
| Enumerations           | Existing Enumeration preset with template-specific presentation.                       |
| Catalogs               | Reference-style lists with typed `catalogBehavior`.                                    |
| Documents              | Transactional records with typed `documentBehavior` and `documentPosting`.             |
| Document Journals      | Journal metadata through typed `journalBehavior`, initially backed by `records.union`. |
| Information Registers  | Fact registers through typed `registerBehavior`.                                       |
| Accumulation Registers | Balance registers through typed `registerBehavior`.                                    |
| Charts of Accounts     | Hierarchical account charts with account flags and subconto links.                     |
| Characteristic Types   | Dynamic characteristic catalogs for typed EAV-style analytics.                         |
| Accounting Registers   | Debit/credit register metadata with dimensions, resources, and projections.            |
| Calculation Types      | Calculation type dependency and displacement metadata.                                 |
| Calculation Registers  | Calculation register metadata for action/base periods and recalculation.               |

Charts of Accounts, Charts of Characteristic Types, Accounting Registers, Charts of Calculation Types, and Calculation Registers are included in the template together with the core runtime presets. Their specialized accounting/calculation engines remain preview behavior metadata, but the entity types and default instances are available from newly created 1C-compatible metahubs.

## Implementation Contract

The template must stay metadata-driven:

-   specialized behavior lives in typed reusable config sections such as `catalogBehavior`, `documentBehavior`, `documentPosting`, and `registerBehavior`;
-   generic runtime widgets and DataGrid/FormDialog primitives are reused first;
-   normal user surfaces must not show raw UUIDs, raw JSON, `[object Object]`, internal table names, or raw validation messages;
-   Constants are top-level entities in this template and must not appear to users as children of Sets.

## Verification

Implementation work for this template is expected to run the focused type/backend checks and local minimal Supabase Playwright coverage tagged with `@1c-compatible` before specialized accounting/calculation behavior is expanded beyond preview metadata.
