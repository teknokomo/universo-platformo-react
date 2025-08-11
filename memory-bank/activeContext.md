# Current Active Context

## Current Project Status

**Status**: **Alpha Achieved (v0.21.0-alpha, July 2025)** - Production-ready platform with complete UPDL system

**Platform Maturity**: Alpha-grade stability with 6 working applications and complete high-level UPDL node system

## Current Focus

**Post-Alpha Development** - Expanding advanced UPDL features and Universo MMOOMM capabilities:

-   **Advanced UPDL Node Types**: Physics, Animation, Networking nodes for complex interactions
-   **Universo MMOOMM Expansion**: Full MMO development pipeline with PlayCanvas
-   **Production Deployment**: Enterprise-grade hosting and scaling solutions
-   **Community Features**: Template sharing and collaborative development tools

## Recently Completed

-   **Space Builder MVP (Prompt-to-Flow, Frontend + Server)**: Implemented an end-to-end generator to create UPDL flows from a natural-language prompt on the canvas. Frontend: FAB + MUI Dialog with model selector (from Credentials), authenticated calls, i18n bundle, placeholder/label fixes, append/replace modes, and hydration of nodes for anchors/handles. Server: `/api/v1/space-builder/{health,config,generate}` with `ensureAuth` and rate-limit, provider ModelFactory (OpenAI-compatible including Groq via `https://api.groq.com/openai/v1`), credential resolution by `credentialId`, meta-prompt → RAW JSON extraction → Zod validation → safe normalization. Environment: single server `.env` with `SPACE_BUILDER_TEST_MODE` and `GROQ_TEST_API_KEY`. Documentation: EN/RU pages added and linked in Applications and SUMMARY.
-   **Space Builder Two-step Quiz Flow (Prepare → Preview → Generate)**: Added `/api/v1/space-builder/prepare`, `QuizPlan` Zod schema, JSON-safe prompt for question/answers proposal, and deterministic fallback graph. Frontend dialog now supports two-step flow with non-editable preview, model selection, and N×M controls; synthetic test provider appears when no credentials are available and `SPACE_BUILDER_TEST_MODE=true`. Increased `sourceText` limit from 1000 to 2000 characters across server validation, UI, i18n strings, and docs. Updated READMEs (apps) and top-level docs (EN/RU) accordingly. Full monorepo build is green.

**Uniks Functionality Extraction and Build System Fixes**: Successfully completed on 2025-08-07. Extracted Uniks (workspace) functionality from monolithic codebase into dedicated packages `@universo/uniks-srv` and `@universo/uniks-frt`, resolving critical build system issues. Implemented modular architecture with clean separation of concerns, eliminated circular dependencies, fixed TypeScript compilation issues, and corrected internationalization configuration. Archive: [docs/archive/enhancements/2025-08/uniks-functionality-extraction.md](../docs/archive/enhancements/2025-08/uniks-functionality-extraction.md)

**MMOOMM Entity Hardcode Elimination Fix**: Successfully completed on 2025-08-06. Eliminated all hardcoded transform values in MMOOMM Entity types that were overriding UPDL settings from Chatflow. Fixed JavaScript variable scope conflicts and preserved all game functionality. Archive: [docs/archive/enhancements/2025-08/mmoomm-entity-hardcode-elimination-fix.md](../docs/archive/enhancements/2025-08/mmoomm-entity-hardcode-elimination-fix.md)

**Previous Development**: Enhanced Resource System with Material Density implemented successfully. Created realistic material physics with separate weight/volume tracking, 16 material types with proper densities (0.001-21.5 t/m³), enhanced inventory system supporting both tons and m³, and improved mineable components with hardness/volume properties. MMOOMM ship.ts refactoring also completed with 90.6% code reduction and modular shared templates architecture.

## System Architecture

**6 Working Applications** (see [productContext.md](productContext.md) for details):

-   **UPDL**: High-level abstract nodes (Space, Entity, Component, Event, Action, Data, Universo)
-   **Publish Frontend/Backend**: Multi-technology export (AR.js, PlayCanvas)
-   **Analytics**: Quiz performance tracking
-   **Profile Frontend/Backend**: Enhanced user management with workspace packages
-   **Uniks Frontend/Backend**: Modular workspace functionality (newly extracted)

**Core Technologies**: React + Material-UI, Node.js + TypeScript, Supabase integration, PNPM workspaces

## Technical Status

**Base Platform**: Flowise 2.2.8 with enhanced ASSISTANT support
**Build Quality**: 100% TypeScript compilation success across entire workspace
**Export Pipeline**: Template-based system for AR.js (production) and PlayCanvas (ready)
**Security**: Enhanced Supabase authentication with secure profile management
**Modular Architecture**: Clean package separation with eliminated circular dependencies

## Next Steps

**Immediate Priorities**:

-   Advanced UPDL node development (Physics, Animation, Networking)
-   Universo MMOOMM feature expansion
-   Production deployment preparation
-   Community collaboration features
-   Additional package extractions following Uniks pattern

_For detailed progress history, see [progress.md](progress.md). For current tasks, see [tasks.md](tasks.md)._
