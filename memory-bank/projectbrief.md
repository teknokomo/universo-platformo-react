# Project Brief - Universo Platformo

## Mission & Strategic Vision

Universo Platformo is a comprehensive platform for creating 3D/AR/VR applications and the foundation for **Universo MMOOMM** - a massive multiplayer online game combining space exploration with **Kiberplano** (Cyberplan) functionality. The platform enables "write once, deploy anywhere" workflow for interactive experiences, while the game serves as a cosmic sandbox where players create production chains, develop detailed products, and implement solutions in the real world through robotic systems.

**Key Strategic Goals:**

-   **Universal UPDL System**: Visual node-based development for cross-platform 3D applications
-   **Universo MMOOMM**: Space MMO with production chains, territorial control, and real-world integration
-   **Kiberplano Integration**: Digital planning → robotic implementation → real world deployment

> **Detailed Functionality:**  
> • [Universo MMOOMM Features](https://github.com/teknokomo/universo-platformo-godot/wiki/Functionality-expected-in-Universo-MMOOMM)  
> • [Universo Platformo Features](https://github.com/teknokomo/universo-platformo-godot/wiki/Functionality-expected-in-Universo-Platformo)

## Current Status & Development Roadmap (v0.17.0+, June 2025)

**Current Phase**: Platform Enhancement & Evolution  
**Base Platform**: Flowise AI 2.2.8 with Supabase multi-user functionality  
**Architecture**: 6 working APPs applications with modular design

### Development Roadmap

| Version              | Focus                        | Key Deliverables                                                                 |
| -------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| **0.18.0-pre-alpha** | Platform Stabilization       | Enhanced user profiles, architecture consolidation, stability improvements       |
| **0.19.0-pre-alpha** | Advanced UPDL Development    | New node types, Universo MMOOMM integration with PlayCanvas technology           |
| **0.20.0-alpha**     | Publication System Evolution | Project versioning, Chatflow (Spaces) management, **transition to Alpha status** |

## UPDL Architecture

### Core Design Principles

1. **Universal Description Layer**: UPDL nodes describe "what" should happen, not "how"
2. **Hierarchical Structure**: Space nodes serve as root containers with parent-child relationships
3. **Cross-Platform Export**: Single node graph works across different rendering engines
4. **Modular Composition**: Primitive nodes combine into specialized composite nodes

### Primitive Node Types (Current Implementation)

| Node       | Purpose                                            | Key Features                                          |
| ---------- | -------------------------------------------------- | ----------------------------------------------------- |
| **Space**  | Root container for 3D environment (formerly Scene) | Global settings, environment configuration            |
| **Object** | 3D entities with transform properties              | Primitives, models, materials, parent-child hierarchy |
| **Camera** | Viewpoint definition                               | Perspective/orthographic, AR/VR settings              |
| **Light**  | Scene illumination                                 | Directional, Point, Spot, Ambient types               |
| **Data**   | Structured information storage                     | Quiz functionality, question/answer systems           |

### Composite & Custom Nodes

-   **Composite Nodes**: Built from primitive combinations (e.g., AR Marker, Interactive Quiz)
-   **Specialized Nodes**: Domain-specific assemblies for 3D, VR, AR, logic systems
-   **Custom User Nodes**: User-created node types with "unpacking" capability
-   **Version Management**: `updlVersion` field ensures forward/backward compatibility

### Export Targets

**Current Support**: AR.js/A-Frame, PlayCanvas React  
**Planned**: Babylon.js, Three.js, A-Frame VR, PlayCanvas Engine  
**Architecture**: Builder pattern in `apps/publish-*` for extensible export system

## Technical Foundation

### Core Technologies

-   **Node.js** (>=18.15.0 <19.0.0 || ^20)
-   **PNPM** (>=9) - **IMPORTANT: Use PNPM, not npm!**
-   **React** with Material-UI components
-   **Supabase** for authentication and data storage
-   **Flowise AI 2.2.8** as base framework
-   **TypeScript** for type safety

### Essential Commands

```bash
# Installation
pnpm install

# Build all applications
pnpm build

# Development mode
pnpm dev

# Build specific application
pnpm build --filter publish-frt
pnpm build --filter updl
```

### APPs Architecture (6 Applications)

```
apps/
├── updl/base/                # UPDL node definitions and interfaces
├── publish-frt/base/         # Publication frontend with AR.js export
├── publish-srv/base/         # Publication backend and URL management
├── profile-frt/base/         # User profile management frontend
├── profile-srv/base/         # @universo/profile-srv workspace package
└── analytics-frt/base/       # Quiz analytics and performance tracking
```

**Architecture Benefits:**

-   **Modularity**: Each functional area contained within its own application
-   **Minimal Core Changes**: Original Flowise code remains largely untouched
-   **Easy Extension**: New technologies added as additional apps
-   **Clean Separation**: Clear boundaries between different functional areas

### Environment Setup

Create `.env` file in `packages/server/` directory:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
```

**Note**: After refactoring, Supabase configuration should only be specified in `packages/server/` directory.

## Coding Standards & Guidelines

-   **Language**: Concise English comments for code, preserve existing patterns
-   **Efficiency**: Fewer lines of code is better, maintain readability
-   **Compatibility**: Maintain backwards compatibility with Flowise
-   **Package Management**: PNPM workspaces only, no npm/yarn usage

## Key Resources & Documentation

-   **Project Repository**: [universo-platformo-react](https://github.com/teknokomo/universo-platformo-react)
-   **Detailed APPs Structure**: [apps/README.md](../apps/README.md)
-   **Technical Context**: [memory-bank/techContext.md](techContext.md)
-   **System Patterns**: [memory-bank/systemPatterns.md](systemPatterns.md)
-   **Current Tasks**: [memory-bank/tasks.md](tasks.md)

## License Information

**Dual Licensing Structure:**

-   **Original Flowise Code** (`packages/` directory): Apache License 2.0
-   **Universo Platformo Extensions** (`apps/` directory): Omsk Open License

The Omsk Open License is similar to MIT but includes additional provisions for creating meaningful public domain while protecting traditional values.

---

_This document serves as the primary context file for the Universo Platformo Memory Bank system. It provides essential technical and strategic information needed for AI-assisted development and project understanding._
