---
name: playcanvas-editor-api-realtime
description: Use when working with the PlayCanvas Editor API, realtime sync protocols, WebSocket endpoints, ShareDB, Operational Transformation (OT), or document collections.
metadata:
    version: '1.0.0'
    scope: 'playcanvas-editor-api-realtime'
    file_policy: 'markdown-only'
---

# PlayCanvas Editor API and Realtime Sync

Use this skill when developing editor extensions via the Editor API, setting up WebSocket connections, or working with ShareDB/OT synchronization.

## Version Guard

- Upstream Editor API matches the `playcanvas/editor` `v2.24.2` implementation.
- Realtime sync protocol runs over `@teamwork/websocket-json-stream` and `sharedb`.
- Operational Transformation uses `ot-text`.

## Required Output

Before modifying realtime sync behaviors or API endpoints:
- state ShareDB collection being accessed (`scenes`, `assets`, `settings`);
- describe the OT operation payload format;
- detail WebSocket handshake and authentication headers.

## Workflow

1. Realtime collaboration uses ShareDB documents for entity and asset properties.
2. The frontend client sends JSON-encoded operations (ops) using OT.
3. Programmatic manipulation of entities must use the Editor API (`editor.call(...)` pattern).
4. Synchronize snapshots with the persistence adapter asynchronously.

## Blocking Rules

- Do not assume full multi-user collaboration is enabled in the current Universo slice (persistence is single-user snapshot-only).
- Do not bypass ShareDB permission gates.
- Do not send uncompressed large textures or binary meshes over the WebSocket control channel.
- Do not let WebSocket connections leak on page/iframe reloads.
