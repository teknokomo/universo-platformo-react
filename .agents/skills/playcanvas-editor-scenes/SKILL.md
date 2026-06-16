---
name: playcanvas-editor-scenes
description: Use when working with the PlayCanvas Editor scene graph, Entity Component System (ECS), entity hierarchy, templates, prefabs, or scene setting configurations.
metadata:
    version: '1.0.0'
    scope: 'playcanvas-editor-scenes'
    file_policy: 'markdown-only'
---

# PlayCanvas Editor Scenes

Use this skill when managing the scene graph, configuring components on entities, working with prefabs/templates, or editing scene-wide render settings.

## Version Guard

- ECS components mapping must align with `playcanvas@2.19.5` (editor runtime version).
- Templates/prefabs follow the schema of Editor `v2.24.2`.

## Required Output

Before modifying scenes or entity states:
- state the target entities and components (camera, light, render, script);
- describe transform parenting relations;
- detail template instances and override configurations.

## Workflow

1. Entities are structured in a tree hierarchy under the Root entity.
2. Component parameters must be validated using Zod schemas before being saved to the scene model.
3. Templates/prefabs are instantiated in the scene graph as reference nodes. Local overrides must be tracked explicitly.
4. Scene render settings (gravity, ambient, fog, skybox) are kept in the scene header document.

## Blocking Rules

- Do not instantiate cyclic entity parents (parent pointing to its child).
- Do not add custom non-standard components to entities unless they are registered in the editor schema.
- Do not modify template definitions directly from an entity instance without committing changes to the template asset first.
- Do not let entity name duplicate handling crash the hierarchy tree.
