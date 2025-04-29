# Tasks

## Pending

-   Explore project structure in detail
-   Identify integration points for Supabase
-   Set up development environment

### Legend

-   [ ] Planned / Not Started
-   [~] In Progress
-   [x] Completed
-   [! ] Blocked / Needs Decision

## Level 1 – Core Systems & APPs Structure

-   [~] **Implement UPDL Node System in Flowise (Editor Integration)**
    -   [x] **Create APPs Directory Structure**
        -   [x] Create root directory `apps/` in project root
        -   [x] Update project configuration to include `apps` in build process
        -   [x] Modify `package.json` to include `apps` in workspaces
        -   [x] Verify build process works with new structure
        -   [x] Fix server typings errors related to INode integration
    -   [x] **Create UPDL Application**
        -   [x] Set up `apps/updl/imp/` directory structure
        -   [x] Create base `BaseUPDLNode` class for all UPDL nodes
        -   [x] Implement UPDL interfaces similar to `Interface.AR.ts`
        -   [x] Create `UPDLSceneBuilder.ts` for UPDL flow processing
    -   [x] **Fix UI Build Error**
        -   [x] Fix path issue "../../../apps/publish/i18n" in src/i18n/index.js
        -   [x] Set up correct integration between flowise-ui and apps/publish packages
        -   [x] Implement vite alias for @apps/publish/i18n path
    -   [x] Define required UPDL node types & roles
    -   [x] **Node Registration Mechanism**
        -   [x] Create `register.js` in `apps/updl` for automatic node registration
        -   [x] Add initialization function in Flowise to load UPDL nodes
        -   [x] Register custom nodes in Flowise configuration (add a new "UPDL" category in the node palette)
        -   [x] Set up correct icon display for UPDL nodes in editor
        -   [x] Remove test AR.js category from node palette
        -   [x] Implement directed hooks for registering external nodes (REGISTER_EXTERNAL_NODES)
        -   [x] Create flowiseNodesHandler interface for registering nodes from apps/updl
        -   [x] Update NodesPool.ts to automatically discover UPDL nodes
        -   [x] Update node icon handling to use SVG files in node directories
        -   [x] Refactor initialize.ts and index.ts to remove manual registration code
    -   [~] **AR.js System Complete Removal**
        -   [ ] Delete AR.js node components from packages directory
        -   [ ] Replace Interface.AR.ts with UPDL interfaces
        -   [ ] Remove AR.js controllers and routes
        -   [ ] Replace buildARflow.ts with buildUPDLflow.ts
        -   [ ] Remove UI handlers for AR.js test implementation
    -   [x] Implement base TypeScript interfaces/classes for nodes (Vector3, Color, etc.)
    -   **Scene Node**
        -   [x] JSON schema & properties
        -   [ ] Editor UI integration (ensure it can only be a root node)
    -   **Object Node**
        -   [x] Schema & properties
        -   [ ] Editor UI integration (property panel for model/material)
    -   **Camera Node**
        -   [x] Properties definition (FOV, clipping planes, mode)
        -   [ ] Editor UI integration (allow as child of Scene/Object)
    -   **Light Node**
        -   [x] Properties definition (type, color, intensity, range/angle)
        -   [ ] Editor UI integration (attach to scene or object)
    -   **Interaction Node (OnClick)**
        -   [ ] Define schema (target object reference)
        -   [ ] Editor UI integration (one output trigger port)
    -   **Controller Node (Spin / Orbit)**
        -   [ ] Define schema (e.g., speed)
        -   [ ] Editor UI integration (input trigger, output value)
    -   **Animation Node**
        -   [ ] Define schema (duration, loop, target property)
        -   [ ] Editor UI integration (play/pause trigger inputs, OnFinish output)
    -   [ ] Validate ports and connections (e.g., cannot connect incompatible types)
    -   [ ] Persist/load custom nodes in Flowise JSON (update save/load logic)
    -   [ ] Create infrastructure for registering nodes from `apps/updl` in Flowise
    -   [ ] **UPDL Core Flow Testing**
        -   [ ] Create a sample flow using UPDL nodes
        -   [ ] Test saving and loading UPDL nodes in JSON
        -   [ ] Verify UPDL chain detection works correctly
        -   [ ] Test publish flow with AR.js and verify marker-based display
    -   [~] **Localization for UPDL Nodes**
        -   [x] Create `apps/updl/i18n/locales/{en,ru}/` structure
        -   [ ] Add language keys for node names and descriptions
        -   [x] Implement integration with main i18n system
    -   [ ] **Multi-Scene Support (Future Implementation)**
        -   [ ] Support multiple UPDL flows in one project
        -   [ ] Create scene selection mechanism in publish interface
        -   [ ] Implement scene transition logic based on conditions
        -   [ ] Develop flow-based scene switching API
        -   [ ] Add start scene configuration option for publication
        -   [ ] Create scene transition monitoring in preview

## Level 2 – Exporters & Publish System

-   [~] **Create Publish Application**

    -   [x] Set up `apps/publish/imp/react` for frontend
    -   [x] Set up `apps/publish/imp/express` for backend
    -   [ ] Develop routing system for new publication URLs

-   [x] **Develop Publication & Export UI**

    -   [x] Modify existing "Embed in website or use as API" UI into "Publish & Export"
    -   [x] Update Configuration tab with technology selection (Chatbot, AR.js, PlayCanvas, etc.)
    -   [x] Rename "Share Bot" tab to "Publish" with technology-specific settings
    -   [ ] Add option to export/download project for selected technology

-   [~] **AR.js / A‑Frame Exporter (Hybrid Approach)**

    -   [x] Create handler in `apps/publish/imp/react/miniapps/arjs/ARJSExporter.ts`
    -   [x] Implement client-side HTML generation for AR.js
    -   [x] HTML template with marker + camera (Hiro pattern, A-Frame scene)
    -   [x] Object nodes → `<a-entity>` (use primitive or glTF model based on node properties)
    -   [x] Light nodes → `<a-light>` with corresponding type and properties
    -   [ ] OnClick → cursor setup and raycaster logic in A-Frame (for click interactions)
    -   [ ] One-shot A-Frame animations (e.g., `<a-animation>` or `<a-entity animation="...">` for spin demo)
    -   [x] Include A-Frame & AR.js CDN scripts in the HTML output
    -   [~] **AR.js Default Handlers**
        -   [x] Implement automatic camera addition if not specified
        -   [x] Add default lighting (ambient + directional)
        -   [x] Create default marker handler (Hiro)
        -   [x] Implement common HTML structure for A-Frame/AR.js
    -   [~] **Architecture Benefits**
        -   [x] Client-side generation reduces server load
        -   [x] Support for offline project export
        -   [x] Centralized storage for published projects
        -   [x] Improved end-user performance
    -   [~] **Further Improvements**
        -   [x] Fix typing errors in `ARJSExporter.ts`
        -   [x] Add strong type checking for function parameters
        -   [ ] Develop and run tests for HTML generation
        -   [ ] Complete UI integration with Flowise interface
        -   [ ] Add scene preview in editor
    -   [ ] **Testing:** Run a webcam marker demo (ensure model appears and can spin on click)

-   [~] **Server-side Integration**

    -   [x] Create API endpoints in `apps/publish/imp/express/src/routes`
    -   [x] Develop publication handlers in `apps/publish/imp/express/src/controllers/UPDLController.js`
    -   [~] **buildUPDLflow.ts Development**
        -   [x] Create `buildUPDLflow.ts` based on `buildARflow.ts`
        -   [x] Implement `getUPDLEndingNodes()` function
        -   [ ] Add UPDL chain validation logic
        -   [x] Integrate with Express request handlers
    -   [x] Implement saving and accessing published projects
    -   [ ] Create unified URL scheme (`/p/{uuid}`) for all published projects

-   [~] **HTML Generation Solution (Hybrid Approach)**

    -   [x] Create frontend API client in `apps/publish/imp/react/api/updlApi.ts`
    -   [x] Implement client-side HTML generation via `ARJSExporter`
    -   [x] Set up server-side HTML storage with `UPDLController.js`
    -   [ ] Develop resource injection mechanism (scripts, styles)
    -   [ ] Optimize resource loading for published AR.js projects
    -   [x] Develop AFrameModel object model for A-Frame elements representation
    -   [x] Create UPDLToAFrameConverter for transforming UPDL nodes to A-Frame model
    -   [x] Implement AFrameHTMLGenerator for templating HTML from model
    -   [x] **Reorganize Exporters Architecture**
        -   [x] Create base `BaseAFrameExporter` class with common generation methods
        -   [x] Implement inheritance for ARJSExporter from base class
        -   [x] Prepare structure for AFrameVRExporter with base code reuse
        -   [x] Develop exporter factory (ExporterFactory) for creating appropriate exporter type
    -   [~] **UPDL Node to Editor Integration**
        -   [x] Update AddNodes.jsx to display UPDL tab instead of AR.js
        -   [x] Replace AR.js tags with UPDL tags in node definitions
        -   [x] Configure Scene Node as root node for UPDL flows
        -   [x] Implement basic Object Node properties for color and primitives
        -   [ ] Test drag-and-drop functionality for UPDL nodes

-   [x] **Localization for Publish System**

    -   [x] Create `apps/publish/i18n/locales/{en,ru}/main.json` structure
    -   [x] Add language keys for publish interface elements
    -   [x] Implement integration with main i18n system for publish interface
    -   [x] Set up directory structure and base files for localization
    -   [x] Create export mechanism for translations using publishTranslations object

-   [~] **AR.js Export Functionality**

    -   [x] Create handlers in `updlApi.ts` for API interaction
    -   [x] Implement HTML generation on client with `ARJSExporter.ts`
    -   [ ] Add export button to publication dialog
    -   [ ] Implement AR.js project packaging with dependencies
    -   [x] Add documentation for using exported projects

-   [ ] **PlayCanvas React Exporter**

    -   [ ] Create handler in `apps/publish/imp/react/miniapps/playcanvas-react`
    -   [ ] Create exporter module (`PlayCanvasReactExporter.ts`) in `apps/updl`
    -   [ ] Generate JSX component tree representing the scene
    -   [ ] Map Camera, Lights, Objects to PlayCanvas React components
    -   [ ] Implement placeholders for interactive elements (OnClick, Spin script as needed)
    -   [ ] **Testing:** Render the JSX in a React environment (e.g., a Storybook or test app) to verify the scene loads

-   [ ] **Babylon.js Exporter**

    -   [ ] Create handler in `apps/publish/imp/react/miniapps/babylonjs`
    -   [ ] Engine/scene bootstrap code (initialize Babylon engine and scene)
    -   [ ] Convert basic primitives and load models (via Babylon's APIs or plugins)
    -   [ ] Use Babylon's ActionManager for click events → set a flag to trigger spin
    -   [ ] Map UPDL lights and camera to Babylon equivalents
    -   [ ] **Testing:** Create an HTML file with a canvas, include the generated Babylon script, ensure scene runs with objects and a clickable rotation

-   [ ] **Three.js Exporter**

    -   [ ] Create handler in `apps/publish/imp/react/miniapps/threejs`
    -   [ ] Scene and renderer setup (create Three.js scene, camera, renderer)
    -   [ ] Load models (GLTFLoader) and add primitives for Object nodes
    -   [ ] Implement raycaster for OnClick events (intersect objects on click)
    -   [ ] Simple animation loop for Spin (rotate object in `requestAnimationFrame`)
    -   [ ] **Testing:** Open the exported HTML and verify 3D scene and interactions work

-   [~] **A‑Frame VR Exporter**

    -   [x] Create handler in `apps/publish/imp/react/miniapps/aframe-vr`
    -   [x] VR scene output using `<a-scene>` without AR marker (for VR mode)
    -   [ ] Add an `<a-cursor>` for gaze-based click in VR (if needed for interactions)
    -   [ ] Ensure VR mode enabled (e.g., `<a-scene embedded vr-mode-ui="enabled: false">` if using default or let user enter VR)
    -   [ ] **Testing:** Use WebXR emulator or device to ensure the scene is viewable in VR headset

-   [ ] **PlayCanvas Engine Exporter**
    -   [ ] Create handler in `apps/publish/imp/react/miniapps/playcanvas-engine`
    -   [ ] Pure JS PlayCanvas bootstrap (`pc.Application` creation, canvas element)
    -   [ ] Convert UPDL nodes to PlayCanvas entities and components (similar to how the React exporter works, but in imperative style)
    -   [ ] Implement a ray-cast based click handler (since PlayCanvas needs explicit picking for clicks)
    -   [ ] Attach a SpinScript to entities that should rotate (using PlayCanvas script component)
    -   [ ] **Testing:** Serve the exported script and HTML, verify the PlayCanvas app runs with expected behavior

## Level 2.5 – Live Preview & Editor Enhancements

-   [ ] **Implement Live Preview in Flowise Editor**

    -   [ ] **Develop Preview Components**
        -   [ ] Create `apps/updl/imp/preview` directory structure
        -   [ ] Implement `UPDLPreviewPanel.jsx` component for preview display
        -   [ ] Create adapters for different preview technologies (AR.js, Three.js)
        -   [ ] Add styles and UI components for preview panel
    -   [ ] **Split View Integration**
        -   [ ] Modify Flowise editor to support screen splitting
        -   [ ] Implement display mode toggle
        -   [ ] Create UPDL node detection system for current flow
        -   [ ] Develop panel size control components
    -   [ ] **Preview HTML Generation**
        -   [ ] Extend `ARJSExporter` with `generatePreviewHTML()` method
        -   [ ] Implement markerless A-Frame version for preview
        -   [ ] Add orbital camera controls for preview
        -   [ ] Create automatic preview update mechanism
    -   [ ] **Asynchronous Processing with WebWorkers**
        -   [ ] Create `apps/updl/imp/preview/workers` directory
        -   [ ] Implement `arjsWorker.js` for background scene generation
        -   [ ] Develop API for worker communication
        -   [ ] Implement error handling and loading state
    -   [ ] **Mini-Preview for Individual Objects**
        -   [ ] Create mini-preview components for node property editors
        -   [ ] Develop isolated renderers for individual objects
        -   [ ] Integrate with node property editing panels
        -   [ ] Implement interactive object controls
    -   [ ] **Adapt Preview for Different Exporters**
        -   [ ] Create preview adapters factory matching exporters factory
        -   [ ] Implement specific preview settings for AR.js and A-Frame

-   [ ] **Optimize and Test Live Preview**
    -   [ ] **Preview Optimization**
        -   [ ] Implement debounced preview updates
        -   [ ] Add rendering quality settings
        -   [ ] Optimize resource loading for preview
        -   [ ] Implement caching for performance improvement
    -   [ ] **Preview Testing**
        -   [ ] Create test scenarios for various scene configurations
        -   [ ] Test across different browsers and devices
        -   [ ] Check performance with large scenes
        -   [ ] Test display mode switching

## Level 3 – Editor & Publishing Integration

-   [~] **Publish Module UI Integration**

    -   [x] Modify the "Embed in website or use as API" dialog to "Publish & Export"
    -   [x] Add platform selection in Configuration tab (Chatbot, AR.js, PlayCanvas, etc.)
    -   [x] Rename "Share Bot" tab to "Publish" and update content for each technology
    -   [ ] Implement Export option for downloading project files
    -   [~] Update embed code tabs for new platforms (or hide if not applicable)
    -   [x] Add i18n support for all new UI elements
    -   [ ] Verify build process includes assets from `apps/publish` and `apps/updl`
    -   [ ] **Testing:** Test full publish flow from UPDL creation to AR.js deployment
    -   [ ] **UI Modifications:**
        -   [ ] Update PublishModal component to use i18n keys for title and labels
        -   [ ] Create technology selection with icons in Configuration.jsx
        -   [ ] Implement conditional tab display based on selected technology
        -   [x] Create technology-specific publisher components in apps/publish/imp/react/miniapps/
        -   [ ] Create publisher registry (publisherRegistry) for different technologies
        -   [ ] Implement dynamic tabs display based on selected technology
        -   [ ] Develop plugin system for export handlers
    -   [ ] **Flow Management for Multiple Scenes:**
        -   [ ] Create UI for selecting multiple UPDL flows during publication
        -   [ ] Implement scene metadata management
        -   [ ] Add configuration for initial scene selection
        -   [ ] Develop basic condition editor for scene transitions

-   [~] **Unified Localization Structure**

    -   [x] Create consistent i18n structure across all apps modules
    -   [x] Implement automated import mechanism for apps language files
    -   [ ] Add support for language switching in published applications
    -   [ ] Test localization in all UI components and exported applications
    -   [ ] Create UPDL nodes localization in apps/updl/i18n/locales/{en,ru}/main.json

-   [~] **Publish Backend Endpoints**

    -   [x] Implement Express routes for handling publication requests
    -   [x] Create handlers to call UPDL exporters for different platforms
    -   [x] Save generated files to accessible storage
    -   [ ] Implement unified URL scheme (`/p/{uuid}`) for all published projects
    -   [ ] Add logic to select correct flow when multiple exist
    -   [ ] **Testing:** Verify API functionality for publishing projects

-   [ ] **Default Handlers for Other Technologies**

    -   [ ] PlayCanvas default handlers
    -   [ ] Babylon.js default handlers
    -   [ ] Three.js default handlers
    -   [ ] A-Frame VR default handlers

-   [ ] **Build Process Verification**
    -   [ ] Test build process with apps included
    -   [ ] Verify assets from apps/publish and apps/updl are included
    -   [ ] Ensure UPDL nodes are built during project build

## Level 4 - Testing & Quality Assurance

-   [ ] **Automated Testing Suite**

    -   [ ] **UPDL Transformation Testing**

        -   [ ] Create test scenarios for UPDL to AR.js transformation
        -   [ ] Develop unit tests for node registration mechanism
        -   [ ] Test HTML generation with different node combinations
        -   [ ] Validate generated HTML structure

    -   [ ] **Integration Testing**

        -   [ ] Test complete workflow from node creation to publication
        -   [ ] Verify URL generation and access to published projects
        -   [ ] Test export functionality for different technologies
        -   [ ] Check cross-browser compatibility

    -   [ ] **User Experience Testing**
        -   [ ] Conduct usability tests for node creation workflow
        -   [ ] Verify editor UI for node properties editing
        -   [ ] Test publication interface usability
        -   [ ] Validate error handling and user feedback
