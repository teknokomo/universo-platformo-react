---
name: playcanvas-editor-scripting
description: Use when working with the PlayCanvas Editor scripting system, script attributes, Monaco editor integrations, ESM scripts, hot reloading, or editor scripts compilation.
metadata:
    version: '1.0.0'
    scope: 'playcanvas-editor-scripting'
    file_policy: 'markdown-only'
---

# PlayCanvas Editor Scripting

Use this skill when authoring, compiling, or integrating scripts, script attributes, hot-reload handlers, or Monaco code editor components.

## Version Guard

- Supports ESM scripts (the default mode in `v2.24.2`, not legacy script format).
- Integrated Monaco editor matches `0.47.0` (as vendored).
- Script attribute parsing uses `@playcanvas/attribute-parser`.

## Required Output

Before modifying script configurations or attributes:
- state the script name and attribute structure (type, defaults, titles);
- specify how hot reload handles state preservation;
- describe code compilation/linter checks used in the Monaco wrapper.

## Workflow

1. Declare scripts as ES6 classes extending `pc.ScriptType`.
2. Attributes must be declared using `ScriptType.attributes.add(name, options)`.
3. Monaco editor compiles scripts in-memory and validates them against the playcanvas TypeScript definitions.
4. Hot reload updates active script instances in the viewport without re-booting the application.

## Blocking Rules

- Do not use legacy `pc.createScript` syntax for new scripts; use standard class syntax.
- Do not bypass script attribute validation. If an attribute option is invalid, Monaco must show a lint error.
- Do not perform synchronous network requests inside the script execution runtime.
- Do not let uncompiled syntax errors crash the viewport rendering loop.
