---
name: playcanvas-editor-settings
description: Use when working with PlayCanvas Editor project settings, rendering configurations, physics settings, audio properties, publishing workflows, or launch page configs.
metadata:
    version: '1.0.0'
    scope: 'playcanvas-editor-settings'
    file_policy: 'markdown-only'
---

# PlayCanvas Editor Settings

Use this skill when editing project settings, modifying physics engines, toggling WebGL features, or configuring publishing endpoints.

## Version Guard

- Schema for project settings is based on PlayCanvas Editor `v2.24.2`.
- Physics configuration includes Ammo.js configurations.

## Required Output

Before modifying project settings or launch configs:
- state rendering capabilities (WebGL 2, WebGPU);
- describe physics parameters (gravity, physics solver steps);
- detail launch options (debug, profiler, device pixel ratio).

## Workflow

1. Project settings are saved in the settings collection under `project_${projectId}` or similar.
2. Verify Ammo.js libraries are correctly registered when physics is enabled.
3. Keep WebGL/WebGPU settings compatible with the target runtime engine version `2.18.1`.
4. Launch pages must respect development tokens and origin security bounds.

## Blocking Rules

- Do not enable physics Ammo.js features without ensuring the WASM module is declared in the boot config.
- Do not bypass GPU compatibility fallbacks.
- Do not bake local development URLs into production publish manifests.
- Do not expose administrative API keys in the launch page config.
