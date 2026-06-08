---
name: playcanvas-editor-interface
description: Use when working with the PlayCanvas Editor interface panels, inspectors, toolbar actions, layout configurations, PCUI components, viewport settings, or keyboard shortcuts.
metadata:
    version: '1.0.0'
    scope: 'playcanvas-editor-interface'
    file_policy: 'markdown-only'
---

# PlayCanvas Editor Interface

Use this skill when developing, customising, or debugging the PlayCanvas Editor user interface panels, tools, hierarchy, or viewport widgets.

## Version Guard

- Pinned to the UI layout of PlayCanvas Editor `v2.23.4`.
- Uses `@playcanvas/pcui` for UI panels and widgets.
- Viewport rendering is powered by `playcanvas@2.19.5`.

## Required Output

Before modifying interface components or configuration:
- state which panel or widget is being modified (hierarchy, inspector, assets, viewport);
- describe the keyboard shortcut or event hook used;
- specify the PCUI components involved.

## Workflow

1. Layout follows the classic 3-pane structure: Hierarchy (left), Assets (bottom), Inspector (right), Viewport (center).
2. UI controls are styled and managed via PCUI. Follow existing layout conventions.
3. Keep custom panels registered inside the Editor's plugin system rather than modifying the main shell.
4. Ensure viewport widgets resize cleanly and do not conflict with the iframe boundary.

## Blocking Rules

- Do not bypass PCUI styling conventions for custom editor panels.
- Do not let custom inspector fields crash on missing asset references.
- Do not add custom global keyboard shortcuts that conflict with standard browser or host app keys.
- Do not break viewport resize hooks when resizing the editor container.
