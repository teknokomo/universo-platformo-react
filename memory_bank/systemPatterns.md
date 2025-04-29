# System Patterns

## UPDL Node Patterns and Visual Programming

### Key Design Principles

1. **Universal Description Layer**

    - UPDL nodes describe "what" should happen, not "how"
    - Technical implementation details are hidden from the developer
    - The same node graph works across different platforms

2. **Hierarchical Structure**

    - Scene node serves as the root container
    - Objects can contain other objects (parent-child relationship)
    - Cameras and lights can be attached to objects or directly to the scene

3. **Typed Ports and Connections**
    - Each port has a specific data type
    - Connections are validated for type compatibility
    - The editor prevents incompatible connections

### Common Node Patterns

#### Basic AR Scene Pattern

```
Scene (root element)
├── Camera (camera settings)
├── Light (scene lighting)
└── AR Marker (marker definition)
    └── Object (3D model or primitive)
        └── Animation (object rotation)
            └── Interaction (click handling)
```

#### Interactive 3D Scene Pattern

```
Scene (root element)
├── Camera (camera settings)
│   └── Controller (orbital control)
├── Light (primary lighting)
├── AmbientLight (background lighting)
└── Object (scene container)
    ├── Model (3D model)
    │   └── Interaction (click handling)
    │       └── Animation (interaction response)
    └── Text (information text)
```

#### Multi-Scene Pattern

```
Scene 1 (initial scene)
├── [Standard elements]
└── Interaction (transition)
    └── Scene 2 (next scene)
        └── [Standard elements]
```

### Default Value Handling

1. **Adding Required Elements**

    - Missing camera automatically added with default parameters
    - Basic lighting added if no light nodes present
    - AR marker auto-added in AR mode if not specified

2. **Platform-Specific Transformations**

    - Coordinate system conversions between different engines
    - Material adaptations based on engine capabilities
    - Mobile optimizations for AR mode

3. **Special Parameter Sections**
    - Technology-specific parameter sections in each node
    - Only relevant parameters applied during export
    - Reasonable defaults for missing parameters

## APPs Architecture Pattern

The project follows a modular APPs architecture that separates concerns while minimizing changes to the core Flowise codebase:

### Directory Structure

```
universo-platformo-react/
├── packages/                  # Original Flowise packages
│   ├── components/            # Components and utilities
│   ├── server/                # Server-side code
│   └── ui/                    # Frontend
├── apps/                      # New APPs architecture
│   ├── updl/                  # UPDL node system
│   │   └── imp/               # Implementation
│   └── publish/               # Publication system
│       ├── imp/               # Implementation
│       │   ├── react/         # Frontend
│       │   │   └── miniapps/  # Technology-specific handlers
│       │   └── express/       # Backend
```

### Key Architectural Benefits

1. **Separation of Concerns**

    - Core functionality remains in original packages
    - UPDL node system contained in apps/updl
    - Publication system isolated in apps/publish

2. **Minimal Core Changes**

    - Original Flowise codebase remains largely untouched
    - Integration points well-defined and limited
    - Backward compatibility maintained

3. **Easy Extension**

    - New export technologies added as miniapps
    - Consistent API across all exporters
    - Simple addition of new node types

4. **Clean Publication Flow**
    - Unified URL format: `/p/{uuid}` with frame, `/e/p/{uuid}` without
    - Dedicated layouts for different technologies
    - Replacement for legacy paths like `/arbot/{id}`

## Code Documentation

-   Prefix first comment line with "Universo Platformo | "
-   Write concise English comments

## Common Architecture and Components UPDL (Work is currently underway to implement it)

At the heart of the system is the **UPDL node graph** – a model representing the interactive application. The graph includes nodes of various types (scenes, objects, logic, etc.) and **connections between them**, capturing both structure and behavior. Based on this graph, two key processes are implemented: **editing** and **export**. The architecture follows a separation of concerns:

-   **Editor (Flowise UI):** Responsible for creating and editing the node graph via a visual interface (drag-and-drop nodes, setting properties, connecting ports). Here, the user defines the **scene structure** (object hierarchy) and **interaction logic** (events, animations, responses) in a platform-independent way. The editor provides a convenient graphical UX for constructing the UPDL graph.
-   **UPDL Format (JSON):** The internal representation of a project. Each node and connection is saved in a unified JSON format (each node is an object with fields like `id`, `type`, `properties`, `children`, etc.). This description is engine-agnostic – essentially a kind of _intermediate language_ for 3D/AR applications. The formal specification of this format is defined in the UPDL architecture document, and our implementation follows that spec. In essence, UPDL JSON acts as the "universal scene graph" that can later be converted to specific engines.
-   **Export Module (Code Generators):** A set of converters (exporters) that take the UPDL description (JSON) as input and produce either source code or configuration for a specific target platform as output. Each target engine has its own exporter encapsulating the nuances of that platform's implementation. Exports will typically be executed on the server (Node.js/Express) when a publish request is made. For example, an AR.js exporter will generate an HTML file with A-Frame markup, whereas a PlayCanvas exporter might generate a JavaScript or JSX file.
-   **Publishing System:** The infrastructure for deploying generated applications. Within our monorepo, this is the `apps/publish` module (React frontend + Express backend). It stores generated files (HTML/JS/CSS and assets) and provides access to them via unique URLs. This allows one-click publishing: once the UPDL graph is ready, the user can generate and host the application immediately through the platform. For published projects, we plan to use a unified URL scheme (using a UUID for identification) instead of distinct paths for each type (no separate `/chatbot/…` or `/arbot/…`). We may later adopt an approach similar to PlayCanvas (where one URL includes an overlay frame and another is frameless), but initially a single clean URL per project is sufficient.

Tying these components together is the **UPDL Core Module** (located in `apps/updl`). This module contains the logic for working with the UPDL format: definitions of node types, functions for serialization/deserialization of the graph, and calls to the appropriate exporters. It acts as the "engine" of our design system, processing the JSON and interfacing with the exporters. The editor, format, exporters, and publishing all connect via this core. For instance, on a publish command, the system will retrieve the saved UPDL JSON (via Flowise or database), then use `apps/updl` to invoke the correct exporter (based on the chosen platform), and finally hand off the result to `apps/publish` for deployment.

This modular architecture (editor → format → exporters → deploy) ensures flexibility and clarity: each piece has a distinct responsibility, and they communicate through well-defined interfaces (the UPDL JSON being the main contract). Changes in one component (e.g., adding a new node type or supporting a new platform) can be made with minimal impact on others.

## UPDL Node System

UPDL represents a project as a **graph of nodes** and connections. A **Node** is the basic unit representing a certain entity or action. Nodes can be **hierarchical** (contain child nodes, forming a tree for spatial structure) and **logical** (connect via input/output ports for events/data flow). Each node has: (1) a **type** (defining the node's role), (2) a set of **properties** (configuration parameters), (3) **inputs and outputs** (ports for linking to other nodes), and (4) a unique **id** (to reference the node). Thanks to a standard JSON schema, nodes are easily saved/loaded and can be extended without breaking compatibility (via versioning and optional fields). Below are key UPDL node types and their roles:

-   **Scene:** A top-level node representing a separate scene or screen of the application. A Scene node usually serves as the root for all objects in that scene. **Properties/Features:** It can have `children` (embedded nodes like objects, camera, lights, etc.). It may define scene-wide settings (background color, environment, gravity, etc.). A Scene node can generate global events such as **OnStart** (scene initialized) and **OnEnd** (scene ended) which can be used to trigger transitions or logic when a scene is entered or exited. Typically, a UPDL project can contain multiple scenes (though initial implementation may support one active scene at a time – see activeContext limitations).
-   **Object:** A general-purpose scene entity node. This can represent any item or element in the scene (3D model, logical grouping, etc.). **Properties:** Transform attributes (position, rotation, scale) and optionally a visual representation. For example, an object might have a primitive shape (`primitive` like cube, sphere, etc.) or reference an external model (`model` URL or asset ID). It can also have a material (`material` color/texture or reference to a material node). **Hierarchy:** An Object can contain child nodes (as `children`) to form a parent-child relationship (for complex grouped models). **Ports:** Input ports might include commands like _SetActive_ (to show/hide or activate/deactivate the object). Typically, an Object node does not have its own output events (it reacts to events from other nodes like interactions or controllers). It represents static elements or actors in the scene.
-   **Camera:** A viewpoint into the scene, defining how the scene is rendered from a certain perspective. **Properties:** camera mode (`mode` could be perspective or orthographic), and parameters like field of view (`fov`), near/far clipping planes, etc. A scene can have multiple Camera nodes, with usually one active at a time. There may be a flag or selection to mark the primary camera for the scene. **Hierarchy:** A Camera can be attached as a child of an Object (e.g., a first-person camera attached to a character object). **Ports:** Input ports might toggle camera settings or switch the active camera (for VR, enabling stereo view, etc.). Camera nodes typically do not have output events since they are passive views controlled by other nodes or user selection.
-   **Light:** A lighting node for the scene. Different types of lights are supported, for example: Directional, Point, Spot, Ambient. **Properties:** common ones include color, intensity, and type-specific settings (e.g., direction for a Directional light, range for a Point light, cone angle for a Spot light, etc.). **Hierarchy:** Lights can be attached to objects (e.g., a spotlight on a moving object). **Ports:** Input ports might allow turning the light on/off or adjusting intensity at runtime. Lights usually do not emit events; they affect rendering.
-   **Controller:** A logical node that controls other nodes or responds to input – essentially a script or behavior component. Controllers implement dynamic behaviors or game mechanics. **Examples:** an _OrbitControls_ controller that rotates a camera around a target when the user drags the mouse, a _FirstPersonController_ that moves a character with WASD input, or a _GameManager_ that implements global game logic. **Properties:** parameters for the behavior (speed, sensitivity, key bindings, etc., depending on the controller type). **Ports:** Controllers often have input ports like _Enable/Disable_ to turn the behavior on or off, or triggers to start/stop an action. They may have output ports to emit events or data. _Example:_ a "Spin" Controller node might have an input _Trigger_ (to start rotation) and an output that continuously emits the current angle value on each frame. That output could be connected to an Object's rotation property, causing the object to rotate. In this way, controllers allow the UPDL graph to describe dynamic runtime behavior (instead of hiding all logic inside code).
-   **Animation:** A node for playing animations (keyframe or procedural). This node handles time-based changes to properties (like moving an object, changing a value over time, etc.). **Properties:** could include a reference to an animation clip or parameters for a procedural animation (e.g., amplitude and period for a sine wave motion). **Ports:** Inputs might include _Play_, _Pause_, _Stop_, or _Seek_ (to jump to a point in the animation), and a _Loop on/off_ toggle. Outputs might include events like _OnFinish_ (when the animation completes), or even continuous output of the current animated value (if used to drive other nodes). _Example:_ a RotateY Animation node might output an updated angle value on every frame; that output could be linked to an object's rotation property to make it spin. Animation nodes thus encapsulate time-based changes and can trigger or be triggered by interactions.
-   **Interaction:** An event-generating node that reacts to user actions or environmental triggers. Interaction nodes are the **sources of events** in the graph (they have output triggers that other nodes can listen to). **Examples of interaction nodes:** _OnClick_ (fires when a specific object is clicked or tapped), _OnKeyPress_ (when a certain key is pressed), _OnCollision_ (when two objects collide), _OnMarkerFound_ (when an AR marker is detected), _OnTimer_ (fires at a set interval). **Properties:** define the condition or target of the interaction (e.g., which object should be clicked, which key code, which marker ID, interval duration, etc.). **Outputs:** usually a trigger event output (or multiple outputs for different outcomes, e.g., _OnMarker_ might have "Found" and "Lost" outputs for AR marker detection). Interaction nodes make the graph declarative by visibly showing **what events initiate logic**, instead of burying event handling in scripts. They are connected to controller or animation inputs to drive behavior when events occur.
-   **Other/Utility Nodes:** Additional node types for specific functions or organizational purposes. These might not all be implemented in the first version but are considered in the design:
    -   _UI elements:_ e.g., Button, Text, or other 2D UI components. These could be represented either as special objects or a separate UI scene/canvas. (In v1, UI nodes are planned but not implemented; UI can be overlaid via React manually if needed.)
    -   _Sound:_ An audio node to play sound effects or music. Properties might include audio file, volume, etc. Inputs could be Play/Stop, and an output event _OnEnd_ when playback finishes.
    -   _Script:_ A node that wraps an arbitrary code script (for cases not covered by standard nodes – an "escape hatch"). It might contain custom code or a reference to an external script file. This allows extending functionality beyond built-in nodes.
    -   _Group/Module:_ A node for grouping other nodes, possibly representing a reusable subgraph or prefab. It could collapse complexity and be instantiated multiple times.
    -   _Network:_ Nodes reserved for networking logic (for future multiplayer or client-server interactions), e.g., a _NetworkSync_ node to sync object state across the network, or a _RemoteEvent_ node to call events on a server. (Networking is outside the scope of the first version, but we keep placeholders for them – exporters will ignore these or warn if present.)

These additional nodes expand UPDL's capabilities while maintaining a consistent structure. In initial implementation, some will be stubbed or omitted; the architecture is designed so unsupported nodes can be safely ignored by exporters or handled specially as needed.

**Extensibility:** The UPDL system is built to allow adding new node types over time without breaking existing projects. This is managed through versioning of the format (`updlVersion` field) and forward-compatibility principles. Older parsers/exporters will simply ignore unfamiliar nodes or properties, while newer ones will utilize them. This means the system can evolve (e.g., adding Physics or Networking nodes later) while maintaining backward compatibility with earlier UPDL files. Exporters can also be updated incrementally to support new nodes as they are introduced. This extensible design ensures UPDL can grow to incorporate more features and platforms, gradually increasing its power.

## Directory Structure and Module Setup

To implement this architecture cleanly, we will organize the code in the monorepo under distinct directories for the core UPDL module and the publishing module. The original main directory of the monorepo in Flowise AI is `packages/`, but now that we are creating our project on its basis, we are introducing an architecture based on **APPs** and will implement new functionality in the `apps/` directory.

Here is the step-by-step plan to create the necessary structure in the repository (`apps/` and `packages/` directories):

1. **Create `apps/updl`:** In the repository root, create a new folder `apps/updl`. This will house the UPDL core module (the logic for node definitions, serialization, and exporters). Initialize it as a Node.js/TypeScript package (add a `package.json` with name `@project/updl` and set up tsconfig, etc.). Ensure to add `apps/updl` to the monorepo workspace configuration (e.g., in `pnpm-workspace.yaml` and `turbo.json`) so it builds with the rest of the project.
2. **Set up UPDL module structure:** Inside `apps/updl`, create the basic source directories: for example, `src/nodes` (to define UPDL node classes or schemas) and `src/exporters` (for exporter implementations). Also create an entry point file (e.g., `src/index.ts`) which exports the main functionality (to be used by other parts like the editor or publish backend).
3. **Create `apps/publish`:** In the repository, create `apps/publish` as a separate module responsible for the publishing interface and deployment backend. This will contain the React UI for publishing and an Express (Node.js) server for handling publish requests. Initialize it with its own `package.json` (e.g., `@project/publish`) and add it to the workspace config.
4. **Set up publish module structure:** Within `apps/publish`, organize the code into `src/client` for the React front-end and `src/server` for the Express back-end. For example, `src/client` might contain React components for the publish dialog (the UI that replaces/enhances the existing "Embed" dialog in Flowise), and `src/server` might have an `index.ts` to start an Express app and serve the publishing API. Ensure the front-end build and back-end can be served together (we might use a single Express server to serve the React build and provide API routes, or use separate processes if needed). Optionally, within the React client, set up subdirectories or a structure for **miniapps** by platform (e.g., a `miniapps/` folder with subfolders for PlayCanvas, Babylon, AR.js, etc.), if we decide to encapsulate platform-specific components.
5. **Integrate modules with monorepo:** Update relevant config files so that running the development server or building the project includes `apps/updl` and `apps/publish`. For instance, add scripts in the root `package.json` for building these apps, and update CI/CD configuration to include them. This step ensures our new modules are recognized and can be worked on like the rest of the codebase.
6. **Migrate existing AR.js prototype code:** Locate any existing AR.js node implementations or prototypes in the monorepo (for example, under `packages/components/nodes/arjs` or in the Flowise UI publish section). Plan to replace or refactor this code into the new `apps/updl` structure. For instance, if there was a `buildARflow.ts` in `packages/server/src/utils`, its logic will be superseded by our new exporters. We will keep it for reference initially, but ultimately the new UPDL module will handle AR flows and similar logic. (The previous approach of picking the latest AR flow via `buildARflow` will be rethought under the new system; if multiple flows are present, the publish system will need a clear way to identify which flow/graph to export.)
7. **Implement UPDL node definitions in `apps/updl`:** For each UPDL node type (Scene, Object, Camera, Light, Interaction, Animation, Controller), create corresponding classes or JSON schema definitions under `apps/updl/src/nodes`. These definitions will be used by both the Flowise editor and the exporters. Keeping them in one place ensures consistency. The Flowise editor will need to reference these (either via a configuration file or by importing a schema). We might export a registry or a list of node definitions from `apps/updl` that the editor can consume to populate its node palette.
8. **Implement exporters in `apps/updl/src/exporters`:** Create subfolders or files for each target platform exporter, e.g., `ARjsExporter.ts`, `PlayCanvasReactExporter.ts`, `BabylonExporter.ts`, etc. Each exporter will take a UPDL JSON (or in-memory graph) and produce output for that platform. Organize common code (like utilities for traversing the node graph, or converting common elements such as camera settings) in shared modules within `apps/updl` so that all exporters can reuse this logic. For example, Babylon.js and Three.js share many concepts, so a helper for converting a UPDL Light node to an engine-specific light could be used by both exporters.
9. **Use `apps/updl` from publish backend:** In `apps/publish/src/server`, import the `apps/updl` module to handle export requests. For instance, when a POST request comes to `/publish` with a project ID and target platform, the publish server can call something like `import { exportProject } from '@project/updl'; ... exportProject(projectId, 'arjs');` which will internally load the UPDL graph (from the database or Flowise) and invoke the appropriate exporter. We will implement such an interface in `apps/updl` (perhaps a function like `publishProject(projectId, targetPlatform)`) that returns the generated build or saves it to a location. By linking the modules this way, we separate responsibilities: `updl` knows how to generate, and `publish` knows how to serve the results.
10. **Ensure editor (Flowise) integration points:** The Flowise editor is part of our platform (integrated in the monorepo, possibly under `packages/editor`). To add custom UPDL nodes to the editor, we may need to modify its configuration or source. Identify where Flowise defines its node types or loads node definitions. Insert hooks or add code to include our `apps/updl/src/nodes` definitions and category. (If Flowise supports a plugin system, we'll use it; otherwise, we modify the source directly.) This step includes editing the appropriate JSON or TS files in `packages/editor` to register the new node types and grouping them under a distinct category (e.g., a palette section labeled "UPDL"). The key is that when the user opens the editor UI, they can drag-and-drop our UPDL nodes. All code specific to node behavior (like default properties or how connections are validated) lives in `apps/updl`, but the editor needs awareness (node icons, names, ports) to display and use them correctly. We'll document these modifications clearly to avoid confusion.
11. **Prevent confusion with old vs new implementations:** As the new UPDL system comes online, we should deprecate or remove the old test nodes and flows (e.g., the AR.js test nodes and any associated UI) to avoid duplication. Clearly separate legacy code (if any remains for reference) from the new code. For example, we might move old prototypes to an archive folder or flag them as deprecated in comments/documentation. Going forward, all node and exporter code will reside in `apps/updl`. This ensures developers know where to add or modify functionality (no scattered code in multiple packages) and that old approaches (like the dedicated AR bot flow) are retired.
12. **Verify independence of components:** Each new sub-project (`apps/updl`, `apps/publish`) should be able to run or build on its own. For instance, we will have a unit test in `apps/updl` that loads a sample UPDL JSON and runs each exporter, ensuring that part works in isolation. Similarly, `apps/publish` should start up and serve a test request (even if `apps/updl` just returns dummy data initially). This modular setup (with clear boundaries) will make development and testing easier, and it aligns with our architecture of separated concerns.
13. **Revise editor UI for publishing/export:** Rework the existing Flowise "Embed in website or use as API" dialog into a new **Publish & Export** interface. This involves renaming the dialog and adjusting its tabs: the first tab (configuration) will allow selection of the target platform (e.g., Chatbot, AR.js, PlayCanvas, etc.—the chatbot remains labeled as such, and other technologies are listed by name rather than as a variant of "bot"). After choosing a platform, the second step (which was "Share Bot") becomes a general **Publish** section for that platform. It will provide the user with the publication link for the generated application. We will also plan for an **Export** option (possibly another tab or button) that allows the user to download the project code/package for the selected platform. All new UI elements will use the existing translation system (i18n) for multilingual support.
14. **Complete embed code functionality for all platforms:** In the repurposed Publish dialog, ensure that the embed code snippets (the tabs like "Embed", "Python", "JavaScript", "cURL") are updated or extended for the new platforms. Originally, these embed options were for chatbots; we will generalize or duplicate this functionality for other platforms where applicable (for example, providing an HTML snippet for embedding an AR scene, or a JS snippet to instantiate a PlayCanvas scene). If some platforms don't support certain embedding methods, we will handle that gracefully (e.g., disable or provide a note). This step will finalize the one-click deployment experience across platforms.
15. **Optimize publishing links and output format:** Implement a unified scheme for published URLs. Instead of URLs containing the type (like `/chatbot/…` or `/arbot/…`), use a common path (for example, `/app/{projectId}` or similar with the project's UUID). This keeps links uniform and simple. Additionally, ensure that the published application is served in a clean, standalone page. In the earlier AR prototype, the AR content was injected into the main app's page, resulting in nested HTML (the React app wrapping an inner A-Frame scene). Moving forward, the publish system will serve each exported project with its own minimal HTML wrapper (or even a distinct static page), avoiding double nesting. This might involve creating a separate layout template for each technology if needed (for example, a basic HTML structure that includes any required scripts and a container for the 3D content). The result will be a more professional-looking published page (and we can optionally include a small branded footer or bar, similar to PlayCanvas's preview bar, without cluttering the embedded content). In the future, we might differentiate between a "framed" view (with an editor UI frame or branding) and an "unframed" view (just the content) via different URL patterns, but initially a single view per publish is sufficient.

By following these steps, we establish a clear structure: **`apps/updl` for core logic (node system & exporters)** and **`apps/publish` for the deployment interface**. The main application (Universo Platformo React) will integrate these, but by keeping them in dedicated modules, we avoid confusion about where code should reside. Node definitions and exporters go into `apps/updl` (and nowhere else), and publishing UI/server code goes into `apps/publish`. This directory organization will help all team members navigate the project and contribute without stepping on each other's toes. The updated editor and publish workflow will provide a seamless experience: design in the node editor, then choose a platform and publish/export with a few clicks, all within the same interface.

## Implementation Roadmap (v0.1 → v0.3)

> _A comprehensive, level‑structured plan that the AI agent and human team can reference while building the platform._  
> _Tasks are grouped by major feature blocks (Level 1) and decomposed to concrete action items (Level 4)._

### 1. Implement UPDL Node System in Flowise (Editor Integration)

1. **Define core node taxonomy** — Scene, Object, Camera, Light, Interaction, Animation, Controller.
2. Extend Flowise editor config to register custom UPDL nodes, icons & palettes (new "UPDL" category in node selector).
3. Add base TypeScript interfaces for nodes (common props, (de)serialization).
4. **Scene Node**
    - Draft JSON schema (background, env‑map, OnStart/OnEnd events).
    - Expose in UI as a root‑only draggable node.
5. **Object Node**
    - Schema: transform, primitive/model ref, material.
    - Property inspector UI (model URL, primitive selector).
6. **Camera Node**
    - Props: proj‑type, fov, near/far.
    - Allow parenting under Scene/Object.
7. **Light Node** — types, color, intensity, range/angle controls.
8. **Interaction Node (OnClick)** — target ref, single _Trigger_ output.
9. **Controller Node (Spin / Orbit demo)** — _Trigger_ in → value out.
10. **Animation Node** — minimal timeline; _Play/Pause/Stop_ inputs, _OnFinish_ trigger.
11. Validate port compatibility (e.g. Scene.OnStart → Controller.Trigger).
12. Persist/load: extend Flowise save logic to store custom node data.
13. Deprecate legacy AR.js test nodes.
14. **Testing**: build demo flow (Scene → Object → OnClick → Animation), save/reload.

### 2. Implement AR.js Exporter (A‑Frame‑based Web AR)

1. Create exporter interface in `apps/updl`.
2. Scaffold `ARjsExporter.ts`.
3. Generate `<a-scene>` + AR.js setup, default Hiro marker + `<a-camera>`.
4. Map Object nodes to `<a-entity>` (gltf‑model or primitive geometries).
5. Map Light nodes to `<a-light>`.
6. Emit click listeners / cursor settings for OnClick nodes → dispatch to animations.
7. Add `animation="property: …"` snippets for simple spin demo.
8. Inject required CDN `<script>` tags (A‑Frame & AR.js).
9. Return pretty‑formatted HTML.
10. Wire into publish module.
11. **Testing**: marker detection + click‑triggered rotation.

### 3. Implement PlayCanvas React Exporter

_Goal:_ generate a ready‑to‑paste JSX component that reproduces the UPDL scene using **@playcanvas/react**.

1. **Module skeleton**

    - `apps/updl/src/exporters/PlayCanvasReactExporter.ts`
    - Exports `exportToPlayCanvasReact(graph: UpdlGraph): ExportResult`.

2. **Code‑gen strategy**

    - Walk the graph once, build an in‑memory **JSX string** tree.
    - Top wrapper:
        ```jsx
        <PlayCanvasApp id='updlApp'>{/* entities injected here */}</PlayCanvasApp>
        ```
    - Re‑use helper `renderEntity(node)` to recursively emit `<Entity>`.

3. **Node mapping**

    - **Scene →** `<Scene name="..." gravity={...}/>`
    - **Camera →** `<Entity camera={{fov, clearColor}} position={[x,y,z]} />`
    - **Light →** `<Entity light={{type:'directional',color:'#fff',intensity}} />`
    - **Object →** `<Entity render={{type:'box'}} position… rotation… scale… />`
    - **Hierarchy** preserved by nesting the JSX.

4. **Interactions**

    - For every _OnClick_ edge create a tiny ÞS (TypeScript) script:
        ```ts
        export default class Clickable extends pc.ScriptType {
            initialize() {
                this.entity.element.on('click', () => this.app.fire('updl:onClick', this.entity))
            }
        }
        ```
    - Attach via `<Entity script={{Clickable}}>`.

5. **Animation / Controller nodes**

    - Pre‑made script templates: _SpinController_, _OrbitController_.
    - When UPDL links OnClick → Spin, emit glue code that toggles `enabled` on the `SpinController` script.

6. **Asset loading**

    - For `model` properties output
        ```jsx
        <Entity model={{ asset: 'model-uuid' }} />
        ```
        plus stub `// TODO preload assets`.

7. **Testing hook**
    - `npm run updl:test:playcanvas-react` builds a CRA sandbox and inserts generated file into `/src/UpdlScene.tsx`.

### 4. Implement Babylon.js Exporter

_Goal:_ emit a self‑contained **ES module** (or `<script>` blob) that renders the scene in Babylon.js.

1. **Boilerplate**

    - Canvas tag id: `renderCanvas`.
    - Engine & scene bootstrapped as per docs.

2. **Camera mapping**

    - Perspective → `new BABYLON.FreeCamera`.
    - Orbit flag present → `new BABYLON.ArcRotateCamera` and `attachControl(canvas)`.

3. **Mesh creation**

    - Primitive box/sphere → `BABYLON.MeshBuilder.CreateBox|Sphere`.
    - Hierarchy via `child.parent = parent`.

4. **Materials**

    - Color hex strings mapped with `BABYLON.Color3.FromHexString`.
    - TODO: PBR pipeline when `material.type === 'pbr'`.

5. **Lights**

    - Directional / Point / Spot objects with intensity & color.

6. **Interactions**
    - Per‑mesh `ActionManager` with `OnPickTrigger` to emit custom events:
        ```ts
        mesh.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () =>
                scene.onPointerObservable.notifyObservers({ type: 'updl:click', target: mesh })
            )
        )
        ```
7. **Animations**

    - If UPDL node `SpinController` present, inject `scene.onBeforeRenderObservable` plus `mesh.rotation.y += speed*dt`.

8. **Output**
    - Returns `{ type:'html', content:"<!doctype html>…<script>/* generated JS */</script>" }`.

### 5. Implement Three.js Exporter

_Goal:_ produce a standalone HTML file that bundles Three.js via CDN and reproduces UPDL logic.

1. **Scaffold**

    - Insert `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>`.
    - Optional loader imports (GLTFLoader) when models detected.

2. **Scene & renderer**
    ```js
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    ```
3. **Mesh mapping**

    - Box → `new THREE.BoxGeometry()` etc.
    - `mesh.userData.updlId = node.id` for later lookup.

4. **Ray‑caster interaction**

    ```js
    const raycaster = new THREE.Raycaster()
    window.addEventListener('click', (e) => {
        mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
        raycaster.setFromCamera(mouse, camera)
        const hit = raycaster.intersectObjects(scene.children, true)[0]
        if (hit) dispatchUpdlEvent('click', hit.object.userData.updlId)
    })
    ```

5. **Anim / Spin**

    - Simple flag per mesh; in render loop `if(m.spin) m.rotation.y += speed*delta`.

6. **GSAP optional**
    - If `AnimationNode.type === 'timeline'` emit `gsap.to(mesh.rotation, {y:Math.PI*2,duration:2});` and include CDN link.

### 6. Implement A‑Frame VR Exporter

_Goal:_ reuse AR.js exporter but output plain VR scene.

1. **Scene tag**

    ```html
    <a-scene vr-mode-ui="enabled: true" embedded>
        <!-- generated content -->
    </a-scene>
    ```

2. **Camera & cursor**

    ```html
    <a-entity camera wasd-controls look-controls>
        <a-cursor fuse="false" raycaster="objects: .clickable"></a-cursor>
    </a-entity>
    ```

3. **Objects / lights**

    - Same mapping as AR exporter; omit `<a-marker>`.

4. **Interactions**

    - Add `.clickable` class to entities with OnClick.
    - JS appended:
        ```js
        AFRAME.registerComponent('updl-onclick', {
            init() {
                this.el.addEventListener('click', () => this.el.emit('updl:click'))
            }
        })
        ```

5. **Animations**
    - Use `<a-animation>` attributes or register components as in AR exporter.

### 7. Implement PlayCanvas Engine Exporter

_Goal:_ pure engine JS for embedding in any HTML page.

1. **Bootstrap**

    ```js
    const canvas = document.getElementById('application-canvas')
    const app = new pc.Application(canvas, { mouse: true, keyboard: true })
    app.start()
    ```

2. **Entity factory**

    - Helper `createEntity(node): pc.Entity` handles primitives & model assets.
    - Store map `id → entity`.

3. **Hierarchy linking** after all creations: `parent.addChild(child)`.

4. **Ray‑cast click handling**

    ```js
    app.mouse.on(pc.EVENT_MOUSEDOWN, (e) => {
        const from = camera.camera.screenToWorld(e.x, e.y, camera.camera.nearClip)
        const to = camera.camera.screenToWorld(e.x, e.y, camera.camera.farClip)
        const hit = app.systems.rigidbody.raycastFirst(from, to)
        if (hit) app.fire('updl:click', hit.entity.name)
    })
    ```

5. **Spin script template**

    ```js
    var SpinScript = pc.createScript('spinScript')
    SpinScript.attributes.add('speed', { type: 'number', default: 30 })
    SpinScript.prototype.initialize = function () {
        this.enabled = false
    }
    SpinScript.prototype.update = function (dt) {
        if (this.enabled) this.entity.rotate(0, this.speed * dt, 0)
    }
    ```

6. **Glue**

    - When UPDL connection OnClick → Spin exists, in click handler set `target.script.spinScript.enabled = true`.

7. **Export result**
    - Emit JS plus minimal HTML stub with `<canvas id="application-canvas"></canvas>`.

### 8. Develop **Publishing Module** (`apps/publish`)

-   React UI: ProjectSelector, platform check‑list, Publish button.
-   Express routes `POST /publish` and `GET /publish/list`.
-   Static file storage `public/exports`.
-   Error handling & link display.

### 9. Integrate Editor with Publishing Workflow

-   Add _Publish_ toolbar button in Flowise UI.
-   Auto‑save graph before publish, open PublishModal with current flow ID.
-   Display success URL in‑editor.

### 10. Testing & Debugging Matrix

-   Static scene, interactive scene, hierarchy scene across **AR.js / PlayCanvas / Babylon / Three**.
-   Cross‑engine coordinate parity checks.
-   Include missing CDN scripts automatically.
-   Memory/perf smoke tests (100 objects stress).

### 11. Documentation & Examples

1. Update README + User Guide.
2. Developer docs: adding nodes / exporters.
3. Example flows (AR demo, interactive web demo, solar system).
4. Keep **Memory Bank** docs (this file, techContext, activeContext) in sync.
5. Auto‑generate UPDL JSON schema reference.
6. Maintain CHANGELOG in `progress.md`.

## Inter-Module Dependencies and Types

### Current Approach: Local Type Copies

In the current APPs architecture, to prevent circular dependencies and maintain module isolation, we use the following approach:

-   The `updl` module serves as the source of truth for UPDL type definitions (`UPDLFlow`, `ExporterInfo`, etc.)
-   The `publish` module maintains local copies of necessary types in its subdirectories
-   When types change in `updl`, copies in `publish` must be manually updated

This is a temporary solution that respects the `rootDir: './imp'` constraint in tsconfig.json while ensuring module isolation. In future versions, we plan to implement a more elegant synchronization mechanism or create a separate package for shared types.

## Localization System Architecture

### Current i18n Implementation

The project currently uses i18next for internationalization with the following structure:

-   Main configuration file: `packages/ui/src/i18n/index.js`
-   Transition from large locale files to modular namespaces:
    -   Legacy approach: Large monolithic locale files (`en.json`, `ru.json`)
    -   New approach: Modular namespace files in language directories (`en/views/auth.json`, `ru/views/admin.json`, etc.)

### Localization in APPs Architecture

For the new APPs architecture, we implement a consistent i18n structure that follows the modular namespace pattern:

1. **Directory Structure**

    ```
    apps/
    ├── updl/
    │   ├── i18n/
    │   │   ├── index.js         # Optional exports for app-specific translations
    │   │   └── locales/
    │   │       ├── en/
    │   │       │   └── main.json # English translations
    │   │       └── ru/
    │   │           └── main.json # Russian translations
    │   └── imp/
    └── publish/
        ├── i18n/
        │   ├── index.js
        │   └── locales/
        │       ├── en/
        │       │   └── main.json
        │       └── ru/
        │           └── main.json
        └── imp/
    ```

2. **Integration with Main i18n System**

    Each app can provide its translations in two ways:

    a. **Automatic Discovery**:
    The main i18n initialization searches for translation files in the apps directory structure and adds them to the i18n resources.

    b. **Explicit Registration**:
    Each app exports its translations through an index.js file, which the main i18n system imports:

    ```javascript
    // apps/updl/i18n/index.js
    import enMainTranslation from './locales/en/main.json'
    import ruMainTranslation from './locales/ru/main.json'

    export const updlTranslations = {
        en: { updl: enMainTranslation },
        ru: { updl: ruMainTranslation }
    }
    ```

    These are then imported and registered in the main i18n configuration:

    ```javascript
    // packages/ui/src/i18n/index.js (modified to include apps translations)
    import { updlTranslations } from 'apps/updl/i18n'
    import { publishTranslations } from 'apps/publish/i18n'

    // Merge app translations with existing resources
    const resources = {
        en: {
            translation: enTranslation,
            // ... existing namespaces
            updl: updlTranslations.en.updl,
            publish: publishTranslations.en.publish
        },
        ru: {
            // ... similar structure
        }
    }
    ```

3. **Translation Key Structure**

    Within each app, translation keys follow a consistent structure:

    ```json
    {
        "nodeNames": {
            "scene": "Scene",
            "object": "Object",
            "camera": "Camera"
        },
        "nodeDescriptions": {
            "scene": "Root node for all UPDL scenes",
            "object": "Represents a 3D object in the scene",
            "camera": "Defines the viewpoint for the scene"
        },
        "propertyLabels": {
            "position": "Position",
            "rotation": "Rotation",
            "scale": "Scale"
        }
    }
    ```

4. **Usage in Components**

    Components use the translations via the useTranslation hook with the appropriate namespace:

    ```jsx
    // In a UPDL node component
    import { useTranslation } from 'react-i18next'

    function SceneNodeComponent() {
        const { t } = useTranslation('updl')

        return (
            <div>
                <h3>{t('nodeNames.scene')}</h3>
                <p>{t('nodeDescriptions.scene')}</p>
            </div>
        )
    }
    ```

This approach ensures that:

1. Each app maintains its own translations in a modular, maintainable way
2. The main application can access all translations through a unified i18n system
3. New apps can easily add their own translations without modifying core files
4. The system supports future expansion to additional languages

As the project scales, we may consider further optimizations such as:

-   Lazy-loading translations for apps/components when needed
-   Automated synchronization of translation keys between language files
-   A shared tool for managing translations across the entire project
