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

-   [x] **Fix Project Structure Issues**

    -   [x] Reorganize folders in apps/publish and apps/updl
        -   [x] Create separate directories for frontend and backend (publish-frt, publish-srv, updl-frt, updl-srv)
        -   [x] Move code to appropriate directories
        -   [x] Update package.json files with correct names and dependencies
        -   [x] Update tsconfig.json files for proper compilation
        -   [x] Update vite.config.js with correct aliases
    -   [x] Verify all import paths are correct
        -   [x] Check for imports from old paths (@apps/publish, @apps/updl)
        -   [x] Update imports to use new path structure
    -   [~] Fix remaining linting errors
    -   [x] Document the new folder structure for future reference
        -   [x] Update README.md in apps directory
        -   [x] Update component-specific README files
    -   [ ] Add comprehensive typing for all API interfaces
    -   [x] Create diagram of new architecture for Memory Bank

-   [x] **Standardize Application Structure**

    -   [x] Analyze current application structure
    -   [x] Define optimal structure for frontend and backend applications
    -   [x] Update systemPatterns.md with new architecture
    -   [x] Refactor publish-frt
        -   [x] Create missing directories
        -   [x] Rename miniapps → features
        -   [x] Move icons to assets
        -   [x] Create API client structure for REST interaction
        -   [x] Move interfaces to separate directory
    -   [x] Refactor publish-srv
        -   [x] Create controllers, routes, services, middlewares directories
        -   [x] Move interfaces to separate directory
        -   [x] Implement basic REST API structure
    -   [~] Refactor updl-frt
        -   [~] Create missing directories
        -   [~] Rename miniapps → features
        -   [~] Move icons to assets
        -   [~] Create API client structure for REST interaction
        -   [~] Move interfaces to separate directory
    -   [~] Refactor updl-srv
        -   [~] Create controllers, routes, services, middlewares directories
        -   [~] Move exporters to services/exporters
        -   [~] Move interfaces to separate directory
        -   [~] Implement basic REST API structure
    -   [x] Update README.md of each application with new structure description
    -   [~] Test application functionality after refactoring

-   [x] **Implement REST API Communication Between Applications**

    -   [x] Analyze current interaction between applications
    -   [x] Eliminate direct imports between applications
    -   [x] Implement HTTP clients in frontend applications
    -   [x] Implement REST endpoints in backend applications
    -   [x] Add basic error handling and validation
    -   [~] Test API interaction

-   [~] **Implement "Streaming" AR.js Generation**

    -   [~] Add "Generation Type" field to AR.js publication interface
        -   [~] Create options for "Streaming" (active) and "Pre-generation" (inactive)
        -   [~] Set "Streaming" as default
        -   [~] Add tooltip explaining the difference
    -   [~] Adapt UI tabs for "Streaming" mode
        -   [~] Keep only "Settings" and "Published" tabs
        -   [~] Remove "Preview" tab for streaming mode
    -   [~] Create client-side generation flow
        -   [~] Implement route handler for `/p/{uuid}`
        -   [~] Create loading screen with progress bar
        -   [~] Implement UPDL to AR.js conversion in the browser
        -   [~] Add error handling for failed generation attempts
    -   [~] Optimize ARJSExporter for frontend use
        -   [~] Ensure all dependencies are properly loaded
        -   [~] Optimize resource loading
        -   [~] Implement caching where appropriate

-   [~] **Connect UPDL Nodes with AR.js Publication**

    -   [~] Create UPDL data extraction mechanism
        -   [~] Extract node data from Chatflow
        -   [~] Create converter from node data to scene structure
        -   [~] Make UPDL node structure accessible via API
    -   [~] Modify publication process
        -   [~] Create API endpoint to fetch UPDL scene data
        -   [~] Connect publication flow with UPDL nodes
        -   [~] Pass UPDL scene to AR.js generator

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

-   [x] **Enhance Publication UI**

    -   [x] Generate QR code for the published URL
        -   [x] Show QR code on "Published" tab
        -   [ ] Add option to download QR code
    -   [x] Improve marker display and selection
        -   [x] Show clear preview of selected marker
        -   [x] Add instructions for marker usage
        -   [x] Consider option to download marker image
    -   [x] User-friendly notifications
        -   [x] Show success message after publication
        -   [x] Display helpful error messages
        -   [x] Add tooltips for publication options

-   [x] **Restructure Publication Interface**

    -   [x] Reorganize main tabs structure
        -   [x] Keep "Configuration" tab for technology selection
        -   [x] Transform "Publication" tab into a scrollable single page without nested tabs
        -   [x] Add new "Export" tab for local download functionality
    -   [x] Redesign "Publication" tab
        -   [x] Move project URL and "Make Public" toggle to the top
        -   [x] Include all settings (former "Settings" nested tab) as scrollable sections
        -   [x] Add publication status and actions at the bottom
        -   [x] Improve responsive design for mobile devices
    -   [x] Create "Export" tab
        -   [x] Move content from nested "Preview" tab to the new "Export" tab
        -   [x] Adapt HTML generation and download functions
        -   [x] Maintain existing export functionality in the new location
    -   [x] Standardize interface across technologies
        -   [x] Create consistent templates for AR.js, PlayCanvas, Babylon.js, etc.
        -   [x] Implement conditional rendering based on selected technology
        -   [x] Improve form validation and error handling

-   [~] **Optimize Publication Flow**

    -   [~] Implement caching for faster loading
        -   [~] Cache generated HTML where appropriate
        -   [~] Optimize resource loading
    -   [~] Add progressive loading for AR.js scenes
        -   [~] Show loading indicators for resources
        -   [~] Load models progressively
    -   [x] Improve error handling and recovery
        -   [x] Detect and report common issues
        -   [x] Provide user-friendly error messages
        -   [x] Add diagnostic information for debugging

-   [~] **Fix Console Errors**
    -   [x] Fix chatflow streaming validation error
        -   [x] Prevent streaming check for UPDL flows
        -   [x] Add flow type detection before validation
        -   [x] Update chatflowService.checkIfChatflowIsValidForStreaming to handle UPDL flows
        -   [x] Silence unnecessary API calls for non-chatbot flows

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

## Level 4 – Additional Future Tasks

-   [ ] **State Management Refactoring**

    -   [ ] Evaluate React Context vs Redux options
    -   [ ] Design consistent state management pattern
    -   [ ] Implement shared state for complex flows

-   [ ] **Comprehensive Logging System**

    -   [ ] Design logging strategy
    -   [ ] Implement structured logging
    -   [ ] Add performance metrics collection

-   [ ] **3D Scene Rendering Optimization**

    -   [ ] Implement asset preloading
    -   [ ] Add level-of-detail rendering
    -   [ ] Optimize for mobile devices

-   [ ] **Enhanced Documentation**

    -   [ ] Create code examples for common patterns
    -   [ ] Add more comprehensive API documentation
    -   [ ] Create developer guides

-   [ ] **Demo Projects**
    -   [ ] Create showcase projects for different exporters
    -   [ ] Add sample scenes for beginners
    -   [ ] Create tutorial materials

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
