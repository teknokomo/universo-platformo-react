# Active Context

> **Last Updated**: 2026-01-29
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Optimistic Lock QA Remediation (In Progress)

**Status**: Core fixes applied; tests rerun with failures in existing suites.

### Summary (2026-01-29)
- Moved metahub `_uplUpdatedBy/_uplUpdatedAt` assignment after version check to preserve conflict metadata.
- Added updatedBy propagation for branch and publication updates.
- Added VersionColumn to TypeORM jest mocks and reran backend tests.

### Next Step
- Review and update failing metahubs/applications backend tests (outdated expectations/mocks).
