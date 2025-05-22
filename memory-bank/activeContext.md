# Current Active Context

## Application Structure Refactoring

### Goal

Implement a unified, coherent structure for all applications in the apps/ directory, based on best practices and the architecture of the main Flowise project.

### Completed Steps

The following steps have been completed in the refactoring process:

1. Updated systemPatterns.md with the new architecture and made changes to tasks.md
2. Refactored publish-frt:
    - Created additional directories (assets, hooks, store, configs)
    - Renamed the miniapps directory to features
    - Created API client structure
    - Updated index.ts
    - Updated README.md
3. Refactored publish-srv:
    - Created directories for controllers, routes, interfaces, middlewares
    - Implemented new types and interfaces
    - Implemented REST endpoints and controllers
    - **Radically simplified codebase, removed all unnecessary components and files**
    - **Streamlined to minimal MVP for AR.js streaming generation only**
    - Updated server.ts and index.ts to integrate with main Flowise
    - Updated README.md
4. Completed asset management restructuring:
    - Created proper icons/ and images/ directories
    - Moved all static assets to appropriate locations
    - Updated import paths to reference new locations
5. Migrated miniapps to features:
    - Renamed directory structure for better clarity
    - Updated all import paths to use new structure
    - Removed old miniapps directories after confirming functionality
6. Improved AR.js publication interface:
    - Fixed initial state of "Сделать публичным" toggle to match Flowise patterns
    - Removed redundant "actions.close" button from interface
    - Removed duplicate "actions.copyLink" button to clean up UI

### Current Work

1. Refactoring updl-frt and updl-srv applications
2. Testing API interaction between applications
3. Implementing "Streaming" AR.js generation

### Key Decisions

-   Maintained the base/ nesting in the application structure
-   Implemented interaction via REST API instead of direct imports
-   Aligned the structure with a unified standard corresponding to the Flowise architecture
-   Each application contains its own interfaces and types
-   Clearly separated features by technology under the features/ directory
-   Simplified AR.js Publication interface to make it consistent with Flowise patterns
-   **Radically simplified publish-srv to include only the minimal functionality needed for AR.js streaming mode**
-   **Removed all unused components, services, and middlewares from publish-srv**
-   **Designed publish-srv as a pure extension to the main Flowise server without standalone capabilities**

**Current Sprint**: 0.9.0 pre-alpha (Apr 2025)

**Primary Focus**:

-   Complete refactoring of updl-frt and updl-srv
-   Implement "Streaming" AR.js generation on the frontend
-   Connect UPDL nodes with publication process
-   Test the end-to-end publication workflow

**Immediate Next Steps**:

1. Complete initial refinements of AR.js publication interface
2. Implement client-side UPDL to AR.js conversion
3. Create a route handler for `/p/{uuid}` publications
4. Connect UPDL nodes data with the publication process
5. Test the full workflow with a red cube example
6. Integrate AR.js publication state with Supabase for persistence

## Current Focus

### Updated Applications Structure

We have reorganized the application architecture to improve modularity and separation of concerns:

-   **publish-frt**: Frontend for publication system (UI components, export options)

    -   Standard directory structure with features/, components/, api/ etc.
    -   Technology-specific modules in features/ directory
    -   Static assets properly organized in assets/icons/ and assets/images/
    -   HTTP clients in api/ for backend communication
    -   Clear interfaces and types in interfaces/

-   **publish-srv**: Backend for publication system (API endpoints, minimal UPDL to AR.js support)

    -   **Minimal structure with only controllers/, routes/, interfaces/, middlewares/**
    -   **Only three REST API endpoints for AR.js publication**
    -   **Focused specifically on UPDL streaming generation**
    -   **Tight integration with main Flowise server**
    -   **No standalone server capability - designed as an extension only**

-   **updl-frt**: Frontend for UPDL nodes and scene building

    -   Currently being refactored to follow same standards
    -   Will include features/, api/, and other standard directories

-   **updl-srv**: Backend for UPDL processing and exporting
    -   Currently being refactored with standard directories
    -   Will move exporters to services/exporters/

This separation:

-   Provides clearer responsibility boundaries
-   Simplifies maintenance and development
-   Enables independent deployment of components
-   Improves code organization and reduces complexity
-   **Reduces code duplication by leveraging Flowise core functionality**

### Current Development Status

Simplifying the AR.js publication architecture and implementing client-side generation.

-   [x] Developed `AFrameModel` layer for A-Frame element representation
-   [x] Implemented `UPDLToAFrameConverter` for converting UPDL scenes to A-Frame
-   [x] Established base exporter architecture with clear responsibilities
-   [x] Created `ARJSExporter` for generating HTML from UPDL scenes
-   [x] Refactored code to clearly separate AR.js and A-Frame implementations
-   [x] Standardized directory structure across applications
-   [x] Completed migration from miniapps to features
-   [x] **Radically simplified publish-srv to minimal MVP for AR.js**
-   [x] **Removed all unused code, services, and controllers from publish-srv**
-   [~] Finishing refactoring of updl-frt and updl-srv
-   [~] Implementing "Streaming" mode for client-side generation
-   [~] Connecting UPDL nodes directly with publication process

## Implementation Strategy

-   Simplify the publication architecture by focusing on client-side generation first
-   Add "Generation Type" field with "Streaming" (active) and "Pre-generation" (inactive) options
-   Modify UI to show only relevant tabs for "Streaming" mode (remove "Preview" tab)
-   Create client-side generation mechanism that converts UPDL to AR.js in the browser
-   Connect UPDL nodes data directly with the publication process
-   Implement loading screen with progress indicator for generation process
-   Test with the marker.html example (red cube on a Hiro marker)
-   Focus on getting basic functionality working before adding advanced features

## Current Issues to Resolve

1. Complete refactoring of updl-frt and updl-srv applications
2. Add "Generation Type" field to the AR.js publication interface
3. Implement client-side UPDL to AR.js conversion
4. Create a route handler for `/p/{uuid}` publications
5. Connect UPDL nodes data with the publication process
6. Implement loading screen with progress indicator
7. Ensure proper error handling for generation failures

## Current Problems and Solutions

### Publication Interface Issues

We have identified several issues with the current publication interface:

1. **Mode switching in APICodeDialog**: When switching between modes (ChatBot/AR.js/etc.) in the Configuration tab, the UI does not correctly display the appropriate settings. Specifically, AR.js settings appear when ChatBot mode is selected.

2. **Duplication of buildUPDLflow.ts**: We have two files with the same name in different parts of the codebase:
    - `packages/server/src/utils/buildUPDLflow.ts` - Server-side processing for UPDL flows
    - `apps/updl-frt/base/src/builders/buildUPDLflow.ts` - Client-side UPDL scene builder
3. **AR.js Publication Interface UX Issues**: Several usability issues have been identified in the AR.js publication interface:
    - ✅ Initial state of "Сделать публичным" toggle was true instead of false (FIXED)
    - ✅ Redundant "actions.close" button at the bottom of interface (FIXED)
    - ✅ Duplicate "actions.copyLink" button when URL was displayed (FIXED)
    - ⏳ Publication state is not persisted in Supabase (PENDING)
    - ⏳ Need to toggle off/on "Сделать публичным" to get publication URL (PENDING)
    - ⏳ Link display not synced with toggle state (PENDING)

### Proposed Solutions

1. **Fix mode switching in APICodeDialog.jsx**:

    - Improve conditional rendering based on `displayMode` state
    - Ensure ChatBot settings only show in chat mode
    - Ensure AR.js settings only show in AR.js mode

2. **Rename client-side buildUPDLflow.ts**:

    - Rename `apps/updl-frt/base/src/builders/buildUPDLflow.ts` to `UPDLFlowBuilder.ts`
    - Update imports in dependent files
    - Add clear documentation about the purpose of each file

3. **Fix AR.js Publication Interface UX Issues**:

    - ✅ Changed initial state of "Сделать публичным" toggle to false
    - ✅ Removed redundant "actions.close" button from interface
    - ✅ Removed duplicate "actions.copyLink" button to clean up UI
    - ⏳ Integrate with Supabase to store publication state
    - ⏳ Load saved publication status when opening interface
    - ⏳ Automatically sync link display with toggle state

4. **Follow Flowise architecture pattern**:
    - Ensure all components interact through REST API
    - Maintain clear separation between different applications
    - Use buildUPDLflow.ts (server) as the entry point for UPDL flow processing
    - **Minimize code duplication by integrating tightly with Flowise core functionality**

### Architectural Decisions

-   We will focus on "Streaming" mode for AR.js generation before implementing the more complex "Pre-generation" mode
-   Client-side generation will be the primary approach for MVP
-   We will use REST API boundaries between all applications following Flowise patterns
-   **publish-srv will be a minimal extension to the main Flowise server, not a standalone application**
-   **We will use the core Flowise functionality wherever possible to avoid duplication**

## Generation Types

### Streaming Mode (Priority)

Client-side generation that converts UPDL to AR.js directly in the user's browser:

1. User accesses the publication URL (`/p/{uuid}`)
2. System fetches UPDL node data from the server
3. Client-side code converts UPDL structure to AR.js HTML
4. Progress indicator shows generation status
5. AR.js application loads and requests camera access
6. User sees AR content when pointing camera at marker

Benefits:

-   Simpler architecture
-   Reduced server load
-   No need to regenerate content when UPDL changes
-   Works with dynamic content
-   No need for complex storage and permission management
-   Faster implementation for MVP

### Pre-generation Mode (Future)

Server-side generation that creates and stores HTML before user access:

1. Content creator publishes UPDL scene
2. Server generates HTML and stores it
3. User accesses pre-generated content
4. Content loads immediately without generation step

Benefits (for future implementation):

-   Faster initial loading
-   Works better with complex scenes
-   Reduced client-side processing
-   Can optimize resources more effectively
-   Better performance for end users

## Test Scenario (marker.html)

To verify AR.js publication functionality, implement an equivalent of the marker.html test example:

```html
<!DOCTYPE html>
<html>
    <script src="https://aframe.io/releases/1.6.0/aframe.min.js"></script>
    <!-- import AR.js with marker and geolocation support -->
    <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
    <body style="margin : 0px; overflow: hidden;">
        <a-scene embedded arjs>
            <a-marker preset="hiro">
                <!-- red cube instead of a 3D model -->
                <a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>
            </a-marker>
            <a-entity camera></a-entity>
        </a-scene>
    </body>
</html>
```

### Testing Steps

1. **UPDL Scene Creation**:

    - Create a new flow with a root node of type Scene
    - Add an Object node configured as a red box with position `0 0.5 0`
    - Save the flow as "AR.js Test Scene"

2. **Project Publication**:

    - Open the "Publication & Export" tab
    - Select "AR.js" in the publication mode
    - Set the title to "AR.js Test"
    - Choose "Streaming" generation type
    - Select the "Hiro (Standard)" marker
    - Publish the project

3. **Result Verification**:

    - Open the generated URL in a browser
    - Observe the generation progress indicator
    - After generation completes, allow camera access
    - Display or print the Hiro marker for scanning
    - Confirm that the red cube appears on the marker

4. **Documenting Results**:
    - Capture a screenshot of the working AR scene
    - Note any discrepancies from expected behavior
    - Update the Memory Bank with test results
