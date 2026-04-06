---
description: Detailed v1 guide for authoring, publishing, and running metahub scripts.
---

# Metahub Scripting

Metahub scripting is the current v1 extension path for custom runtime behavior.
The same contract covers authoring in the metahub UI, publication packaging, application sync, and runtime execution.

## What Scripts Can Do

Scripts currently cover four product needs:

- add server logic that reacts to runtime events;
- expose client code for widgets and interactive UI;
- share read-only metadata helpers across authoring and runtime flows;
- attach custom logic to metahub-level and entity-level design surfaces.

## Supported Contract

| Axis | Current contract |
| --- | --- |
| Source kind | Only `embedded` authoring is enabled in the UI. |
| SDK compatibility | Only `sdkApiVersion = 1.0.0` is supported. |
| Imports | Only `@universo/extension-sdk` imports are allowed. |
| Roles | `module`, `lifecycle`, `widget`, and `global`. |
| Attachment scopes | Metahub, hub, catalog, set, enumeration, and attribute. |
| Client runtime | Browser Worker runtime with fail-closed fallback when Worker is unavailable or execution exceeds the runtime budget. |
| Server runtime | Pooled `isolated-vm` execution behind the applications backend. |

## Authoring Workflow

1. Open the Scripts tab on the metahub or the specific attached entity.
2. Create a new script and choose the module role before editing code.
3. Keep the source kind as Embedded and declare only the capabilities the script really needs.
4. Export a class that extends `ExtensionScript`.
5. Mark callable methods with `@AtClient()`, `@AtServer()`, `@AtServerAndClient()`, or `@OnEvent(...)`.
6. Save the draft and fix any fail-closed validation error before publishing.

## Roles And Capabilities

Role choice is not cosmetic. It drives the allowed capabilities, default capabilities, and runtime exposure rules.

| Role | Typical use | Important notes |
| --- | --- | --- |
| `widget` | Interactive widgets such as the quiz widget. | Widget drafts default to the client RPC capability needed for runtime bridges. |
| `module` | Shared business logic modules. | Use this for non-widget runtime helpers. |
| `lifecycle` | Event-driven server hooks. | Lifecycle handlers are never callable through public runtime RPC. |
| `global` | Cross-scope helper logic. | Keep capabilities minimal and explicit. |

## Publication And Runtime Flow

1. Design-time scripts live in metahub storage and are edited from the Scripts tab.
2. Publication generation serializes script metadata, source code, and the compiled runtime bundles into the publication snapshot.
3. Application sync copies the published contract into `_app_scripts`.
4. Runtime list endpoints return metadata only and never inline executable bundles.
5. Client code is fetched from the dedicated client-bundle endpoint.
6. Server calls go through the runtime script call route and stay behind capability checks.

## Decorator Semantics

- `@AtClient()` marks a browser-executed method.
- `@AtServer()` marks a server-executed method.
- `@AtServerAndClient()` keeps one method available in both bundles.
- `@OnEvent(...)` declares a lifecycle handler that is dispatched by events, not by public RPC.
- Undecorated helper methods stay private to the class.

## Quiz Widget Contract

The shipped quiz flow uses a widget-role script that powers `quizWidget` on the application dashboard.

```json
{
	"type": "quizWidget",
	"scriptCodename": "quiz-widget"
}
```

The default runtime bridge expects a client `mount()` method and a server `submit()` method.
Optional widget config can override those names, but the bundled quiz starter uses the defaults.

## Fail-Closed Rules

- Unsupported SDK versions are rejected during authoring, publication normalization, and runtime loading.
- Unsupported imports, `require()`, dynamic `import()`, and `import.meta` are rejected before bundling.
- Public runtime RPC can call only non-lifecycle server methods from scripts that declare `rpc.client`.
- If `_app_scripts` cannot be prepared during sync, the application sync fails instead of silently skipping scripts.
- If the browser cannot provide a Worker runtime or the execution stalls past the runtime budget, client execution fails closed.

## Recommended Delivery Sequence

1. Author the script in the metahub.
2. Attach the widget or other consumer to a layout.
3. Publish a version that contains the updated script.
4. Sync or create the linked application.
5. Verify the runtime behavior on `/a/:applicationId`.

For a concrete browser-authored example, continue with [Quiz Application Tutorial](quiz-application-tutorial.md).