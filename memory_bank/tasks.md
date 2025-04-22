# Tasks

## Pending
- Explore project structure in detail  
- Identify integration points for Supabase  
- Set up development environment  

### Legend
- [ ] Planned / Not Started  
- [~] In Progress  
- [x] Completed  
- [! ] Blocked / Needs Decision  

## Level 1 – Core Systems
- [~] **Implement UPDL Node System in Flowise (Editor Integration)**  
  - [ ] Define required UPDL node types & roles  
  - [ ] Register custom nodes in Flowise configuration (add a new "UPDL" category in the node palette)  
  - [ ] Implement base TypeScript interfaces/classes for nodes  
  - **Scene Node**  
    - [ ] JSON schema & properties  
    - [ ] Editor UI integration (ensure it can only be a root node)  
  - **Object Node**  
    - [ ] Schema & properties  
    - [ ] Editor UI integration (property panel for model/material)  
  - **Camera Node**  
    - [ ] Properties definition (FOV, clipping planes, mode)  
    - [ ] Editor UI integration (allow as child of Scene/Object)  
  - **Light Node**  
    - [ ] Properties definition (type, color, intensity, range/angle)  
    - [ ] Editor UI integration (attach to scene or object)  
  - **Interaction Node (OnClick)**  
    - [ ] Define schema (target object reference)  
    - [ ] Editor UI integration (one output trigger port)  
  - **Controller Node (Spin / Orbit)**  
    - [ ] Define schema (e.g., speed)  
    - [ ] Editor UI integration (input trigger, output value)  
  - **Animation Node**  
    - [ ] Define schema (duration, loop, target property)  
    - [ ] Editor UI integration (play/pause trigger inputs, OnFinish output)  
  - [ ] Validate ports and connections (e.g., cannot connect incompatible types)  
  - [ ] Persist/load custom nodes in Flowise JSON (update save/load logic)  
  - [ ] Remove legacy AR.js test nodes (deprecate "AR.js" temporary category)  
  - [ ] **Testing:** Create a sample flow using new nodes, save and reload to ensure data integrity  

## Level 2 – Exporters
- [~] **AR.js / A‑Frame Exporter**  
  - [ ] Exporter interface stub in `apps/updl` (base class or function)  
  - [ ] HTML template with marker + camera (Hiro pattern, A-Frame scene)  
  - [ ] Object nodes → `<a-entity>` (use primitive or glTF model based on node properties)  
  - [ ] Light nodes → `<a-light>` with corresponding type and properties  
  - [ ] OnClick → cursor setup and raycaster logic in A-Frame (for click interactions)  
  - [ ] One-shot A-Frame animations (e.g., `<a-animation>` or `<a-entity animation="...">` for spin demo)  
  - [ ] Include A-Frame & AR.js CDN scripts in the HTML output  
  - [ ] **Testing:** Run a webcam marker demo (ensure model appears and can spin on click)  

- [ ] **PlayCanvas React Exporter**  
  - [ ] Create exporter module (`PlayCanvasReactExporter.ts`) in `apps/updl`  
  - [ ] Generate JSX component tree representing the scene  
  - [ ] Map Camera, Lights, Objects to PlayCanvas React components  
  - [ ] Implement placeholders for interactive elements (OnClick, Spin script as needed)  
  - [ ] **Testing:** Render the JSX in a React environment (e.g., a Storybook or test app) to verify the scene loads  

- [ ] **Babylon.js Exporter**  
  - [ ] Engine/scene bootstrap code (initialize Babylon engine and scene)  
  - [ ] Convert basic primitives and load models (via Babylon’s APIs or plugins)  
  - [ ] Use Babylon’s ActionManager for click events → set a flag to trigger spin  
  - [ ] Map UPDL lights and camera to Babylon equivalents  
  - [ ] **Testing:** Create an HTML file with a canvas, include the generated Babylon script, ensure scene runs with objects and a clickable rotation  

- [ ] **Three.js Exporter**  
  - [ ] Scene and renderer setup (create Three.js scene, camera, renderer)  
  - [ ] Load models (GLTFLoader) and add primitives for Object nodes  
  - [ ] Implement raycaster for OnClick events (intersect objects on click)  
  - [ ] Simple animation loop for Spin (rotate object in `requestAnimationFrame`)  
  - [ ] **Testing:** Open the exported HTML and verify 3D scene and interactions work  

- [ ] **A‑Frame VR Exporter**  
  - [ ] VR scene output using `<a-scene>` without AR marker (for VR mode)  
  - [ ] Add an `<a-cursor>` for gaze-based click in VR (if needed for interactions)  
  - [ ] Ensure VR mode enabled (e.g., `<a-scene embedded vr-mode-ui="enabled: false">` if using default or let user enter VR)  
  - [ ] **Testing:** Use WebXR emulator or device to ensure the scene is viewable in VR headset  

- [ ] **PlayCanvas Engine Exporter**  
  - [ ] Pure JS PlayCanvas bootstrap (`pc.Application` creation, canvas element)  
  - [ ] Convert UPDL nodes to PlayCanvas entities and components (similar to how the React exporter works, but in imperative style)  
  - [ ] Implement a ray-cast based click handler (since PlayCanvas needs explicit picking for clicks)  
  - [ ] Attach a SpinScript to entities that should rotate (using PlayCanvas script component)  
  - [ ] **Testing:** Serve the exported script and HTML, verify the PlayCanvas app runs with expected behavior  

## Level 3 – Editor & Publishing Integration
- [ ] **Publish Module UI Integration**  
  - [ ] Create the **Publish & Export** dialog in the UI (replace "Embed in website or use as API").  
  - [ ] Add platform selection on the configuration step (e.g., Chatbot, AR.js, PlayCanvas, etc., listed by name).  
  - [ ] Rename "Share Bot" tab to **Publish** and update its content to handle any chosen platform (generate or fetch the appropriate publish URL).  
  - [ ] Implement an option to **Export** project files for download (allow user to get the code for offline use for the chosen platform).  
  - [ ] Update embed code tabs (Embed, Python, JavaScript, cURL) to work with the new platforms or hide them if not applicable.  
  - [ ] Ensure all new UI text is added to the i18n system (translations files in the `apps/` structure) rather than hardcoded.  
  - [ ] Verify the build process includes assets and files from `apps/publish` and `apps/updl` (so that running `pnpm build` and `pnpm start` picks up the new modules).  
  - [ ] **Testing:** Full publish flow – design a test UPDL flow, use the dialog to publish it as AR.js, and open the provided URL to verify the application works.

- [ ] **Publish Backend Endpoints**  
  - [ ] Implement Express routes in `apps/publish/src/server` (e.g., POST `/publish`) to handle publication requests.  
  - [ ] In the publish handler, call `apps/updl` to generate the project output for the requested platform.  
  - [ ] Save the generated files (HTML, JS, assets) to a public directory or storage accessible by the server.  
  - [ ] Serve a unique URL for each published project (e.g., GET `/p/{uuid}` returning the HTML content or redirecting to a static page).  
  - [ ] If multiple flows exist in an editor session, determine which flow to publish (possibly the one specified by ID in the request or the most recently edited). Implement logic similar to Flowise’s `buildChatflow`/`buildARflow` to select the correct flow/chain by type.  
  - [ ] **Testing:** Use the API directly (via HTTP calls) to request a publish of a known project and ensure the response contains a valid URL and the content is accessible.

- [ ] **Deprecate Legacy AR Prototype**  
  - [ ] Remove or disable the temporary AR.js nodes category in the Flowise editor now that official UPDL nodes are available.  
  - [ ] Remove old routes like `/arbot/{id}` and `/chatbot/{id}` in favor of the unified publish route (if not already covered by the new publish mechanism).  
  - [ ] Clearly mark any legacy code (e.g., `buildARflow.ts` or old AR handlers) as deprecated and ensure it's not invoked by the new system.  
  - [ ] Migrate any remaining data (if needed) from old structures to new (for example, existing AR bot projects should be converted or re-created using UPDL nodes).  
  - [ ] **Testing:** Ensure that after removal, all functionality (chatbot publish and AR publish) still works via the new system (the chatbot should also use the new unified publish flow transparently).
