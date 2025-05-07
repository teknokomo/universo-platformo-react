# Progress

**As of 2025‑04‑30**

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

## In Progress

-   **APPs architecture** — Enhancing apps/updl and apps/publish structure with clean modular design.
-   **UPDL node system** — Completing implementation of universal nodes for scene building.
-   **AR.js exporter** — Implementing and refining exporter for AR.js/A-Frame with publication functionality.
-   **Publication interface** — Redesigning "Publish & Export" UI with technology selection.

## Implementation Roadmap

### Phase 1: Foundation (Current)

-   APPs directory structure setup ✅
-   Base UPDL node interfaces ✅
-   First AR.js exporter implementation ✅
-   Publication backend infrastructure ✅
-   A-Frame model structures ✅
-   Client-server flow integration 🔄

### Phase 2: Core Components

-   Complete set of UPDL nodes 🔄
-   Publication system UI redesign 🔄
-   AR.js marker scene testing 🔄
-   Publication URL scheme implementation 🔄

### Phase 3: Exporters Expansion

-   PlayCanvas React and PlayCanvas exporter ⏳
-   Babylon.js exporter ⏳
-   Three.js and other exporters ⏳

### Phase 4: Final Integration

-   Removal of test AR.js nodes ⏳
-   Full publication and export system ⏳
-   Complete documentation ⏳

## Recent Accomplishments

-   Implemented complete model framework (`AFrameModel.ts`) with core A-Frame entity structures
-   Created `UPDLToAFrameConverter` for transforming UPDL scene objects into A-Frame components
-   Developed `ARJSExporter` with proper inheritance from `BaseAFrameExporter` for HTML generation
-   Implemented server-side handling of published projects via `UPDLController`
-   Created API endpoints for publication and listing of AR.js projects
-   Added support for scene validation, model format conversion, and Hiro marker generation
-   Designed client-side API service for publishing UPDL scenes to AR.js format

## Upcoming

-   **0.9.0-pre-alpha** - Finalize AR.js publication flow, implement QR code sharing, test marker scenes.
-   **0.10.0-pre-alpha** - PlayCanvas React and PlayCanvas exporters, UPDL node enhancements.
-   **0.11.0-pre-alpha** - Remaining exporters (Babylon.js, Three.js, A-Frame VR).
-   **0.12.0-pre-alpha** - Test AR.js nodes removal, optimization, and complete documentation.
