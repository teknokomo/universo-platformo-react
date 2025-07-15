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

## APPs Architecture ✅ **COMPLETE**

**6 Working Applications** with modular architecture minimizing core Flowise changes:

-   **UPDL**: High-level abstract nodes (Space, Entity, Component, Event, Action, Data, Universo)
-   **Publish Frontend/Backend**: Multi-technology export with template-first architecture
-   **Analytics**: Quiz performance tracking and lead collection
-   **Profile Frontend/Backend**: Enhanced user management with workspace packages

**Key Benefits:**

-   Template-based export system supporting multiple technologies
-   Clean separation of concerns with minimal core changes
-   Publication URL format (`/p/{uuid}`) with iframe-based rendering
-   Proven scalability with production-ready AR.js and PlayCanvas support

## Current Status: Alpha Achieved (v0.20.0-alpha, July 2025)

**Platform Status**: **Alpha Achieved** - Production-ready platform with complete UPDL system

### ✅ Major Achievements

| Milestone                       | Status      | Details                                                                         |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| **High-Level UPDL System**      | ✅ COMPLETE | 7 core abstract nodes (Space, Entity, Component, Event, Action, Data, Universo) |
| **Multi-Technology Export**     | ✅ COMPLETE | AR.js (production), PlayCanvas (ready), template-based architecture             |
| **Template-First Architecture** | ✅ COMPLETE | Reusable export templates across multiple technologies                          |
| **Alpha Status**                | ✅ ACHIEVED | Production-ready stability and feature completeness                             |

### Current Capabilities

-   ✅ **Production Platform**: Alpha-grade stability with 6 working applications
-   ✅ **Multi-Technology**: AR.js (production), PlayCanvas (ready), extensible system
-   ✅ **Template System**: Reusable quiz and MMOOMM templates
-   ✅ **Universo MMOOMM**: Foundation ready for MMO development

### Next Development Focus (Post-Alpha)

**Advanced UPDL Features:**

-   Physics, Animation, Networking nodes for complex interactions
-   Advanced scene management and multi-scene projects
-   Collaborative editing and real-time collaboration features

**Universo MMOOMM Expansion:**

-   Full MMO development pipeline with PlayCanvas
-   Multiplayer networking and territorial control systems
-   Integration with Kiberplano for real-world implementation

**Production Deployment:**

-   Enterprise-grade hosting and scaling solutions
-   Community features for template sharing and collaboration
-   Advanced analytics and performance optimization
