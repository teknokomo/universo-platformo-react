# Active Context

> **Last Updated**: 2025-11-13
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: i18n Residual Keys & Space Builder Refactor

### i18n Phase 5 – Canvas Dialogs & Speech-to-Text (2025-11-13)
- Fixed CanvasConfigurationDialog, UpsertHistoryDialog, SpeechToText namespace binding
- Fixed PlayCanvas/ARJS publishers colon syntax for common namespace
- Modified 7 files (spaces-frt, template-mui, chatmessage packages)
- Builds: All successful (spaces-frt, template-mui, flowise-ui)
- Next: Browser verification (tasks.md#5.10)

### Space Builder Dedicated Namespace (2025-11-13)
- Replaced merger logic with explicit namespace registration
- Updated SpaceBuilderDialog/Fab to use `useTranslation('spaceBuilder')`
- Fixed JSX parse errors (missing closing tags)
- Builds: space-builder-frt successful (CJS 3596 kB, ESM 795 kB)
- Next: Browser QA (tasks.md#R5), restore compatibility export (tasks.md#R6)

### Uniks Functionality Refactoring (2025-11-10)
- Completed: TypeORM migration, frontend rebuild, routing, i18n, builds
- Status: Stage 9 (Canvas routes), Stage 11 (Versions crash mitigation)
- MinimalLayout created for full-screen Canvas editing
- Next: Browser test navigation, Canvas rendering (tasks.md#7.1-7.7)

---

## Active Blockers

### Template MUI CommonJS Shims
- Problem: flowise-ui cannot import from @flowise/template-mui (ESM/CJS conflict)
- Solution: Extract to @universo package with dual build (like space-builder-frt)
- Impact: Blocks UI component imports
- Status: DEFERRED

---

## Quick Reference

### Core Patterns
- i18n Architecture: systemPatterns.md#i18n-architecture
- Universal List: systemPatterns.md#universal-list-pattern
- React StrictMode: systemPatterns.md#react-strictmode
- TypeORM Repository: systemPatterns.md#typeorm-repository-pattern

### Key Commands
```bash
pnpm --filter <package> test
pnpm --filter <package> build
pnpm build
pnpm --filter <package> lint
```

---

## Previous Focus (Archived to progress.md)

- 2025-11-12: i18n Phase 3 (View Messages/Leads dialogs) – Details: progress.md#2025-11-12
- 2025-11-12: i18n Phase 2 (Singleton binding, colon syntax) – Details: progress.md#2025-11-12
- 2025-11-11: API Keys i18n migration – Details: progress.md#2025-11-11
- 2025-11-11: i18n Double namespace fix – Details: progress.md#2025-11-11
- 2025-11-07: HTTP Error Handling – Details: progress.md#2025-11-07
- 2025-11-06: Member Dialog UX – Details: progress.md#2025-11-06
- 2025-11-05: Dashboard implementation – Details: progress.md#2025-11-05

---

**Note**: For detailed implementation logs older than 7 days, see progress.md archive.
