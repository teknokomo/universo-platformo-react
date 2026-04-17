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
- share reusable Resources-workspace helpers through library modules and `@shared/<codename>` imports;
- attach custom logic to the Resources workspace, metahub-level, and entity-level design surfaces.

## Supported Contract

| Axis | Current contract |
| --- | --- |
| Source kind | Only `embedded` authoring is enabled in the UI. |
| SDK compatibility | Only `sdkApiVersion = 1.0.0` is supported. |
| Imports | `@universo/extension-sdk` is always allowed; consumer scripts may also import Resources workspace libraries through `@shared/<codename>`. |
| Roles | `module`, `lifecycle`, `widget`, and `library`. |
| Attachment scopes | `general` in the Resources workspace for `library`, plus metahub, hub, catalog, set, enumeration, and attribute for executable consumers. |
| Client runtime | Browser Worker runtime with fail-closed fallback when Worker is unavailable or execution exceeds the runtime budget. |
| Server runtime | Pooled `isolated-vm` execution behind the applications backend. |

## Authoring Workflow

1. Open the Scripts tab in the Resources workspace for shared libraries, or on the metahub / specific attached entity for consumers.
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
| `library` | Shared Resources workspace helpers. | Libraries are import-only, stay pure, and cannot declare decorators or runtime ctx access. |

## Shared Library Contract

- Library scripts are authored only from the Scripts tab in the Resources workspace with attachment scope `general`.
- `general` and `library` are inseparable: Resources rejects any other role for `general`, and new `library` authoring is rejected outside the Resources workspace.
- Libraries are compiled for dependency resolution and validation before consumer scripts are bundled.
- Consumer scripts import them through `@shared/<codename>` and keep ordinary scope-specific attachment rules.
- Libraries are not exposed as direct runtime entrypoints, RPC targets, or lifecycle handlers.
- Delete, codename rename, and circular `@shared/*` graphs fail closed before publication can ship a broken dependency graph.

## Publication And Runtime Flow

1. Design-time scripts live in metahub storage and are edited from the Scripts tab.
2. Publication generation validates and compiles shared libraries in topological dependency order, then serializes script metadata, source code, and the compiled runtime bundles into the publication snapshot.
3. Application sync copies the published consumer-script contract into `_app_scripts` while keeping shared-library material available only through the compiled consumers.
4. Runtime list endpoints return metadata only for published consumer scripts and never inline executable bundles.
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