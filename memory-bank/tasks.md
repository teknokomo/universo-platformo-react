# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## 🔥 ACTIVE TASKS

### Flowise 3.0.12 Full Package Replacement (Branch: feature/flowise-3.0.12-full-replacement)

- [x] Create branch from main, backup old package as flowise-components-2.2.8-backup
- [x] Copy new Flowise 3.0.12 components from .backup/Flowise-flowise-3.0.12/packages/components
- [x] Adapt build system (tsdown, remove gulpfile, update package.json)
- [x] Adapt source code (add missing bufferToUint8Array, add type annotation to getGcsClient)
- [x] Convert module.exports to ESM exports (106 credentials + 310 nodes)
- [x] Update CanvasType enum (add AGENTFLOW)
- [x] Build flowise-components package successfully
- [x] Update IServerSideEventStreamer implementations (8 new methods for AgentFlow + TTS)
- [x] Update storage function return types (addBase64FilesToStorage, addArrayFilesToStorage, removeFolderFromStorage)
- [x] Update streamStorageFile calls (add orgId parameter)
- [x] Full project build - SUCCESS (54 tasks)
- [x] Fix rolldown circular dependency issue (pin rolldown 1.0.0-beta.43 via pnpm.overrides)
- [x] Fix customtemplates-frontend dts generation (disable dts for JSON re-exports)

#### TSC Build Fix (Flowise 3.0.12 components)


- [x] Align root-level pnpm overrides/resolutions with Flowise 3.0.12 requirements (openai/@langchain/*)
	- Note: Current root pins force older versions (e.g., openai 4.82.0, @langchain/core 0.3.37, @langchain/openai 0.4.4) which breaks Flowise 3.0.12 types.
- [x] Revert tsdown/rolldown-only type hacks that break tsc (e.g., getGcsClient return type with missing Bucket)
- [x] Re-run `pnpm install` and rebuild `flowise-components` with `tsc && gulp`
- [ ] Fix `@flowise/core-backend` build errors introduced by OpenAI SDK vector stores API changes
    - Note: `openai.beta.vectorStores` no longer exists in openai >= 4.96; update code to `openai.vectorStores` and adjust types.
- [ ] Fix `buildCanvasFlow` follow-up prompts typing (Flowise components typing currently returns `{}`)
- [ ] Full workspace rebuild (`pnpm build`) to validate cross-package compatibility

#### AgentFlow Icons Fix (Flowise 3.0.12)

- [x] Investigate 500 errors for AgentFlow node icons
    - Root cause: AgentFlow nodes don't have icon files; they use built-in @tabler/icons-react components defined in AGENTFLOW_ICONS constant
- [x] Add AGENTFLOW_ICONS constant to flowise-template-mui/constants.ts
- [x] Update agentflows/index.jsx to use AGENTFLOW_ICONS for built-in icons instead of API calls
- [x] Update ItemCard component to support icons prop (React components)
- [x] Update FlowListTable component to support icons prop
- [x] Upgrade @tabler/icons-react from ^2.32.0 to ^3.30.0 in flowise-template-mui

##### Follow-up: Apply upstream AgentFlow icon rendering in spaces-frontend

- [x] Patch AgentFlow icons in spaces-frontend canvas palette (AddNodes)
    - Done: Added renderNodeIcon() helper using AGENTFLOW_ICONS.find() with upstream rule `node.color && !node.icon`
- [x] Patch AgentFlow icons in spaces-frontend canvas node renderer (CanvasNode)
    - Done: Same renderNodeIcon pattern applied
- [x] Patch AgentFlow icons in spaces-frontend agentflows list previews
    - Done: buildImageMap returns {images, icons}, ItemCard/FlowListTable receive icons prop
- [x] Patch AgentFlow icons in spaces-frontend canvases and spaces list previews
    - Done: Same pattern applied to canvases/index.jsx and spaces/index.jsx
- [x] Patch NodeInfoDialog to render AgentFlow icons
    - Done: Added conditional Tabler icon rendering
- [x] Fix backend global error handler to respect `statusCode` (avoid masking 404 as 500)
    - Done: Updated routes/index.ts error handler
- [x] Full workspace rebuild (`pnpm build`) and package lints for touched packages
    - Done: Build successful (54 tasks, ~5m23s)

- [x] Runtime testing (pnpm start)
    - Done: AgentFlow icons display correctly on canvas, palette, and lists

- [x] Cleanup and documentation
    - Done: Removed flowise-components-2.2.8-backup (20MB), updated Memory Bank
- [x] Commit changes to branch
    - Done: Changes committed and pushed to feature/flowise-3.0.12-full-replacement

### Memory Bank Maintenance

- [x] Fixed TypeScript ESLint compatibility warning (upgraded to v8.x)
- [ ] Review and update Memory Bank files monthly
- [ ] Archive old progress entries (>6 months) when files exceed limits
- [ ] Update version table in progress.md when new releases published

---

## 📋 PLANNED FEATURES (Backlog)

### Admin Module Enhancements

- [ ] Implement role cloning feature (duplicate existing role)
- [ ] Add role templates (predefined permission sets)
- [ ] Implement permission inheritance system
- [ ] Add audit log for role/permission changes
- [ ] Multi-instance support (remote instances management)

### RBAC System Improvements

- [ ] Implement ABAC conditions system (time-based, IP-based, resource-based)
- [ ] Add permission testing UI (simulate user permissions)
- [ ] Implement permission delegation (temporary access grants)
- [ ] Add custom permission subjects via UI

### Frontend UX

- [ ] Implement dark mode theme
- [ ] Add keyboard shortcuts system
- [ ] Improve mobile responsiveness
- [ ] Add tour/onboarding system for new users

### Performance Optimization

- [ ] Implement server-side caching strategy
- [ ] Add CDN integration for static assets
- [ ] Optimize bundle size (code splitting)
- [ ] Database query optimization audit

### Documentation

- [ ] Complete API documentation (OpenAPI specs)
- [ ] Add architecture decision records (ADR)
- [ ] Create video tutorials for key features
- [ ] Write migration guide for breaking changes

---

## 🧪 TECHNICAL DEBT

### Code Quality

- [ ] Refactor remaining useApi usages → useMutation pattern
- [ ] Standardize error handling across all packages
- [ ] Add unit tests for critical business logic
- [ ] Add E2E tests for key user flows

### Architecture Cleanup

- [ ] Resolve Template MUI CommonJS/ESM conflict (extract to @universo package)
- [ ] Audit and remove unused dependencies
- [ ] Consolidate duplicate utility functions
- [ ] Standardize TypeScript strict mode across all packages

### Database

- [ ] Add database connection pooling optimization
- [ ] Implement database backup automation
- [ ] Add migration rollback testing
- [ ] Optimize RLS policies performance

---

## 🔒 SECURITY TASKS

- [ ] Implement rate limiting for all API endpoints
- [ ] Add CSRF protection
- [ ] Implement API key rotation mechanism
- [ ] Add security headers (HSTS, CSP, etc.)
- [ ] Conduct security audit
- [ ] Implement 2FA/MFA system

---

## ✅ RECENTLY COMPLETED (Last 30 Days)

**For detailed completion history, see progress.md**

### December 2025
- ✅ VLC→LocalizedContent rename refactoring (2025-12-15) - Renamed VLC terminology to Localized Content across types, utils, API
- ✅ Dynamic Locales System (2025-12-14) - Database-driven locale management for VLC
- ✅ Legacy code cleanup (2025-12-10)
- ✅ Global roles access implementation (2025-12-09)
- ✅ CASL standard compliance refactoring (2025-12-08)
- ✅ RBAC architecture cleanup (2025-12-07)
- ✅ Roles UI unification (2025-12-07)
- ✅ Admin Instances module MVP (2025-12-06)
- ✅ Dynamic global roles system (2025-12-05)
- ✅ User settings system (2025-12-04)
- ✅ Admin packages creation (2025-12-03)

### November 2025
- ✅ Campaigns integration (2025-11-26)
- ✅ Storages management (2025-11-25)
- ✅ Organizations module (2025-11-22)
- ✅ Projects management system (2025-11-18)
- ✅ Uniks module expansion (2025-11-13)

---

## 📊 PROJECT STATISTICS

**Current Package Count**: 52 packages

**Build Performance**: ~4-6 minutes (full workspace)

**Test Coverage**: TBD (tests not yet comprehensive)

---

## 🎯 ROADMAP (Tentative)

### Q1 2025
- [x] Admin module with RBAC
- [x] Global roles system
- [ ] Role-based UI customization
- [ ] Multi-tenancy support

### Q2 2025
- [ ] ABAC conditions implementation
- [ ] Advanced permission testing
- [ ] Performance optimization sprint
- [ ] Security audit & hardening

### Q3 2025
- [ ] Mobile app development
- [ ] Real-time collaboration features
- [ ] Advanced analytics dashboard
- [ ] Plugin/extension system

### Q4 2025
- [ ] AI-powered features
- [ ] Advanced automation workflows
- [ ] Enterprise features (SSO, LDAP)
- [ ] Compliance certifications (SOC 2, ISO 27001)

---

**Last Updated**: 2025-12-14

**Note**: For implementation details → progress.md. For patterns → systemPatterns.md.
