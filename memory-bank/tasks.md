# Tasks for Stage 3

## Pending

-   Implement working AR.js publication with frontend generation
-   Connect UPDL nodes with publication process
-   Enhance user experience and interface improvements

### Legend

-   [ ] Planned / Not Started
-   [~] In Progress
-   [x] Completed
-   [! ] Blocked / Needs Decision

## Level 1 – Core Functionality & Structure Improvements

-   [x] **✅ QA Documentation Verification (Level 1)**

    -   [x] **VERIFIED app structure documentation** - checked apps/README.md against real directory structure
    -   [x] **CORRECTED publish-srv documentation** - removed non-existent directories (interfaces, middlewares, services, models, configs, validators)
    -   [x] **CORRECTED publish-frt documentation** - removed non-existent directories (hooks, routes, store, interfaces)
    -   [x] **CLARIFIED interface architecture** - documented separation between UPDLInterfaces.ts and Interface.UPDL.ts
    -   [x] **CONFIRMED no interface duplication** - each serves distinct purpose (core UPDL vs integration layer)
    -   [x] **UPDATED README files** - added interface architecture explanation to UPDL and main README

-   [x] **✅ Code Refactoring and Cleanup (Level 1)**

    -   [x] **CLEANED ARJSPublishApi.ts** - removed type aliases duplication, excessive URL logging, and optimized error handling
    -   [x] **OPTIMIZED ARJSPublisher.jsx** - removed unused imports (Button, Icons), excessive URL analysis logging, and cleaned API request parameters
    -   [x] **PRESERVED demo functionality** - maintained Template selector component and all demo mode features (DEMO_MODE = false)
    -   [x] **VERIFIED no A-Frame cleanup needed** - UPDLToARJSConverter.ts and ARViewPage.tsx correctly use A-Frame as AR.js foundation
    -   [x] **COMPLETED build verification** - all 7 packages built successfully without errors
    -   [x] **MAINTAINED streaming functionality** - preserved working AR.js publication pipeline

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
    -   [x] Fix remaining linting errors
    -   [x] Document the new folder structure for future reference
        -   [x] Update README.md in apps directory
        -   [x] Update component-specific README files
    -   [x] **✅ Add comprehensive typing for all API interfaces**
        -   [x] **CENTRALIZED types in Interface.UPDL.ts** - eliminated duplication
        -   [x] **REMOVED rootDir restrictions** - enabled cross-package imports
        -   [x] **ADDED @server/interface alias** - simplified import paths
        -   [x] **REPLACED local types with imports** - publish-frt uses centralized types
        -   [x] **VERIFIED build process** - all applications compile successfully
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
    -   [x] **✅ Refactor UPDL applications (Complete)**
        -   [x] **REMOVED updl-srv entirely** - determined unnecessary
        -   [x] **RENAMED updl-frt → updl** - simplified naming
        -   [x] **CLEANED updl from export/publication code** - pure node definitions only
        -   [x] **REMOVED configs, store, api directories** - eliminated legacy functionality
        -   [x] **STREAMLINED to assets, hooks, i18n, interfaces, nodes, utils** - essential only
        -   [x] **UPDATED package.json and documentation** - reflects new structure
        -   [x] **VERIFIED build process works** - all tests pass
    -   [x] Update README.md of each application with new structure description
    -   [x] **✅ Test application functionality after refactoring**

-   [x] **Clean up unused code in publish-frt and publish-srv**

    -   [x] Remove updlRoutes.ts and UPDLController.ts from publish-srv
    -   [x] Remove unused getExporters API endpoint
    -   [x] Remove unused ARJSPublisher component duplicate
    -   [x] Clean up streamUPDL implementation
    -   [x] Fix build issues after code cleanup
    -   [x] Test project build and verify no regression

-   [x] **Implement REST API Communication Between Applications**

    -   [x] Analyze current interaction between applications
    -   [x] Eliminate direct imports between applications
    -   [x] Implement HTTP clients in frontend applications
    -   [x] Implement REST endpoints in backend applications
    -   [x] Add basic error handling and validation
    -   [x] **✅ Test API interaction** - verified working correctly

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

-   [~] **Fix AR.js Publication Interface Issues**

    -   [x] Fix initial interface UX issues
        -   [x] Set initial "Сделать публичным" toggle state to false
        -   [x] Remove redundant "actions.close" button
        -   [x] Remove redundant "actions.copyLink" button
    -   [ ] Integrate with Supabase for publication state persistence
        -   [ ] Use existing `chat_flow` table for AR.js publication data
        -   [ ] Store publication settings in `chatbotConfig` field
        -   [ ] Update isPublic flag in database when toggled
    -   [ ] Improve UX for publication status
        -   [ ] Load previously saved publication state on open
        -   [ ] Sync link display with toggle state
        -   [ ] Add automatic state update on toggle

-   [ ] **Fix publication interface mode switching**

    -   [ ] Fix ChatBot/AR.js mode switching in APICodeDialog.jsx
        -   [ ] Analyze current implementation and identify issues
        -   [ ] Implement correct conditional rendering based on displayMode
        -   [ ] Ensure ChatBot settings only show in chat mode
        -   [ ] Ensure AR.js settings only show in AR.js mode
    -   [ ] Test mode switching with all available publication types
        -   [ ] Check ChatBot mode functionality
        -   [ ] Verify AR.js mode settings
        -   [ ] Test other available modes
    -   [ ] Add improved error handling for mode switching
        -   [ ] Implement fallback default mode
        -   [ ] Add validation for mode selection

-   [x] **✅ Resolve buildUPDLflow.ts duplication**

    -   [x] **ELIMINATED duplication through UPDL refactoring**
        -   [x] **REMOVED client-side buildUPDLflow.ts** - part of eliminated export logic
        -   [x] **KEPT only server-side version** - packages/server/src/utils/buildUPDLflow.ts
        -   [x] **SIMPLIFIED UPDL to node definitions only** - no builders or export logic
        -   [x] **VERIFIED no conflicts remain** - clean architecture achieved

-   [x] **Connect UPDL Nodes with AR.js Publication**

    -   [x] **✅ UPDL data integration working**
        -   [x] **UPDL nodes loaded by Flowise NodesPool** - from apps/updl/base/dist/nodes
        -   [x] **utilBuildUPDLflow extracts node data** - server-side processing
        -   [x] **publish-srv calls utilBuildUPDLflow** - for UPDL scene data
        -   [x] **AR.js publication receives UPDL data** - via REST API
        -   [x] **Streaming generation works correctly** - verified in logs

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
