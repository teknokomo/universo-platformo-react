# Progress

**As of 2025‑05‑05**

## Completed (chronological)

| Release         | Date       | Highlights                                                                                              |
| --------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| 0.1.0‑pre‑alpha | 2025‑03‑03 | Initial project scaffold created                                                                        |
| 0.2.0‑pre‑alpha | 2025‑03‑11 | Added multi‑user (Supabase) foundation                                                                  |
| 0.3.0‑pre‑alpha | 2025‑03‑17 | Basic **Uniks** functionality delivered                                                                 |
| 0.4.0‑pre‑alpha | 2025‑03‑25 | Full Uniks feature‑set shipped                                                                          |
| 0.5.0‑pre‑alpha | 2025‑03‑30 | Document Store, Templates, complete i18n                                                                |
| 0.6.0‑pre‑alpha | 2025‑04‑06 | Chatbots module, Auth UI, language‑file refactor                                                        |
| 0.7.0‑pre‑alpha | 2025‑04‑16 | First AR prototype with **AR.js** marker scene                                                          |
| 0.8.0‑pre‑alpha | 2025‑04‑22 | Enhanced Supabase authentication with secure token refresh, Memory Bank documentation structure created |
| 0.8.5‑pre‑alpha | 2025‑04‑29 | UPDL to A-Frame converter implemented, exporter architecture, basic publication flow                    |

## Stage 2 Issues & Lessons Learned

The initial AR.js implementation faced several challenges:

1. **Complex architecture**: The hybrid approach with both client and server generation proved too complex for the initial MVP
2. **Unclear separation**: AR.js and A-Frame technologies were not clearly separated in the codebase
3. **Disconnected components**: UPDL nodes were not properly connected to the publication flow
4. **Build process issues**: Publication worked in development mode but failed in production builds

These insights have informed our revised approach for Stage 3.

## In Progress

-   **Simplified architecture** — Streamlining the apps/updl and apps/publish structure
-   **Streaming AR.js generation** — Implementing client-side UPDL to AR.js conversion
-   **UPDL-Publication connection** — Creating direct links between UPDL nodes and publication process

## Implementation Roadmap (Revised)

### Phase 1: Streamlined Foundation (Current)

-   APPs directory structure reorganization 🔄
-   Simplified publication architecture 🔄
-   Client-side "Streaming" generation mode 🔄
-   UPDL nodes to publication connection 🔄

### Phase 2: Core Components

-   Complete set of UPDL nodes 🔄
-   Working AR.js publication flow ⏳
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

-   Identified core issues with the AR.js publication implementation
-   Restructured the apps directories to improve organization
-   Created plan for simplified "Streaming" AR.js generation
-   Updated Memory Bank with new tasks and approach for Stage 3

## Current Focus

-   Implementing "Streaming" mode for client-side AR.js generation
-   Creating direct connection between UPDL nodes and publication
-   Developing route handler for `/p/{uuid}` URL format
-   Implementing loading screen with progress indicator
-   Testing with simple red cube example

## Upcoming

-   **0.9.0-pre-alpha** - Working client-side "Streaming" AR.js generation, basic UPDL scenes, test with marker.
-   **0.10.0-pre-alpha** - QR code generation, improved UI, better error handling.
-   **0.11.0-pre-alpha** - Server-side "Pre-generation" mode (optional), additional export options.
-   **0.12.0-pre-alpha** - Complete documentation, optimizations, and finalization.
