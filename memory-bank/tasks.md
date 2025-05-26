# Tasks for Stage 3

## Current Focus

Develop complex UPDL structures in Chatflow that support:

-   Multiple objects in single space
-   Multiple connected spaces (Space nodes)
-   Advanced AR.js publication/export functionality

### Legend

-   [ ] Planned / Not Started
-   [~] In Progress
-   [x] Completed
-   [! ] Blocked / Needs Decision

## Level 1 – Core Functionality

-   [x] **✅ Project Architecture & Structure** - Complete reorganization of apps structure, REST API communication, proper typing, documentation updates

-   [x] **✅ AR.js Publication & Supabase Integration** - Multi-technology publication architecture, persistent settings, correct API routes, UI/UX improvements

-   [x] **✅ UPDL Data Integration** - UPDL nodes integration with Flowise, streaming generation, publish-srv integration

-   [~] **AR.js Streaming Generation**

    -   [~] Generation type selection (Streaming/Pre-generation)
    -   [~] Client-side generation flow for `/p/{uuid}`
    -   [~] UI adaptation for streaming mode

-   [ ] **Publication Interface Mode Switching**

    -   [ ] Fix ChatBot/AR.js mode switching in APICodeDialog.jsx
    -   [ ] Test mode switching functionality
    -   [ ] Add error handling for mode transitions

-   [ ] **AR.js Basic Publication Testing**
    -   [ ] Create test UPDL scene (Scene → Box objects)
    -   [ ] Test full publication workflow
    -   [ ] Verify scene display with markers

## Level 2 – User Experience

-   [x] **✅ Enhanced Publication UI** - QR codes, marker display, notifications, tooltips

-   [x] **✅ Restructured Publication Interface** - Tab reorganization, scrollable layout, form validation

-   [~] **Publication Flow Optimization**
    -   [~] Caching implementation
    -   [~] Progressive loading for AR.js scenes
    -   [x] Error handling improvements

## Level 3 – Complex UPDL Structures (New Focus)

-   [ ] **Multi-Object Spaces**

    -   [ ] Support multiple 3D objects in single Space node
    -   [ ] Object positioning and relationship management
    -   [ ] Dynamic object generation from UPDL data

-   [ ] **Connected Spaces Architecture**

    -   [ ] Multiple Space nodes in single Chatflow
    -   [ ] Space relationship and navigation logic
    -   [ ] Cross-space object references

-   [ ] **Advanced AR.js Generation**

    -   [ ] Complex scene generation from multi-space UPDL
    -   [ ] Space transitions and interactions
    -   [ ] Enhanced object behavior and properties

-   [ ] **UPDL Node Enhancements**
    -   [ ] Enhanced Space node capabilities
    -   [ ] Advanced object nodes (animations, interactions)
    -   [ ] Navigation and linking nodes

## Level 4 – Advanced Features

-   [ ] **Advanced Generation Modes**

    -   [ ] Hybrid generation architecture
    -   [ ] Pre-generation mode foundation
    -   [ ] Storage and caching strategy

-   [ ] **Multi-Exporter Support**

    -   [ ] Common exporter interfaces
    -   [ ] Plugin system architecture
    -   [ ] TypeScript interfaces for exporters

-   [ ] **Performance & Optimization**
    -   [ ] Asset preloading
    -   [ ] Level-of-detail rendering
    -   [ ] Mobile optimization

## Testing & Documentation

-   [ ] **Testing Framework**

    -   [ ] Unit tests for UPDL conversion
        -   [ ] Integration tests for publication flow
    -   [ ] End-to-end testing scenarios

-   [ ] **Documentation**
    -   [ ] Technical architecture documentation
    -   [ ] User guides for complex UPDL structures
    -   [ ] API documentation for new features
