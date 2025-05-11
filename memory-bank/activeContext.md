# Active Context

**Current Sprint**: 0.9.0 pre-alpha (Apr 2025)

**Primary Focus**:

-   Implement "Streaming" AR.js generation on the frontend
-   Connect UPDL nodes with publication process
-   Simplify the publication architecture
-   Test the end-to-end publication workflow

**Immediate Next Steps**:

1. Add "Generation Type" field to AR.js publication interface
2. Implement client-side UPDL to AR.js conversion
3. Create a route handler for `/p/{uuid}` publications
4. Connect UPDL nodes data with the publication process
5. Test the full workflow with a red cube example

## Current Focus

Simplifying the AR.js publication architecture and implementing client-side generation.

-   [x] Developed `AFrameModel` layer for A-Frame element representation
-   [x] Implemented `UPDLToAFrameConverter` for converting UPDL scenes to A-Frame
-   [x] Established base exporter architecture with clear responsibilities
-   [x] Created `ARJSExporter` for generating HTML from UPDL scenes
-   [x] Built server-side `UPDLController` for handling publication requests
-   [x] Added API routes for publishing and listing AR.js projects
-   [x] Refactored code to clearly separate AR.js and A-Frame implementations
-   [~] Fixing project structure issues and improving organization
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

## Current Issues to Resolve

1. Fix project structure issues and improve organization
2. Add "Generation Type" field to the AR.js publication interface
3. Implement client-side UPDL to AR.js conversion
4. Create a route handler for `/p/{uuid}` publications
5. Connect UPDL nodes data with the publication process
6. Implement loading screen with progress indicator
7. Ensure proper error handling for generation failures
