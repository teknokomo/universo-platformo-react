# Active Context

> **Last Updated**: 2026-03-05
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: QA Cleanup Complete — Ready for Testing

**Status**: ✅ Completed  
**Date**: 2026-03-05  
**Scope**: Post-QA cleanup of DnD implementation, migration display fix, legacy ConfirmContext removal.

### Recently Completed

1. **DnD Empty Child Table Drop fix** — confirmed working by user (confirm dialog appears, attribute moves successfully).
2. **QA cleanup** of all diagnostic `[DND-DIAG]` console.warn logs (6 locations in 4 files).
3. **Migration display fix** — baseline schema version now shows `0 → 0.1.0` instead of `— → 0.1.0`.
4. **Legacy ConfirmContext removal** — deleted unused `ConfirmContext.jsx`, `ConfirmContextProvider.jsx`, `dialogReducer.js` from `@universo/store`; removed wrapper from `index.tsx`; updated README docs. Zero runtime impact (0 consumers).
5. **Local ConfirmContextProvider** added in `AttributeList.tsx` — ensures `useConfirm()` and `<ConfirmDialog />` share the same context instance (workaround for dnd-kit + React 18 batching).

### Architecture Note

The project now has a single `ConfirmContext` implementation in `@universo/template-mui`. The `ConfirmContextProvider` is mounted in two places:
- `MainLayoutMUI` (shared layout for all authenticated pages)
- `AttributeList` (local provider to ensure DnD confirm flow works reliably)

### Immediate Next Steps

1. User testing of migration display fix (`0 → 0.1.0`).
2. Continue with Constants Value Tab + Localization tasks (see tasks.md).
