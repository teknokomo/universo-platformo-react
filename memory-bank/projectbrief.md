# Project Brief - Universo Platformo

## Overview

Universo Platformo (Universo Kiberplano) is a project based on the modification of Flowise AI, adding multi-user functionality through Supabase integration.

## Project Name

-   Universo Platformo / Universo Kiberplano
-   Based on Flowise AI (version 2.2.7-patch.1)

## Core Technologies

-   Node.js (>=18.15.0 <19.0.0 || ^20)
-   PNPM (>=9)
-   Supabase (for multi-user functionality)
-   React

## Key Goals

-   Implement multi-user functionality
-   Minimize changes to original Flowise code
-   Maintain backwards compatibility
-   Keep implementation simple and concise

## Coding Standards

-   Prefix comments with "Universo Platformo | "
-   Write concise English comments
-   Follow existing code patterns
-   Fewer lines of code is better

## UPDL (Work is currently underway to implement it)

UPDL is an initiative to create a universal visual design language **UPDL (Universo Platformo Definition Language)** within the Universo Platformo ecosystem. The goal of the project is to provide **a single way to describe** 3D/AR/VR scenes and interactive logic in a form understandable to both humans and machines, which can then be used to generate applications on different technologies. In other words, developers will be able to describe the structure of a scene and the behavior of an application once, in the form of a **graph of nodes**, and then export this specification to various engines (for example, PlayCanvas, Babylon.js, Three.js, A-Frame, AR.js, etc.) without duplicating work. This approach separates the **"what" (content and logic)** from the **"how" (platform-specific implementation)**: _what_ should happen is described in UPDL, and _how_ it is realized is determined by the code generator during export. By decoupling content from platform details in this way, UPDL enables a true "write once, deploy anywhere" workflow for interactive 3D/AR applications.

Key outcomes the project aims to achieve:

-   **Universal node system (UPDL):** A unified node-based system for describing scenes and logic, integrated into the application (based on FlowiseAI).
-   **Multi-platform export:** The ability to generate, from one description, multiple versions of an application – an AR application in the browser, a 3D application on PlayCanvas (including React), scenes in Babylon.js, Three.js, A-Frame, etc.
-   **Publishing mechanism:** A user-friendly interface to generate and deploy the generated applications via a unique link (similar to the _Publish_ system in PlayCanvas).
-   **Documentation and automation:** A well-tuned Memory Bank system to preserve development context and a set of Cursor AI prompts to assist in planning, code generation, and creative tasks.

This project is expected to significantly reduce the effort required to develop interactive applications for different platforms. In the long term, UPDL will become the **central link of the Universo Platformo ecosystem**, providing a unified format for sharing content between design tools and runtime engines.

## UPDL Architecture

### Core Node Components

1. **Scene Node**: The root node for all UPDL scenes that contains global settings and serves as the main container.
2. **Object Node**: Represents 3D objects, including primitives and complex models, with material and texture options.
3. **Camera Node**: Defines viewing parameters with options for perspective, orthographic, and specialized AR/VR modes.
4. **Light Node**: Creates various light sources with customizable parameters for intensity, color, and range.
5. **Interaction Node**: Handles user interactions like clicks, touches, and other event-based triggers.
6. **Controller Node**: Manages behaviors like spinning, orbiting, or other automated movements.
7. **Animation Node**: Controls property animations with timing, looping, and sequence options.

### Export Targets

UPDL is designed to export to multiple target technologies:

-   **AR.js / A-Frame**: For marker-based augmented reality experiences in web browsers
-   **PlayCanvas React**: For React-based 3D applications using PlayCanvas
-   **Babylon.js**: For high-performance 3D web applications
-   **Three.js**: For lower-level WebGL-based development
-   **A-Frame VR**: For virtual reality experiences
-   **PlayCanvas Engine**: For native PlayCanvas applications

### APPs Architecture

The project is transitioning to a modular APPs architecture with minimal changes to the base Flowise codebase:

```
universo-platformo-react/
├── packages/                  # Original Flowise packages
│   ├── components/            # Components and utilities
│   ├── server/                # Server-side code
│   └── ui/                    # Frontend
├── apps/                      # New APPs architecture
│   ├── updl/                  # UPDL node system
│   │   └── imp/               # Implementation
│   └── publish/               # Publication system
│       ├── imp/               # Implementation
│       │   ├── react/         # Frontend
│       │   │   └── miniapps/  # Technology-specific handlers
│       │   └── express/       # Backend
```

This structure allows for:

1. **Modularity**: Each functional area is contained within its own application
2. **Minimal Core Changes**: Original Flowise code remains largely untouched
3. **Easy Extension**: New technologies can be added as miniapps
4. **Clean Separation**: Clear boundaries between different functional areas

The architecture will replace the existing temporary AR.js implementation with a comprehensive, extensible system for creating, publishing, and exporting 3D/AR/VR applications.
