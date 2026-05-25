---
description: Detailed v1 guide for authoring, publishing, and running metahub modules.
---

# Metahub Modules

Metahub modules is the current v1 extension path for custom runtime behavior.
The same contract covers authoring in the metahub UI, publication packaging, application sync, and runtime execution.

## What Modules Can Do

Modules currently cover four product needs:

- add server logic that reacts to runtime events;
- expose client code for widgets and interactive UI;
- share reusable Resources-workspace helpers through library modules and `@shared/<codename>` imports;
- attach custom logic to the Resources workspace, metahub-level, and entity-level design surfaces.

## Supported Contract

| Axis | Current contract |
| --- | --- |
| Source kind | Only `embedded` authoring is enabled in the UI. |
| SDK compatibility | Only `sdkApiVersion = 1.0.0` is supported. |
| Imports | `@universo/extension-sdk` is always allowed; consumer modules may also import Resources workspace libraries through `@shared/<codename>`. |
| Roles | `module`, `lifecycle`, `widget`, and `library`. |
| Attachment scopes | `general` in the Resources workspace for `library`, plus metahub, hub, object, set, enumeration, and component for executable consumers. |
| Client runtime | Browser Worker runtime with fail-closed fallback when Worker is unavailable or execution exceeds the runtime budget. |
| Server runtime | Pooled `isolated-vm` execution behind the applications backend. |

## Authoring Workflow

![Metahub modules dialog](../.gitbook/assets/quiz-tutorial/metahub-modules.png)

1. Open the Modules tab in the Resources workspace for shared libraries, or on the metahub / specific attached entity for consumers.
2. Create a new module and choose the module role before editing code.
3. Keep the source kind as Embedded and declare only the capabilities the module really needs.
4. Export a class that extends `ExtensionModule`.
5. Mark callable methods with `@AtClient()`, `@AtServer()`, `@AtServerAndClient()`, or `@OnEvent(...)`.
6. Save the draft and fix any fail-closed validation error before publishing.

## Roles And Capabilities

Role choice is not cosmetic. It drives the allowed capabilities, default capabilities, and runtime exposure rules.

| Role | Typical use | Important notes |
| --- | --- | --- |
| `widget` | Interactive widgets such as the quiz widget. | Widget drafts default to the client RPC capability needed for runtime bridges. |
| `module` | Shared business logic modules. | Use this for non-widget runtime helpers. |
| `lifecycle` | Event-driven server hooks. | Lifecycle handlers are never callable through public runtime RPC. |
| `library` | Shared Resources workspace helpers. | Libraries are import-only, stay pure, and cannot declare decorators or runtime ctx access. |

## Shared Library Contract

- Library modules are authored only from the Modules tab in the Resources workspace with attachment scope `general`.
- `general` and `library` are inseparable: Resources rejects any other role for `general`, and new `library` authoring is rejected outside the Resources workspace.
- Libraries are compiled for dependency resolution and validation before consumer modules are bundled.
- Consumer modules import them through `@shared/<codename>` and keep ordinary scope-specific attachment rules.
- Libraries are not exposed as direct runtime entrypoints, RPC targets, or lifecycle handlers.
- Delete, codename rename, and circular `@shared/*` graphs fail closed before publication can ship a broken dependency graph.

## Publication And Runtime Flow

1. Design-time modules live in metahub storage and are edited from the Modules tab.
2. Publication generation validates and compiles shared libraries in topological dependency order, then serializes module metadata, source code, and the compiled runtime bundles into the publication snapshot.
3. Application sync copies the published consumer-module contract into `_app_modules` while keeping shared-library material available only through the compiled consumers.
4. Runtime list endpoints return metadata only for published consumer modules and never inline executable bundles.
5. Client code is fetched from the dedicated client-bundle endpoint.
6. Server calls go through the runtime module call route and stay behind capability checks.

## Decorator Semantics

- `@AtClient()` marks a browser-executed method.
- `@AtServer()` marks a server-executed method.
- `@AtServerAndClient()` keeps one method available in both bundles.
- `@OnEvent(...)` declares a lifecycle handler that is dispatched by events, not by public RPC.
- Undecorated helper methods stay private to the class.

## Quiz Widget Contract

The shipped quiz flow uses a widget-role module that powers `quizWidget` on the application dashboard.

```json
{
	"type": "quizWidget",
	"moduleCodename": "quiz-widget"
}
```

The default runtime bridge expects a client `mount()` method and a server `submit()` method.
Optional widget config can override those names, but the bundled quiz starter uses the defaults.

## Fail-Closed Rules

- Unsupported SDK versions are rejected during authoring, publication normalization, and runtime loading.
- Unsupported imports, `require()`, dynamic `import()`, and `import.meta` are rejected before bundling.
- Public runtime RPC can call only non-lifecycle server methods from modules that declare `rpc.client`.
- If `_app_modules` cannot be prepared during sync, the application sync fails instead of silently skipping modules.
- If the browser cannot provide a Worker runtime or the execution stalls past the runtime budget, client execution fails closed.

## Recommended Delivery Sequence

1. Author the module in the metahub.
2. Attach the widget or other consumer to a layout.
3. Publish a version that contains the updated module.
4. Sync or create the linked application.
5. Verify the runtime behavior on `/a/:applicationId`.

For a concrete browser-authored example, continue with [Quiz Application Tutorial](quiz-application-tutorial.md).
