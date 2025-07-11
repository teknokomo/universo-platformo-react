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

## APPs Architecture Implementation

The project has successfully implemented a modular APPs architecture with 4 working applications that minimize changes to the core Flowise codebase:

1. **Separation of Concerns** ✅ **IMPLEMENTED**

    - Core functionality preserved in original packages
    - UPDL node system implemented in apps/updl (pure node definitions)
    - Publication system implemented in apps/publish-frt and apps/publish-srv
    - Analytics functionality separated in apps/analytics-frt

2. **Technology-Specific Builders** ✅ **IMPLEMENTED**

    - AR.js builder with iframe-based rendering implemented
    - **Template-First Architecture**: Migrated to template-based structure (`templates/quiz/arjs/`, `templates/mmoomm/playcanvas/`)
    - **Template Reusability**: Enabled templates to be implemented across multiple technologies
    - Modular builder architecture for easy addition of new exporters and templates
    - Multi-object support with circular positioning
    - Local library serving for CDN-blocked regions

3. **Integration Points** ✅ **IMPLEMENTED**

    - UPDL nodes successfully registered in Flowise editor
    - "Embed in website" redesigned into "Publish & Export" interface
    - Server endpoints for publication handling integrated with main Flowise server
    - Quiz functionality with lead collection implemented

4. **Publication URL Format** ✅ **IMPLEMENTED**
    - `/p/{uuid}` format implemented and working
    - Iframe-based AR.js rendering for proper script execution
    - Quiz results storage in Supabase
    - Library configuration system (CDN vs local sources)

This architecture has proven successful with 4 applications working in production, enabling comprehensive AR.js quiz functionality while maintaining full backward compatibility.

## Current Phase & Status (v0.17.0+ Achieved, June 2025)

The project has successfully **completed implementation** of the core APPs architecture and AR.js functionality. Our milestone achieved:

> ✅ _"UPDL graph in Flowise → AR.js application in browser"_ **COMPLETED**

### Completed Deliverables ✅

| Deliverable                    | Status  | Implementation Details                                            |
| ------------------------------ | ------- | ----------------------------------------------------------------- |
| **UPDL core node set**         | ✅ DONE | Space, Object, Camera, Light, Data nodes working in editor        |
| **AR.js exporter**             | ✅ DONE | Full AR.js builder with iframe rendering and multi-object support |
| **Publish flow (MVP)**         | ✅ DONE | API returns working URLs with `/p/{uuid}` format                  |
| **AR.js / A-Frame separation** | ✅ DONE | Clean APPs architecture with specialized AR.js handling           |
| **Quiz functionality**         | ✅ DONE | Educational quizzes with scoring and lead collection              |
| **Analytics system**           | ✅ DONE | Separate analytics-frt application for quiz results               |

### Current Focus: Advanced Development & Evolution

**Platform Status**: ✅ COMPLETED - Successfully upgraded to Flowise 2.2.8 with enhanced functionality

**Next Priorities**:

1. **User Experience Enhancement**: Improved interfaces and workflow optimization
2. **Advanced UPDL Development**: New node types for diverse project creation
3. **Publication System Evolution**: Project versioning and Chatflow (Spaces) management

### Proven Capabilities

-   ✅ **Multi-platform foundation**: APPs architecture proven with 4 working applications
-   ✅ **AR.js production ready**: Full quiz functionality with lead collection
-   ✅ **CDN independence**: Local library serving for blocked regions
-   ✅ **Educational use cases**: Quiz creation and analytics working
-   ✅ **Scalable architecture**: Easy addition of new applications and exporters

### Future Expansion Roadmap

| Version              | Focus                        | Key Deliverables                                                                                             |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **0.18.0‑pre‑alpha** | Platform Stabilization       | Complete current architecture consolidation, enhanced user profile system, stability improvements            |
| **0.19.0‑pre‑alpha** | Advanced UPDL Development    | New UPDL node types for diverse projects, Universo MMOOMM integration preparation with PlayCanvas technology |
| **0.20.0‑alpha**     | Publication System Evolution | Advanced project versioning, Chatflow (Spaces) version management, **transition to Alpha status**            |

#### **Version 0.18.0-pre-alpha: Platform Stabilization**

**Focus:** Complete current architecture consolidation and enhance system stability

**Key Features:**

-   **Enhanced User Profile System** - Advanced profile management with extended user settings
-   **Architecture Consolidation** - Finalize integration of all APPs components
-   **Stability Improvements** - Performance optimization and bug fixes
-   **Documentation Enhancement** - Comprehensive user and developer documentation
-   **Testing Framework** - Automated testing for all applications

#### **Version 0.19.0-pre-alpha: Advanced UPDL Development**

**Focus:** Expand UPDL capabilities for diverse project creation including Universo MMOOMM

**Key Features:**

-   **New UPDL Node Types** - Physics, Animation, Interaction, and Networking nodes
-   **Universo MMOOMM Integration** - UPDL to PlayCanvas pipeline for MMO development
-   **PlayCanvas Technology** - New exporter for PlayCanvas Engine integration
-   **Advanced Scene Management** - Multi-scene UPDL projects with complex interactions
-   **Collaborative Features** - Multi-user editing and real-time collaboration

#### **Version 0.20.0-alpha: Publication System Evolution**

**Focus:** Advanced project management and transition to Alpha status

**Key Features:**

-   **Project Versioning System** - Multiple versions of published projects
-   **Chatflow (Spaces) Version Management** - Track and manage different Space versions
-   **Publication Branching** - Development, staging, and production publication environments
-   **Advanced Analytics** - Comprehensive usage analytics and performance metrics
-   **Alpha Status Transition** - Production-ready stability and feature completeness
