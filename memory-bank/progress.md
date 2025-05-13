# Progress

**As of 2025‑05‑12**

## Completed (chronological)

| Release         | Date       | Highlights                                                                                                          |
| --------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| 0.1.0‑pre‑alpha | 2025‑03‑03 | Initial project scaffold created                                                                                    |
| 0.2.0‑pre‑alpha | 2025‑03‑11 | Added multi‑user (Supabase) foundation                                                                              |
| 0.3.0‑pre‑alpha | 2025‑03‑17 | Basic **Uniks** functionality delivered                                                                             |
| 0.4.0‑pre‑alpha | 2025‑03‑25 | Full Uniks feature‑set shipped                                                                                      |
| 0.5.0‑pre‑alpha | 2025‑03‑30 | Document Store, Templates, complete i18n                                                                            |
| 0.6.0‑pre‑alpha | 2025‑04‑06 | Chatbots module, Auth UI, language‑file refactor                                                                    |
| 0.7.0‑pre‑alpha | 2025‑04‑16 | First AR prototype with **AR.js** marker scene                                                                      |
| 0.8.0‑pre‑alpha | 2025‑04‑22 | Enhanced Supabase authentication with secure token refresh, Memory Bank documentation structure created             |
| 0.8.5‑pre‑alpha | 2025‑04‑29 | UPDL to A-Frame converter implemented, exporter architecture, basic publication flow                                |
| 0.9.0‑pre‑alpha | 2025‑05‑12 | Refactored "Publish & Export" interface, separated ARJSPublisher and ARJSExporter components, improved i18n support |

## Stage 2 Issues & Lessons Learned

The initial AR.js implementation faced several challenges:

1. **Complex architecture**: The hybrid approach with both client and server generation proved too complex for the initial MVP
2. **Unclear separation**: AR.js and A-Frame technologies were not clearly separated in the codebase
3. **Disconnected components**: UPDL nodes were not properly connected to the publication flow
4. **Build process issues**: Publication worked in development mode but failed in production builds
5. **Localization structure issues**: Improper organization of i18n keys caused display problems in UI components

These insights have informed our revised approach for Stage 3.

## In Progress

-   **Simplified architecture** — Streamlining the apps/updl and apps/publish structure ✅
-   **Interface restructuring** — Reorganized "Publish & Export" interface with better UX ✅
-   **Streaming AR.js generation** — Implementing client-side UPDL to AR.js conversion 🔄
-   **UPDL-Publication connection** — Creating direct links between UPDL nodes and publication process 🔄

## Recent Major Achievements

### Application Structure Refactoring (2023-09-25)

-   **Standardized directory structure** across all applications ✅
    -   Frontend apps: assets/, api/, components/, features/, hooks/, etc.
    -   Backend apps: controllers/, routes/, services/, models/, etc.
-   **Features migration** from miniapps directory ✅
    -   Renamed miniapps → features in publish-frt
    -   Updated all import paths
    -   Verified build process works correctly
    -   Removed old miniapps directories
-   **Asset management improvement** ✅
    -   Created dedicated icons/ and images/ directories
    -   Improved organization of static assets
    -   Updated import paths for all assets
-   **REST API communication** between applications ✅
    -   Replaced direct imports with API client calls
    -   Implemented type-safe HTTP clients
    -   Created clear contracts between frontend and backend
-   **Documentation updates** ✅
    -   Updated all README files with new structure
    -   Added comprehensive documentation of architecture

### Next Focus Areas

-   Complete refactoring of updl-frt and updl-srv applications
-   Implement "Streaming" AR.js generation on the frontend
-   Connect UPDL nodes with publication process
-   Test the full workflow with a simple scene example

## Implementation Roadmap (Revised)

### Phase 1: Streamlined Foundation (Current)

-   APPs directory structure reorganization ✅
-   Simplified publication architecture ✅
-   Interface restructuring and optimization ✅
-   Client-side "Streaming" generation mode 🔄
-   UPDL nodes to publication connection 🔄

### Phase 2: Core Components

-   Complete set of UPDL nodes 🔄
-   Working AR.js publication flow 🔄
-   AR.js marker scene testing ⏳
-   Publication URL scheme implementation ⏳

### Phase 3: Feature Enhancement

-   QR code generation for mobile access ⏳
-   UI improvements and better error handling ⏳
-   Documentation and user guides ⏳

### Phase 4: Advanced Features

-   Server-side "Pre-generation" mode ⏳
-   Additional exporters (PlayCanvas, Babylon.js, etc.) ⏳
-   Full publication and export system ⏳
-   Complete documentation ⏳

## Recent Status Update

-   Refactored "Publish & Export" interface for AR.js technology
-   Created dedicated ARJSExporter component for HTML export functionality
-   Restructured ARJSPublisher component to use a single scrollable page layout
-   Fixed i18n issues by properly organizing translation keys
-   Improved user experience with clear separation between publishing and exporting
-   Completed migration from miniapps to features directory structure
-   Implemented structured asset management with dedicated icons and images directories
-   Standardized application structure across the codebase

## Current Focus

-   Implementing "Streaming" mode for client-side AR.js generation
-   Creating direct connection between UPDL nodes and publication
-   Developing route handler for `/p/{uuid}` URL format
-   Implementing loading screen with progress indicator
-   Testing with simple red cube example

## Upcoming

-   **0.10.0-pre-alpha** - QR code generation, improved UI, better error handling.
-   **0.11.0-pre-alpha** - Server-side "Pre-generation" mode (optional), additional export options.
-   **0.12.0-pre-alpha** - Complete documentation, optimizations, and finalization.

## 2023-07-02: Application Structure Refactoring

-   Developed and implemented a unified structure for applications in the `apps/` directory
-   Updated system patterns in `systemPatterns.md`
-   Refactored applications `publish-frt` and `publish-srv`
    -   Renamed directories `miniapps` → `features`
    -   Created new structures for API clients in frontend
    -   Created controllers, services, and routes in backend
    -   Implemented types and interfaces
    -   Updated documentation (README.md)
-   Implemented interaction through REST API instead of direct imports between applications
