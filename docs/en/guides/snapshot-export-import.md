---
description: How to export and import metahub snapshots for backup, migration, and sharing.
---

# Snapshot Export & Import

Snapshot export/import enables you to capture the full state of a metahub
(or a specific publication version) as a portable JSON envelope and restore it
in the same or a different Universo Platformo instance.

## Overview

A **snapshot envelope** is a self-contained JSON file that includes:

- **kind**: `metahub_snapshot_bundle`
- **bundleVersion**: `1` (for forward compatibility)
- **snapshot**: the full metahub state — entities, layouts, scripts, shared attributes/constants/values, and shared override rows
- **snapshotHash**: SHA-256 integrity hash computed from normalized snapshot data

## Exporting

### From a Publication Version

1. Navigate to the metahub → Publications → select a publication.
2. In the version list, open the row actions menu for the desired version.
3. Click **Export**.
4. The browser downloads a `.json` file containing the snapshot envelope.

### From the Metahub Directly

Use the API endpoint `GET /api/v1/metahub/:id/export` to obtain the full
metahub snapshot without going through publication versions.

## Importing

### As a New Metahub

1. Navigate to the Metahub list page.
2. Click the dropdown arrow on the **Create** button.
3. Select **Import from Snapshot**.
4. Choose the `.json` envelope file from your file system.
5. The system validates the envelope, verifies the integrity hash, and creates
   a new metahub with all entities restored.

### As a Publication Version

1. Navigate to the metahub → Publications → select a publication.
2. Click the dropdown arrow on the **Create Version** button.
3. Select **Import from Snapshot**.
4. Choose the `.json` envelope file.
5. A new publication version is created from the imported snapshot data.

## File Format Specification

```json
{
  "kind": "metahub_snapshot_bundle",
  "bundleVersion": 1,
  "exportedAt": "2026-04-03T12:00:00.000Z",
  "snapshot": {
    "versionEnvelope": {
      "structureVersion": "0.1.0",
      "templateVersion": null,
      "snapshotFormatVersion": 2
    },
    "entities": { ... },
    "sharedAttributes": [ ... ],
    "sharedConstants": [ ... ],
    "sharedEnumerationValues": [ ... ],
    "sharedEntityOverrides": [ ... ]
  },
  "snapshotHash": "sha256-hex-string"
}
```

### Envelope Fields

| Field | Type | Description |
|-------|------|-------------|
| `kind` | `string` | Always `metahub_snapshot_bundle` |
| `bundleVersion` | `number` | Schema version (currently `1`) |
| `exportedAt` | `string` | ISO 8601 export timestamp |
| `snapshot` | `object` | Full metahub state data |
| `snapshotHash` | `string` | SHA-256 hash of normalized snapshot |

## Shared Authoring Data

- `sharedAttributes`, `sharedConstants`, and `sharedEnumerationValues` preserve the Resources-workspace shared pools.
- `sharedEntityOverrides` preserves per-target exclusions, inactive overrides, and sparse sort-order changes.
- Publication runtime loading materializes those shared sections before application sync and runtime deserialization.
- Snapshot import recreates the shared containers first and then remaps shared override targets to the restored objects.

## Security Considerations

- **Hash Verification**: On import, the system recomputes the SHA-256 hash of
  the snapshot and compares it with `snapshotHash`. Tampered files are rejected
  with a `400 Bad Request` error.
- **Nesting Depth Limit**: JSON payloads with nesting exceeding 50 levels are
  rejected to prevent stack overflow attacks.
- **Prototype Pollution Protection**: Keys like `__proto__`, `constructor`, and
  `prototype` are stripped from imported JSON before processing.
- **Entity Count Limits**: The total number of entities in a snapshot is
  validated against configurable limits.
- **Size Limit**: The import endpoint accepts payloads up to 50 MB.
- **CSRF Protection**: All import (POST) endpoints require a valid CSRF token
  via the `x-csrf-token` header.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/metahub/:id/export` | Export full metahub as snapshot |
| `POST` | `/api/v1/metahubs/import` | Import snapshot as new metahub |
| `GET` | `/api/v1/metahub/:id/publication/:pubId/versions/:verId/export` | Export a publication version |
| `POST` | `/api/v1/metahub/:id/publication/:pubId/versions/import` | Import snapshot as new version |

## Troubleshooting

- **"Hash mismatch"**: The file may have been modified after export. Re-export
  from the source.
- **"Invalid envelope"**: The imported file does not match the expected schema.
  Ensure it was exported from a compatible Universo Platformo version.
- **"Entity limit exceeded"**: The snapshot contains more entities than the
  configured maximum. Contact your administrator to increase limits if needed.
