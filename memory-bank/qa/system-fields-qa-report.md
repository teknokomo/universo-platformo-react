# QA Analysis Report: System Fields Architecture Plan v2

## Executive Summary

**Overall Assessment: ⚠️ PLAN REQUIRES SIGNIFICANT REVISION**

The proposed plan has architectural issues and deviates from existing codebase conventions. This QA report identifies critical problems and provides recommendations for alignment.

---

## 1. Critical Issues Found

### 🔴 CRITICAL: Prefix Naming Convention Mismatch

**Problem:** The plan proposes `_upl_`, `_mhb_`, `_app_` prefixes for all system fields.

**Reality:** The codebase does NOT use domain-specific prefixes. All existing entities use direct semantic naming:
- `is_deleted` (not `_upl_is_deleted`)
- `deleted_date` (not `_upl_deleted_at`)
- `created_at` (not `_upl_created_at`)

**Evidence:**
```typescript
// spaces-backend/entities/Space.ts - ACTUAL pattern
@Column({ name: 'is_deleted', default: false })
isDeleted!: boolean

@Column({ name: 'deleted_date', type: 'timestamptz', nullable: true })
deletedDate?: Date

@Column({ name: 'deleted_by', type: 'uuid', nullable: true })
deletedBy?: string
```

**Impact:** The proposed `_upl_created_at`, `_mhb_deleted`, `_app_published` names would break consistency with existing 100+ entities.

**Recommendation:** Use existing naming patterns without prefixes. Differentiate by table location (static tables vs dynamic schema tables).

---

### 🔴 CRITICAL: Over-Engineering - Too Many Fields

**Problem:** Plan proposes 17 platform fields + 11 metahub fields + 11 application fields = **39 system fields per record**.

**Reality:** Existing soft delete implementations use only 3 fields:
- `is_deleted` (boolean)
- `deleted_date` (timestamp)
- `deleted_by` (UUID)

**Analysis of proposed fields:**

| Proposed Field | Verdict | Reason |
|----------------|---------|--------|
| `_upl_locked` + `_upl_locked_at` + `_upl_locked_by` + `_upl_locked_reason` | ❌ Over-engineering | No existing use case, can be added later if needed |
| `_upl_archived` + `_upl_archived_at` + `_upl_archived_by` | ⚠️ Premature | No archiving feature exists, add when needed |
| `_upl_purge_after` | ⚠️ Premature | Requires scheduled job infrastructure |
| `_upl_version` | ✅ Keep | Optimistic locking is valuable |
| `_mhb_order` | ✅ Keep | Already exists as `sort_order` in current schema |
| `_mhb_readonly` | ❌ Remove | Can use existing `is_active` pattern |
| `_app_access_level` | ❌ Over-engineering | RLS handles this at database level |

**Recommendation:** Start with MVP (5-7 fields), add others when features are actually needed.

---

### 🔴 CRITICAL: Duplicate Fields Across Levels

**Problem:** Plan proposes same fields at all three levels:
- `_upl_deleted`, `_mhb_deleted`, `_app_deleted`
- `_upl_archived`, `_mhb_archived`, `_app_archived`
- `_upl_published`, `_mhb_published`, `_app_published`

**Issue:** This creates:
1. Data redundancy
2. Complex cascading logic
3. Confusion about which level to check
4. 3x storage overhead

**Recommendation:** Use single soft delete field with status enum instead:
```sql
deleted_level ENUM('none', 'user', 'admin', 'platform') DEFAULT 'none'
```

---

### 🟡 WARNING: UI Component Overreach

**Problem:** Plan proposes creating new UI components:
- "TrashPanel UI component"
- "RestoreConfirmDialog"
- "PermanentDeleteDialog"

**Reality:** Existing components can be reused:
- `ConfirmDeleteDialog` - already exists in `@universo/template-mui`
- `BlockingEntitiesDeleteDialog` - already handles dependency checks
- Action patterns via `ActionDescriptor` - already standardized

**Recommendation:** Extend existing dialogs with new action types, don't create new components.

---

## 2. Existing Patterns to Align With

### 2.1 Soft Delete Pattern (from spaces-backend)

```typescript
// CORRECT pattern - already in codebase
@Column({ name: 'is_deleted', default: false })
isDeleted!: boolean

@Column({ name: 'deleted_date', type: 'timestamptz', nullable: true })
deletedDate?: Date

@Column({ name: 'deleted_by', type: 'uuid', nullable: true })
deletedBy?: string
```

### 2.2 Timestamp Pattern

```typescript
// CORRECT pattern - metahubs, applications use this
@CreateDateColumn({ name: 'created_at' })
createdAt!: Date

@UpdateDateColumn({ name: 'updated_at' })
updatedAt!: Date
```

### 2.3 Boolean Flag Pattern

```typescript
// CORRECT pattern - use is_ prefix
@Column({ name: 'is_public', default: false })
isPublic!: boolean

@Column({ name: 'is_active', default: true })
isActive!: boolean
```

### 2.4 Action Pattern (from template-mui)

```typescript
// CORRECT pattern - use existing ActionDescriptor
const actions: ActionDescriptor[] = [
  {
    id: 'moveToTrash',  // NEW action type
    labelKey: 'common:actions.moveToTrash',
    icon: <DeleteIcon />,
    order: 90,
    group: 'danger',
    dialog: {
      loader: async () => {
        // Reuse existing ConfirmDeleteDialog
        const module = await import('@universo/template-mui/components/dialogs')
        return { default: module.ConfirmDeleteDialog }
      }
    }
  }
]
```

---

## 3. Revised Field Specification

### 3.1 MVP Field Set (Recommended)

**For ALL entities (static and dynamic):**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `UUID` | `uuid_generate_v7()` | Primary key |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `created_by` | `UUID` | - | Creator user ID |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Update timestamp |
| `updated_by` | `UUID` | - | Updater user ID |
| `version` | `INTEGER` | `1` | Optimistic locking |
| `is_deleted` | `BOOLEAN` | `false` | Soft delete flag |
| `deleted_at` | `TIMESTAMPTZ` | - | Deletion timestamp |
| `deleted_by` | `UUID` | - | Deleter user ID |

**Total: 9 fields** (vs 39 in original plan)

### 3.2 Additional Fields for Dynamic Tables Only

For `_mhb_objects`, `_mhb_attributes`, `_mhb_elements` and application tables:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `is_published` | `BOOLEAN` | `true` | Publication status |
| `published_at` | `TIMESTAMPTZ` | - | When published |
| `published_by` | `UUID` | - | Who published |
| `sort_order` | `INTEGER` | `0` | Display order |
| `owner_id` | `UUID` | - | Record owner (for RLS) |

**Total for dynamic tables: 14 fields**

---

## 4. Architecture Recommendations

### 4.1 Single Soft Delete Level

Instead of three deletion levels, use a single level with recovery tiers:

```
User deletes → is_deleted = true, deleted_at = now()
         ↓
  Visible in Trash for 30 days (configurable)
         ↓
  After 30 days: permanently deleted OR
  Admin can restore at any time
```

**Rationale:** The three-level cascade (`_app_` → `_mhb_` → `_upl_`) adds complexity without clear user benefit. Most users don't need platform-level recovery.

### 4.2 Keep "Archived" for Phase 2

Don't implement archiving now. Add it when there's an actual feature request.

### 4.3 Keep "Locked" for Phase 3

Account locking is an admin feature that can be added later via a separate entity (`account_locks` table) rather than per-record fields.

---

## 5. Files to Modify (Revised)

### Phase 1: Core Soft Delete

| File | Change |
|------|--------|
| `1766351182000-CreateMetahubsSchema.ts` | Add `created_by`, `updated_by`, `version`, `is_deleted`, `deleted_at`, `deleted_by` |
| `1800000000000-CreateApplicationsSchema.ts` | Same as above |
| `MetahubSchemaService.ts` (lines 230-285) | Add same fields to dynamic tables |
| Existing TypeORM entities (9 files) | Add new column decorators |

### Phase 2: Service Layer

| File | Change |
|------|--------|
| `MetahubObjectsService.ts` | Replace `.delete()` with soft delete |
| `MetahubAttributesService.ts` | Same |
| `MetahubElementsService.ts` | Same |
| `MetahubHubsService.ts` | Same |

### Phase 3: API Routes

| File | Change |
|------|--------|
| `catalogsRoutes.ts` | Add `/trash` and `/restore` endpoints |
| `elementsRoutes.ts` | Same |
| `hubsRoutes.ts` | Same |

### Phase 4: Frontend (Minimal)

| File | Change |
|------|--------|
| Existing `*Actions.tsx` | Add 'moveToTrash' and 'restore' action descriptors |
| Reuse `ConfirmDeleteDialog` | Update confirmation text for trash |
| i18n files | Add translation keys |

**NO new UI components needed** — reuse existing dialog patterns.

---

## 6. Summary of Changes Required

| Aspect | Original Plan | Revised Recommendation |
|--------|---------------|------------------------|
| **Field prefixes** | `_upl_`, `_mhb_`, `_app_` | No prefixes, use standard names |
| **Total fields** | 39 per record | 9-14 per record |
| **Deletion levels** | 3 cascading levels | 1 level with time-based purge |
| **Archiving** | Included | Defer to Phase 2 |
| **Locking** | Included | Defer to Phase 3 |
| **New UI components** | 3+ new dialogs | Reuse existing dialogs |
| **Complexity** | High | Medium |

---

## 7. QA Verdict

| Criterion | Status |
|-----------|--------|
| Aligns with existing naming conventions | ❌ FAIL |
| Reuses existing UI components | ❌ FAIL |
| Follows YAGNI principle | ❌ FAIL |
| Matches existing soft delete pattern | ❌ FAIL |
| Appropriate scope for MVP | ❌ FAIL |

**Recommendation:** Revise plan to align with existing codebase patterns before implementation.

---

## 8. Next Steps

1. **Update plan** with revised field specification
2. **Remove** prefix naming (`_upl_`, `_mhb_`, `_app_`)
3. **Reduce** field count to MVP set
4. **Align** with spaces-backend soft delete pattern
5. **Reuse** existing UI components via ActionDescriptor pattern
6. **Defer** archiving and locking features to future phases
