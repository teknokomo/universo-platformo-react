# Configuration Workflow

This reference describes how a feature flows through the three layers of a
Universo configuration. Use it when deciding which layer owns a behavior or
piece of content.

## The Three Layers

```
┌─────────────────────────┐
│       Metahub           │  Canonical configuration
│                         │  (entity types, scripts, seeded content)
└───────────┬─────────────┘
            │  publish
            ▼
┌─────────────────────────┐
│  Application + Control  │  Deployed instance
│       Panel             │  (global settings of this deployment)
└───────────┬─────────────┘
            │  use
            ▼
┌─────────────────────────┐
│      Workspaces         │  Runtime isolation
│ (inside the published   │  (user-authored content per workspace)
│      application)       │
└─────────────────────────┘
```

### Metahub

Holds the canonical configuration:

- entity types (chosen from platform presets and/or built via the Entity
  Type Constructor);
- relationships among them;
- attached scripts;
- seeded/default content that should ship with every deployment;
- default layouts and default UI metadata for runtime widgets.

A new metahub bootstraps from a **template**. The platform ships four
built-in templates today (`basic` is the default, plus `basic-demo`,
`empty`, `lms`); a future "1C-compatible" template will deliver the full
1C:Enterprise metadata-object map. The chosen template determines which
presets the metahub starts with and which entities, layouts, and settings
are seeded.

Updates to the metahub propagate to all applications built from it (with
explicit migration rules). The metahub is a configuration-level concept,
not a runtime store.

### Application Control Panel

Each application is created from a metahub. The control panel exposes
**global settings of the deployed instance**:

- feature toggles for this deployment;
- branding (name, logo, colors);
- access policies (who can join, default role on join);
- default values for things that vary per deployment;
- runtime parameters (rate limits, retention windows).

The control panel is for the deploying administrator, not for end users.
Putting end-user content authoring here is a defect — it belongs to
workspaces.

### Workspaces (inside the published application)

Workspaces are the runtime isolation layer. Each workspace has its own:

- data produced by the configuration;
- membership and role assignments;
- access to the content created within it.

End users with sufficient role create, edit, copy, and delete content here.
This is where the day-to-day work of the configuration happens.

## Placement Rules

When designing a feature, place each piece of behavior at the layer where its
lifecycle naturally belongs:

| Concern | Layer |
|---|---|
| Domain model (entity types, relationships, scripts) | Metahub |
| Pre-seeded content distributed with the configuration | Metahub |
| Default UI layout for runtime widgets | Metahub |
| Feature toggles for the deployed instance | Application control panel |
| Branding of the deployed instance | Application control panel |
| Access policies for the deployed instance | Application control panel |
| User-authored content (created/edited/deleted by users) | Workspace |
| Per-user or per-workspace preferences | Workspace |
| Multi-tenant data partitioning | Workspace |

## Common Misplacements

- **Putting feature flags in the metahub** — the metahub is shared across
  every deployment, so a flag there cannot vary per deployment. Move it to
  the application control panel.
- **Putting end-user content authoring in the control panel** — the
  control panel is administrative. End users should not need administrator
  access to author content. Move it to the workspace.
- **Putting per-workspace settings in the control panel** — settings that
  vary per workspace belong to the workspace, not the deployment-wide
  control panel.
- **Hardcoding seeded content in user-content tables** — seeded content
  ships from the metahub and should be marked as seeded so it can be
  distinguished from user content during migrations and exports.

## Workflow When Designing a Feature

1. Identify what the feature creates or stores.
2. Decide whether the lifecycle is configuration-level (ships with every
   deployment), instance-level (varies per deployment), or workspace-level
   (varies per tenant).
3. Place the data and the UI at the layer that matches the lifecycle.
4. If the same data needs to appear at multiple layers (for example, a
   default that the deployment can override), keep the canonical version
   at the higher layer (metahub) and the override at the lower layer
   (control panel or workspace), with explicit precedence rules.
