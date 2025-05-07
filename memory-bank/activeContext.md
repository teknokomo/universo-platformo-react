# Active Context

**Current Sprint**: 0.9.0 pre-alpha (Apr 2025)

**Primary Focus**:

-   Publish UPDL scenes to AR.js using the implemented export architecture
-   Update the "Publication" tab into the "Publication & Export" interface
-   Test the publication process and obtain the AR.js scene URL
-   Verify compatibility with the marker.html test example

**Immediate Next Steps**:

1. Update the "Publication" tab UI according to the provided screenshot
2. Implement QR code generation for convenient mobile access
3. Configure correct URL handling for published projects (`/p/{uuid}`)
4. Create a test UPDL scene based on the marker.html example (red cube)
5. Test the full publication and viewing workflow

## Current Focus

Completing the UPDL-to-AR.js publication process and updating the UI.

-   [x] Developed `AFrameModel` layer for A-Frame element representation
-   [x] Implemented `UPDLToAFrameConverter` for converting UPDL scenes to A-Frame
-   [x] Established base exporter architecture with clear responsibilities
-   [x] Created `ARJSExporter` for generating HTML from UPDL scenes
-   [x] Built server-side `UPDLController` for handling publication requests
-   [x] Added API routes for publishing and listing AR.js projects
-   [~] Updating the publication UI component to match the screenshot
-   [~] Integrating the publication form with the exporter and API service
-   [~] Testing marker selection and project publication functionality

## Implementation Strategy

-   Update the "Publication" tab UI as shown in the screenshot, adding fields for title, marker settings, colors, and 3D model URL
-   Integrate the UI with existing export classes (`ARJSExporter`, `UPDLToAFrameConverter`)
-   Add QR code display for quick mobile access to the published AR scene
-   Implement a unified URL scheme for publications using `/p/{uuid}`, inspired by PlayCanvas
-   Thoroughly test with the marker.html example (red cube on a Hiro marker)

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
    - Select "AR.js / A-Frame" in the publication mode
    - Set the title to "AR.js Test"
    - Choose the "Hiro (Standard)" marker
    - Publish the project

3. **Result Verification**:

    - Open the generated URL in a browser
    - Display or print the Hiro marker for scanning
    - Confirm that the red cube appears on the marker
    - Compare with the original marker.html behavior

4. **Documenting Results**:
    - Capture a screenshot of the working AR scene
    - Note any discrepancies from expected behavior
    - Update the Memory Bank with test results

## Current Issues to Resolve

1. Update the "Publication" tab UI with all required AR.js configuration fields
2. Implement QR code display in the publication success dialog for mobile access
3. Ensure correct display of the published AR.js scene via `/p/{uuid}` URLs
4. Guarantee public access to published projects without authentication when toggled
5. Complete end-to-end testing using the red cube on a Hiro marker example
