### 2025-09-26 — Canvas versions UI and orchestration

- Removed the unused SQLite migration stub for spaces so Supabase remains the single source of truth for canvas metadata.
- Added a dedicated `CanvasVersionsDialog` in `apps/spaces-frt/base` with list/create/activate/delete actions, optimistic updates, and snackbar feedback.
- Wired the dialog into the canvas header menu with a new "Canvas Versions" entry, surfaced the active version label next to the space title, and exposed refresh/select callbacks so activating a snapshot reloads the active canvas flow.
- Introduced REST clients for version APIs plus translations (EN/RU) and menu icons across `spaces-frt` and shared UI packages to keep settings consistent.

### 2025-09-25 — Canvas versioning backend groundwork

- Extended Supabase migrations (Postgres + SQLite) with canvas version metadata, unique active-version constraints, and data backfill so existing canvases become their own active groups.
- Updated TypeORM entities (`Canvas`, `SpaceCanvas`, `ChatFlow`) plus Flowise interfaces to expose version fields, ensuring chatflow creation seeds version identifiers consistently.
- Implemented version lifecycle helpers in `SpacesService` (list/create/activate/delete) with REST endpoints, DTOs, and Flowise `chatflows` synchronization, accompanied by Jest coverage for version flows and upgraded TypeORM test mocks.

### 2025-09-25 — QA review for localized default canvas flow

- Verified temporary canvas rename now stays client-side until the space is persisted, preventing 500 errors from hitting `/canvases/temp`.
- Confirmed Spaces service accepts `defaultCanvasName` and persists localized labels during creation; API responses include seeded canvas metadata.
- Automated Jest suite `pnpm --filter @universo/spaces-srv test` passes across controller, routes, and service specs, validating new DTO paths.
- Archived the temporary plan document after QA sign-off so future updates rely on the consolidated progress log.

### 2025-09-24 — Spaces router embedded into Uniks

- Mounted `createSpacesRoutes` directly inside the Uniks router so `/unik/:id/spaces` and `/unik/:id/canvases` reuse the Spaces service without an extra express mount layer.
- Preserved the existing `ensureAuth` guard and wrapped a conditional rate limiter that only fires for `/spaces` and `/canvases` paths to avoid throttling unrelated legacy chatflow routes.
- Extended Jest route tests to stub the Spaces router, verify bootstrapping, and ensure cleanup helpers continue to be mocked, keeping regression coverage for the new wiring.

### 2025-09-23 — Localized default canvas flow for new spaces

- Canvas view keeps unsaved "temp" canvases in local state, allowing rename without hitting the API and forwarding the chosen label when the space is persisted.
- `@universo/spaces-srv` now accepts `defaultCanvasName`/`defaultCanvasFlowData`, trims inputs, seeds the initial canvas with localized names, and returns the created canvas in the response.
- Removed the frontend auto-rename effect that overwrote saved canvases on locale change; updated Jest suites for spaces service, controller, and routes to cover the new payload.

### 2025-09-22 — Space Builder new canvas mode for saved spaces

- Space Builder dialog now receives an `allowNewCanvas` flag, defaults to the "new canvas" mode for saved spaces, and exposes localized labels for the additional option.
- Updated Space Builder triggers and Spaces canvas view to create dedicated canvases with generated graphs, reuse existing hydration helpers, and surface i18n-aware snackbar errors when API calls fail.
- Extended `useCanvases.createCanvas` to accept initial flow payloads, refreshed manual safeguard tests to cover the new mode, and ran `pnpm --filter @universo/space-builder-frt test` (vitest) successfully.

### 2025-09-20 — Fix rootDirs build error in @universo/multiplayer-colyseus-srv and flowise packages

### 2025-09-21 — Uniks Schema & RLS Refactor (Migration In-Place Update) - **COMPLETED**

Objective:
- Strengthen multi-tenant isolation for Uniks by introducing dedicated `uniks` schema and replacing broad `auth.role()='authenticated'` RLS policies with membership-driven `auth.uid()` checks.

Changes Implemented:
- Modified existing migration `1741277504476-AddUniks.ts` (no new migration file) to:
  - Create schema `uniks` and tables `uniks.uniks` & `uniks.uniks_users` (renamed from legacy `user_uniks`).
  - Add composite uniqueness (user_id, unik_id) and explicit FK constraints (best-effort) to `auth.users` and `uniks.uniks`.
  - Add indexes `IDX_uniks_users_unik` and `IDX_uniks_users_user` for membership lookups.
  - Attach (idempotent) `unik_id` column + FK to `uniks.uniks` across core domain tables (`chat_flow`, `credential`, `tool`, `assistant`, `variable`, `apikey`, `document_store`, `custom_template`).
  - Enable RLS on new tables; drop permissive role-based model.
  - Implement granular policies:
    - `uniks_select_members`: Only members can SELECT a unik.
    - `uniks_insert_owner`: Any authenticated user can INSERT (application must create owner membership row).
    - `uniks_update_admin` / `uniks_delete_admin`: Owner/Admin restricted modifications.
    - Membership (`uniks_users_*`) policies enforcing self-join creation and owner/admin controlled updates/deletes.

TypeORM Integration:
- Migrated Uniks system from Supabase REST to TypeORM Repository pattern
- Implemented WorkspaceAccessService with centralized membership validation and per-request caching
- Added strict TypeScript role system (owner, admin, editor, member) with hierarchy validation
- Introduced ensureUnikMembershipResponse middleware for controller access control
- Fixed cross-schema foreign key issues with dual query strategy

Testing & Validation:
- All 9 WorkspaceAccessService tests passing (100% coverage)
- Jest configuration fixed for TypeScript compilation with ts-jest
- RLS policies validated for membership isolation and role-based access control
- Production query syntax corrected for Supabase schema-qualified tables

Security Impact:
- Eliminates risk of cross-tenant data exposure via generic authenticated role
- Enforces principle of least privilege at row level leveraging EXISTS membership predicates
- Application-level access control with TypeORM middleware provides additional security layer

**Status: COMPLETE** - Full migration to Passport.js + Supabase + TypeORM architecture achieved


Issue:
- Build failed with TS2307 "Cannot find module '@universo/multiplayer-colyseus-srv'" error
- Root cause: `rootDirs: ["./src", "../../../tools"]` in tsconfig.json caused compilation artifacts to land in wrong location (dist/apps/multiplayer-colyseus-srv/base/src/ instead of dist/)
- Similar issue affected packages/server which also had problematic rootDirs configuration

Resolution:
- Created ensurePortAvailable utility in @universo-platformo/utils package to centralize network functions
- Removed rootDirs configuration from both affected tsconfig.json files
- Cleaned up include paths and excluded test directories appropriately  
- Updated package.json dependencies to use @universo-platformo/utils workspace package
- Modified import statements from @universo-tools/network to @universo-platformo/utils/net

Files modified:
- `apps/universo-platformo-utils/base/src/net/ensurePortAvailable.ts` (created)
- `apps/universo-platformo-utils/base/src/net/index.ts` (updated exports)
- `apps/multiplayer-colyseus-srv/base/package.json` (added dependency)
- `apps/multiplayer-colyseus-srv/base/tsconfig.json` (removed rootDirs)
- `apps/multiplayer-colyseus-srv/base/src/integration/MultiplayerManager.ts` (updated imports)
- `packages/server/package.json` (added dependency)
- `packages/server/tsconfig.json` (removed rootDirs)
- `packages/server/src/commands/start.ts` (updated imports)

Validation:
- `pnpm --filter @universo-platformo/utils build` SUCCESS
- `pnpm --filter @universo/multiplayer-colyseus-srv build` SUCCESS  
- `pnpm --filter flowise build` SUCCESS
- Full `pnpm build` completes across 27 packages in 3m51s without failures

Cleanup:
- Removed obsolete `tools/network/ensurePortAvailable.ts` and empty `tools/network/` directory
- Updated README.md and README-RU.md for @universo-platformo/utils package with new net utilities documentation
- Updated documentation in `docs/en/universo-platformo/utils/README.md` and `docs/ru/universo-platformo/utils/README.md`

### 2025-09-18 — Fix TS path alias build error in @universo/spaces-srv

Issue:
- Full build failed due to TS2307 errors in `apps/spaces-srv/base/src/tests/fixtures/spaces.ts` for imports like `@/database/entities/*`.

Root cause:
- `tsconfig.json` in `@universo/spaces-srv` lacked a path alias mapping for `@/*` with `baseUrl` pointing to `src`.
- Tests directory was included in the production `tsc` build, pulling fixtures into the production compile.

Resolution:
- Added `paths: { "@/*": ["*"] }` and kept `baseUrl: "./src"`.
- Excluded `src/tests/**` in `exclude` to keep unit tests out of production build.

Validation:
- `pnpm --filter @universo/spaces-srv build` compiles and outputs `dist/` successfully.
- Full `pnpm build` completes across 27 packages without failures.

Follow-ups:
- Consider adding a shared TS config preset for servers to ensure consistent alias and test exclusions.

### 2025-09-18

- **QR Code Download Notification Fixed**:
  - Added Snackbar notification system to QRCodeSection.jsx component
  - Users now receive "QR-код успешно сохранён" / "QR code saved successfully" message after download
  - Implemented 3-second auto-hide duration with proper state management
  - Fixed GitHub bot issue about missing download feedback

- **Background Color Functionality Fixed**:
  - Resolved hardcoded #1976d2 color issue in ARJSQuizBuilder.ts
  - Fixed missing backgroundColor parameter passing from ARViewPage.tsx to template
  - Backend correctly extracts backgroundColor from chatbotConfig.arjs.backgroundColor
  - Frontend now properly passes renderConfig.backgroundColor to buildOptions
  - Complete data flow: UI → Supabase → Backend → Frontend → Template works correctly

- AR.js wallpaper mode (cameraUsage: none) fixed:
\- **i18n Normalization across chatflows/publish UIs**:
  - Fixed namespace/key mismatches causing raw keys to render in UI.
  - Updated `APICodeDialog.jsx`, `EmbedChat.jsx`, `ShareChatbot.jsx`, `chatflows/index.jsx`, `agentflows/index.jsx`, `publish/api/PythonCode.jsx`, `publish/api/LinksCode.jsx`, and `chatflows/Configuration.jsx` to use relative keys within the correct namespaces.
  - Verified no compile errors; keys like `apiCodeDialog.*`, `embedChat.*`, `shareChatbot.*`, and `common.version` now resolve properly.
  - Scene no longer includes `arjs` attribute; AR.js libs are skipped.
  - Wallpaper background implemented as rotating wireframe `a-sphere` with `shader: flat` and as optional `<a-sky>`.
  - DataHandler recognizes wallpaper sphere and `a-sky` and keeps them visible independent of `data-scene-id`.
  - Built `@universo/template-quiz` and `publish-frt` with no errors.
# Progress

**As of 2025-01-17 | AR.js Camera Disable Fix Implemented**

## AR.js Camera Usage Settings Implementation (2025-01-17)

**Status**: ✅ **COMPLETED**

### Summary
Successfully fixed AR.js camera initialization issue where the library was still loading and initializing even when "Без камеры" (No Camera) option was selected by users.

### Root Cause Analysis:
- **Problem Identified**: AR.js library (v3.4.7) was always being loaded via `getRequiredLibraries()` method, causing camera initialization regardless of scene attribute settings
- **Console Evidence**: Browser logs showed "AR.js 3.4.7 - trackingBackend: artoolkit" initialization messages even when camera was disabled
- **Architecture Issue**: Library loading occurred before scene attribute evaluation, making attribute-based disabling ineffective

### Implementation Details:

#### 1. Library Loading Control:
- ✅ **Modified ARJSQuizBuilder.ts (template-quiz)**: Updated `getRequiredLibraries()` to accept `options` parameter and conditionally exclude AR.js library
- ✅ **Conditional Logic**: Returns `['aframe']` only when `cameraUsage='none'`, preventing AR.js script inclusion entirely
- ✅ **Enhanced Debugging**: Added console logging to track library loading decisions

#### 2. Architecture Updates:
- ✅ **AbstractTemplateBuilder.ts**: Updated abstract method signature to pass BuildOptions through library loading chain
- ✅ **Library Integration**: Modified `getLibrarySourcesForTemplate()` to pass options to `getRequiredLibraries()`
- ✅ **Wrapper Coordination**: Fixed ARJSQuizBuilder wrapper in publish-frt to properly translate BuildOptions

#### 3. Build System Fixes:
- ✅ **Method Name Correction**: Fixed `convertToTemplateOptions` → `convertBuildOptions` naming mismatch
- ✅ **TypeScript Compilation**: Resolved all type signature mismatches across template-quiz and publish-frt packages
- ✅ **Package Builds**: Successfully compiled both template-quiz and publish-frt with no errors

### Technical Resolution:
- **Before**: AR.js library always loaded → camera always initialized regardless of settings
- **After**: AR.js library conditionally loaded → no camera initialization when `cameraUsage='none'`
- **Result**: Complete prevention of camera permission requests and AR.js functionality when disabled

### Features Delivered:
- **True Camera Disable**: No AR.js library loading when "Без камеры" selected
- **Clean Browser Experience**: No camera permission prompts or AR.js console messages
- **Maintained Functionality**: Full AR.js features preserved when camera usage enabled
- **Architectural Improvement**: Proper BuildOptions flow through library loading system

---

## QR Code Download Feature Implementation (2025-01-17)

**Status**: ✅ **COMPLETED**

## QR Code Download Feature Implementation (2025-01-17)

**Status**: ✅ **COMPLETED**

### Summary
Successfully implemented QR code download functionality for published applications. Users can now save generated QR codes as high-quality PNG files (512x512 resolution).

### Implementation Details:

#### 1. SVG to PNG Conversion Utility:
- ✅ **Created `/apps/publish-frt/base/src/utils/svgToPng.js`**: Complete utility module with Canvas API approach
- ✅ **High Quality Settings**: 512x512 resolution with quality 1.0 for crisp images
- ✅ **Error Handling**: Comprehensive input validation and resource cleanup
- ✅ **Modular Functions**: `convertSvgToPng()`, `downloadDataUrl()`, `generateQRCodeFilename()`, `downloadQRCode()`

#### 2. UI Integration:
- ✅ **Enhanced QRCodeSection Component**: Added download button with Material-UI design consistency
- ✅ **Loading States**: Proper `isDownloading` state management with button disable/spinner
- ✅ **Error Feedback**: Toast notifications for download success/failure
- ✅ **SVG Reference**: Used `useRef` hook to access QR code SVG element for conversion

#### 3. Internationalization:
- ✅ **Russian Translations**: Added download keys (download, downloading, downloadError, downloadSuccess) to ru/main.json
- ✅ **English Translations**: Added corresponding keys to en/main.json
- ✅ **Namespace Integration**: Used existing 'publish' namespace for consistent translation loading

#### 4. Technical Validation:
- ✅ **Package Build**: Successfully compiled publish-frt with new code (Gulp 114ms completion)
- ✅ **Full Workspace Build**: Completed 5m52s build across all 27 packages without errors
- ✅ **Code Quality**: TypeScript compilation passed, confirming syntax and type correctness

### Features Delivered:
- **High-Quality Downloads**: 512x512 PNG files with maximum quality settings
- **User-Friendly Interface**: Integrated download button with loading states and error handling
- **Cross-Browser Compatibility**: Modern Canvas API approach with fallback safety
- **Internationalized Experience**: Full Russian/English support for download workflow

---

## AR.js Internationalization Fix (2025-01-17)

**Status**: ✅ **COMPLETED**

### Summary
Successfully resolved translation issues in AR.js published applications where language keys were displaying instead of translated text during loading screens.

### Issues Fixed:

#### 1. PublicFlowView Translation Issues:
- ✅ **Namespace Fix**: Updated useTranslation() to use 'publish' namespace specification
- ✅ **Key Path Correction**: Fixed 'common.loading' → 'general.loading' with proper fallback
- ✅ **Error Message Translation**: Updated applicationNotAvailable key usage
- ✅ **Component Integration**: Maintains universal dispatcher functionality for AR.js applications

#### 2. ARViewPage Translation Issues:
- ✅ **Namespace Specification**: Added 'publish' namespace to useTranslation hook
- ✅ **Loading Key Path**: Corrected 'publish.arjs.loading' → 'arjs.loading' with fallback text
- ✅ **Streaming Mode Compatibility**: Fixed translations for AR.js content rendering

#### 3. Translation File Updates:
- ✅ **Russian Language**: Added missing 'applicationNotAvailable' key to ru/main.json
- ✅ **English Language**: Added corresponding key to en/main.json for consistency  
- ✅ **Build Integration**: Successfully rebuilt and validated translation system

#### 4. Technical Resolution:
- ✅ **Package Rebuild**: Compiled publish-frt package with all fixes applied
- ✅ **Full Workspace Build**: Propagated changes across all dependent packages (27 packages rebuilt)
- ✅ **Error Elimination**: Loading screens now display proper translated text instead of raw language keys

**Result**: Users accessing published AR.js applications now see properly localized text during all loading phases.

---

## QR Code Generation Feature Implementation (2025-01-17)

**Status**: ✅ **COMPLETED**

### Summary
Successfully implemented MVP QR code generation functionality for published AR.js applications with toggleable UI, internationalization support, and proper error handling.

### Features Implemented:

#### 1. Library Integration:
- ✅ **React QR Code Library**: Added `react-qr-code@2.0.18` dependency to publish-frt package
- ✅ **TypeScript Support**: Chosen library provides excellent TypeScript integration and maintainability
- ✅ **Performance Optimized**: Lightweight library (smaller than alternatives like qrcode.react)

#### 2. Internationalization Support:
- ✅ **Russian Translations**: Added complete qrCode section to `ru/main.json` with toggle, description, generating, scanInstruction, error, invalidUrl keys
- ✅ **English Translations**: Added parallel qrCode section to `en/main.json` with consistent key structure
- ✅ **Translation Integration**: Proper useTranslation hook usage with 'publish' namespace

#### 3. QRCodeSection Component:
- ✅ **Reusable Architecture**: Created standalone component for potential reuse across different publication technologies
- ✅ **State Management**: React hooks for showQRCode, isGenerating, and error handling
- ✅ **URL Validation**: Built-in validation for safe QR code generation (HTTP/HTTPS only)
- ✅ **User Experience**: Loading states, error handling, and generation simulation for better UX
- ✅ **Material-UI Integration**: Consistent styling with existing publish interface components

#### 4. ARJSPublisher Integration:
- ✅ **Legacy Code Replacement**: Replaced old qrcode.react implementation with new QRCodeSection component
- ✅ **Import Updates**: Clean import structure removing optional dependency handling
- ✅ **Seamless Integration**: QRCodeSection appears after PublicationLink with proper spacing and styling
- ✅ **Disabled State Support**: Component respects generation state to prevent conflicts

#### 5. Technical Implementation:
- ✅ **Component Features**:
  - Toggle switch with loading indicator during generation
  - Descriptive text explaining QR code functionality
  - White background paper wrapper for QR code visibility
  - 180px QR code size for optimal mobile scanning
  - Error display with user-friendly messages
  - Automatic state reset when URL changes
- ✅ **Error Handling**:
  - URL validation before QR generation
  - User-friendly error messages in multiple languages
  - Graceful fallback for invalid URLs
- ✅ **Performance**:
  - Generation delay simulation for better UX
  - Efficient re-rendering with proper React patterns
  - Memory cleanup on component unmount

### Build Validation:
- ✅ **Package Build**: Successfully compiled publish-frt package without errors
- ✅ **Full Project Build**: Complete workspace build completed in 5m38s with all 27 packages successful
- ✅ **TypeScript Compilation**: No compilation errors in component or integration code
- ✅ **Dependency Installation**: Library properly installed and integrated into workspace

### Code Quality:
- ✅ **Best Practices**: Followed existing component patterns and coding standards
- ✅ **Documentation**: Comprehensive JSDoc comments for component and helper functions
- ✅ **Type Safety**: Full TypeScript support with proper prop types and validation
- ✅ **Error Boundaries**: Defensive programming with proper error states

### User Experience:
- ✅ **Intuitive Interface**: Clear toggle with descriptive text and instructions
- ✅ **Visual Feedback**: Loading spinners and proper state transitions
- ✅ **Mobile Optimized**: QR code size and contrast optimized for mobile scanning
- ✅ **Multilingual Support**: Full Russian and English language support

**MVP Requirements Met**: ✅ Toggleable QR code generation, no persistence required, spinner during generation, no interference with existing functionality.

## AR.js Legacy Configuration Management System Bug Fixes (2025-09-16)

**Status**: ✅ **COMPLETED**

### Summary
Fixed critical issues in the legacy configuration management system including translation interpolation, dual alert display, and field accessibility in recommendation mode.

### Bug Fixes Implemented:

#### 1. Translation Interpolation Fixed:
- ✅ **Source Name Translation**: Fixed dynamic source name translation in alert messages
- ✅ **Parameter Mapping**: Corrected parameter name from `recommendedSource` to `source` to match translation keys
- ✅ **Conditional Translation**: Added proper conditional translation for 'official' vs 'kiberplano' source names

#### 2. Alert Display Logic Fixed:
- ✅ **Single Alert Display**: Added `isLegacyScenario` state to prevent dual alert display
- ✅ **Smart Alert Replacement**: Legacy alerts now replace standard enforcement messages instead of showing both
- ✅ **Alert Lifecycle Management**: Legacy alerts are cleared when user corrects configuration in recommendation mode

#### 3. Field Accessibility in Recommendation Mode:
- ✅ **Conditional Field Locking**: Fields are now editable in legacy recommendation mode (`autoCorrectLegacySettings: false`)
- ✅ **Enhanced Disabled Logic**: `disabled={!!publishedUrl || (globalSettings?.enforceGlobalLibraryManagement && (!isLegacyScenario || globalSettings?.autoCorrectLegacySettings))}`
- ✅ **Helper Text Conditional**: Helper text only shows when fields are actually disabled

#### 4. User Interaction Improvements:
- ✅ **Source Change Handlers**: Updated to allow changes in recommendation mode and clear legacy state when user complies
- ✅ **State Transition Logic**: Proper transition from legacy recommendation to standard enforcement when user changes sources
- ✅ **Real-time Feedback**: Alert automatically disappears when user sets both sources to match global requirements

### Technical Implementation:

#### Fixed Translation Interpolation:
```jsx
// Before: showing language keys
message: t('publish.globalLibraryManagement.legacyRecommendationMessage', {
    recommendedSource: globalSettings.defaultLibrarySource
})

// After: proper source name translation
message: t('publish.globalLibraryManagement.legacyRecommendationMessage', {
    source: globalSettings.defaultLibrarySource === 'official' 
        ? t('publish.globalLibraryManagement.officialSource')
        : t('publish.globalLibraryManagement.kiberplanoSource')
})
```

#### Fixed Field Accessibility Logic:
```jsx
// Before: always disabled in enforcement mode
disabled={!!publishedUrl || globalSettings?.enforceGlobalLibraryManagement}

// After: editable in legacy recommendation mode
disabled={!!publishedUrl || (globalSettings?.enforceGlobalLibraryManagement && (!isLegacyScenario || globalSettings?.autoCorrectLegacySettings))}
```

#### Fixed Alert Display Logic:
```jsx
// Standard alert only shows when NOT in legacy scenario
{globalSettings?.enforceGlobalLibraryManagement && !isLegacyScenario && (
    <Alert severity="info">Standard enforcement message</Alert>
)}
```

### Behavioral Scenarios Now Working:

#### Scenario 1: Legacy Recommendation Mode
- **Config**: `PUBLISH_AUTO_CORRECT_LEGACY_SETTINGS=false`
- **Behavior**: 
  - Single warning alert with proper source name translation
  - Fields editable for user to make changes
  - Alert disappears when user complies with global settings
  - Standard message appears after compliance

#### Scenario 2: Legacy Auto-Correction Mode
- **Config**: `PUBLISH_AUTO_CORRECT_LEGACY_SETTINGS=true`
- **Behavior**:
  - Single info alert with correction confirmation
  - Settings automatically updated to global requirements
  - Fields remain locked as expected
  - Standard message on subsequent visits

---

## AR.js Legacy Configuration Management System (2025-01-16)

**Status**: ✅ **COMPLETED**

### Summary
Implemented sophisticated legacy configuration handling for AR.js global library management system, allowing administrators to control how legacy spaces with conflicting library settings are handled - either through automatic correction or user recommendations.

### Changes Implemented:

#### 1. Environment Configuration:
- ✅ **Environment Variable**: Added `PUBLISH_AUTO_CORRECT_LEGACY_SETTINGS=true` to control legacy behavior
- ✅ **Documentation**: Comprehensive documentation in `.env.example` explaining auto-correction vs recommendation scenarios
- ✅ **Backend API**: Updated `publishController.ts` to expose `autoCorrectLegacySettings` flag

#### 2. Translation System:
- ✅ **Legacy Alert Messages**: Added `legacyCorrectedMessage` and `legacyRecommendationMessage` keys to both Russian and English locales
- ✅ **Interpolation Support**: Dynamic content using i18next interpolation for source names and recommendations
- ✅ **Fixed English Locale**: Resolved missing "coming soon" translation key

#### 3. Frontend Logic Implementation:
- ✅ **Legacy Detection**: Automatic detection of spaces with library configurations that don't match global requirements
- ✅ **Three-tier Handling**: 
  - New spaces: Apply global settings directly
  - Legacy with auto-correction: Automatically update settings and show info alert
  - Legacy with recommendations: Keep existing settings and show warning alert
- ✅ **Alert UI Component**: Added dismissible alert component to show legacy status messages
- ✅ **State Management**: Added `alert` state to track and display legacy configuration messages

#### 4. Testing & Validation:
- ✅ **Build Validation**: Confirmed both `publish-frt` and `publish-srv` build successfully
- ✅ **Translation Verification**: Verified correct translation key paths and interpolation
- ✅ **API Integration**: Confirmed backend exposes `autoCorrectLegacySettings` flag correctly

### Technical Architecture:

#### Legacy Detection Logic:
```jsx
const hasLegacyConfig = savedSettings.libraryConfig && 
    (savedSettings.libraryConfig.arjs?.source !== globalSettings.defaultLibrarySource ||
     savedSettings.libraryConfig.aframe?.source !== globalSettings.defaultLibrarySource)
```

#### Three-Scenario Handling:
1. **Auto-Correction Mode** (`autoCorrectLegacySettings: true`):
   - Updates settings to match global requirements
   - Shows blue info alert with correction message

2. **Recommendation Mode** (`autoCorrectLegacySettings: false`):
   - Preserves existing legacy settings
   - Shows orange warning alert with administrator recommendation

3. **New Spaces**:
   - Applies global settings directly without alerts

### Environment Variables:
```env
# Legacy Configuration Handling
PUBLISH_AUTO_CORRECT_LEGACY_SETTINGS=true
# When true: Auto-correct legacy space library settings to match global requirements
# When false: Show recommendation alerts but preserve existing settings
```

### Translation Keys Added:
```json
"globalLibraryManagement": {
    "legacyCorrectedMessage": "Library source settings have been automatically updated to comply with global administrator requirements (set to: {{source}})",
    "legacyRecommendationMessage": "Administrator recommends changing library source to {{source}} to comply with global settings"
}
```

---

## AR.js Global Library Management Alert Internationalization (2025-01-16)

**Status**: ✅ **COMPLETED**

### Summary
Internationalized the global library management alert message in AR.js Publisher component, replacing hardcoded Russian text with proper i18n keys supporting both Russian and English languages.

### Changes Implemented:

#### Translation Keys Added:
- ✅ **Russian** (`apps/publish-frt/base/src/i18n/locales/ru/main.json`):
  ```json
  "arjs": {
    "globalLibraryManagement": {
      "enforcedMessage": "Настройки источника библиотек управляются глобально администратором (текущий источник: {{source}})",
      "officialSource": "Официальный сервер",
      "kiberplanoSource": "Сервер Kiberplano"
    }
  }
  ```

- ✅ **English** (`apps/publish-frt/base/src/i18n/locales/en/main.json`):
  ```json
  "arjs": {
    "globalLibraryManagement": {
      "enforcedMessage": "Library source settings are managed globally by administrator (current source: {{source}})",
      "officialSource": "Official server",
      "kiberplanoSource": "Kiberplano server"
    }
  }
  ```

#### Component Updates:
- ✅ **ARJSPublisher.jsx**: Replaced hardcoded Russian text with parameterized t() function calls
- ✅ **Dynamic Source Translation**: Conditional translation of source names based on `globalSettings.defaultLibrarySource`
- ✅ **Template Literal Replacement**: Used i18next interpolation syntax `{{source}}` for dynamic content

#### Technical Implementation:
```jsx
{t('arjs.globalLibraryManagement.enforcedMessage', {
    source: globalSettings.defaultLibrarySource === 'official' 
        ? t('arjs.globalLibraryManagement.officialSource')
        : t('arjs.globalLibraryManagement.kiberplanoSource')
})}
```

### Build Validation:
- ✅ **TypeScript Compilation**: publish-frt package builds successfully without errors
- ✅ **i18n Namespace**: Properly integrated with existing `publish` namespace structure
- ✅ **Conditional Display**: Alert only shows when `globalSettings?.enforceGlobalLibraryManagement` is true

### Language Support:
- ✅ **Russian**: Complete support for enforcement mode alert and source names
- ✅ **English**: Complete support for enforcement mode alert and source names
- ✅ **Extensible**: Framework supports adding additional languages in the future

## Двухуровневое управление библиотеками AR.js (2025-01-16)

**Status**: ✅ **COMPLETED**

### Summary
Разработана гибкая система двухуровневого управления библиотеками AR.js и A-Frame, позволяющая администраторам устанавливать как приоритетные настройки по умолчанию, так и принудительное управление с полной блокировкой выбора пользователя.

### Features Implemented:

#### Уровень 1: Приоритетное управление
- ✅ **PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT=true**: Устанавливает глобальные настройки как приоритет по умолчанию
- ✅ **Пользовательский выбор**: Пользователи могут изменять источники библиотек при желании
- ✅ **Без ограничений UI**: Никаких предупреждений или блокировок интерфейса

#### Уровень 2: Принудительное управление  
- ✅ **PUBLISH_ENFORCE_GLOBAL_LIBRARY_MANAGEMENT=true**: Полное принудительное управление
- ✅ **Блокировка UI**: Отключение возможности выбора источников библиотек
- ✅ **Предупреждающие сообщения**: Отображение warning-сообщения о принудительном управлении

### Technical Implementation:

**Environment Variables:**
```bash
# Уровень 1: Приоритетное управление - устанавливает дефолты, но позволяет пользователю выбирать
PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT=true

# Уровень 2: Принудительное управление - полностью блокирует выбор пользователя  
PUBLISH_ENFORCE_GLOBAL_LIBRARY_MANAGEMENT=false

# Источник по умолчанию
PUBLISH_DEFAULT_LIBRARY_SOURCE=kiberplano
```

**Frontend Logic Priority:**
```javascript
if (globalSettings?.enforceGlobalLibraryManagement) {
    // УРОВЕНЬ 2: Принудительное управление - принудительно применить глобальные настройки
    setArjsSource(globalSettings.defaultLibrarySource)
    setAframeSource(globalSettings.defaultLibrarySource)
    // UI: disabled=true, warning message shown
} else if (savedSettings.libraryConfig) {
    // Использовать сохраненные настройки пользователя
    setArjsSource(savedSettings.libraryConfig.arjs?.source || 'official')
    setAframeSource(savedSettings.libraryConfig.aframe?.source || 'official')
} else if (globalSettings?.enableGlobalLibraryManagement) {
    // УРОВЕНЬ 1: Приоритетное управление - использовать как дефолт
    setArjsSource(globalSettings.defaultLibrarySource)
    setAframeSource(globalSettings.defaultLibrarySource)
    // UI: enabled=true, no warnings
} else {
    // Стандартные дефолты
    setArjsSource('official')
    setAframeSource('official')
}
```

### Use Cases:
- **Приоритетное управление**: Рекомендации для новых пользователей, но сохранение гибкости
- **Принудительное управление**: Корпоративные среды с строгими требованиями к инфраструктуре
- **Комбинированное использование**: Различные уровни контроля для разных окружений

### Build Validation:
- ✅ **TypeScript Compilation**: 27 пакетов успешно скомпилированы за 3м16с
- ✅ **No Errors**: Все изменения прошли проверку без ошибок компиляции

## UI Fixes for AR.js Publication Component (2025-01-16)

**Status**: ✅ **COMPLETED**

### Summary
Fixed two critical UI issues in ARJSPublisher component after global library management implementation:

1. **Default Values Issue**: Fixed library sources showing 'kiberplano' instead of 'official' when global management disabled
2. **Dialog Flickering**: Resolved dialog collapsing/flickering when switching to AR.js publication tab

### Technical Fixes:
- ✅ **useState Initial Values**: Changed from 'kiberplano' to 'official' for both arjsSource and aframeSource
- ✅ **Settings Initialization Flag**: Added settingsInitialized state to prevent multiple useEffect executions
- ✅ **useEffect Dependencies**: Removed globalSettings from loadSavedSettings dependencies to prevent unnecessary re-runs
- ✅ **Flow ID Reset Logic**: Added useEffect to reset settingsInitialized when flow.id changes

### Build Validation:
- ✅ **TypeScript Compilation**: All packages compiled successfully without errors
- ✅ **Project Structure**: 27 packages built successfully in 4m28s

## Global Library Management Enhancement (2025-01-16)

**Status**: ✅ **COMPLETED**

### Summary
Implemented comprehensive global library management system for AR.js and A-Frame libraries in publication settings, allowing administrators to centrally control library sources across all publications.

### Features Implemented:
- ✅ **Environment Configuration**: Added PUBLISH section to .env/.env.example with `PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT` and `PUBLISH_DEFAULT_LIBRARY_SOURCE` settings
- ✅ **Backend API**: Created `/api/v1/publish/settings/global` endpoint to expose server configuration to frontend
- ✅ **Frontend Integration**: Updated ARJSPublisher component to load and respect global settings
- ✅ **UI Enhancement**: Added visual indicators when global management is active
- ✅ **Permission Control**: Disabled library source selection when global management is enabled
- ✅ **Fallback Logic**: Maintains individual project settings when global management is disabled

### Technical Implementation:
```typescript
// Environment variables
PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT=false  // Enable global control
PUBLISH_DEFAULT_LIBRARY_SOURCE=kiberplano       // Default source (official|kiberplano)

// Frontend priority logic
if (globalSettings?.enableGlobalLibraryManagement) {
    // Use global settings - disable user controls
    setArjsSource(globalSettings.defaultLibrarySource)
    setAframeSource(globalSettings.defaultLibrarySource)
} else {
    // Use saved project settings or defaults
    setArjsSource(savedSettings.libraryConfig.arjs?.source || 'kiberplano')
}
```

### User Experience:
- Administrators can enable global management to enforce consistent library sources
- Users see clear indicators when settings are controlled globally
- Library source dropdowns are disabled with explanatory text when global management is active
- Individual projects retain their settings when global management is disabled

### Build Validation:
- ✅ Full project build successful (5m 9s)
- ✅ All TypeScript compilation clean
- ✅ No linting errors
- ✅ All package dependencies resolved correctly

## URL Parsing Bug Fix (2025-09-16)

**Status**: ✅ **COMPLETED**

### Summary
Fixed critical bug in AR.js Publisher where "unikId not found in URL" error prevented loading and saving publication settings.

### Root Cause:
- `getCurrentUrlIds()` function in `apps/publish-frt/base/src/api/common.ts` was using legacy `/uniks/` regex pattern
- After routing refactoring, frontend URLs changed from `/uniks/:unikId` to `/unik/:unikId` for individual operations
- Function couldn't extract `unikId` from new URL structure, causing AR.js publication to fail

### Solution Implemented:
- ✅ **Updated regex patterns**: Added support for both new singular `/unik/` and legacy `/uniks/` patterns
- ✅ **Backward compatibility**: Maintains support for legacy URLs while prioritizing new pattern
- ✅ **Code audit**: Verified no other URL parsing issues exist in codebase
- ✅ **Build validation**: publish-frt package compiles successfully without TypeScript errors
- ✅ **Documentation**: Updated systemPatterns.md with URL parsing best practices

### Technical Pattern:
```typescript
// Correct URL parsing approach
const unikSingularMatch = pathname.match(/\/unik\/([^\/]+)/)
const unikLegacyMatch = pathname.match(/\/uniks\/([^\/]+)/)
if (unikSingularMatch && unikSingularMatch[1]) {
    result.unikId = unikSingularMatch[1]
} else if (unikLegacyMatch && unikLegacyMatch[1]) {
    result.unikId = unikLegacyMatch[1]
}
```

### Outcome:
- AR.js Publisher now successfully loads and saves settings
- No "Failed to load saved settings" error in publication dialog
- Consistent URL parsing across platform
xed**

## AR.js Legacy Configuration Management System Bug Fixes (2025-01-16)

**Status**: ✅ **COMPLETED**

### Summary
Fixed critical issues in the legacy configuration management system including translation interpolation, dual alert display, and field accessibility in recommendation mode.

### Bug Fixes Implemented:

#### 1. Translation Interpolation Fixed:
- ✅ **Source Name Translation**: Fixed dynamic source name translation in alert messages
- ✅ **Parameter Mapping**: Corrected parameter name from `recommendedSource` to `source` to match translation keys
- ✅ **Conditional Translation**: Added proper conditional translation for 'official' vs 'kiberplano' source names

#### 2. Alert Display Logic Fixed:
- ✅ **Single Alert Display**: Added `isLegacyScenario` state to prevent dual alert display
- ✅ **Smart Alert Replacement**: Legacy alerts now replace standard enforcement messages instead of showing both
- ✅ **Alert Lifecycle Management**: Legacy alerts are cleared when user corrects configuration in recommendation mode

#### 3. Field Accessibility in Recommendation Mode:
- ✅ **Conditional Field Locking**: Fields are now editable in legacy recommendation mode (`autoCorrectLegacySettings: false`)
- ✅ **Enhanced Disabled Logic**: `disabled={!!publishedUrl || (globalSettings?.enforceGlobalLibraryManagement && (!isLegacyScenario || globalSettings?.autoCorrectLegacySettings))}`
- ✅ **Helper Text Conditional**: Helper text only shows when fields are actually disabled

#### 4. User Interaction Improvements:
- ✅ **Source Change Handlers**: Updated to allow changes in recommendation mode and clear legacy state when user complies
- ✅ **State Transition Logic**: Proper transition from legacy recommendation to standard enforcement when user changes sources
- ✅ **Real-time Feedback**: Alert automatically disappears when user sets both sources to match global requirements

### Technical Implementation:

#### Fixed Translation Interpolation:
```jsx
// Before: showing language keys
message: t('publish.globalLibraryManagement.legacyRecommendationMessage', {
    recommendedSource: globalSettings.defaultLibrarySource
})

// After: proper source name translation
message: t('publish.globalLibraryManagement.legacyRecommendationMessage', {
    source: globalSettings.defaultLibrarySource === 'official' 
        ? t('publish.globalLibraryManagement.officialSource')
        : t('publish.globalLibraryManagement.kiberplanoSource')
})
```

#### Fixed Field Accessibility Logic:
```jsx
// Before: always disabled in enforcement mode
disabled={!!publishedUrl || globalSettings?.enforceGlobalLibraryManagement}

// After: editable in legacy recommendation mode
disabled={!!publishedUrl || (globalSettings?.enforceGlobalLibraryManagement && (!isLegacyScenario || globalSettings?.autoCorrectLegacySettings))}
```

#### Fixed Alert Display Logic:
```jsx
// Standard alert only shows when NOT in legacy scenario
{globalSettings?.enforceGlobalLibraryManagement && !isLegacyScenario && (
    <Alert severity="info">Standard enforcement message</Alert>
)}
```

### Behavioral Scenarios Now Working:

#### Scenario 1: Legacy Recommendation Mode
- **Config**: `PUBLISH_AUTO_CORRECT_LEGACY_SETTINGS=false`
- **Behavior**: 
  - Single warning alert with proper source name translation
  - Fields editable for user to make changes
  - Alert disappears when user complies with global settings
  - Standard message appears after compliance

#### Scenario 2: Legacy Auto-Correction Mode
- **Config**: `PUBLISH_AUTO_CORRECT_LEGACY_SETTINGS=true`
- **Behavior**:
  - Single info alert with correction confirmation
  - Settings automatically updated to global requirements
  - Fields remain locked as expected
  - Standard message on subsequent visits

---

## AR.js Legacy Configuration Management System (2025-01-16)

**Status**: ✅ **COMPLETED**

### Summary
Implemented sophisticated legacy configuration handling for AR.js global library management system, allowing administrators to control how legacy spaces with conflicting library settings are handled - either through automatic correction or user recommendations.

### Changes Implemented:

#### 1. Environment Configuration:
- ✅ **Environment Variable**: Added `PUBLISH_AUTO_CORRECT_LEGACY_SETTINGS=true` to control legacy behavior
- ✅ **Documentation**: Comprehensive documentation in `.env.example` explaining auto-correction vs recommendation scenarios
- ✅ **Backend API**: Updated `publishController.ts` to expose `autoCorrectLegacySettings` flag

#### 2. Translation System:
- ✅ **Legacy Alert Messages**: Added `legacyCorrectedMessage` and `legacyRecommendationMessage` keys to both Russian and English locales
- ✅ **Interpolation Support**: Dynamic content using i18next interpolation for source names and recommendations
- ✅ **Fixed English Locale**: Resolved missing "coming soon" translation key

#### 3. Frontend Logic Implementation:
- ✅ **Legacy Detection**: Automatic detection of spaces with library configurations that don't match global requirements
- ✅ **Three-tier Handling**: 
  - New spaces: Apply global settings directly
  - Legacy with auto-correction: Automatically update settings and show info alert
  - Legacy with recommendations: Keep existing settings and show warning alert
- ✅ **Alert UI Component**: Added dismissible alert component to show legacy status messages
- ✅ **State Management**: Added `alert` state to track and display legacy configuration messages

#### 4. Testing & Validation:
- ✅ **Build Validation**: Confirmed both `publish-frt` and `publish-srv` build successfully
- ✅ **Translation Verification**: Verified correct translation key paths and interpolation
- ✅ **API Integration**: Confirmed backend exposes `autoCorrectLegacySettings` flag correctly

### Technical Architecture:

#### Legacy Detection Logic:
```jsx
const hasLegacyConfig = savedSettings.libraryConfig && 
    (savedSettings.libraryConfig.arjs?.source !== globalSettings.defaultLibrarySource ||
     savedSettings.libraryConfig.aframe?.source !== globalSettings.defaultLibrarySource)
```

#### Three-Scenario Handling:
1. **Auto-Correction Mode** (`autoCorrectLegacySettings: true`):
   - Updates settings to match global requirements
   - Shows blue info alert with correction message

2. **Recommendation Mode** (`autoCorrectLegacySettings: false`):
   - Preserves existing legacy settings
   - Shows orange warning alert with administrator recommendation

3. **New Spaces**:
   - Applies global settings directly without alerts

### Environment Variables:
```env
# Legacy Configuration Handling
PUBLISH_AUTO_CORRECT_LEGACY_SETTINGS=true
# When true: Auto-correct legacy space library settings to match global requirements
# When false: Show recommendation alerts but preserve existing settings
```

### Translation Keys Added:
```json
"globalLibraryManagement": {
    "legacyCorrectedMessage": "Library source settings have been automatically updated to comply with global administrator requirements (set to: {{source}})",
    "legacyRecommendationMessage": "Administrator recommends changing library source to {{source}} to comply with global settings"
}
```

---

## AR.js Global Library Management Alert Internationalization (2025-01-16)

**Status**: ✅ **COMPLETED**

### Summary
Internationalized the global library management alert message in AR.js Publisher component, replacing hardcoded Russian text with proper i18n keys supporting both Russian and English languages.

### Changes Implemented:

#### Translation Keys Added:
- ✅ **Russian** (`apps/publish-frt/base/src/i18n/locales/ru/main.json`):
  ```json
  "arjs": {
    "globalLibraryManagement": {
      "enforcedMessage": "Настройки источника библиотек управляются глобально администратором (текущий источник: {{source}})",
      "officialSource": "Официальный сервер",
      "kiberplanoSource": "Сервер Kiberplano"
    }
  }
  ```

- ✅ **English** (`apps/publish-frt/base/src/i18n/locales/en/main.json`):
  ```json
  "arjs": {
    "globalLibraryManagement": {
      "enforcedMessage": "Library source settings are managed globally by administrator (current source: {{source}})",
      "officialSource": "Official server",
      "kiberplanoSource": "Kiberplano server"
    }
  }
  ```

#### Component Updates:
- ✅ **ARJSPublisher.jsx**: Replaced hardcoded Russian text with parameterized t() function calls
- ✅ **Dynamic Source Translation**: Conditional translation of source names based on `globalSettings.defaultLibrarySource`
- ✅ **Template Literal Replacement**: Used i18next interpolation syntax `{{source}}` for dynamic content

#### Technical Implementation:
```jsx
{t('arjs.globalLibraryManagement.enforcedMessage', {
    source: globalSettings.defaultLibrarySource === 'official' 
        ? t('arjs.globalLibraryManagement.officialSource')
        : t('arjs.globalLibraryManagement.kiberplanoSource')
})}
```

### Build Validation:
- ✅ **TypeScript Compilation**: publish-frt package builds successfully without errors
- ✅ **i18n Namespace**: Properly integrated with existing `publish` namespace structure
- ✅ **Conditional Display**: Alert only shows when `globalSettings?.enforceGlobalLibraryManagement` is true

### Language Support:
- ✅ **Russian**: Complete support for enforcement mode alert and source names
- ✅ **English**: Complete support for enforcement mode alert and source names
- ✅ **Extensible**: Framework supports adding additional languages in the future

## Двухуровневое управление библиотеками AR.js (2025-01-16)

**Status**: ✅ **COMPLETED**

### Summary
Разработана гибкая система двухуровневого управления библиотеками AR.js и A-Frame, позволяющая администраторам устанавливать как приоритетные настройки по умолчанию, так и принудительное управление с полной блокировкой выбора пользователя.

### Features Implemented:

#### Уровень 1: Приоритетное управление
- ✅ **PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT=true**: Устанавливает глобальные настройки как приоритет по умолчанию
- ✅ **Пользовательский выбор**: Пользователи могут изменять источники библиотек при желании
- ✅ **Без ограничений UI**: Никаких предупреждений или блокировок интерфейса

#### Уровень 2: Принудительное управление  
- ✅ **PUBLISH_ENFORCE_GLOBAL_LIBRARY_MANAGEMENT=true**: Полное принудительное управление
- ✅ **Блокировка UI**: Отключение возможности выбора источников библиотек
- ✅ **Предупреждающие сообщения**: Отображение warning-сообщения о принудительном управлении

### Technical Implementation:

**Environment Variables:**
```bash
# Уровень 1: Приоритетное управление - устанавливает дефолты, но позволяет пользователю выбирать
PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT=true

# Уровень 2: Принудительное управление - полностью блокирует выбор пользователя  
PUBLISH_ENFORCE_GLOBAL_LIBRARY_MANAGEMENT=false

# Источник по умолчанию
PUBLISH_DEFAULT_LIBRARY_SOURCE=kiberplano
```

**Frontend Logic Priority:**
```javascript
if (globalSettings?.enforceGlobalLibraryManagement) {
    // УРОВЕНЬ 2: Принудительное управление - принудительно применить глобальные настройки
    setArjsSource(globalSettings.defaultLibrarySource)
    setAframeSource(globalSettings.defaultLibrarySource)
    // UI: disabled=true, warning message shown
} else if (savedSettings.libraryConfig) {
    // Использовать сохраненные настройки пользователя
    setArjsSource(savedSettings.libraryConfig.arjs?.source || 'official')
    setAframeSource(savedSettings.libraryConfig.aframe?.source || 'official')
} else if (globalSettings?.enableGlobalLibraryManagement) {
    // УРОВЕНЬ 1: Приоритетное управление - использовать как дефолт
    setArjsSource(globalSettings.defaultLibrarySource)
    setAframeSource(globalSettings.defaultLibrarySource)
    // UI: enabled=true, no warnings
} else {
    // Стандартные дефолты
    setArjsSource('official')
    setAframeSource('official')
}
```

### Use Cases:
- **Приоритетное управление**: Рекомендации для новых пользователей, но сохранение гибкости
- **Принудительное управление**: Корпоративные среды с строгими требованиями к инфраструктуре
- **Комбинированное использование**: Различные уровни контроля для разных окружений

### Build Validation:
- ✅ **TypeScript Compilation**: 27 пакетов успешно скомпилированы за 3м16с
- ✅ **No Errors**: Все изменения прошли проверку без ошибок компиляции

## UI Fixes for AR.js Publication Component (2025-01-16)

**Status**: ✅ **COMPLETED**

### Summary
Fixed two critical UI issues in ARJSPublisher component after global library management implementation:

1. **Default Values Issue**: Fixed library sources showing 'kiberplano' instead of 'official' when global management disabled
2. **Dialog Flickering**: Resolved dialog collapsing/flickering when switching to AR.js publication tab

### Technical Fixes:
- ✅ **useState Initial Values**: Changed from 'kiberplano' to 'official' for both arjsSource and aframeSource
- ✅ **Settings Initialization Flag**: Added settingsInitialized state to prevent multiple useEffect executions
- ✅ **useEffect Dependencies**: Removed globalSettings from loadSavedSettings dependencies to prevent unnecessary re-runs
- ✅ **Flow ID Reset Logic**: Added useEffect to reset settingsInitialized when flow.id changes

### Build Validation:
- ✅ **TypeScript Compilation**: All packages compiled successfully without errors
- ✅ **Project Structure**: 27 packages built successfully in 4m28s

## Global Library Management Enhancement (2025-01-16)

**Status**: ✅ **COMPLETED**

### Summary
Implemented comprehensive global library management system for AR.js and A-Frame libraries in publication settings, allowing administrators to centrally control library sources across all publications.

### Features Implemented:
- ✅ **Environment Configuration**: Added PUBLISH section to .env/.env.example with `PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT` and `PUBLISH_DEFAULT_LIBRARY_SOURCE` settings
- ✅ **Backend API**: Created `/api/v1/publish/settings/global` endpoint to expose server configuration to frontend
- ✅ **Frontend Integration**: Updated ARJSPublisher component to load and respect global settings
- ✅ **UI Enhancement**: Added visual indicators when global management is active
- ✅ **Permission Control**: Disabled library source selection when global management is enabled
- ✅ **Fallback Logic**: Maintains individual project settings when global management is disabled

### Technical Implementation:
```typescript
// Environment variables
PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT=false  // Enable global control
PUBLISH_DEFAULT_LIBRARY_SOURCE=kiberplano       // Default source (official|kiberplano)

// Frontend priority logic
if (globalSettings?.enableGlobalLibraryManagement) {
    // Use global settings - disable user controls
    setArjsSource(globalSettings.defaultLibrarySource)
    setAframeSource(globalSettings.defaultLibrarySource)
} else {
    // Use saved project settings or defaults
    setArjsSource(savedSettings.libraryConfig.arjs?.source || 'kiberplano')
}
```

### User Experience:
- Administrators can enable global management to enforce consistent library sources
- Users see clear indicators when settings are controlled globally
- Library source dropdowns are disabled with explanatory text when global management is active
- Individual projects retain their settings when global management is disabled

### Build Validation:
- ✅ Full project build successful (5m 9s)
- ✅ All TypeScript compilation clean
- ✅ No linting errors
- ✅ All package dependencies resolved correctly

## URL Parsing Bug Fix (2025-09-16)

**Status**: ✅ **COMPLETED**

### Summary
Fixed critical bug in AR.js Publisher where "unikId not found in URL" error prevented loading and saving publication settings.

### Root Cause:
- `getCurrentUrlIds()` function in `apps/publish-frt/base/src/api/common.ts` was using legacy `/uniks/` regex pattern
- After routing refactoring, frontend URLs changed from `/uniks/:unikId` to `/unik/:unikId` for individual operations
- Function couldn't extract `unikId` from new URL structure, causing AR.js publication to fail

### Solution Implemented:
- ✅ **Updated regex patterns**: Added support for both new singular `/unik/` and legacy `/uniks/` patterns
- ✅ **Backward compatibility**: Maintains support for legacy URLs while prioritizing new pattern
- ✅ **Code audit**: Verified no other URL parsing issues exist in codebase
- ✅ **Build validation**: publish-frt package compiles successfully without TypeScript errors
- ✅ **Documentation**: Updated systemPatterns.md with URL parsing best practices

### Technical Pattern:
```typescript
// Correct URL parsing approach
const unikSingularMatch = pathname.match(/\/unik\/([^\/]+)/)
const unikLegacyMatch = pathname.match(/\/uniks\/([^\/]+)/)
if (unikSingularMatch && unikSingularMatch[1]) {
    result.unikId = unikSingularMatch[1]
} else if (unikLegacyMatch && unikLegacyMatch[1]) {
    result.unikId = unikLegacyMatch[1]
}
```

### Outcome:
- AR.js Publisher now successfully loads and saves settings
- No "Failed to load saved settings" error in publication dialog
- Consistent URL parsing across platform

## TypeScript Path Aliases Refactoring (2025-09-16)

**Status**: ✅ **COMPLETED**

### Summary
Successfully refactored TypeScript path aliases across frontend applications, replacing long relative paths (`../../../../../packages/ui/src/*`) with clean aliases (`@ui/*`).

### Results Achieved:
- ✅ **finance-frt**: Migrated from 23+ long imports to @ui/* aliases
- ✅ **profile-frt**: Migrated 2 UI imports to @ui/* aliases  
- ✅ **resources-frt**: Already using @ui/* - standardized tsconfig
- ✅ **analytics-frt**: Already clean - standardized tsconfig
- ✅ **spaces-frt & metaverses-frt**: Already using @ui/* (reference implementations)
- ✅ **All builds passing**: 9 frontend apps compile and build successfully

### Technical Implementation:
- **Standardized tsconfig.json** pattern across all apps:
  ```json
  {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@ui/*": ["../../../packages/ui/src/*"],
      "@types/*": ["../../../apps/universo-platformo-types/base/src/*"],
      "@utils/*": ["../../../apps/universo-platformo-utils/base/src/*"]
    }
  }
  ```
- **Build System**: Confirmed compatibility with tsc+gulp (not Vite)
- **PNPM Workspaces**: Works with existing link-workspace-packages=deep
- **Tool Created**: `tools/check-imports.js` for future monitoring

### Remaining Notes:
- **Internal imports** in publish-frt, template-mmoomm, template-quiz still use relative paths (within same apps)
- These are internal architectural decisions, not cross-package dependencies
- All packages/ui imports successfully migrated to @ui/* aliases

**MVP Objective Achieved**: Clean, maintainable imports from UI package to frontend apps.

---

**As of 2025-01-21 | v0.29.0-alpha | [Backup](progress.md.backup-2)**

## Completed (chronological)

| Release          | Date       | Highlights                                                                                   |
| ---------------- | ---------- | -------------------------------------------------------------------------------------------- |
| 0.1.0‑pre‑alpha  | 2025‑03‑03 | Initial project scaffold                                                                     |
| 0.2.0‑pre‑alpha  | 2025‑03‑11 | Multi‑user Supabase foundation                                                               |
| 0.3.0‑pre‑alpha  | 2025‑03‑17 | Basic Uniks functionality                                                                    |
| 0.4.0‑pre‑alpha  | 2025‑03‑25 | Full Uniks feature‑set                                                                       |
| 0.5.0‑pre‑alpha  | 2025‑03‑30 | Document Store, Templates, i18n                                                              |
| 0.6.0‑pre‑alpha  | 2025‑04‑06 | Chatbots module, Auth UI, language refactor                                                  |
| 0.7.0‑pre‑alpha  | 2025‑04‑16 | First AR.js marker scene prototype                                                           |
| 0.8.0‑pre‑alpha  | 2025‑04‑22 | Enhanced Supabase auth, Memory Bank structure                                                |
| 0.8.5‑pre‑alpha  | 2025‑04‑29 | UPDL to A-Frame converter, publication flow                                                  |
| 0.9.0‑pre‑alpha  | 2025‑05‑12 | Refactored Publish & Export interface, ARJSPublisher/ARJSExporter separation                |
| 0.10.0‑pre‑alpha | 2025‑05‑08 | Memory bank updates, Publishing/UPDL enhancement                                             |
| 0.11.0‑pre‑alpha | 2025‑05‑15 | Global refactoring Stage 2, Gulp task manager, app separation                                |
| 0.12.0‑pre‑alpha | 2025‑05‑22 | Removed pre-generation test, UPDL export cleanup                                             |
| 0.13.0‑pre‑alpha | 2025‑05‑28 | AR.js library selection, flexible UPDL assembly                                              |
| 0.14.0‑pre‑alpha | 2025‑06‑04 | AR.js library loading, AR bot removal, cleanup                                               |
| 0.15.0‑pre‑alpha | 2025‑06‑13 | Flowise 3.0.1 upgrade attempt (rollback to 2.2.7), UPDL scoring                             |
| 0.16.0‑pre‑alpha | 2025‑06‑21 | Russian localization fixes, analytics separation, profile enhancements                       |
| 0.17.0‑pre‑alpha | 2025‑06‑25 | Enhanced user profile fields, menu updates, profile-srv workspace conversion                |
| 0.18.0‑pre‑alpha | 2025‑07‑01 | Flowise 2.2.8 upgrade, TypeScript compilation fixes, TypeORM conflicts resolution          |
| 0.19.0‑pre‑alpha | 2025‑07‑06 | High-level UPDL nodes, PlayCanvas integration, template-first architecture, MMOOMM foundation |
| 0.20.0‑alpha     | 2025‑07‑13 | **Alpha status achieved** - Tools Revolution, complete UPDL system, PlayCanvas rendering    |
| 0.21.0‑alpha     | 2025‑07‑20 | Firm Resolve - Memory Bank optimization, MMOOMM stabilization, improved ship controls       |
| 0.22.0‑alpha     | 2025‑07‑27 | Global Impulse - laser mining, inventory consolidation, ship refactor, resource density     |
| 0.23.0‑alpha     | 2025‑08‑05 | Vanishing Asteroid - Russian docs, MMOOMM fixes, custom modes, conditional UPDL parameters |
| 0.24.0‑alpha     | 2025‑08‑12 | Stellar Backdrop - Space Builder, AR.js wallpaper mode, MMOOMM extraction, Uniks separation |
| 0.25.0‑alpha     | 2025‑08‑17 | Gentle Memory - Space Builder multi-provider, Metaverse MVP, core packages (@universo-platformo) |
| 0.26.0‑alpha     | 2025‑08‑24 | Slow Colossus - MMOOMM modular package, Colyseus multiplayer, PlayCanvas architecture       |
| 0.27.0‑alpha     | 2025‑08‑31 | Stable Takeoff - template modularization, Finance integration, build order stabilization    |
| 0.28.0‑alpha     | 2025‑09‑07 | Orbital Switch - Resources/Entities modules, Spaces refactor, cluster isolation            |
| 0.29.0‑alpha     | 2025‑01‑21 | Routing Consistency - Fixed Unik navigation, singular API routing, parameter transformation, nested routing bug fixes (resolved intermittent 400/412 via id→unikId middleware + controller fallback) + **Parameter Unification** (2025-01-22): Eliminated middleware transformation and fallback patterns, unified all nested routes to use :unikId parameter consistently |

## Stage 2 Lessons Learned

Initial AR.js implementation challenges: hybrid architecture complexity, unclear AR.js/A-Frame separation, disconnected UPDL nodes, build process failures in production, improper localization structure, unnecessary UPDL export duplication. These insights informed the simplified Stage 3 architecture.

## Major Achievements

- **Singular API Routing** (2025-01-21): Comprehensive routing restructure: three-tier backend architecture (/uniks collections, /unik individual operations, /unik/:id/resources nested), frontend navigation consistency, API endpoint pattern unification
- **Resources Cluster Isolation** (2025-09-10): Three-tier architecture, data isolation, CASCADE constraints, cluster-scoped endpoints, Material-UI validation, EN/RU docs
- **Template Modularization** (2025-08-30): Dedicated packages (`@universo-platformo/types`, `@universo-platformo/utils`, template packages), TemplateRegistry, dual build (CJS+ESM+Types)
- **Multiplayer Colyseus** (2025-08-22): MMOOMMRoom (16-player), type-safe schemas, server-authoritative gameplay, mining/trading, UPDL integration
- **MMOOMM Extraction** (2025-08-22): Workspace package with dual build, PlayCanvas builders, handlers, multiplayer support
- **Core Types Package** (2025-08-14): ECS types, networking DTOs, error codes, protocol version, EN/RU docs
- **Core Utils Package** (2025-08-14): Validation (Zod), delta ops, serialization, networking, UPDL schemas
- **Space Builder Test Mode** (2025-08-13): `/config` endpoint, OpenAI-compatible providers, test-only UI enforcement
- **AR.js Wallpaper Mode** (2025-08-12): Markerless AR, wallpaper selector, renderConfig persistence, animated sphere
- **UPDL Refactoring**: Removed updl-srv, renamed updl-frt to updl, pure node definitions
- **App Structure Standardization**: Directory structure, features migration, asset management, REST API, docs
- **Build Order & Finance** (2025-08-31): Workspace dependencies, circular removal, i18n unification, Finance integration
- **Metaverse MVP** (2025-08-14): Backend Express router, TypeORM migrations, frontend MetaverseList, dual build

## Current Status ✅ **ALPHA ACHIEVED**

**Platform Status:** Alpha v0.28.0 - Production-ready stability achieved (September 2025)

**Core Foundation:**
- APPs architecture with 15+ working applications
- High-level UPDL node system (7 core abstract nodes) 
- Multi-technology export (AR.js, PlayCanvas)
- Template-first architecture with reusable templates
- Supabase multi-user authentication with enhanced profiles
- Universo MMOOMM foundation for MMO development

**Architecture Principles:**
- **UPDL** → Universal abstract nodes for cross-platform development
- **Template System** → Reusable export templates across technologies  
- **Multi-Technology** → AR.js (production), PlayCanvas (ready), extensible architecture
- **Flowise 2.2.8** → Enhanced platform with TypeScript modernization

## UPDL Architecture Simplification ✅

Eliminated `updl-srv` - Flowise server provides all backend functionality. Simplified `updl` app to pure node definitions only. Clean separation of concerns, reduced code duplication, simplified maintenance.

## Key Technical & Recent Achievements

**Systems & Engines**
- Laser Mining System (2025-07-26): Auto-target, mining state machine, 3s cycles, PlayCanvas beam, inventory sync.
- High-Level UPDL Nodes (2025-01-29): 7 abstract nodes unified; connector logic fixed; centralized types.
- Template-First Refactor (2025-01-27): publish-frt migrated to template-first folder structure (builders/templates/...), zero TS errors, doc sync.
- Template Architecture (2025-06-30): Modular template system (`AbstractTemplateBuilder`, `TemplateRegistry`).

**Space Builder Evolution (Aug 2025)**
- MVP generation: Prompt → validated UPDL graph; multi-provider backend; EN/RU docs.
- Deterministic builder: Local quizPlan → stable layout; 5000 char input limit.
- UI refinements: 3-step flow, model settings modal, creation modes, safer append.
- Constraints & Iteration: additionalConditions + /revise endpoint for targeted quiz plan edits, validation preserving structure.

**AR.js & Visual**
- Wallpaper Mode (2025-08-12): Markerless mode + renderConfig persistence.
- Icons & Visual Identity: Unique SVG icons for all core UPDL nodes.

**Stabilization & Refactors**
- Spaces + Canvases Refactor (2025-09-07): State race fixed, local API/hooks, UI cleanup.
- Spaces-FRT Packaging Refresh (2025-09-19): TS build configs (compact tsconfig + tsconfig.types), API migration to TS, Vitest mocks + test target, README updates.
- Ship Movement Optimization (2025-01-27): Physics fallback + clean logging.
- Profile-SRV Package (2025-06-24): Scoped package conversion.

**Data & Processing**
- UPDL Objects Multiplayer Fix (2025-08-20): Correct entity extraction & sync (7 entities confirmed).
- Universal Data Extraction Fix (2025-01-26): Corrected field mapping & positions.

**Security & Auth**
- Auth PoC (2025-08-14): Passport local, CSRF, session hardening (isolated – not integrated yet).
- Auth Session Integration (2025-09-21): `@universo/auth-srv` mounted in packages/server with express-session, `@universo/auth-frt` consumed by packages/ui (cookie/CSRF flow).

**Documentation & Quality**
- Memory Bank Optimization (Firm Resolve 0.21.0): Structure + cross-references.
- Docs & Code Cleanup (2024-12-19): Streamlined ARJS publishing pipeline.

**Uniks & Entity Integrity**
- Uniks Extraction (2025-08-07): Modular packages, build stabilization.
- MMOOMM Entity Transform Fix (2025-08-06): Removed hardcoded transforms.

## Future Roadmap (Condensed)
- UPDL: Physics, Animation, Networking nodes; multi-scene orchestration.
- MMOOMM: Expand mechanics, territorial control, deeper multiplayer loops.
- Deployment: Production infra, performance & security hardening.
- Community: Template sharing, collaborative editing, component marketplace.

## Recently Completed Enhancements (Summary)
- Uniks modularization → stable builds & maintainability.
- Entity transform de-hardcoding → UPDL fidelity restored.
- Multiplayer UPDL objects → correct scene entity sync.
- Auth PoC → secured session model (pending integration).
- Spaces/Canvases refactor → deterministic hydration & cleaner UI.
- Unik List UI refinement → Category/Nodes columns replaced with Spaces count; rename dialog now pre-fills current name via initialValue, placeholder removed for edits.
- Unik singular route `/unik/:unikId` implemented; table links fixed, menu system updated, mass navigation path replacement; UI build validated.
### 2025-09-21 — Passport.js session hardening

Highlights:
- Moved the shared `ensureAuth` middleware into `@universo/auth-srv` with typed session helpers and updated the server to consume it directly.
- Replaced all Basic Auth usage in the UI (header, dialogs, async dropdowns, streaming chat) with the shared auth client from `@universo/auth-frt`, including CSRF-aware SSE requests.
- Updated CLI flags, docker configs, and EN/RU/ES documentation to describe the Supabase + Passport.js session flow and removed references to `FLOWISE_USERNAME/FLOWISE_PASSWORD`.
### 2025-09-20 — Restore PropTypes bundling in Flowise UI

Issue:
- Production build crashed with `PropTypes is not defined` when loading `/build/assets/index-*.js`.
- `packages/ui/src/layout/MainLayout/Header/ProfileSection/index.jsx` still assigned `Component.propTypes` but missed the `prop-types` import after upstream refactors.

Resolution:
- Reintroduced an explicit `import PropTypes from 'prop-types'` (grouped under third-party imports) so Vite keeps the dependency during tree shaking.
- Audited the codebase to confirm other components already use `import * as PropTypes` and require no further fixes.
- Documented a follow-up plan to migrate away from PropTypes using the official React 19 codemod.

Validation:
- `pnpm --filter flowise-ui build` (completes successfully in ~65s; noted CLI 60s timeout message but build finishes with `✓ built`).
- Manual grep over `packages/ui/build/assets` confirmed hashed bundle now resolves PropTypes via the minified alias (`me`).

### 2025-09-20 — Auth UI regression & registration support

Issue:
- `/auth` page kept reloading, preventing input because the shared Axios client redirected to `/auth` on every 401 response; `useSession` hits `/auth/me` even on the auth route.
- New minimalist login form replaced the previous MUI layout and removed registration, breaking expected UX.

Resolution:
- Added a pathname guard to the Axios 401 interceptor (`packages/ui/src/api/client.js`) to skip redirects while already on `/auth`.
- Restored the legacy MUI-based login/registration form in `packages/ui/src/views/up-auth/Auth.jsx`, reusing the new session-aware auth context.
- Implemented a CSRF-protected `/api/v1/auth/register` endpoint in `@universo/auth-srv` that signs users up via Supabase.

Validation:
- `pnpm --filter @universo/auth-srv exec tsc --noEmit` and `tsc -p tsconfig.esm.json --noEmit` (type checks pass).
- `pnpm --filter flowise-ui build` (completes successfully in ~51s; timeout message observed but build ends with `✓ built`).

### 2025-09-20 — Shared Auth UI extraction & session refresh hardening

Issue:
- Even after redirect guard the login flow flickered because the generic Axios client still redirected on 401 responses and `login()` did not surface refresh failures.
- The restored login/register screen lived only inside `packages/ui`, preventing reuse in other React shells.

Resolution:
- Updated `packages/ui/src/api.js` to skip `/auth` redirects and revamped `authProvider.login()` to throw when `useSession.refresh()` cannot retrieve the current user.
- Made `useSession.refresh()` (in `@universo/auth-frt`) return the fetched user and exported a reusable `AuthView` component matching the legacy MUI layout with customizable slots.
- Rewired `packages/ui/src/views/up-auth/Auth.jsx` to consume `AuthView`, supply localization labels, and keep the existing `MainCard` styling via slot overrides while delegating registration to the shared component. Added guards in `useAuthError`, `authProvider.logout()`, and normalized `@universo/uniks-srv` user ID resolution (`user.id` fallback instead of `user.sub`) to stop infinite logout loops triggered by 401 responses on `/api/v1/uniks`.
- Server-side Supabase client now prefers `SUPABASE_SERVICE_ROLE_KEY` (fallback to anon) and disables session persistence so authenticated API routes can bypass RLS when required.

### 2025-09-21 — Uniks schema access fixes

Issue:
- После переноса таблиц в схему `uniks` PostgREST отвечал `PGRST106` (schema not exposed), запросы падали, insert-ы блокировались политиками.

Resolution:
- Переписали REST-слой Uniks на TypeORM: прямые обращения к PostgreSQL через `Unik`/`UnikUser`, валидация payload через zod, унификация ответов.
- Удалили использование Supabase REST и вспомогательные fallback-ветки, вместо этого используем репозитории и RLS/ACL на уровне базы.
- Пересобрали тесты на mock-репозиториях TypeORM и успешно прогнали `pnpm --filter @universo/uniks-srv exec tsc --noEmit`.

Validation:
- `pnpm --filter @universo/auth-frt exec tsc --noEmit`
- `pnpm --filter @universo/auth-frt exec tsc -p tsconfig.esm.json --noEmit`
- `pnpm --filter @universo/uniks-srv exec tsc --noEmit`
- `pnpm --filter flowise-ui build` (completes in ~44s; build log shows `✓ built`).

### 2025-09-23 — Unik deletion cascade cleanup

Issue:
- Deleting a Unik via REST removed the workspace row but left orphaned canvases, chat history, and Document Store references because the router called `unikRepo.delete` directly without replicating the manual cascade implemented in `SpacesService.deleteSpace`.

Resolution:
- Wrapped Unik deletion in a single transaction (`createUnikIndividualRouter`) that verifies ownership, gathers all related space and canvas identifiers, removes their `spaces_canvases` links, and deletes orphan canvases alongside chat messages, feedback, leads, and upsert history rows.
- Added Document Store hygiene by stripping deleted canvas IDs from `document_store.whereUsed` and scheduled storage cleanup via `removeFolderFromStorage` for each removed canvas.
- Extended Jest coverage with transactional route tests (mocked manager/transaction) and a helper-focused scenario using an in-memory manager to prove that spaces, canvases, chat artefacts, and Document Store metadata are purged.

Validation:
- `pnpm --filter @universo/uniks-srv test`

### 2025-09-24 — Shared purge helper for spaces cleanup

Issue:
- Unik deletion and single-space deletion executed separate cascade implementations, leading to duplicated SQL and inconsistent cleanup of canvases, chat artefacts, and Document Store metadata across packages.

Resolution:
- Decoupled the `Space` entity from a direct `@universo/uniks-srv` import (string-based relation plus `unikId` column) to break the workspace dependency cycle and allow cross-package helper reuse.
- Introduced `purgeSpacesForUnik` under `@universo/spaces-srv`, consolidating space/canvas collection, chat table pruning, Document Store updates, and returning canvas IDs for storage cleanup.
- Refactored `SpacesService.deleteSpace` and the Unik DELETE route to call the shared helper inside existing transactions, updated Jest suites, and added dedicated helper tests covering multi-space and targeted deletions.

Validation:
- `pnpm --filter @universo/spaces-srv test`
- `pnpm --filter @universo/uniks-srv test`
### 2025-09-23 — Canvas versioning backend groundwork

- Updated the Spaces Supabase migration (Postgres/SQLite) to add canvas version metadata, enforce one active version per group via indexes, and seed existing rows with group ids.
- Extended TypeORM entities plus Flowise `ChatFlow` model with version fields, added REST endpoints for listing/creating/activating/deleting versions, and introduced a stub declaration for `flowise-components` in the spaces service.
- Enhanced `SpacesService` logic and Flowise chatflow auto-provisioning to respect version groups; Jest suite `pnpm --filter @universo/spaces-srv test` passes with updated fixtures and expectations.
