# Active Context

> **Last Updated**: 2025-12-03
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: Memory Bank Maintenance

- Compression cycle in progress (2025-12-03)
- All files require size optimization per compression instructions
- Next: Resume development tasks after compression

---

## Recent Completions (Last 7 Days)

### 2025-01-22: Flowise Core Packages Naming Refactoring ✅
- `flowise-ui` → `@flowise/core-frontend`, `flowise-server` → `@flowise/core-backend`
- Added `base/` structure to 4 core packages for consistency
- Fixed ~50 tsconfig.json files with `types: ["node"]`
- Details: progress.md#2025-01-22

### 2025-01-20: Spaces Backend Improvements ✅
- Zod validation schemas: spacesController reduced ~30% (750→515 lines)
- System status fields: is_active, is_published, is_deleted for Spaces/Canvases
- Canvas Versions API client added to @universo/api-client
- Canvases migration consolidation (7 migrations merged)
- Details: progress.md#2025-01-20

### 2025-01-19: CustomTemplates Package Extraction ✅
- Created @flowise/customtemplates-backend and @flowise/customtemplates-frontend
- Naming: Marketplaces → Templates migration complete
- VectorStore dialogs deduplicated (moved to @flowise/docstore-frontend)
- DocumentStore Clean Integration with DI pattern
- Details: progress.md#2025-01-19

### 2025-12-01-02: DocumentStore Full Migration ✅
- @flowise/docstore-backend: 3 entities, 4 DI services, consolidated migration
- @flowise/docstore-frontend: 20 JSX files, i18n merged
- Fixed 403 error, i18n interpolation format
- Build: 48/48 packages
- Details: progress.md#2025-12-01

### 2025-11-28-29: Package Extractions ✅
- ChatMessage: Full migration to @universo/flowise-chatmessage-backend
- Leads: Extracted to @universo/flowise-leads-backend
- Assistants: @universo/flowise-assistants-backend with DI pattern
- ApiKey: Dual storage mode (JSON + DB)
- Variables, Credentials: Following same DI pattern
- Details: progress.md#2025-11-28

### 2025-11-27: Tools Package Extraction ✅
- @universo/flowise-tools-backend and frontend
- Migration order: Init → Tools → Credentials
- Bot review fixes applied (PR #564)
- Details: progress.md#2025-11-27

---

## Active Blockers

### Template MUI CommonJS Shims (DEFERRED)
- **Problem**: flowise-ui ESM/CJS conflict with @flowise/template-mui
- **Solution**: Extract to @universo package with dual build
- **Status**: Low priority, workarounds in place

---

## Quick Reference

### Core Patterns
- systemPatterns.md#source-only-package-peerdependencies-pattern
- systemPatterns.md#rls-integration-pattern
- systemPatterns.md#i18n-architecture
- systemPatterns.md#service-factory-nodeprovider-pattern

### Key Commands
```bash
pnpm --filter <package> build    # Build single package
pnpm build                       # Full workspace build
pnpm --filter <package> lint     # Lint single package
```

---

**Note**: For implementation details, see progress.md. For planned work, see tasks.md.
