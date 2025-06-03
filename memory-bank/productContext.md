# Product Context

## Purpose

Expanding Flowise AI with multi‑user capabilities for collaborative workflows within Uniq (workflows/projects), creating visual‑programming functionality, business applications, games, and AR/VR applications.

## Development Philosophy

-   Minimal changes to the original codebase
-   Backwards compatibility
-   Simplicity over complexity

## 3D/AR/VR

Modern AR/VR and 3D application development faces a key problem: a multitude of different engines and frameworks often require reimplementing the same logic for each platform. **UPDL** is designed to solve this problem by providing a **unified description language** for content. Implementing UPDL will allow development teams to:

-   **Develop faster and only once:** Create the scene description and game logic a single time, rather than redoing it for every engine. UPDL acts as an intermediate layer that can automatically generate platform-specific implementations across different tech stacks. This is especially valuable for studios targeting multiple platforms (for example, WebAR and native apps) – they can design in UPDL and export to each target as needed without starting from scratch.
-   **Embrace multi-platform from the start:** Thanks to UPDL's abstract nature, multi-platform deployment is considered from the design phase. The project is built with the assumption it might run anywhere. All engine-specific details remain "behind the scenes" until the export stage. The team can focus on user experience and game mechanics without being distracted by the syntax of different APIs.
-   **Scale projects efficiently:** The format is intended for a wide range of applications – from a simple AR quiz to an MMO game. UPDL's node-based structure and extensibility make it suitable for small prototypes as well as complex projects, promoting reuse of design and easier project evolution. As the project grows, the same UPDL description can be expanded and exported to new platforms, ensuring consistency across versions.

By addressing these needs, UPDL will streamline development workflows. Teams can iterate rapidly on the core experience in a platform-agnostic way, then rely on exporters to bring that experience to each target environment. This unification reduces duplicated effort, lowers the barrier to support new platforms, and helps maintain consistency in functionality across all outputs.

## UPDL Use Cases

### Educational AR Applications

1. **Mineral Identification Quizzes**

    - Teachers create scenes with 3D models of minerals
    - Add interactive elements for knowledge testing
    - Publish as AR applications for student smartphones
    - Students scan markers to view and interact with 3D models

2. **Interactive Learning Materials**
    - Anatomical models for medical education
    - Interactive physics experiments for science classes
    - Historical reconstructions for history lessons

### Presentation 3D Applications

1. **Product Demonstrations**

    - Interactive 3D product models
    - Animations to showcase functionality
    - Publication as both web applications and AR experiences

2. **Architectural Visualization**
    - Interactive building models
    - Toggle between different configurations
    - Export to web or AR for physical location overlay

### Integration with Universo MMOOMM

1. **Virtual World Prototyping**

    - Development of virtual world prototypes
    - Testing game mechanics
    - Component export for use in full applications

2. **Multiplayer Interactions**
    - Interactive spaces for collaboration
    - Prototyping multiplayer game elements
    - Integration with Supabase multiplayer functionality

## APPs Architecture Approach

The project is moving to a modular APPs architecture that minimizes changes to the core Flowise codebase:

1. **Separation of Concerns**

    - Core functionality in original packages
    - UPDL node system in apps/updl
    - Publication system in apps/publish

2. **Technology-Specific MiniApps**

    - Each export target implemented as a miniapp
    - Consistent API for all exporters
    - Easy addition of new technology exporters

3. **Integration Points**

    - Registration of UPDL nodes in Flowise editor
    - Redesign of "Embed in website" into "Publish & Export"
    - Server endpoints for publication handling

4. **Publication URL Format**
    - `/p/{uuid}` format with Universo Kiberplano frame
    - `/e/p/{uuid}` option for frameless embedding
    - Replacing legacy `/ar/{id}` and `/chatbot/{id}` routes

This architecture enables a clean transition from the existing test AR.js implementation to a comprehensive, extensible system while maintaining backward compatibility.

## Current Phase & Roadmap (v0.9.0 pre-alpha, May 2025)

The project has shifted from design to **implementation**. Our end‑to‑end milestone:

> _"UPDL graph in Flowise → AR.js application in browser"_

### Near‑term deliverables

| Deliverable                    | Definition of Done                                              |
| ------------------------------ | --------------------------------------------------------------- |
| **UPDL core node set**         | Nodes can be created, saved, and displayed in the editor        |
| **AR.js exporter**             | A working HTML page with a 3D model on a marker is generated    |
| **Publish flow (MVP)**         | CLI or API returns a URL for the generated build                |
| **AR.js / A-Frame separation** | Specialized AR.js files with ARJS prefix and updated API routes |

### Priorities

1. Prove the viability of the pipeline (editor → export → publish).
2. Conduct an internal UX test to identify bottlenecks (node hierarchy, drag‑and‑drop workflow).
3. Prepare the foundation for the next platforms: **PlayCanvas React → Babylon.js → Three.js → A‑Frame VR** (in that order).

### Known Limitations for v0.7.0

-   **Web‑only:** native ARKit/ARCore are not supported.
-   **UI nodes:** 2D interface nodes are currently outside UPDL; a React UI can be overlaid on the canvas if needed.
-   **Complex nodes (Physics, Networking)** are postponed; exporters ignore them with a warning.
-   **Single‑scene assumption:** the first Scene node is treated as the main scene.
-   **Focus on functionality > optimization:** performance will be polished later.

### Upcoming Release Plan

| Version    | Focus                          | Key Deliverables                                                                 |
| ---------- | ------------------------------ | -------------------------------------------------------------------------------- |
| **0.9.0**  | APPs Structure & UPDL Base     | Basic apps/updl and apps/publish structure, UPDL core nodes, AR.js export        |
| **0.10.0** | Additional Exporters (Phase 1) | PlayCanvas React and Babylon.js exporters, enhanced node functionality           |
| **0.11.0** | Additional Exporters (Phase 2) | Three.js, A-Frame VR, and PlayCanvas Engine exporters                            |
| **0.12.0** | Cleanup & Optimization         | Legacy AR.js code removal, performance optimization, comprehensive documentation |
