# Implementation Notes

## UPDL Integration

### Completed Steps

1. Created a separate interface file (`packages/server/src/Interface.UPDL.ts`) for UPDL-specific types:

    - Defined basic geometry interfaces (IUPDLPosition, IUPDLRotation, IUPDLColor)
    - Defined component interfaces (IUPDLObject, IUPDLCamera, IUPDLLight)
    - Defined main scene type (UPDLScene)
    - Defined flow result type (UPDLFlowResult)

2. Added UPDL interfaces export to main Interface.ts file

3. Updated buildUPDLflow.ts file:
    - Imported UPDL types
    - Removed duplicate local interface definitions
    - Added required fields to satisfy IChatFlow interface requirements

### AR.js and A-Frame Separation

Following a clear design decision, we have separated AR.js and A-Frame implementations to improve maintainability and future extensibility:

1. **File Naming Convention**:

    - Created specialized files with ARJS prefix:
        - updlToARJSBuilder.ts (replaced updlFlowBuilder.ts)
        - ARJSHTMLGenerator.ts (replaced AFrameHTMLGenerator.ts)
        - UPDLToARJS.ts (replaced UPDLToAFrame.ts)

2. **Interface Implementation**:

    - Updated ARJSPrimitive class with proper type interfaces
    - Fixed linter errors related to missing methods in ARJSPrimitive class
    - Created clear separation between UPDL core model and presentation technologies

3. **API Updates**:

    - Updated API endpoints to use consistent /arjs pattern
    - Renamed methods in UPDLController.ts (getARPublication → getARJSPublication)
    - Updated routes in updlRoutes.ts with prefix '/arjs'
    - Adapted client API to work with new routes

4. **Documentation Updates**:
    - Updated apps/publish/README.md to reflect current architecture
    - Removed outdated references to mixed AR.js/A-Frame implementations

### Outstanding Issues

1. **Type compatibility issues**: buildUPDLflow.ts still has linter errors related to:

    - Incompatibility between simplified objects and full Flowise interfaces
    - Missing required properties for IExecuteFlowParams

2. **Integration approach decisions**:
    - Current approach: UPDL functionality exists as specialized modules within apps directory
    - AR.js implementation is our current focus, with A-Frame VR postponed for future sprints

### Next Steps

1. **Fix remaining linter errors**:

    - Fully implement required interfaces or create proper type assertions
    - Consider mock objects for testing vs production implementation

2. **Implementation plan**:
    - Complete publication UI updates for AR.js
    - Implement QR code display for mobile access
    - Test publication with the marker.html example (red cube on Hiro marker)
    - Document full AR.js publication workflow

## Architecture Considerations

Creating separate interface files for domain-specific functionality (like UPDL and AR.js) provides a clean separation of concerns, making the codebase more maintainable. This approach allows us to extend functionality without cluttering the core interfaces.

Our current architecture uses the following approach:

1. Specialized implementation with clear separation between AR.js and A-Frame
2. Core UPDL features in apps/updl with minimal dependencies on Flowise
3. Publication functionality in apps/publish with RESTful API endpoints

This balances development speed, maintainability, and future extensibility requirements, allowing us to focus on completing the AR.js implementation now while providing a clear path for future technologies.
