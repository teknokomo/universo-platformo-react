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
-   [🎨] Creative Phase Complete

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

-   [x] **✅ Multi-Object UPDL Support** - COMPLETED: Fixed data extraction in buildUPDLflow.ts, implemented circular positioning in ObjectHandler, added validation with SimpleValidator, and basic logging. Multiple objects now render correctly in AR.js with proper positioning to prevent overlaps.

## Level 3 – Complex UPDL Structures (Current Focus)

-   [~] **Multi-Object Spaces** - 🎨 CREATIVE PHASES COMPLETED

    -   [ ] Fix buildUPDLSpaceFromNodes data extraction (Critical)
        -   [ ] Fix objectType vs type field mapping
        -   [ ] Fix color format handling (string vs RGB object)
        -   [ ] Fix position/scale field extraction from ObjectNode
    -   [🎨] PositionManager implementation (Circular layout algorithm)
        -   [ ] Implement core PositionManager class
        -   [ ] Add adaptive radius calculation
        -   [ ] Integrate with buildUPDLSpaceFromNodes
    -   [🎨] MultiObjectValidator implementation (Custom validation classes)
        -   [ ] Implement ColorValidator for multiple formats
        -   [ ] Implement PositionValidator for AR bounds
        -   [ ] Implement SpaceValidator for object conflicts
    -   [🎨] Performance optimization (Caching + object batching)
        -   [ ] Implement UPDLCache with smart invalidation
        -   [ ] Add object batching for identical objects
        -   [ ] Performance monitoring and metrics

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

## Creative Phase Decisions

### 🎨 PositionManager Architecture

-   **Algorithm**: Circular layout with adaptive radius
-   **Features**: Respects manual positions, automatic object separation
-   **Integration**: buildUPDLSpaceFromNodes + ARJSBuilder

### 🎨 MultiObjectValidator Data Model

-   **Approach**: Custom validation classes (ColorValidator, PositionValidator, ObjectValidator, SpaceValidator)
-   **Features**: UPDL-specific validation, detailed error reporting
-   **Performance**: Optimized for streaming mode

### 🎨 Performance Optimization Algorithm

-   **Primary**: Caching with smart invalidation (hash-based cache keys)
-   **Secondary**: Object batching for identical objects (>3 instances)
-   **Metrics**: Processing time tracking, cache hit rates

## Testing & Documentation

-   [ ] **Testing Framework**

    -   [ ] Unit tests for UPDL conversion
        -   [ ] Integration tests for publication flow
    -   [ ] End-to-end testing scenarios

-   [ ] **Documentation**
    -   [ ] Technical architecture documentation
    -   [ ] User guides for complex UPDL structures
    -   [ ] API documentation for new features
