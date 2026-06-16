---
name: playcanvas-editor-version-control
description: Use when working with the PlayCanvas Editor version control system (VCS), managing checkpoints, handling branches, merging histories, or resolving document conflicts.
metadata:
    version: '1.0.0'
    scope: 'playcanvas-editor-version-control'
    file_policy: 'markdown-only'
---

# PlayCanvas Editor Version Control

Use this skill when managing the project version control, committing checkpoints, branching, and resolving scene or asset merge conflicts.

## Version Guard

- Schema and operation logs follow PlayCanvas VCS specifications.
- Pinned to the version control panel capabilities of Editor `v2.24.2`.

## Required Output

Before performing branching or merging operations:
- state current branch and target branch names;
- identify conflicts in scene graphs or asset configurations;
- describe the resolution strategy (keep mine, keep theirs, manual merge).

## Workflow

1. Create branches as fork pointers of scene/asset states.
2. Checkpoints are committed with explicit description messages.
3. Merging compares JSON diffs of scene hierarchies and asset models.
4. Conflict resolution requires manual user validation before committing the merged state.

## Blocking Rules

- Do not attempt automatic merges on binary assets (textures, models). They must fail closed, requiring explicit user selection.
- Do not bypass checkout validations.
- Do not lose document revision history.
- Do not let a merge operation overwrite unsaved local modifications.
