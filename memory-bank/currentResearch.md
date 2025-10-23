# Current Research: Publication Links MVP Analysis

**Date**: 2025-10-06
**Status**: Planning Phase
**Goal**: Finalize publication links system with slug-based URLs

## Current Implementation Status

### ✅ Already Implemented (PR #475)

1. **Database Schema** (`uniks.publish_canvases`)
   - Migration: `1742000000000-CreatePublishCanvases.ts`
   - Entity: `PublishCanvas` with all required fields
   - Base58 slug generation via `bs58` library
   - Custom slug support with sanitization
   - Version group and specific version targeting

2. **Backend Services**
   - `PublishLinkService`: Full CRUD operations
   - `FlowDataService.getFlowDataBySlug()`: Slug resolution
   - Automatic group link creation via `ensureGroupLinkForCanvas()`
   - Transaction-safe slug generation with collision detection

3. **Frontend Routes**
   - `PublicFlowView` component with slug parameter
   - Routes: `/p/:slug` and `/b/:slug` in `MainRoutes.jsx`
   - Universal dispatcher for AR.js and PlayCanvas

### ❌ Current Issues

1. **Migration Order Problem**
   - `CreatePublishCanvases` (timestamp 1742000000000) runs BEFORE `SpacesCore` (1743000000000)
   - FK constraint `publish_canvases.space_id → spaces.id` fails because `spaces` table doesn't exist yet
   - Error: `relation "spaces" does not exist`

2. **Missing Frontend Integration**
   - No UI for creating/managing publication links
   - No slug display in publishers (ARJSPublisher, PlayCanvasPublisher)
   - No link management interface

3. **UUID Fallback Still Present**
   - `FlowDataService` has UUID fallback in `getPublicARJSPublication`
   - Should be removed to enforce slug-only access

## Technical Analysis

### Nanoid vs BS58

**Current**: Using `bs58` library with `crypto.randomBytes()`
**Alternative**: `nanoid` with custom Base58 alphabet

```typescript
// Current implementation (bs58)
import bs58 from 'bs58'
const bytes = randomBytes(Math.ceil(12 * 0.8))
const slug = bs58.encode(bytes).slice(0, 12)

// Alternative (nanoid)
import { customAlphabet } from 'nanoid'
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const nanoid = customAlphabet(BASE58_ALPHABET, 12)
const slug = nanoid()
```

**Recommendation**: Keep `bs58` - already implemented, tested, and working. No need to change.

### Migration Order Fix Options

**Option 1: Change Timestamp** (Recommended)
- Rename migration to `1744000000000-CreatePublishCanvases.ts`
- Update class name and imports
- Ensures execution after all spaces migrations

**Option 2: Make FK Optional**
- Wrap FK creation in try-catch like `SpacesCore` does
- Less clean but preserves timestamp

**Option 3: Remove FK**
- Only if space relationship is not critical
- Not recommended - breaks referential integrity

## Recommended MVP Plan

### Phase 1: Fix Migration Order (Immediate)
1. Rename migration file and class to timestamp `1744000000000`
2. Update import in `packages/publish-srv/base/src/database/migrations/postgres/index.ts`
3. Drop and recreate Supabase database (test environment)
4. Verify migrations run in correct order

### Phase 2: Remove UUID Fallbacks (Quick Win)
1. Remove UUID fallback from `FlowDataService.getPublicARJSPublication`
2. Remove UUID fallback from streaming endpoint
3. Update error messages to guide users to slug-based URLs
4. Test that only slug-based access works

### Phase 3: Frontend Integration (Core MVP)
1. Update `ARJSPublisher` to display both base and custom slugs
2. Update `PlayCanvasPublisher` similarly
3. Add slug management UI (view, copy, edit custom slug)
4. Show publication status and link preview

### Phase 4: Documentation & Testing
1. Update README files (EN/RU) with slug-based URL examples
2. Add i18n keys for publication links UI
3. Test full flow: create space → publish → access via slug
4. Verify version switching updates group links correctly

## Key Decisions

### 1. Slug Generation Strategy
**Decision**: Keep current `bs58` implementation
**Rationale**: Already working, cryptographically secure, no migration needed

### 2. UUID Access
**Decision**: Remove completely (slug-only)
**Rationale**: Cleaner architecture, forces proper publication workflow

### 3. Custom Slugs
**Decision**: Optional feature, base slug always available
**Rationale**: Matches Miro/Figma patterns, user-friendly for sharing

### 4. Migration Timestamp
**Decision**: Change to 1744000000000
**Rationale**: Simplest fix, no legacy data to migrate

## Next Steps

1. **Immediate**: Fix migration order issue
2. **Short-term**: Remove UUID fallbacks and test
3. **Medium-term**: Build frontend UI for link management
4. **Long-term**: Add analytics, QR codes, custom domains

## References

- PR #475: Initial publication links implementation
- Nanoid docs: Custom alphabet support
- Miro URL pattern: `https://miro.com/app/board/uXjVJBOe7Vk=/`
- Current routes: `/p/:slug` and `/b/:slug` already configured
