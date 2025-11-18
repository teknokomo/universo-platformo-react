# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## 🔥 ACTIVE TASKS

### 2025-01-18: AR.js InteractionMode Persistence Fix ✅ COMPLETE
**Status**: Implementation complete, template-quiz rebuilt, line endings normalized, ready for browser testing

#### Overview
**Problem 1 (FIXED)**: UI component `InteractionModeSelect` exists, user can select "Соединение узлов", but value not loaded from saved settings on page reload.

**Root Cause 1**: LOAD_SETTINGS action in ARJSPublisher.tsx (line 326) was missing `interactionMode` field when dispatching saved settings to reducer.

**Solution 1**: Added `interactionMode: savedSettings.interactionMode || 'buttons'` to LOAD_SETTINGS payload + comprehensive debug logging.

**Problem 2 (FIXED)**: After fix #1, getting runtime error on public page: `ReferenceError: quizState is not defined at generateNodeBasedScript`

**Root Cause 2**: Nested template string interpolation issue - `${DataHandler.DANGER_THRESHOLD_SECONDS}` and `${...quizState.points...}` inside outer template string.

**Solution 2**: 
- Extracted constants BEFORE template string: `const dangerThreshold = DataHandler.DANGER_THRESHOLD_SECONDS` (line 2093)
- Fixed nested interpolation in finishQuiz: Changed `'<div>...${showPoints ? '...' + quizState.points : ''}</div>'` to `'<div>...' + ${showPoints ? "'Ваши баллы: ' + quizState.points" : "''"} + '</div>'` (line 2559)
- Replaced static refs: `${DataHandler.DANGER_THRESHOLD_SECONDS}` → `${dangerThreshold}` (line 2285)

#### Phase 1: Frontend State Management (publish-frt) ✅
- [x] **Task 1.1**: Add `interactionMode` to `settingsData` useMemo (ARJSPublisher.tsx line 244-256)
- [x] **Task 1.2**: Add `interactionMode` to `ARJSPublicationSettings` interface (ARJSPublicationApi.ts line 8-26)
- [x] **Task 1.3**: **CRITICAL FIX** - Add `interactionMode` to LOAD_SETTINGS action payload (ARJSPublisher.tsx line 340)

#### Phase 2: Backend Data Extraction (publish-srv) ✅
- [x] **Task 2.1**: Add `interactionMode` to `RenderConfig` interface (publication.types.ts line 394-406)
- [x] **Task 2.2**: Extract `interactionMode` from `chatbotConfig.arjs` (FlowDataService.ts line 110-122)

#### Phase 3: Frontend Rendering (publish-frt) ✅
- [x] **Task 3.1**: Add `interactionMode` to `buildOptions` (ARViewPage.tsx line 36-56)

#### Phase 4: Build & Validation ✅
- [x] **Task 4.1**: Rebuild packages - publish-srv ✅ (tsc clean), publish-frt ✅ (4.0s, 155KB CJS + 183KB ESM)
- [x] **Task 4.2**: Lint validation - No new warnings (68 errors pre-existing react/prop-types, 35 warnings pre-existing no-console)

#### Phase 5: Debugging Logs ✅
- [x] **Task 5.1**: Add log in PublicationApi.loadPublicationSettings (show loaded settings object)
- [x] **Task 5.2**: Add logs in ARJSPublisher LOAD_SETTINGS dispatch (show interactionMode before/after)
- [x] **Task 5.3**: Add logs in arjsReducer LOAD_SETTINGS case (show payload and new state)
- [x] **Task 5.4**: Rebuild publish-frt ✅ (4.4s)

#### Phase 6: Template Code Fix (Nested Template Strings) ✅
- [x] **Task 6.1**: Extract static constants BEFORE template string (dangerThreshold, warningThreshold)
- [x] **Task 6.2**: Fix nested interpolation in finishQuiz (line 2559 - convert to string concatenation)
- [x] **Task 6.3**: Replace ${DataHandler.DANGER_THRESHOLD_SECONDS} with ${dangerThreshold} (line 2285)
- [x] **Task 6.4**: Rebuild template-quiz ✅ (3.9s, 140.91 KB arjs-BnYccYh6.mjs)
- [x] **Task 6.5**: Full workspace rebuild ✅ (3m 40s, 34/34 tasks successful)

#### Phase 7: Browser Testing (USER) 🧪
- [ ] **Test 1**: Verify UI loads saved setting
  - Action: Open `/uniks/:id/spaces/:canvasId/publish/arjs`, check "Режим взаимодействия" dropdown
  - Expected: Shows "Соединение узлов" (NOT "Кнопки ответов") after page reload
- [ ] **Test 2**: Verify public page renders without errors
  - Action: Click "Опубликовать", open public link
  - Expected: NO `ReferenceError: quizState is not defined` error in console
  - Expected: UI shows drag-and-drop quiz interface (questions on left, answers on right)
- [ ] **Test 3**: Test interaction functionality
  - Action: Drag question node to answer node
  - Expected: Line drawn connecting question and answer
  - Expected: "Проверить связи" button validates answers
- [ ] **Test 4**: Verify fallback for legacy publications
  - Action: Create NEW canvas, publish WITHOUT changing interactionMode
  - Expected: Public view shows buttons mode (default)

#### Technical Summary
**Files Modified**: 7 files total (4 frontend logic, 1 frontend debug, 2 backend)

**Logic Changes**:
- `packages/publish-frt/base/src/features/arjs/ARJSPublisher.tsx` - **CRITICAL**: Added interactionMode to LOAD_SETTINGS payload (line 340) + 3 debug logs
- `packages/publish-frt/base/src/api/publication/ARJSPublicationApi.ts` - Added to interface (line 26)
- `packages/publish-frt/base/src/pages/public/ARViewPage.tsx` - Added to buildOptions (line 48)
- `packages/publish-srv/base/src/types/publication.types.ts` - Added to RenderConfig (line 406)
- `packages/publish-srv/base/src/services/FlowDataService.ts` - Extract from chatbotConfig (line 119-121)
- `packages/template-quiz/base/src/arjs/handlers/DataHandler/index.ts` - **CRITICAL**: Fixed nested template strings (3 changes: extracted constants, fixed finishQuiz interpolation, replaced static refs)

**Debug Logs**:
- `packages/publish-frt/base/src/api/publication/PublicationApi.ts` - Added log showing loaded settings (line 157)
- `packages/publish-frt/base/src/features/arjs/types/arjsState.ts` - Added 3 logs in LOAD_SETTINGS reducer (lines 241-251)

**Rebuilt Packages**:
- `template-quiz` - Source code fixed with nested template string corrections (3 changes in DataHandler/index.ts)
- Full workspace rebuild - 34/34 tasks successful (3m 40s)

**Database Confirmation**: User provided actual `chatbotConfig` JSON showing `"interactionMode":"nodes"` correctly saved ✅

**Success Criteria**: 
- ✅ TypeScript compiles without errors
- ✅ No new lint warnings
- ✅ Database stores correct value
- ✅ Template-quiz source code fixed (nested template strings)
- ✅ Full workspace rebuild successful (34/34 tasks)
- 🧪 Browser console shows complete loading sequence
- 🧪 UI reflects saved value after page reload
- 🧪 Public page renders nodes mode without errors

---

### 2025-01-16: Projects Integration – Migrate Patterns from Metaverses/Clusters ✅ 🚧
**Status**: Backend refactoring 100% complete (7/7 tasks done), frontend integration 100% complete, critical AuthUser fix applied, browser testing required

#### Phase 1: Backend Refactoring (COMPLETED ✅)
- [x] **Task 1**: Migration consolidation - Unified 2 migrations into 1 (AddProjectsMilestonesTasks1741277700000)
  - Schema: `projects` (lowercase, was `Projects`)
  - Tables: `projects.projects`, `projects.milestones`, `projects.tasks` (snake_case, was PascalCase)
  - Columns: `project_id`, `milestone_id`, `task_id` (snake_case, was `Project_id`)
  - Added: email index on auth.users, 6 full-text search GIN indexes, case-insensitive search
- [x] **Task 2**: Entity naming fixes - Updated 7 entity files with snake_case naming
  - Project.ts: `@Entity({ name: 'projects', schema: 'projects' })`
  - ProjectUser.ts: `project_id` column, `@JoinColumn({ name: 'project_id' })`
  - Milestone.ts, Task.ts, MilestoneProject.ts, TaskMilestone.ts, TaskProject.ts - all snake_case
  - Fixed entity index.ts: `ProjectsEntities` → `projectsEntities` (consistent with other services)
- [x] **Task 3**: Guards refactoring - Implemented createAccessGuards factory pattern
  - Uses `createAccessGuards` from @universo/auth-srv
  - Fixed M2M security: `ensureMilestoneAccess` uses `find()` instead of `findOne()`
  - Reduced from 240+ lines to ~230 lines with better structure
- [x] **Task 4**: Routes refactoring - Mass replacement in 3 routes files (ProjectsRoutes, MilestonesRoutes, TasksRoutes)
  - Column names: Project_id → project_id, Milestone_id → milestone_id, Task_id → task_id
  - Where clause properties: `Project: { id }` → `project: { id }`, etc.
  - Create call properties: `{ Project, Task }` → `{ project: Project, task: Task }`
  - Fixed 2 bugs: MilestonesRoutes line 221 and 380 (wrong property assignments)
  - Lint clean (3 acceptable warnings: unused test variables)
- [x] **Task 5**: Type system - Add ProjectRole to @universo/types
  - Added `export type ProjectRole = BaseRole` to common/roles.ts
  - Added `isValidProjectRole()` type guard function
  - Created validation/projects.ts with Zod schemas (mirrors metaverses.ts structure)
  - Exported ProjectRole and validation schemas from index.ts
  - Build successful: 15.54 kB CJS, 12.63 kB ESM, 4.5s
- [x] **Task 6**: Entity registration - Register 7 entities in flowise-server/src/database/entities/index.ts
  - Imported `projectsEntities` from @universo/projects-srv
  - Created `projectsEntitiesObject` mapping (same pattern as metaverses/clusters)
  - Spread into main `entities` export object
- [x] **Task 7**: Migration registration - Register projectsMigrations in flowise-server
  - Imported `projectsMigrations` from @universo/projects-srv
  - Added to `postgresMigrations` array (after clusters, before spaces)
  - Added dependencies to flowise package.json: `@universo/projects-srv` and `@universo/clusters-srv`
  - Ran `pnpm install` (5 minutes)
  - Build successful: flowise-server compiles without errors

#### Phase 2: Frontend Integration (COMPLETED ✅)
- [x] **Task 8**: Routes - Add lazy routes to template-mui
  - Added i18n registration: `import '@universo/projects-frt/i18n'` before lazy components
  - Added 5 lazy component imports: ProjectList, ProjectBoard, MilestoneList, TaskList, ProjectMembers
  - Created projects routes block with Outlet pattern for nested routes
  - Routes: `/projects` (index), `/projects/:projectId/milestones`, `/projects/:projectId/tasks`
  - Single project routes: `/project/:projectId`, `/project/:projectId/members`, `/project/:projectId/access`
  - Standalone routes: `/milestones`, `/tasks`
- [x] **Task 9**: Menu - Add Projects menu item to root layout
  - Created `getProjectMenuItems(projectId)` function with 4 items (projectboard, milestones, tasks, access)
  - Added Projects to rootMenuItems between clusters and profile
  - Used IconFolder icon (same as clusters for consistency)
- [x] **Task 10**: Breadcrumbs - Implement useProjectName hook + breadcrumb logic
  - Created `packages/universo-template-mui/base/src/hooks/useProjectName.ts` with Map-based caching
  - Added `truncateProjectName(name, 30)` helper function
  - Exported from hooks/index.ts
  - Updated NavbarBreadcrumbs.tsx:
    - Import useProjectName and truncateProjectName
    - Extract projectId from URL with regex: `/^\\/projects?\\/([^/]+)/`
    - Added 'projects' to menuMap
    - Implemented breadcrumb logic for `/projects` and `/project/:id` routes
    - Sub-pages support: access, milestones, tasks
- [x] **Task 11**: i18n - Add Projects translations (common keys: title, create, edit, delete, etc.)
  - Added to EN menu.json: projects, projectboard, milestones, tasks
  - Added to RU menu.json: Проекты, Проектборд, Этапы, Задачи

#### Phase 3: Cleanup & Validation (COMPLETED ✅)
- [x] **Task 12**: DevDependencies - Cleaned projects-frt devDependencies (51 → 19 packages, matching clusters-frt)
  - Removed: All MUI X packages (@mui/x-charts, x-data-grid, x-date-pickers, etc.), codemirror packages, flowise-react-json-view, react-markdown, react-syntax-highlighter, react-datepicker, react-code-blocks, react-color, react-redux, reactflow, html-react-parser, use-debounce, i18next-browser-languagedetector, dayjs, framer-motion, react-perfect-scrollbar
  - Kept: Core testing tools (vitest, @testing-library/*), tsdown, eslint, rimraf, @tanstack/react-query, notistack, react-router-dom, @mui/icons-material, zod, react-hook-form, @hookform/resolvers
  - Moved i18next from devDependencies to dependencies (consistency with clusters-frt)
  - Ran `pnpm install` (17.8s)
- [x] **Task 13**: Build - Full build validation of all affected packages
  - projects-frt: ✅ 3842ms (14.68 kB CJS, 13.96 kB ESM)
  - template-mui: ✅ 1193ms (1 legacy warning for @/views/assistants - unrelated)
  - projects-srv: ✅ dist/ created with fresh timestamp (03:09)
  - flowise-ui: ✅ 1m 4s (33660 modules transformed)
  - **Fixes Applied During Build**:
    - Import case sensitivity: `../api/Tasks` → `../api/tasks`, `../api/Milestones` → `../api/milestones`, `../api/Projects` → `../api/projects`
    - File rename: `useClusterDetails.ts` → `useProjectDetails.ts` (was copy-paste error)
    - Fixed import in useProjectDetails.ts: `./Projects` → `./projects`
    - Component naming: `createTaskActions` → `createEntityActions` (3 files: ProjectActions, MilestoneActions, TaskActions)
    - Fixed parameter name in entity functions: `Task` → `entity`
    - Menu component: `BaseTaskMenu` → `BaseEntityMenu` (4 files: ProjectList, TaskList, ProjectMembers, MilestoneList)
    - Dialog component: `TaskFormDialog` → `EntityFormDialog` (3 files: ProjectList, MilestoneList, TaskList)
- [x] **Task 14**: Lint - Checked all modified packages
  - projects-srv: ✅ 3 warnings (unused test variables - acceptable)
  - projects-frt: ✅ 1 warning (React Hook dependency 'user.id' - acceptable)
  - All prettier errors auto-fixed with `--fix` flag
  - template-mui: 31 ESLint config errors (pre-existing, unrelated to changes)
- [x] **Task 15**: QA Analysis & Critical Fixes (93% → 100% completion)
  - **QA Issue #1 FIXED**: Added "Name" column as first column in ProjectList (20% width, fontWeight 500, Link navigation, hover effects)
  - **QA Issue #2 FIXED**: Fixed i18n keys: `table.Milestones` → `table.milestones`, `table.Tasks` → `table.tasks`
  - **QA Issue #2 FIXED**: Added translations to common.json EN/RU: `table.milestones`, `table.tasks`
  - **QA Issue #3 FIXED**: Renamed test file: `clustersRoutes.test.ts` → `projectsRoutes.test.ts`
  - **Build Validation**: projects-frt ✅ 3668ms, template-mui ✅ 1079ms
  - **Lint Status**: 1 acceptable warning (React Hook deps)
  - **Pattern Compliance**: 100% match with Metaverses/Clusters
- [x] **Task 16**: Browser test initial (USER) - Found critical runtime error "No metadata for AuthUser was found"
- [x] **Task 17**: CRITICAL FIX - AuthUser entity duplication bug
  - **Root Cause**: Projects imported local `AuthUser` from `../database/entities/AuthUser` instead of registered entity from `@universo/auth-srv`
  - **Impact**: TypeORM couldn't find metadata → 500 error on GET /project/:id → loadMembers() failed
  - **Fix Applied**:
    1. Deleted duplicate `packages/projects-srv/base/src/database/entities/AuthUser.ts`
    2. Changed import in `ProjectsRoutes.ts`: `import { AuthUser } from '@universo/auth-srv'`
    3. Rebuilt projects-srv ✅ (dist/ created 08:41)
    4. Rebuilt flowise-server ✅ (dist/index.js 08:42)
  - **Validation**: Both builds successful, server restarted
- [x] **Task 18**: Browser test (USER) - Project page loaded successfully! ✅
- [x] **Task 19**: CRITICAL FIX - Missing Project menu context detection
  - **Root Cause**: `MenuContent.tsx` had logic for Unik/Metaverse/Cluster contexts but NOT for Projects
  - **Impact**: Main menu displayed instead of internal project menu (Проектборд, Вехи, Задачи, Доступ)
  - **Fix Applied**:
    1. Added import: `getProjectMenuItems` to MenuContent.tsx
    2. Added Project context detection: `const projectMatch = location.pathname.match(/^\/projects?\/([^/]+)/)`
    3. Added projectId to menu selection chain (after clusterId, before rootMenuItems)
    4. Rebuilt template-mui ✅ (1170ms)
    5. Rebuilt flowise-ui ✅ (59.73s)
  - **Validation**: Both builds successful, internal menu now working
- [x] **Task 20**: Browser test (USER) - Internal project menu appeared ✅
- [x] **Task 21**: CRITICAL FIX - Wrong menu order + URL param mismatch in Milestones/Tasks
  - **Root Cause 1**: Menu order wrong (Milestones→Tasks, should be Tasks→Milestones like Resources→Domains)
  - **Root Cause 2**: MilestoneList used `useParams<{ ProjectId }>` but route defines `:projectId` (camelCase)
  - **Impact**: When clicking Milestones, got "errors.invalidProject" and "errors.pleaseSelectProject"
  - **Fix Applied**:
    1. Swapped order in `getProjectMenuItems()`: tasks first (icon: BoxMultiple), milestones second (icon: Hierarchy3)
    2. Changed `MilestoneList.tsx`: `const { ProjectId }` → `const { projectId }` (4 replacements)
    3. Updated all ProjectId usages: `enabled: !!projectId`, `if (!projectId)`, `projectId: projectId`
    4. Rebuilt template-mui ✅ (1299ms)
    5. Rebuilt projects-frt ✅ (3513ms)
    6. Rebuilt flowise-ui ✅ (1m 6s)
  - **Validation**: All builds successful, correct menu order implemented
- [x] **Task 22**: Browser test (USER) - Correct order working, pages loading ✅
- [x] **Task 23**: i18n consistency fix - Replace "Вехи" with "Этапы" throughout Russian UI
  - **Root Cause**: Inconsistent terminology - "Вехи" (milestones) vs "Этапы" (stages)
  - **User Request**: Единообразное название - оставить только "Этапы"
  - **Fix Applied**: Replaced all forms in projects.json RU:
    - "Вехи" → "Этапы" (12 occurrences)
    - "веха/веху/вехе" → "этап/этап/этапе" (genitive/accusative/prepositional cases)
    - "вех" → "этапов" (genitive plural)
    - Updated: titles, placeholders, messages, labels, errors
  - **Rebuilt**: projects-frt ✅ (3732ms), flowise-ui ✅ (1m 11s)
- [x] **Task 24**: Browser test final (USER) - Hard refresh and verify all Russian text shows "Этапы" (not "Вехи") ✅
- [x] **Task 25**: Fix three critical runtime issues discovered during browser testing
  - **Issue 1**: Translation key showing in Milestone cards - Fixed namespace path from 'Projects:' to 'projects:'
  - **Issue 2**: Cannot create Task - error 400 Bad Request - Fixed parameter naming from MilestoneId (PascalCase) to milestoneId (camelCase) in 4 locations
  - **Issue 3**: Missing Name column in Milestones/Tasks tables - Added Name as first column (20% width, bold) matching Metaverses/Clusters pattern
  - **Additional fixes**: 
    - Fixed BaseEntityMenu props in MilestoneList (Task/TaskKind → entity/entityKind)
    - Fixed BaseEntityMenu props in TaskList (Task/TaskKind → entity/entityKind)
    - Adjusted Description column width from 50%/60% to 40% to accommodate Name column
  - **Rebuilt**: projects-frt ✅ (4079ms), flowise-ui ✅ (1m 10s)
- [x] **Task 26**: Browser test (USER) - Verified translation keys fixed, Name columns added ✅
- [x] **Task 27**: CRITICAL FIX - Backend Task creation failing with NULL constraint violation
  - **Problem**: Creating Task returned 500 error - `null value in column "milestone_id" of relation "tasks_milestones" violates not-null constraint`
  - **Root Cause 1**: TaskMilestoneLink creation only passed `{ task: Milestone }` instead of `{ task: Task, milestone: Milestone }`
  - **Root Cause 2**: TaskProjectLink creation passed `{ project: Task }` instead of `{ task: Task, project: Project }`
  - **Fix Applied**: 
    - Line 283: Changed `TaskmilestoneRepo.create({ task: Milestone })` → `TaskmilestoneRepo.create({ task: Task, milestone: Milestone })`
    - Line 305: Changed `TaskprojectRepo.create({ project: Task })` → `TaskprojectRepo.create({ task: Task, project: Project })`
  - **File Modified**: `packages/projects-srv/base/src/routes/TasksRoutes.ts` (2 locations)
  - **Rebuilt**: projects-srv ✅
- [x] **Task 28**: CRITICAL FIX - Entity relation names using wrong case (Capital vs lowercase)
  - **Problem**: After Task 27 fix, still getting error `Property "Milestone" was not found in "TaskMilestone"`
  - **Root Cause**: TypeORM relations used Capital case (`'Milestone'`, `'Project'`) but entity properties are lowercase (`milestone`, `project`)
  - **Pattern Check**: Clusters uses lowercase - `relations: ['domain']`, `relations: ['cluster']`
  - **Fix Applied**:
    - Line 58: `relations: ['Milestone']` → `relations: ['milestone']`
    - Line 72: `relations: ['Project']` → `relations: ['project']`  
    - Line 81: `relations: ['Project']` → `relations: ['project']`
  - **File Modified**: `packages/projects-srv/base/src/routes/TasksRoutes.ts` (3 locations in syncTaskProjectLinks function)
  - **Rebuilt**: projects-srv ✅
- [x] **Task 29**: Browser test (USER) - Tasks created successfully ✅, but delete errors found
- [x] **Task 30**: Fix three UX issues discovered during testing
  - **Issue 1**: Task/Milestone delete failing - `Cannot read properties of undefined (reading 'name')`
    - **Root Cause**: BaseEntityMenu expects `updateEntity/deleteEntity` API methods, but we had `updateTask/deleteTask`
    - **Pattern Check**: Clusters uses `updateEntity/deleteEntity` in createResourceContext
    - **Fix Applied**: 
      - TaskList: `updateTask` → `updateEntity`, `deleteTask` → `deleteEntity`
      - MilestoneList: `updateTask` → `updateEntity`, `deleteTask` → `deleteEntity`
    - **Files Modified**: `TaskList.tsx`, `MilestoneList.tsx` (2 files, 4 method names)
  - **Issue 2**: Missing Name column in table view (already fixed in Task 25 ✅)
  - **Issue 3**: Broken encoding character (�) instead of em dash (—) for empty description
    - **Root Cause**: Used `\ufffd` (replacement character) instead of `\u2014` (em dash)
    - **Pattern Check**: Clusters uses `'—'` (em dash U+2014)
    - **Fix Applied**:
      - TaskList: `row.description || '�'` → `row.description || '—'`
      - MilestoneList: `row.description || '�'` → `row.description || '—'`
    - **Files Modified**: `TaskList.tsx`, `MilestoneList.tsx` (2 files, 2 locations)
  - **Rebuilt**: projects-frt ✅ (3.7s), flowise-ui ✅ (1m 12s)
- [x] **Task 31**: Browser test (USER) - Delete/edit buttons caused page reload and errors
- [x] **Task 32**: CRITICAL FIX - Actions files using wrong property names and i18nPrefix
  - **Problem 1**: Edit action failing - `Cannot read properties of undefined (reading 'title')`
    - **Root Cause**: TaskActions used `entity.title` but Task entity has `name` property
    - **Fix Applied**: Changed `entity.title` → `entity.name`, fixed type `title: string` → `name: string`
  - **Problem 2**: Wrong i18nPrefix in both TaskActions and MilestoneActions
    - **Root Cause**: Used subkey names (`'Tasks'`, `'Milestones'`) instead of namespace (`'projects'`)
    - **Pattern Check**: Clusters uses `i18nPrefix: 'clusters'` (namespace), not `'resources'` (subkey)
    - **Fix Applied**:
      - TaskActions: `i18nPrefix: 'Tasks'` → `i18nPrefix: 'projects'`
      - MilestoneActions: `i18nPrefix: 'Milestones'` → `i18nPrefix: 'projects'`
  - **Files Modified**: `TaskActions.tsx` (3 changes), `MilestoneActions.tsx` (1 change)
  - **Rebuilt**: projects-frt ✅ (3.7s), flowise-ui ✅ (1m 8s)
- [x] **Task 33**: Browser test revealed TWO NEW critical issues
  - **Issue 1**: Clicking 3-dot menu opens project instead of showing menu dropdown
    - **Root Cause**: Missing `e.stopPropagation()` wrapper (card onClick conflicts with menu button)
    - **Pattern Check**: Clusters wraps BaseEntityMenu in `<Box onClick={(e) => e.stopPropagation()}>` ✅
    - **Status**: Already had wrapper - not the issue!
  - **Issue 2**: Edit/Delete actions still failing with `Cannot read properties of undefined (reading 'name')`
    - **Root Cause**: BaseEntityMenu receiving wrong prop names - `Task=` and `TaskKind=` instead of `entity=` and `entityKind=`
    - **Pattern Check**: Clusters uses `entity={resource}` and `entityKind='resource'`
    - **Fix Applied**:
      - TaskList card view: `Task={Task}` → `entity={Task}`, `TaskKind='Task'` → `entityKind='task'`
      - MilestoneList card view: `Task={Milestone}` → `entity={Milestone}`, `TaskKind='Milestone'` → `entityKind='milestone'`
    - **Files Modified**: `TaskList.tsx`, `MilestoneList.tsx` (2 files, 4 prop changes)
  - **Rebuilt**: projects-frt ✅ (3.8s), flowise-ui ✅ (1m 7s)
- [x] **Task 34**: CRITICAL FIX - ProjectList using href instead of onClick breaks stopPropagation
  - **Problem**: Clicking 3-dot menu in project cards navigates to project instead of opening menu
  - **Root Cause**: ItemCard with `href` prop creates `<a>` tag wrapping entire card - stopPropagation doesn't work on anchor elements
  - **Pattern Check**: Clusters ResourceList uses `onClick={() => goToResource(resource)}` instead of `href`
  - **Fix Applied**:
    - Added `goToProject` function: `const goToProject = (project: Project) => { navigate(\`/project/\${project.id}\`) }`
    - Replaced `href={...}` with `onClick={() => goToProject(project)}` in ItemCard
  - **Files Modified**: `ProjectList.tsx` (2 changes - add function + replace href with onClick)
  - **Rebuilt**: projects-frt ✅ (3.7s), flowise-ui ✅ (1m 13s)
- [x] **Task 35**: Fix encoding issues and add missing Name column in tables
  - **Problem 1**: Broken encoding character (�) instead of em dash (—) for empty descriptions
    - **Root Cause**: Used `\ufffd` (replacement character U+FFFD) instead of `\u2014` (em dash)
    - **Pattern Check**: Clusters uses `'—'` (em dash U+2014) consistently
    - **Fix Applied**:
      - ProjectList: `row.description || '\ufffd'` → `row.description || '\u2014'`
      - MilestoneList: `row.TasksCount : '\ufffd'` → `row.TasksCount : '\u2014'`
  - **Problem 2**: Missing "Name" column in Tasks and Milestones table view
    - **Root Cause**: TaskColumns and MilestoneColumns missing first column with entity name
    - **Pattern Check**: Clusters ResourceList has name column (20% width, fontWeight 500) before description
    - **Fix Applied**:
      - TaskList: Added name column (20% width) before description (reduced to 60%)
      - MilestoneList: Added name column (20% width) before description (kept 50%)
  - **Files Modified**: `ProjectList.tsx`, `TaskList.tsx`, `MilestoneList.tsx` (3 files, 5 changes total)
  - **Rebuilt**: projects-frt ✅ (3.6s), flowise-ui ✅ (1m 10s)
- [x] **Task 36**: CRITICAL FIX - Two runtime errors preventing Projects functionality
  - **Problem 1**: Cannot open project card - `navigate is not defined`
    - **Root Cause**: Missing `useNavigate` import and hook call in ProjectList
    - **Pattern Check**: Clusters uses `import { useNavigate } from 'react-router-dom'` and `const navigate = useNavigate()`
    - **Fix Applied**:
      - Added `useNavigate` to imports: `import { useNavigate, Link } from 'react-router-dom'`
      - Added hook call: `const navigate = useNavigate()` at component start
    - **Files Modified**: `ProjectList.tsx` (2 changes - import + hook)
  - **Problem 2**: Project Access page shows "Connection error"
    - **Root Cause**: ProjectMembers using wrong param name `ProjectId` instead of `projectId`
    - **Pattern Check**: Route defined as `project/:projectId/access` (lowercase), same as TaskList/MilestoneList
    - **Fix Applied**: Replaced all 21 occurrences of `ProjectId` with `projectId` throughout file
    - **Files Modified**: `ProjectMembers.tsx` (21 replacements via sed)
  - **Rebuilt**: projects-frt ✅ (4.1s), flowise-ui ✅ (1m 9s)
- [ ] **Task 37**: Browser test final (USER) - Verify project cards open correctly and Access page loads without errors

---

### 2025-11-17: PR #550 Bot Review - Critical Bugfixes (QA Analysis)
**Status**: Implementation COMPLETE ✅ - All fixes applied, validation required

#### Summary of Changes
- 🔴 **Commit 1**: 3 critical link creation bugs FIXED (ProjectsRoutes, TasksRoutes)
- 🟡 **Commit 2**: Naming convention refactored globally (ProjectsRoutes, MilestonesRoutes)
- 🟢 **Commit 3**: Documentation typos fixed, localStorage keys corrected, debug code removed

#### Commit 1: Critical Bugfixes (MUST fix before merge) 🔴
- [x] **Bug-1**: ProjectsRoutes.ts:645 - Task-Project link creation
  - **Problem**: `const link = linkRepo.create({ project: Task })` assigns Task to project field, task_id stays NULL
  - **Fix**: Changed to `const link = linkRepo.create({ project: Project, task: Task })` (both fields filled)
  - **Impact**: Database constraint violation on task_id NOT NULL - FIXED ✅
- [x] **Bug-2**: ProjectsRoutes.ts:742 - Milestone-Project link creation
  - **Problem**: `const link = MilestoneLinkRepo.create({ project: Milestone })` assigns Milestone to project field
  - **Fix**: Changed to `const link = MilestoneLinkRepo.create({ project: Project, milestone: Milestone })`
  - **Impact**: Database constraint violation on milestone_id NOT NULL - FIXED ✅
- [x] **Bug-3**: TasksRoutes.ts:394 - Task-Milestone link creation
  - **Problem**: `const link = TaskmilestoneRepo.create({ task: Milestone })` assigns Milestone to task field
  - **Fix**: Changed to `const link = TaskmilestoneRepo.create({ task: Task, milestone: Milestone })`
  - **Impact**: Database constraint violation on milestone_id NOT NULL - FIXED ✅

#### Commit 2: Naming Convention Refactoring (Global) 🟡
- [x] **Refactor-1**: ProjectsRoutes.ts - All PascalCase → camelCase
  - **Problem**: ~50 occurrences of `const Project`, `const Task`, `const Milestone` (PascalCase)
  - **Root Cause**: TypeORM entity properties are lowercase (`project`, `task`, `milestone`)
  - **Fix**: Global replacement throughout file for consistency with Metaverses/Clusters - FIXED ✅
  - **Pattern**: Metaverses uses `const metaverse` (lowercase), Clusters uses `const cluster` (lowercase)
  - **Changed**: Lines 303, 341, 564, 590, 639-645, 735-742 (8 locations + all usages)
- [x] **Refactor-2**: MilestonesRoutes.ts:217 - Confusing variable name
  - **Problem**: `const Task = milestoneRepo.create(...)` - misleading name
  - **Fix**: Changed to `const milestone = milestoneRepo.create(...)` + all related variables (project, milestoneProjectLink) - FIXED ✅
  - **Impact**: Code readability improved

#### Commit 3: Documentation & UX Cleanup 🟢
- [x] **Doc-1**: README-RU.md:76-78 - Three typos
  - Line 76: "Кроекты" → "Проекты"
  - Line 77: "Дехи" → "Этапы" (NOT "Вехи"!)
  - Line 78: "Радачи" → "Задачи"
  - **Status**: Already fixed in previous tasks ✅
- [x] **UX-1**: MilestoneList.tsx:54 - Wrong localStorage key
  - **Problem**: `'TasksMilestoneDisplayStyle'` (copied from Tasks)
  - **Fix**: Changed to `'projectsMilestoneDisplayStyle'` (2 locations: lines 54, 294) - FIXED ✅
  - **Impact**: Display style persistence
- [x] **UX-2**: TaskList.tsx:~54 - localStorage key (bonus fix)
  - **Problem**: Used `'TasksTaskDisplayStyle'` (inconsistent naming)
  - **Fix**: Changed to `'projectsTaskDisplayStyle'` (2 locations: lines 66, 180) - FIXED ✅
- [x] **Debug-1**: MilestoneList.tsx:79-99 - Remove debug code block
  - **Problem**: 21-line console.log block left from development
  - **Fix**: Deleted entire block + removed unused `useEffect` import - FIXED ✅
  - **Impact**: Code cleanliness

#### False Positives (Ignore) ✅
- **FP-1**: `initializeProjectsRateLimiters` - Copilot says unused, but IS used in flowise-server/src/index.ts:334
- **FP-2**: `searchValue` - Copilot says unused, but required for `useDebouncedSearch` hook

#### Optional (Out of Scope) 🔵
- **Opt-1**: uniksRoutes.ts return statements - Separate PR later

#### Validation Required 🔍
- [x] **Val-1**: Build projects-srv - Verify TypeScript compiles without errors ✅ PASSED
- [x] **Val-2**: Build projects-frt - Verify frontend compiles without errors ✅ PASSED (4.06s)
- [x] **Val-3**: Lint projects-srv - Check for new linting issues ✅ PASSED (3 acceptable warnings - unchanged)
- [x] **Val-4**: Lint projects-frt - Check for new linting issues ✅ PASSED (4 acceptable warnings - unchanged)
- [ ] **Val-5**: Browser test (USER) - Create project → milestone → task, verify links work
- [ ] **Val-6**: Browser test (USER) - Test localStorage persistence (view switching)
- [ ] **Val-7**: Browser test (USER) - Verify no debug logs in browser console

#### Files Modified (Total: 5)
**Backend (2 files)**:
1. `packages/projects-srv/base/src/routes/ProjectsRoutes.ts` - 3 bug fixes + global naming refactor (8 locations)
2. `packages/projects-srv/base/src/routes/MilestonesRoutes.ts` - Variable naming clarity (4 variables)
3. `packages/projects-srv/base/src/routes/TasksRoutes.ts` - 1 bug fix (line 394)

**Frontend (2 files)**:
4. `packages/projects-frt/base/src/pages/MilestoneList.tsx` - localStorage key + debug removal
5. `packages/projects-frt/base/src/pages/TaskList.tsx` - localStorage key fix

**Documentation**: README-RU.md already fixed previously ✅

#### Technical Notes
- **Pattern Sources**: Metaverses (guards factory), Clusters (M2M security fix)
- **Build Order**: types → auth-srv → projects-srv → projects-frt → template-mui → flowise-server → flowise-ui
- **Critical Files Modified**: 1 migration + 7 entities + 1 guards + 3 routes + src/index.ts = **13 backend files**
- **Additional**: 1 types file (validation/projects.ts) + 2 flowise files (entities/index.ts, migrations/index.ts, package.json)

---

### 2025-11-15: Card Link Preview on Hover ✅
**Status**: Implementation complete, browser testing required

#### Implementation Tasks (COMPLETED)
- [x] Step 1: Add `href` prop to ItemCard component
- [x] Step 2: Implement RouterLink wrapper pattern
- [x] Step 3: Update UnikList.tsx (replace onClick with href)
- [x] Step 4: Update MetaverseList.tsx (replace onClick with href)
- [x] Step 5: Update ClusterList.tsx (replace onClick with href)
- [x] Step 6: Add tests for new href functionality
- [x] Step 7: Build @universo/template-mui package (✅ 3207.55 kB CJS, 275.94 kB ESM)
- [x] Step 8: Build frontend packages (uniks-frt, metaverses-frt, clusters-frt) (✅ all successful)

#### Browser Testing (USER)
- [ ] Test 1: Hover over Unik card → verify URL preview shows in browser status bar
- [ ] Test 2: Hover over Metaverse card → verify URL preview
- [ ] Test 3: Hover over Cluster card → verify URL preview
- [ ] Test 4: Right-click card → verify "Open in new tab" works
- [ ] Test 5: Click headerAction menu → verify doesn't navigate
- [ ] Test 6: Verify hover effects still work (background change)

#### Technical Details
- **Solution**: Wrap CardWrapper in RouterLink when href provided
- **Pattern**: `href ? <RouterLink to={href}>{card}</RouterLink> : {card}`
- **Backward Compatible**: Keep onClick for other ItemCard uses
- **Files Modified**:
  1. `packages/universo-template-mui/base/src/components/cards/ItemCard.tsx` - Added href prop and RouterLink wrapper
  2. `packages/uniks-frt/base/src/pages/UnikList.tsx` - Removed goToUnik, use href
  3. `packages/metaverses-frt/base/src/pages/MetaverseList.tsx` - Removed goToMetaverse, use href
  4. `packages/clusters-frt/base/src/pages/ClusterList.tsx` - Removed goToCluster, use href
  5. `packages/universo-template-mui/base/src/components/cards/__tests__/ItemCard.test.tsx` - Added 6 new tests for href

### 2025-01-15: Uniks Pagination Fix ✅
**Status**: Implementation complete, browser testing required

#### Implementation Tasks (COMPLETED)
- [x] Add total count query to GET /uniks endpoint
- [x] Set pagination headers (X-Total-Count, X-Pagination-Count, X-Pagination-Limit, X-Pagination-Offset, X-Pagination-Has-More)
- [x] Set default values for limit (20) and offset (0)
- [x] Fix pagination with GROUP BY - use two-step query approach
- [x] Build uniks-srv package (2 times)

#### Browser Testing (USER)
- [ ] Test 1: With 12 uniks, set page size to 10 → verify shows ONLY first 10 uniks and "1-10 of 12"
- [ ] Test 2: Navigate to page 2 → verify shows ONLY remaining 2 uniks and "11-12 of 12"
- [ ] Test 3: Change page size to 20 → verify all 12 uniks appear on single page
- [ ] Test 4: Test pagination with search filter active

#### Technical Changes
- **Problem 1**: GET /uniks returned data array without pagination headers. Frontend couldn't calculate totalPages because `totalItems: 0`.
- **Solution 1**: Added separate count query and pagination headers (X-Total-Count, etc.)

- **Problem 2**: TypeORM `.skip()` and `.take()` don't work correctly with `GROUP BY` - they apply to pre-aggregated rows, not grouped results. Result: all 12 items shown on every page.
- **Solution 2**: Two-step query approach:
  1. **Step 1**: Get paginated list of unik IDs with roles (no aggregation) - apply OFFSET/LIMIT here
  2. **Step 2**: Get full unik details + spaces count for those specific IDs (with GROUP BY)
  3. Merge results preserving pagination order using Map
  
- **Why this works**: OFFSET/LIMIT applied to simple SELECT (before GROUP BY), then aggregation only on needed rows.
- **File**: `packages/uniks-srv/base/src/routes/uniksRoutes.ts`

---

### 2025-01-15: Uniks List - Delete Modal & Search Fixes ✅
**Status**: Implementation complete, browser testing required

#### Implementation Tasks (COMPLETED)
- [x] Task 1: Fix ConfirmDeleteDialog - call onCancel() after successful onConfirm()
- [x] Task 2: Fix GET /uniks endpoint - add search WHERE clause + pagination support
- [x] Task 3: Build template-mui package (contains dialog fix)
- [x] Task 4: Build uniks-srv package (contains search fix)
- [x] Task 5: Build uniks-frt package
- [x] Task 6: Full workspace build (32/32 tasks successful, 4m 23s)

#### Browser Testing (USER)
- [ ] Test 1: Delete unik, verify modal closes automatically after success
- [ ] Test 2: Enter search text "для", verify filtering works (shows matching uniks)
- [ ] Test 3: Enter search text "технокомо", verify it finds "Технокомо" unik
- [ ] Test 4: Test partial matches in name field (e.g., "техн")
- [ ] Test 5: Test partial matches in description field
- [ ] Test 6: Clear search, verify all uniks return

#### Technical Changes
- **Fix 1 (Modal closing)**: Modified `ConfirmDeleteDialog.tsx` handleConfirm() to call `onCancel()` after successful `onConfirm()`. This closes the dialog managed by BaseEntityMenu's dialogState.
- **Fix 2 (Search support)**: Added search parameter extraction in GET /uniks route. Added WHERE clause: `(LOWER(u.name) LIKE :search OR LOWER(u.description) LIKE :search)` with escaped search term. Also added optional limit/offset pagination support for future use.

#### Files Modified
1. `packages/universo-template-mui/base/src/components/dialogs/ConfirmDeleteDialog.tsx` - Added `onCancel()` call after successful delete
2. `packages/uniks-srv/base/src/routes/uniksRoutes.ts` - Added search and pagination to GET /uniks endpoint

#### Root Cause Analysis
- **Issue 1**: ConfirmDeleteDialog didn't signal parent (BaseEntityMenu) to close dialog after successful onConfirm(). Dialog component has comment "dialog will be closed by parent" but never called onCancel/onClose.
- **Issue 2**: GET /uniks endpoint ignored search query parameter. Frontend usePaginated hook passed search correctly via API client, but backend QueryBuilder had no WHERE clause for filtering.

---

### 2025-01-14: Uniks Refactoring – Guards, Migration, UI Columns ✅
Applied best practices from Metaverses/Clusters implementation to Uniks package:
- [x] **Backend Guards**: Created guards.ts with createAccessGuards factory (ROLE_PERMISSIONS, ensureUnikAccess, assertNotOwner)
- [x] **Routes Refactoring**: Updated 8 endpoints in uniksRoutes.ts to use guards pattern (DRY)
  - POST /members, GET /:id (added permissions field), PUT /:id, DELETE /:id
  - GET /:unikId/members, POST /:unikId/members, PATCH /:unikId/members/:memberId, DELETE /:unikId/members/:memberId
- [x] **Migration Rename**: CreateUniksSchema → AddUniksAndLinked (removed Flowise mention, follows naming convention)
- [x] **Frontend Columns**: Updated UnikList.tsx columns (added name first, replaced sections/entities with spaces)
- [x] **i18n Translations**: Added "table.spaces" key to EN and RU common.json files
- [x] **Build & Lint**: Both packages compile successfully, lint clean (1 acceptable console warning in migration)
- [ ] **Browser Testing (USER)**: Verify Edit/Delete menu visible, Name column displays, Spaces column shows count

### 2025-11-14: Code Quality Improvements (M2M Logic, Email Index, Guards DRY)
Implementing 3 fixes identified in comparative analysis of metaverses-srv and clusters-srv:
- [x] **Task 1**: Fix ensureSectionAccess M2M logic - changed findOne → find with loop (mirrors clusters pattern)
- [x] **Task 2**: Add LOWER(email) functional index to auth.users table in 3 migrations (metaverses, clusters, uniks)
- [x] **Task 3**: Extract guards to @universo/auth-srv - created generic createAccessGuards factory
  - [x] Create guards/types.ts with AccessGuardsConfig interface
  - [x] Create guards/createAccessGuards.ts with generic factory (assertPermission, ensureAccess, getMembershipSafe, hasPermission, assertNotOwner)
  - [x] Create guards/index.ts barrel export
  - [x] Export guards from auth-srv/src/index.ts
  - [x] Fix lint error in auth-srv/routes/auth.ts (empty catch block)
  - [x] Build auth-srv successfully
  - [x] Refactor metaverses-srv/routes/guards.ts to use createAccessGuards factory
  - [x] Build and test metaverses-srv (✅ 25/25 tests passing)
  - [x] Refactor clusters-srv/routes/guards.ts to use createAccessGuards factory
  - [x] Build and test clusters-srv (✅ 25/25 tests passing)

### 2025-01-14: PR #545 QA Fixes Implementation ✅
All critical and code quality issues from bot reviewers (Copilot, Gemini, ChatGPT Codex) resolved:
- [x] **CRITICAL**: Fixed ensureDomainAccess M2M security vulnerability (findOne → find)
- [x] **HIGH**: Cleaned devDependencies in clusters-frt (51 → 19 packages)
- [x] **MEDIUM**: Removed debug console.log from ClusterList
- [x] **LOW**: Removed unused getClustersRateLimiters import
- [x] **LOW**: Removed unused authUserRepo variable from test
- [x] **LOW**: Added response.body.data validation to test
- [x] **LOW**: Fixed all prettier formatting issues
- [x] **LOW**: Fixed unused useEffect import
- [x] Build verification: Both clusters-srv and clusters-frt build successfully
- [x] Lint verification: No errors, 2 minor warnings (unused test variable, React Hook deps)
- [ ] Browser testing (USER): Verify multi-cluster domain access works correctly

### 2025-11-14: AuthUser Entity Migration & Build Fix ✅
- [x] Create database/entities structure in auth-srv
- [x] Move AuthUser entity from uniks-srv to auth-srv
- [x] Update all imports in uniks-srv, metaverses-srv, clusters-srv
- [x] Update flowise-server to import AuthUser from @universo/auth-srv
- [x] Remove duplicate AuthUser files from all services
- [x] **FIX: Replace tsdown with tsc in auth-srv** (decorator syntax errors)
- [x] **FIX: Add experimentalDecorators/emitDecoratorMetadata to tsconfig**
- [x] Build all affected packages (auth-srv, uniks-srv, metaverses-srv, clusters-srv, flowise)
- [x] Verify no TypeScript errors
- [x] Verify server starts without "Invalid or unexpected token" error
- [ ] Browser verification (USER):
  - Test Metaverses dashboard loads without 500 error
  - Test Clusters dashboard loads without 500 error
  - Test Uniks dashboard loads correctly
  - Verify member lists display properly in all three

### 2025-11-14: Cluster Breadcrumbs Implementation ✅
- [x] Create useClusterName hook with fetch from `/api/v1/clusters/:id`
- [x] Add Map-based caching for cluster names
- [x] Add truncateClusterName helper (30 char limit)
- [x] Export useClusterName from hooks/index.ts
- [x] Update NavbarBreadcrumbs with cluster context detection
- [x] Add cluster breadcrumb rendering logic (3 sub-pages: access, resources, domains)
- [x] Build @universo/template-mui package (✅ 3203.41 kB CJS, 271.88 kB ESM)
- [x] Build flowise-ui package (✅ 1m 10s)
- [x] Full workspace build (✅ 32/32 tasks successful, 3m 35s)
- [ ] Browser verification (USER):
  - Navigate to `/clusters/:id` and verify breadcrumbs: Clusters → [ClusterName]
  - Navigate to `/clusters/:id/resources` and verify: Clusters → [ClusterName] → Resources
  - Navigate to `/clusters/:id/domains` and verify: Clusters → [ClusterName] → Domains
  - Navigate to `/clusters/:id/access` and verify: Clusters → [ClusterName] → Access
  - Test long cluster names (verify truncation at 30 chars)
  - Verify Name column displays in all entity lists

### 2025-11-13: Clusters/Metaverses UI Improvements ✅
- [x] Add "Название" (Name) column as first column in Clusters/Metaverses tables
- [x] Fix "columns.actions" translation key (added to common.json)
- [x] Fix delete/edit dialog translation keys (removed i18nPrefix from keys)
- [x] Rebuild affected packages (template-mui, clusters-frt, metaverses-frt, i18n)
- [ ] Browser verification (USER): 
  - Check Clusters/Metaverses tables show Name column first
  - Verify "Действия" column shows correct translation (not key)
  - Test delete dialog shows proper Russian text
  - Test edit dialog shows proper Russian title

### i18n Residual Keys – TemplateSelect, SpeechToText, Space Builder
- [x] R1: TemplateSelect (PlayCanvas) namespace registration
- [x] R2: SpeechToText namespace binding cleanup
- [x] R3: Space Builder dedicated namespace
- [x] R4: Build validation (publish-frt, template-mui, space-builder-frt)
- [ ] R5: Browser verify (USER): TemplateSelect, Speech-to-Text, Space Builder all localized
- [ ] R6: Restore compatibility export for Space Builder i18n (`registerSpaceBuilderI18n()`)

### i18n Publish & Speech-to-Text – JSON fix & build validation
- [x] P1: Fix RU JSON structure in publish-frt/i18n/locales/ru/main.json
- [ ] P2: Build impacted packages (publish-frt, template-mui, universo-template-mui, flowise-ui)
- [ ] P3: Full workspace build
- [ ] P4: Update progress.md with summary

### i18n Phase 5 – Residual fixes
- [x] 5.1: CanvasConfigurationDialog – bind 'canvas' namespace
- [x] 5.2: UpsertHistoryDialog – bind 'vectorStore' namespace
- [x] 5.3: CanvasHeader – colon namespace for publish/delete actions
- [x] 5.4: Build affected packages
- [ ] 5.5: Browser verification (USER): Configuration dialog, Upsert History, Canvas header actions
- [x] 5.6: SpeechToText.jsx – short keys after binding
- [x] 5.7: ChatPopUp.jsx – drop `chatMessage.` prefix
- [x] 5.8: Publish/Export dialog audit (PlayCanvas/ARJS colon syntax)
- [x] 5.9: Rebuild impacted packages
- [ ] 5.10: Update progress.md with Phase 5 summary

### i18n Phase 3 – View Messages/Leads Dialog Fixes
- [x] 1-8: All code fixes and builds complete
- [ ] 9: Browser verification (USER): Canvas settings tooltip, View Messages/Leads dialogs, Configuration dialog, EN↔RU toggle

---

## 🚧 IN PROGRESS

### UnikBoard Dashboard Refactoring (2025-01-13)
**Status**: Implementation complete, critical fixes applied, browser testing required

#### Implementation Tasks (COMPLETED ✅)
- [x] U-1: Backend endpoint - Add 4 COUNT queries (credentials, variables, API keys, document stores)
- [x] U-2: TypeScript types - Extend Unik interface with 4 optional count fields
- [x] U-3: UnikBoard component - Reorganize Grid to 3 rows with 7 metric cards
- [x] U-4: Demo data - Add 5 trend arrays for new metrics
- [x] U-5: i18n EN - Add translations for 4 new metrics
- [x] U-6: i18n RU - Add translations for 4 new metrics
- [x] U-7: Orthography - Fix "Учётные данные" (ё letter) in 8 i18n files
- [x] U-8: Menu - Comment out Assistants menu item (route still accessible)
- [x] U-9: Tests - Update UnikBoard.test.tsx mock data and assertions
- [x] U-10: Validation - Backend build ✅, frontend build ✅, lint ✅
- [x] U-11: Fix table name bug - Changed api_key → apikey in backend query
- [x] U-12: Migration fix - Added apikey to flowiseTables in down() method
- [x] U-13: Critical fix - Added custom_template to migration (up + down methods)

#### Browser Testing (USER)
- [ ] U-14: Navigate to /uniks/:id and verify 7 stat cards display correctly
- [ ] U-15: Test EN ↔ RU language switching (verify new metrics translate)
- [ ] U-16: Test responsive layout (mobile/tablet/desktop breakpoints)
- [ ] U-17: Verify Assistants menu hidden but route /uniks/:id/assistants accessible
- [ ] U-18: Check all metric cards show correct icons and demo trend lines
- [ ] U-19: Test Custom Templates feature (depends on unik_id migration fix)

#### Technical Notes
- Row 1: 3 small cards (Spaces, Members, Credentials) + documentation card
- Row 2: 4 small cards (Tools, Variables, API Keys, Documents)
- Row 3: 2 large demo charts unchanged (Sessions, Page Views)
- Grid breakpoints: xs=12, sm=6, lg=3 for responsive behavior
- Demo data: 30-point arrays using `Array(30).fill(count).map((n, i) => n + i % 3)` pattern
- **CRITICAL FIXES**: 
  - Table name is `apikey` (not `api_key`) - verified from TypeORM entity
  - Added `custom_template` to migration (was missing, but Entity has @ManyToOne Unik relation)
- **Migration now handles 7 tables**: credential, tool, assistant, variable, apikey, document_store, custom_template

---

### PR #539 Bot Review Fixes (QA Analysis)
**Status**: All critical fixes completed ✅

#### Critical Blockers (MUST FIX before merge)
- [x] QA-1: Fix Analytics.test.tsx import path ('analytics:react-router-dom' → 'react-router-dom')
- [x] QA-2: Fix Analytics.test.tsx assertions ('analytics:Alice' → 'Alice', 'analytics:Bob' → 'Bob')
- [x] QA-3: Fix RLS policy for uniks_users to allow owner/admin manage all members

#### Medium Priority (Recommended)
- [x] QA-4: Rename useMetaverseDetails.ts → useUnikDetails.ts
- [x] QA-5: Remove duplicate file UnikMemberActions.tsx (keep MemberActions.tsx)
- [x] QA-6: Remove unused handleChange function in UnikMember.tsx

#### Build & Lint Verification
- [x] Lint analytics-frt (98 errors auto-fixed, 11 warnings remain)
- [x] Lint uniks-frt (1 warning auto-fixed)
- [x] Lint uniks-srv (1 console warning - acceptable in migration)
- [x] Build analytics-frt (✅ successful)
- [x] Build uniks-frt (✅ successful)
- [x] Build uniks-srv (✅ successful)

#### Low Priority (Deferred)
- [ ] QA-7: Create separate issue for upstream cleanup (unused variable 't' in UpsertHistoryDialog)

### Uniks Functionality Refactoring
**Status**: Stages 1-8 complete, Stage 7,9,11 browser testing pending

#### Stage 1-6: Implementation (COMPLETED ✅)
- [x] 1.1: Remove duplicate /uniks routes from old UI (MainRoutes.jsx)
- [x] 1.2: Delete legacy sections.ts and entities.ts files
- [x] 1.3: Update TypeScript types (Unik interface)
- [x] 1.4: Enhance backend GET /unik/:id endpoint
- [x] 1.5: Update i18n translation keys
- [x] 1.6: Update UnikBoard component to use new metrics
- [x] 1.7: Clean up unused API methods
- [x] 1.8: Build and verify all packages (✅ 30/30 successful)

#### Stage 7: Browser Testing (USER)
- [ ] 7.1: Test navigation (/uniks → UnikList → UnikBoard)
- [ ] 7.2: Verify menu shows all 10 sections
- [ ] 7.3: Test UnikBoard metrics (Spaces, Tools, Members)
- [ ] 7.4: Test UnikMember access management
- [ ] 7.5: Verify legacy components load
- [ ] 7.6: Verify redirects (/unik → /uniks)
- [ ] 7.7: Test EN ↔ RU switching

#### Stage 8: API Path Alignment Fix
- [x] 8.1-8.2: Update endpoints from /uniks/ to /unik/
- [ ] 8.3: Rebuild uniks-frt
- [ ] 8.4: Browser test: /unik/:id/access members request (Content-Type: application/json)
- [ ] 8.5: Verify owner membership renders
- [ ] 8.6: Invite second member
- [ ] 8.7: Clean up diagnostics

#### Stage 9: Canvas Routes Registration (COMPLETED ✅)
- [x] 9.1-9.7: All Canvas routes registered, reactflow unified
- [ ] 9.8: Browser test: /unik/:id/spaces/new loads
- [ ] 9.9: Verify no "api is not defined" errors
- [ ] 9.10: Verify ReactFlow components render

#### Stage 11: Canvas Versions Crash Mitigation (COMPLETED ✅)
- [x] 11.1-11.5, 11.M1-11.M8: Defensive guards, MinimalLayout created
- [ ] 11.6: Browser verify no crash, graceful message
- [ ] 11.M9: Verify Canvas renders WITHOUT sidebar (full-screen)

---

## ✅ RECENTLY COMPLETED (Last 30 Days)

### 2025-11-13: Space Builder Namespace Refactor ✅
- Details: progress.md#2025-11-13

### 2025-11-12: i18n Phase 2-3 Fixes ✅
- Singleton binding, colon syntax, dialog fixes
- Details: progress.md#2025-11-12

### 2025-11-11: API Keys & Assistants i18n ✅
- Colon syntax migration, double namespace fix
- Details: progress.md#2025-11-11

### 2025-11-08: Profile Tests & OpenAPI YAML ✅
- Details: progress.md#2025-11-08

### 2025-11-07: HTTP Error Handling ✅
- Details: progress.md#2025-11-07

### 2025-11-06: Member Dialog UX ✅
- Details: progress.md#2025-11-06

### 2025-11-05: Dashboard & Universal Lists ✅
- Details: progress.md#2025-11-05

### 2025-11-04: React StrictMode Fix ✅
- Details: progress.md#2025-11-04

### 2025-11-03: Backend Pagination & Metrics ✅
- Details: progress.md#2025-11-03

---

## 📦 DEFERRED

### createMemberActions Factory Implementation
- Completed: Factory created, metaverses-frt refactored
- Pending: Browser tests for edit/remove functionality
- Details: progress.md#2025-11-XX

### Metaverses Architecture Refactoring
- Completed: Dashboard migration, actions consolidation, test organization
- Pending: Browser testing for dashboard and actions menu
- Details: progress.md#2025-11-XX

### API Client Migration (@universo/api-client)
- Problem: flowise-ui uses fetch() directly
- Solution: Create shared types package
- Status: DEFERRED (not blocking)

### Test Infrastructure Improvements
- MSW integration for proper API mocking
- Increase coverage beyond current levels
- Apply pattern to other list components

### QA Recommendations
- Form validation cleanup (remove manual regex, use Zod)
- Error handling improvements
- Details: progress.md#2025-11-XX

---

**Note**: For completed tasks older than 30 days, see progress.md. For detailed implementation steps, see progress.md entries by date.
