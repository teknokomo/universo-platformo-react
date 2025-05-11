# Universo Platformo Apps Directory

This directory contains modular applications that extend the core Flowise platform, providing additional functionality without modifying the core codebase.

## Directory Structure

```
apps/
├── publish/             # Publication system for exporting and sharing content
│   ├── base/            # Core publication functionality for the publish app
│   ├── dist/
│   ├── package.json
│   ├── tsconfig.json
│   ├── gulpfile.ts
│   └── README.md
├── updl/                # Universal Platform Definition Language
│   ├── base/            # Core UPDL functionality for the updl app
│   ├── dist/
│   ├── package.json
│   ├── tsconfig.json
│   ├── gulpfile.ts
│   └── README.md
└── README.md            # This documentation
```

## Applications

### UPDL (Universal Platform Definition Language)

The UPDL application provides a unified node-based system for describing 3D/AR/VR scenes that can be exported to multiple target platforms. It defines a standardized intermediate representation layer that abstracts away the specifics of various rendering engines.

**Key Features:**

-   Universal node system (Scene, Object, Camera, Light, etc.)
-   Standardized property interfaces
-   Flow-based scene construction
-   Integration with Flowise editor

**Current Status:** Foundation Phase (Phase 1)

**Documentation:** See [apps/updl/README.md](./updl/README.md)

### Publish

The Publish application provides mechanisms for exporting UPDL scenes to various target platforms and publishing them with shareable URLs. It includes both client-side React components and server-side API endpoints.

**Key Features:**

-   Technology-specific exporters (AR.js, A-Frame, etc.)
-   Publication UI components
-   URL-based sharing system
-   QR code generation for mobile access

**Current Status:** In active development

**Documentation:** See [apps/publish/README.md](./publish/README.md)

## Interactions

The apps in this directory are designed to work together:

1.  **UPDL** defines the universal scene format and node types
2.  **Publish** provides the exporters and UI for publishing UPDL scenes

```
┌──────────────┐       ┌────────────────┐        ┌────────────────┐
│              │       │                │        │                │
│   Flowise    │──────▶│  UPDL Module   │───────▶│ Publish Module │
│   Editor     │       │  (Scene Graph) │        │  (Export/Share)│
│              │       │                │        │                │
└──────────────┘       └────────────────┘        └────────┬───────┘
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │                │
                                                 │  Public URL    │
                                                 │  /p/{uuid}     │
                                                 │                │
                                                 └────────────────┘
```

## Development Guidelines

1.  **Modularity:** Keep each app self-contained with clear interfaces
2.  **Minimal Core Changes:** Avoid modifying core Flowise code
3.  **Documentation:** Maintain README files in each app directory
4.  **Shared Types:** Use common type definitions for cross-app communication (can be placed in a shared `packages/types` or similar if needed)

## Building

From the project root:

```bash
# Install all dependencies for the workspace
pnpm install

# Build all apps (and other packages in the workspace)
pnpm build

# Build specific app
pnpm build --filter publish
pnpm build --filter updl
```

The build process for each app now involves:

1. Compiling TypeScript code from `base/` to `dist/`
2. Generating declaration files (.d.ts) and source maps (.js.map)
3. Running Gulp tasks to copy SVG icons from source to dist directory

## Development

To run a specific app in development mode (watches for changes and rebuilds):

```bash
pnpm --filter publish dev
pnpm --filter updl dev
```

**Note about assets:** The `dev` scripts watch TypeScript files for changes but don't automatically copy SVG icons. If you add or modify SVG assets during development, run `pnpm build --filter <app>` to ensure they're properly copied to the dist directory.

---

_Universo Platformo | Apps Documentation_
