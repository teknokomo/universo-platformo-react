# LMS MVP Implementation Plan

## Context

The platform has a mature metahub/entity system for building data-driven applications. Metahubs define catalogs, hubs, sets, enumerations, scripts, and layouts. Applications are created from metahubs via connectors, with PostgreSQL schema generated dynamically. The workspace system exists at the database level (`_app_workspaces`, `_app_workspace_roles`, `_app_workspace_user_roles`, `_app_limits`) with RLS policies and per-user personal workspaces, but **has no frontend UI**.

The goal is to build an LMS (Learning Management System) MVP entirely as metahub configuration data, not hardcoded in platform packages. The LMS must support: classes (student groups), learning modules, quizzes, guest access via direct links/QR codes, and basic statistics.

**Key constraint**: test DB will be recreated, no legacy code preservation needed, significant refactoring allowed, no schema version bumps.

---

## QA Findings (Critical Corrections)

### 1. TABLE fields do NOT support nesting
`TABLE_CHILD_DATA_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON']` — no TABLE inside TABLE.
**Impact**: Quiz questions with nested options TABLE is impossible. Options must be stored as JSON array within each question row.

### 2. Widget keys are predefined in types
`DASHBOARD_LAYOUT_WIDGETS` in `packages/universo-types/base/src/common/metahubs.ts` defines all valid widget keys. New LMS widget keys must be ADDED to this array.

### 3. REF fields cannot target hub entities
Only catalog, set, enumeration are valid REF targets. Module references via hub IDs must use STRING type.

### 4. `workspacesEnabled` is on the application table
Not a template setting — controlled at application creation time.

### 5. Existing components MUST be reused
- `FormDialog.tsx` (1,322 lines) handles all field types — reuse for all LMS forms
- `useCrudDashboard` hook + `EmployeeList` pattern — reuse for class/student management
- API functions (`fetchAppRow`, `createAppRow`, `useAppRow`, `useCreateAppRow`) — reuse directly
- `QuizWidget.tsx` already works for quizzes — reuse as-is or extend minimally
- Entity presets (`tree-entity`, `linked-collection`, `value-group`, `option-list`) available for template

### 6. No existing public/guest access infrastructure
Must be built from scratch, but follow existing auth middleware patterns.

---

## Phase 0: Workspace UI Foundation

Expose the existing workspace database infrastructure as user-facing UI in the apps template.

### 0.1 Backend: Runtime Workspace API

**Create** `packages/applications-backend/base/src/controllers/runtimeWorkspaceController.ts`
- `GET /applications/:applicationId/runtime/workspaces` — list current user's workspaces
- `POST /applications/:applicationId/runtime/workspaces` — create workspace (type: 'shared')
- `PATCH /applications/:applicationId/runtime/workspaces/:workspaceId/default` — set default workspace
- `POST /applications/:applicationId/runtime/workspaces/:workspaceId/members` — invite member (by userId)
- `DELETE /applications/:applicationId/runtime/workspaces/:workspaceId/members/:userId` — remove member

**Create** `packages/applications-backend/base/src/services/runtimeWorkspaceService.ts`
- Extract reusable query functions from existing `applicationWorkspaces.ts`:
  - `listUserWorkspaces(executor, schemaName, userId)`
  - `createSharedWorkspace(executor, schemaName, input)`
  - `setDefaultWorkspace(executor, schemaName, userId, workspaceId)`
  - `addWorkspaceMember(executor, schemaName, workspaceId, userId, roleCodename)`
  - `removeWorkspaceMember(executor, schemaName, workspaceId, userId)`
- Reuse existing `qSchemaTable`, `qColumn` from `@universo/database` for SQL identifiers
- Reuse existing parameterized query patterns from `applicationWorkspaces.ts`

**Modify** `packages/applications-backend/base/src/routes/index.ts` — register workspace routes
**Modify** `packages/applications-backend/base/src/shared/runtimeHelpers.ts` — expose workspace info in runtime GET response

### 0.2 Frontend: Workspace Components

**Create** `packages/apps-template-mui/src/dashboard/components/WorkspaceSwitcher.tsx`
- Reuse `SelectContent.tsx` pattern from existing dashboard (Mui Select with avatar)
- Dropdown in `AppNavbar.tsx` showing current workspace name
- On change: PATCH default workspace, invalidate TanStack Query cache
- Only rendered when `workspacesEnabled` is true and workspace context exists

**Create** `packages/apps-template-mui/src/dashboard/components/WorkspaceManagerDialog.tsx`
- Reuse existing `FormDialog.tsx` pattern for workspace creation form
- Reuse existing `ConfirmDeleteDialog.tsx` for member removal confirmation
- Member list with role badges (owner/member) — reuse MUI Chip component
- Use `useMutation` + optimistic updates pattern (same as existing CRUD patterns)

**Modify** `packages/apps-template-mui/src/dashboard/components/AppNavbar.tsx` — add `WorkspaceSwitcher`
**Modify** `packages/apps-template-mui/src/dashboard/DashboardDetailsContext.tsx` — add workspace fields to context

### 0.3 i18n for Workspace UI

**Modify** `packages/apps-template-mui/src/i18n/locales/en/apps.json` and `.../ru/apps.json`:
- `workspace.title`, `workspace.switch`, `workspace.create`, `workspace.invite`, `workspace.members`, `workspace.personal`, `workspace.roleOwner`, `workspace.roleMember`, `workspace.limitReached`, etc.

### 0.4 Verification

- **Unit tests** (Vitest): `runtimeWorkspaceService.test.ts` — CRUD with mock executor (follow `applicationWorkspaces.test.ts` pattern)
- **Component tests**: `WorkspaceSwitcher.test.tsx` — renders list, fires mutation
- **E2E** (Playwright): Open workspace-enabled app → see workspace selector → switch workspace → verify data isolation
- **Screenshots**: workspace selector, workspace manager dialog

---

## Phase 1: LMS Metahub Entity Design

Define the exact metahub entity structure for the LMS. All LMS logic is data (entities, fields, scripts) — no hardcoded LMS code in platform packages.

### 1.1 LMS Template File

**Create** `packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts`
- Follow pattern from `basic.template.ts` (uses `vlc()` helper, `MetahubTemplateManifest`)
- Reuse entity presets from `standardEntityTypeDefinitions.ts` where applicable
- Register in `packages/metahubs-backend/base/src/domains/templates/data/index.ts`

### 1.2 Entity Structure (Corrected for TABLE Constraints)

```
LMS Metahub
├── Hub: "Learning" (tree container for modules, nested hubs at runtime)
│
├── Catalog: "classes" (student groups)
│   ├── name: STRING (required, VLC, display)
│   ├── description: STRING (optional, VLC)
│   ├── school_year: STRING (optional)
│   └── student_count_limit: NUMBER (optional)
│
├── Catalog: "students" (registered + guest)
│   ├── display_name: STRING (required, display)
│   ├── email: STRING (optional)
│   ├── is_guest: BOOLEAN (default: false)
│   └── guest_session_token: STRING (optional)
│
├── Catalog: "enrollments" (class↔student↔module bridge)
│   ├── student_id: REF → students (required)
│   ├── class_id: REF → classes (required)
│   ├── module_id: STRING (hub ID, required — REF cannot target hubs)
│   ├── status: REF → enrollment_status (required)
│   ├── enrolled_at: DATE (required)
│   ├── completed_at: DATE (optional)
│   └── score: NUMBER (optional)
│
├── Catalog: "modules" (learning content)
│   ├── title: STRING (required, VLC, display)
│   ├── description: STRING (optional, VLC)
│   ├── status: REF → module_status (required)
│   ├── cover_image_url: STRING (optional)
│   ├── estimated_duration_minutes: NUMBER (optional)
│   ├── access_link_slug: STRING (optional)
│   └── content_items: TABLE (child fields — NOT nested TABLE)
│       ├── item_type: REF → content_type (required)
│       ├── item_title: STRING (VLC, optional)
│       ├── item_content: STRING (VLC, optional — markdown/URL)
│       ├── quiz_id: STRING (UUID of quiz record, optional)
│       └── sort_order: NUMBER
│
├── Catalog: "quizzes"
│   ├── title: STRING (required, VLC, display)
│   ├── description: STRING (optional, VLC)
│   ├── passing_score_percent: NUMBER (optional, default 70)
│   ├── max_attempts: NUMBER (optional)
│   └── questions: TABLE (child fields — options stored as JSON)
│       ├── prompt: STRING (VLC, required)
│       ├── description: STRING (VLC, optional)
│       ├── question_type: REF → question_type (required)
│       ├── difficulty: NUMBER (optional)
│       ├── explanation: STRING (VLC, optional)
│       ├── options: JSON (array of {id, label_VLC, is_correct})  ← NOT nested TABLE
│       └── sort_order: NUMBER
│
├── Catalog: "quiz_responses"
│   ├── student_id: REF → students (required)
│   ├── quiz_id: REF → quizzes (required)
│   ├── question_id: STRING (required — UUID of question within quiz TABLE)
│   ├── selected_option_ids: JSON (array of option IDs)
│   ├── is_correct: BOOLEAN
│   ├── attempt_number: NUMBER
│   └── submitted_at: DATE
│
├── Catalog: "module_progress"
│   ├── student_id: REF → students (required)
│   ├── module_id: REF → modules (required)
│   ├── status: STRING (not_started/in_progress/completed)
│   ├── progress_percent: NUMBER (0-100)
│   ├── started_at: DATE (optional)
│   ├── completed_at: DATE (optional)
│   └── last_accessed_item_index: NUMBER (optional)
│
├── Catalog: "access_links"
│   ├── slug: STRING (required, unique)
│   ├── target_type: STRING (module/quiz, required)
│   ├── target_id: STRING (UUID, required)
│   ├── class_id: REF → classes (optional)
│   ├── is_active: BOOLEAN (default true)
│   ├── expires_at: DATE (optional)
│   ├── max_uses: NUMBER (optional)
│   ├── use_count: NUMBER (default 0)
│   └── title: STRING (VLC, optional)
│
├── Enumeration: "module_status" — draft/published/archived (EN/RU)
├── Enumeration: "enrollment_status" — invited/active/completed/dropped (EN/RU)
├── Enumeration: "question_type" — single_choice/multiple_choice (EN/RU)
├── Enumeration: "content_type" — text/image/video_url/quiz_ref (EN/RU)
│
└── Scripts (3 ExtensionScript classes, see Phase 1.3)
```

**Critical design note**: Quiz options are stored as JSON field within each question TABLE row, not as a nested TABLE. This is because `TABLE_CHILD_DATA_TYPES` does not include TABLE, so nesting is impossible. The script serializes/deserializes options from JSON.

### 1.3 Scripts (ExtensionScript with @AtClient/@AtServer)

**Script "lms-module-viewer"** (widget, attachedToKind: metahub, capabilities: rpc.client):
```javascript
class LmsModuleViewer extends ExtensionScript {
    @AtServer()
    async getModule(payload) { /* reads module + content_items from catalog */ }
    @AtServer()
    async updateProgress(payload) { /* updates module_progress */ }
    @AtClient()
    async mount(locale) { return this.ctx.callServerMethod('getModule', [{ locale }]) }
}
```

**Script "lms-quiz-runner"** (widget, attachedToKind: metahub, capabilities: rpc.client):
```javascript
class LmsQuizRunner extends ExtensionScript {
    @AtServer()
    async getQuiz(payload) { /* reads quiz + questions, no correct answers to client */ }
    @AtServer()
    async submit(payload) { /* validates, records quiz_response, returns score */ }
    @AtClient()
    async mount(locale) { return this.ctx.callServerMethod('getQuiz', [{ locale }]) }
}
```

**Script "lms-stats-viewer"** (widget, attachedToKind: metahub, capabilities: rpc.client):
```javascript
class LmsStatsViewer extends ExtensionScript {
    @AtServer()
    async getStats(payload) { /* aggregates module_progress + quiz_responses */ }
    @AtClient()
    async mount(locale) { return this.ctx.callServerMethod('getStats', [{ locale }]) }
}
```

### 1.4 Template Layout

- Layout: dashboard with left menu bound to "Learning" hub (reuse `buildBasicMinimalSeedZoneWidgets()` pattern)
- Center zone: `moduleViewerWidget` (primary widget)
- Settings: same as basic template (codename style, language, etc.)
- Application must be created with `workspacesEnabled: true`

### 1.5 Verification

- **Unit test**: `lmsTemplate.test.ts` — validate template structure, all codenames are VLC objects, all enumerations have EN/RU
- **E2E test**: Import LMS metahub snapshot → publish → verify all entities appear in app runtime
- **E2E test**: Create class → add students → verify CRUD for all catalogs

---

## Phase 2: Platform Enhancements

### 2A. Type Extensions for New Widgets

**Modify** `packages/universo-types/base/src/common/metahubs.ts`
- Add new entries to `DASHBOARD_LAYOUT_WIDGETS` array (around line 797):
  ```typescript
  { key: 'moduleViewerWidget', allowedZones: ['center'] as const, multiInstance: false },
  { key: 'statsViewerWidget', allowedZones: ['center', 'right'] as const, multiInstance: false },
  { key: 'qrCodeWidget', allowedZones: ['center', 'right'] as const, multiInstance: true },
  ```
- Add config interfaces: `ModuleViewerWidgetConfig`, `StatsViewerWidgetConfig`, `QRCodeWidgetConfig`

### 2B. New Widget Components

**Create** `packages/apps-template-mui/src/dashboard/components/ModuleViewerWidget.tsx`
- Follow exact `QuizWidget.tsx` architecture: fetch scripts → load client bundle → call mount() → render
- Use same `fetchRuntimeScripts`, `callRuntimeScriptMethod`, `createClientScriptContext` helpers
- Renders content items: text (rendered as Typography), images (Card with img), video embeds, quiz references
- When content_item type = quiz_ref → renders existing `QuizWidget` component inline
- Progress bar (MUI LinearProgress) showing completion percentage
- Previous/next navigation between content items

**Create** `packages/apps-template-mui/src/dashboard/components/StatsViewerWidget.tsx`
- Same script-driven pattern as QuizWidget
- Displays completion rate cards (reuse `StatCard.tsx` from existing dashboard)
- MUI X Charts for bar charts (already in dependencies via `@mui/x-charts`)
- Aggregates data via `lms-stats-viewer` script RPC

**Create** `packages/apps-template-mui/src/dashboard/components/QRCodeWidget.tsx`
- Lightweight component: receives URL from widget config
- Uses `qrcode` npm package for client-side SVG generation
- "Copy link" button (reuse existing snackbar notification pattern)
- Config: `{ url: string, size: number, title: VLC }`

**Modify** `packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx`
- Add cases after existing `case 'quizWidget':` at line 121:
  ```typescript
  case 'moduleViewerWidget':
      return <ModuleViewerWidget key={widget.id} config={widget.config} />
  case 'statsViewerWidget':
      return <StatsViewerWidget key={widget.id} config={widget.config} />
  case 'qrCodeWidget':
      return <QRCodeWidget key={widget.id} config={widget.config} />
  ```

### 2C. Guest/Anonymous Access

**Create** `packages/applications-backend/base/src/shared/publicRuntimeAccess.ts`
- `resolvePublicRuntimeSchema(executor, input)` — variant of `resolveRuntimeSchema` WITHOUT userId requirement
- Validates application exists and has valid published schema
- Sets workspace context to null
- Restricts access to specific catalogs only (modules, quizzes — not student lists)
- Uses existing `getPoolExecutor()` pattern

**Create** `packages/applications-backend/base/src/controllers/runtimeGuestController.ts`
- `GET /public/a/:applicationId/links/:slug` — resolve access link by slug
- `POST /public/a/:applicationId/guest-session` — create guest student record
  - Body: `{ displayName: string, accessLinkId?: string }`
  - Returns: `{ studentId: string, sessionToken: string }`
- `GET /public/a/:applicationId/runtime` — read-only runtime data for guest
- `POST /public/a/:applicationId/runtime/guest-submit` — submit quiz response as guest

**Modify** `packages/applications-backend/base/src/routes/index.ts`
- Register public routes WITHOUT `ensureAuth` middleware
- Apply rate limiting using existing `@universo/utils` rate-limiting helpers

**Create** `packages/apps-template-mui/src/standalone/GuestApp.tsx`
- Minimal layout: no workspace switcher, no member management
- Name entry form on first visit → creates guest session
- Renders `ModuleViewerWidget` or `QuizWidget` based on access link target
- Stores guest session token in localStorage
- Reuse existing MUI components (TextField, Button, Card)

**Modify** `packages/apps-template-mui/src/routes/createAppRoutes.tsx`
- Add route for `/public/a/:applicationId/links/:slug` → renders `GuestApp`
- No auth guard on this route

### 2D. QR Code Utility

**Add** `qrcode` to `pnpm-workspace.yaml` catalog (lightweight, pure JS, no canvas dependency)

### 2.5 Verification

- **Unit test**: `publicRuntimeAccess.test.ts` — anonymous access to public app allowed, private app denied
- **Unit test**: `runtimeGuestController.test.ts` — guest session creation, access link resolution
- **Component test**: `ModuleViewerWidget.test.tsx` — renders content items, navigation works
- **Component test**: `GuestApp.test.tsx` — name entry, module rendering
- **E2E test**: Open access link without login → name entry → module content → quiz → completion
- **Screenshots**: module viewer, guest name form, QR code widget

---

## Phase 3: Quiz App Fixture Update

### 3.1 Update Quiz Fixture Contract

**Modify** `tools/testing/e2e/support/quizFixtureContract.ts`
- Ensure compatibility — the existing `SpaceQuizWidget` class stays unchanged
- The quiz app remains independent from LMS metahub (different metahub)
- Verify that quiz widget rendering works when embedded inside module viewer

### 3.2 Regenerate Quiz Fixture

- Run E2E generator to produce new `tools/fixtures/metahubs-quiz-app-snapshot.json`
- Verify import/export flow works
- The quiz app remains independent (not part of LMS metahub)

### 3.3 Create LMS Fixture

**Create** `tools/testing/e2e/support/lmsFixtureContract.ts`
- Define canonical LMS metahub structure for testing
- Sample class "Class A", module with 3 content items (text, image, quiz_ref), quiz with 3 questions
- Sample access link with slug "demo-module"
- Sample student records (registered + guest)
- Follow exact pattern from `quizFixtureContract.ts`

**Create** `tools/fixtures/metahubs-lms-app-snapshot.json` — generated via Playwright generator

### 3.4 Verification

- Existing quiz E2E tests pass unchanged
- LMS E2E test: Create module with quiz content item → open module → complete embedded quiz

---

## Phase 4: Testing Strategy

### 4.1 Unit Tests (Vitest)

| File | Tests |
|------|-------|
| `runtimeWorkspaceService.test.ts` | Workspace CRUD, member management, permission checks |
| `publicRuntimeAccess.test.ts` | Anonymous access allowed/denied scenarios |
| `lmsTemplate.test.ts` | Template structure validation, VLC codenames, enumerations |
| `WorkspaceSwitcher.test.tsx` | Renders list, fires mutation |
| `ModuleViewerWidget.test.tsx` | Renders content items, navigation |
| `StatsViewerWidget.test.tsx` | Renders charts with mock data |
| `GuestApp.test.tsx` | Name entry, module rendering |
| `QRCodeWidget.test.tsx` | Generates QR code, renders |

### 4.2 Playwright E2E Tests

| Spec | Coverage |
|------|----------|
| `lms-workspace-management.spec.ts` | Workspace switching, creation, member invite, data isolation |
| `lms-class-module-quiz.spec.ts` | Full LMS flow: create class → module → quiz → publish → complete |
| `lms-guest-access.spec.ts` | Access link → name entry → module → quiz → verify recorded |
| `lms-qr-code.spec.ts` | Generate QR → verify URL → follow → guest access |
| `lms-statistics.spec.ts` | Complete modules as students → verify stats dashboard |

### 4.3 Visual Regression Tests

- Screenshot workspace selector, workspace manager dialog
- Screenshot module viewer with content
- Screenshot quiz in module context
- Screenshot statistics dashboard
- Screenshot guest name entry form
- Screenshot QR code widget

### 4.4 Verification

- `pnpm --filter applications-backend test` — all backend unit tests pass
- `pnpm --filter apps-template-mui test` — all frontend unit tests pass
- `pnpm run test:e2e:full` — all E2E tests including LMS pass
- `pnpm build` — full workspace build passes

---

## Phase 5: Documentation

### 5.1 New Documentation Pages (EN/RU)

| Page | Content |
|------|---------|
| `docs/en/guides/lms-overview.md` | LMS concepts: classes, modules, quizzes, guest access |
| `docs/en/guides/lms-setup.md` | Step-by-step: create LMS metahub → configure → publish |
| `docs/en/guides/lms-guest-access.md` | Direct links, QR codes, guest data retention |
| `docs/en/guides/workspace-management.md` | Workspace concepts, creation, member management |
| `docs/en/architecture/lms-entities.md` | Entity relationship diagram, field definitions |

Mirror all in `docs/ru/`.

### 5.2 Update Existing Docs

- `docs/en/platform/workspaces.md` / `docs/ru/platform/workspaces.md` — update with workspace UI info
- `docs/en/guides/quiz-application-tutorial.md` — update for compatibility with LMS
- `docs/en/SUMMARY.md` / `docs/ru/SUMMARY.md` — add new pages to GitBook navigation
- Check ALL docs for outdated information (per requirement 5: "щепетильно проверить всю старую документацию")

### 5.3 Screenshots in Docs

- Use Playwright screenshot generators (following existing pattern in `docs-entity-screenshots.spec.ts`)
- All screenshots in both EN and RU locales
- Screenshots must reflect ACTUAL UI, not imagined

### 5.4 Update Memory Bank

- Update all memory-bank files per `.gemini/rules/memory-bank.md`

---

## Phase 6: Root-level README Updates

- Update root `README.md` with LMS section
- Update package READMEs as needed

---

## Execution Order

```
Phase 0 (Workspace UI) ──┐
                          ├─ Can run in parallel
Phase 1 (LMS Entities) ──┘
         │
Phase 2 (Platform Enhancements) ── depends on Phase 0 + Phase 1
         │
Phase 3 (Quiz Fixture) ── depends on Phase 1 + Phase 2
         │
Phase 4 (Testing) ── incremental, alongside each phase
         │
Phase 5 (Documentation) ── final phase
         │
Phase 6 (README) ── final
```

---

## Critical Reference Files

| File | Purpose |
|------|---------|
| `packages/applications-backend/base/src/services/applicationWorkspaces.ts` | All existing workspace SQL — foundation for Phase 0 backend |
| `packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx` | Widget dispatch — new LMS widgets must register here |
| `packages/apps-template-mui/src/dashboard/components/QuizWidget.tsx` | Reference widget pattern — new widgets follow this exactly |
| `packages/metahubs-backend/base/src/domains/templates/data/basic.template.ts` | Template pattern with `vlc()` helper |
| `packages/metahubs-backend/base/src/domains/templates/data/basic-demo.template.ts` | Demo template with full widgets |
| `packages/universo-types/base/src/common/metahubs.ts` | Widget key definitions (line 767-799), `TABLE_CHILD_DATA_TYPES` (line 747) |
| `tools/testing/e2e/support/quizFixtureContract.ts` | Quiz fixture contract — pattern for LMS fixture |
| `packages/applications-backend/base/src/shared/runtimeHelpers.ts` | Runtime schema resolution — extend with public access |
| `packages/apps-template-mui/src/dashboard/DashboardDetailsContext.tsx` | Dashboard context — add workspace fields |
| `packages/apps-template-mui/src/components/dialogs/FormDialog.tsx` | 1,322-line form dialog — reuse for all LMS forms |
| `packages/apps-template-mui/src/crud-dashboard/components/EmployeeList.tsx` | CRUD list pattern — reuse for class/student management |
| `packages/apps-template-mui/src/api/api.ts` | API functions — reuse `fetchAppRow`, `createAppRow` etc. |

---

## Key Architectural Decisions

1. **LMS is metahub data, not code** — All LMS-specific entities, fields, and scripts are defined in the metahub template. Platform packages only provide generic widget rendering infrastructure.

2. **Workspace UI is generic** — Workspace switching/management works for any workspace-enabled app, not just LMS.

3. **Guest access is app-level** — Guest sessions are created within the app's schema (students catalog with `is_guest=true`). No platform-wide guest accounts.

4. **Scripts own the business logic** — Module viewing, quiz running, stats aggregation all live in ExtensionScript classes with @AtServer methods. Platform only provides RPC transport and widget rendering.

5. **QR codes are client-side** — `qrcode` npm package generates SVG in the browser. No server-side dependency.

6. **Quiz options as JSON** — TABLE fields cannot nest, so quiz options are stored as a JSON array within each question row. The script handles serialization.

7. **Maximal component reuse** — FormDialog, CRUD dashboard, existing API patterns, entity presets, StatCard, ConfirmDeleteDialog — all reused, not reinvented.
