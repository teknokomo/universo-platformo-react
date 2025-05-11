# Tasks for Stage 3

## Pending

-   Update and streamline apps structure
-   Implement working AR.js publication with frontend generation
-   Connect UPDL nodes with publication process

### Legend

-   [ ] Planned / Not Started
-   [~] In Progress
-   [x] Completed
-   [! ] Blocked / Needs Decision

## Level 1 – Core Functionality & Structure Improvements

-   [~] **Fix Project Structure Issues**

    -   [~] Reorganize folders in apps/publish and apps/updl
    -   [ ] Verify all import paths are correct
    -   [ ] Fix remaining linting errors
    -   [ ] Document the new folder structure for future reference
    -   [ ] Add comprehensive typing for all API interfaces
    -   [ ] Create diagram of new architecture for Memory Bank

-   [ ] **Implement "Streaming" AR.js Generation**

    -   [ ] Add "Generation Type" field to AR.js publication interface
        -   [ ] Create options for "Streaming" (active) and "Pre-generation" (inactive)
        -   [ ] Set "Streaming" as default
        -   [ ] Add tooltip explaining the difference
    -   [ ] Adapt UI tabs for "Streaming" mode
        -   [ ] Keep only "Settings" and "Published" tabs
        -   [ ] Remove "Preview" tab for streaming mode
    -   [ ] Create client-side generation flow
        -   [ ] Implement route handler for `/p/{uuid}`
        -   [ ] Create loading screen with progress bar
        -   [ ] Implement UPDL to AR.js conversion in the browser
        -   [ ] Add error handling for failed generation attempts
    -   [ ] Optimize ARJSExporter for frontend use
        -   [ ] Ensure all dependencies are properly loaded
        -   [ ] Optimize resource loading
        -   [ ] Implement caching where appropriate

-   [ ] **Connect UPDL Nodes with AR.js Publication**

    -   [ ] Create UPDL data extraction mechanism
        -   [ ] Extract node data from Chatflow
        -   [ ] Create converter from node data to scene structure
        -   [ ] Make UPDL node structure accessible via API
    -   [ ] Modify publication process
        -   [ ] Create API endpoint to fetch UPDL scene data
        -   [ ] Connect publication flow with UPDL nodes
        -   [ ] Pass UPDL scene to AR.js generator

-   [ ] **AR.js Basic Publication Testing**
    -   [ ] Create test UPDL scene via nodes
        -   [ ] Set up Scene node as root
        -   [ ] Add Box object configured as red cube
        -   [ ] Configure camera and lighting
    -   [ ] Test full publication workflow
        -   [ ] Publish scene via new interface
        -   [ ] Verify correct URL generation
        -   [ ] Test scene display with Hiro marker
        -   [ ] Compare with marker.html example
    -   [ ] Document test results in Memory Bank

## Level 2 – User Experience & Improvements

-   [ ] **Enhance Publication UI**

    -   [ ] Add QR code generation for mobile access
        -   [ ] Generate QR code for the published URL
        -   [ ] Show QR code on "Published" tab
        -   [ ] Add option to download QR code
    -   [ ] Improve marker display and selection
        -   [ ] Show clear preview of selected marker
        -   [ ] Add instructions for marker usage
        -   [ ] Consider option to download marker image
    -   [ ] User-friendly notifications
        -   [ ] Show success message after publication
        -   [ ] Display helpful error messages
        -   [ ] Add tooltips for publication options

-   [ ] **Optimize Publication Flow**

    -   [ ] Implement caching for faster loading
        -   [ ] Cache generated HTML where appropriate
        -   [ ] Optimize resource loading
    -   [ ] Add progressive loading for AR.js scenes
        -   [ ] Show loading indicators for resources
        -   [ ] Load models progressively
    -   [ ] Improve error handling and recovery
        -   [ ] Detect and report common issues
        -   [ ] Provide user-friendly error messages
        -   [ ] Add diagnostic information for debugging

-   [ ] **Fix Console Errors**
    -   [ ] Fix chatflow streaming validation error
        -   [ ] Prevent streaming check for UPDL flows
        -   [ ] Add flow type detection before validation
        -   [ ] Update chatflowService.checkIfChatflowIsValidForStreaming to handle UPDL flows
        -   [ ] Silence unnecessary API calls for non-chatbot flows

## Level 3 – Future Enhancements

-   [ ] **Prepare for Advanced Generation Modes**

    -   [ ] Design architecture for hybrid generation approach
        -   [ ] Define server vs. client responsibilities
        -   [ ] Plan storage and caching strategy
        -   [ ] Document security considerations
    -   [ ] Create foundation for "Pre-generation" mode
        -   [ ] Define database schema for stored publications
        -   [ ] Plan API endpoints for pre-generated content
        -   [ ] Design UI for managing pre-generated content

-   [ ] **Integration with Other Exporters**
    -   [ ] Plan architecture for multi-exporter support
        -   [ ] Define common interfaces for all exporters
        -   [ ] Design plugin system for exporters
        -   [ ] Plan UI for exporter selection and configuration
    -   [ ] Prepare TypeScript interfaces for exporters
        -   [ ] Create base exporter interface
        -   [ ] Define common methods and properties
        -   [ ] Plan for versioning and compatibility

## Testing & Documentation

-   [ ] **Comprehensive Testing Plan**

    -   [ ] Create test scenarios for all functionality
        -   [ ] Unit tests for core conversion logic
        -   [ ] Integration tests for publication flow
        -   [ ] End-to-end tests for complete user journey
    -   [ ] Set up testing environment
        -   [ ] Configure testing framework
        -   [ ] Create test fixtures and mocks
        -   [ ] Set up test data for UPDL nodes

-   [ ] **Documentation Updates**
    -   [ ] Update technical documentation
        -   [ ] Document new architecture
        -   [ ] Create API documentation
        -   [ ] Document publication process
    -   [ ] Create user guides
        -   [ ] Guide for creating UPDL scenes
        -   [ ] Guide for publishing AR.js scenes
        -   [ ] Troubleshooting guide
