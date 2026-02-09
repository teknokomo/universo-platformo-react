# Active Context

> **Last Updated**: 2026-02-09
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Completed: Publication Version Dialog Alignment

**Status**: Version create/edit dialogs updated to match standard action spacing. Full build passes (65/65). Ready for user re-testing.

### Summary
Aligned the action buttons in the metahub Publications version dialogs so they are not flush to the edge. Both create and edit dialogs now use the same padding and spacing as other standard dialogs.

### Key Design Decisions
- Reused the `EntityFormDialog` action spacing values (`p: 3`, `pt: 2`, `gap: 1`) for visual consistency.

### Next Steps
- Manual browser re-testing by user
- Proceed to QA mode when user confirms
