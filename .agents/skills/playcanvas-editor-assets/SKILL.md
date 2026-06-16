---
name: playcanvas-editor-assets
description: Use when working with the PlayCanvas Editor asset import pipeline, texture conversion, model ingestion, audio files, materials, or asset metadata attributes.
metadata:
    version: '1.0.0'
    scope: 'playcanvas-editor-assets'
    file_policy: 'markdown-only'
---

# PlayCanvas Editor Assets

Use this skill when dealing with the ingestion, conversion, storage, or metadata handling of assets inside the PlayCanvas Editor.

## Version Guard

- Upstream asset schema is based on PlayCanvas Editor `v2.24.2`.
- Uses `@playcanvas/attribute-parser` for asset metadata parsing.
- Texture compression includes formats supported by the runtime (e.g. WebP, basis, dxt).

## Required Output

Before modifying asset pipelines or schemas:
- state the asset types being changed (texture, material, model, audio, script);
- specify target platform texture formats (ASTC, DXT, ETC, PVR);
- describe the source metadata structure and how attributes are validated.

## Workflow

1. Ingestion is handled via the asset pipeline, converting raw formats (e.g., FBX, GLB, PNG) into editor-compatible representations.
2. Metadata properties (e.g., tags, preload, size, hash) must be kept in sync with the ShareDB asset collection.
3. Assets must be loaded asynchronously, supporting proper loading progress and error indicators.
4. Clean up asset cache references on document closures.

## Blocking Rules

- Do not upload raw binaries directly to the config payload; use asset identifiers instead.
- Do not bypass asset preload flags. If an asset is marked as not-preloaded, do not force-load it at startup.
- Do not change asset schemas without validating them against the Zod schema defined in types.
- Do not expose local upload paths to the client.
