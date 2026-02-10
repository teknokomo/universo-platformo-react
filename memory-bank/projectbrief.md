# Project Brief - Universo Platformo

> **Last Reviewed**: 2026-02-10 (no change)

## Mission & Strategic Vision

Universo Platformo is a comprehensive platform for creating 3D/AR/VR applications and the foundation for **Universo MMOOMM** - a massive multiplayer online game combining space exploration with **Kiberplano** (Cyberplan) functionality. The platform enables "write once, deploy anywhere" workflow for interactive experiences, while the game serves as a cosmic sandbox where players create production chains, develop detailed products, and implement solutions in the real world through robotic systems.

**Key Strategic Goals:**

-   **Universal UPDL System**: Visual node-based development for cross-platform 3D applications
-   **Universo MMOOMM**: Space MMO with production chains, territorial control, and real-world integration
-   **Kiberplano Integration**: Digital planning → robotic implementation → real world deployment
-   **Shared Runtime DDL**: Extracted schema generation/migration into `@universo/schema-ddl` to avoid backend coupling

> **Detailed Functionality:**  
> • [Universo MMOOMM Features](https://github.com/teknokomo/universo-platformo-godot/wiki/Functionality-expected-in-Universo-MMOOMM)  
> • [Universo Platformo Features](https://github.com/teknokomo/universo-platformo-godot/wiki/Functionality-expected-in-Universo-Platformo)

## Current Status: Alpha Achieved (v0.21.0-alpha, July 2025)

**Platform Status**: **Alpha Achieved** - Production-ready platform with complete UPDL system
**Base Platform**: Flowise AI 2.2.8 with enhanced ASSISTANT support
**Architecture**: 6 working APPs applications with template-first design

## UPDL Architecture

### Core Design Principles

1. **Universal Description Layer**: UPDL nodes describe "what" should happen, not "how"
2. **Hierarchical Structure**: Space nodes serve as root containers with parent-child relationships
3. **Cross-Platform Export**: Single node graph works across different rendering engines
4. **Modular Composition**: Primitive nodes combine into specialized composite nodes

### High-Level Abstract Nodes ✅ **COMPLETE**

| Node          | Purpose                                    | Key Features                                     |
| ------------- | ------------------------------------------ | ------------------------------------------------ |
| **Space**     | Root container for 3D environments         | Global settings, environment configuration       |
| **Entity**    | Game objects with transform and behavior   | Universal object representation across platforms |
| **Component** | Attachable behaviors and properties        | Geometry, material, script components            |
| **Event**     | Trigger system for interactions            | User input, collision, timer events              |
| **Action**    | Executable behaviors and responses         | Animation, state changes, network calls          |
| **Data**      | Information storage and quiz functionality | Structured data with scope management            |
| **Universo**  | Global connectivity and network features   | MMO integration and cross-space communication    |

### Export Architecture

**Production Ready**: AR.js (iframe-based rendering), PlayCanvas (complete integration)
**Template System**: Reusable export templates (quiz, MMOOMM) across technologies
**Extensible**: Builder pattern supports additional technologies (Babylon.js, Three.js)

## Technical Foundation

### Core Technologies

-   **Node.js** (>=18.15.0 <19.0.0 || ^20)
-   **PNPM** (>=9) - **IMPORTANT: Use PNPM, not npm!**
-   **React** with Material-UI components
-   **Supabase** for authentication and data storage
-   **Flowise AI 2.2.8** as base framework
-   **TypeScript** for type safety
-   **Operational reliability**: pool budgets aligned with Supabase Pool Size and pool error telemetry enabled

### Essential Commands

```bash
# Installation
pnpm install

# Build all applications
pnpm build

# Development mode
pnpm dev

# Build specific application
pnpm build --filter publish-frontend
pnpm build --filter updl
```

### APPs Architecture (6 Applications) ✅ **COMPLETE**

```
packages/
├── updl/base/                # High-level UPDL abstract nodes
├── publish-frontend/base/         # Multi-technology export frontend
├── publish-backend/base/         # Publication backend with template system
├── profile-frontend/base/         # Enhanced user profile management
├── profile-backend/base/         # @universo/profile-backend workspace package
└── analytics-frontend/base/       # Quiz analytics and performance tracking
```

**Key Benefits:**

-   **Template-First**: Reusable export templates across multiple technologies
-   **Production Ready**: Alpha-grade stability with complete UPDL system
-   **Minimal Core Changes**: Original Flowise code preserved
-   **Extensible**: Easy addition of new technologies and features

### Environment Setup

Create `.env` file in `packages/flowise-core-backend/base/` directory:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
```

**Note**: After refactoring, Supabase configuration should only be specified in `packages/flowise-core-backend/base/` directory.

## Coding Standards & Guidelines

-   **Language**: Concise English comments for code, preserve existing patterns
-   **Efficiency**: Fewer lines of code is better, maintain readability
-   **Compatibility**: Maintain backwards compatibility with Flowise
-   **Package Management**: PNPM workspaces only, no npm/yarn usage

## Key Resources & Documentation

-   **Project Repository**: [universo-platformo-react](https://github.com/teknokomo/universo-platformo-react)
-   **Detailed APPs Structure**: [packages/README.md](../packages/README.md)
-   **Technical Context**: [memory-bank/techContext.md](techContext.md)
-   **System Patterns**: [memory-bank/systemPatterns.md](systemPatterns.md)
-   **Progress Timeline**: [memory-bank/progress.md](progress.md)
-   **Current Tasks**: [memory-bank/tasks.md](tasks.md)

## License Information

**Dual Licensing Structure:**

-   **Original Flowise Code** (`packages/` directory): Apache License 2.0
-   **Universo Platformo Extensions** (`packages/` directory): Omsk Open License

The Omsk Open License is similar to MIT but includes additional provisions for creating meaningful public domain while protecting traditional values.

---

_This document serves as the primary context file for the Universo Platformo Memory Bank system. It provides essential technical and strategic information needed for AI-assisted development and project understanding._
