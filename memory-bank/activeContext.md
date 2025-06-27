# Current Active Context

## CURRENT PROJECT FOCUS: Chatbot App Refactoring & Platform Enhancement

### 🎯 Primary Objective

Continue platform modernization following successful Flowise 2.2.8 upgrade with chatbot functionality refactoring:

1. **Flowise Upstream Upgrade** - ✅ COMPLETED: Updated from 2.2.7-patch.1 to 2.2.8
2. **Chatbot App Refactoring** - Move chatbot functionality to separate `apps/chatbot-frt` structure
3. **Preserve existing functionality** - Maintain all UPDL, AR.js, and analytics capabilities

### ✅ COMPLETED: Profile-SRV Workspace Package Conversion

**Status**: **COMPLETED** ✅ Profile service successfully converted to workspace package

#### **Profile-SRV Workspace Package:**

-   **Package Name**: `@universo/profile-srv` - Scoped workspace package
-   **Purpose**: Backend profile service with clean import system
-   **Integration**: Main server imports via `import { Profile, profileMigrations, createProfileRoutes } from '@universo/profile-srv'`
-   **Architecture**: Eliminated complex relative paths, prepared for future plugin extraction
-   **Build System**: Automatic dependency resolution via pnpm workspace

#### **Technical Achievement:**

-   🔧 **Clean Imports**: Replaced relative paths with workspace package imports
-   ✅ **Verified**: All builds pass successfully, runtime working correctly
-   📦 **Package Structure**: Professional scoped package with proper exports
-   🚀 **Future-Ready**: Prepared for extraction to separate repository

### ✅ COMPLETED: Analytics-FRT Application Setup

**Status**: **COMPLETED** ✅ Analytics functionality successfully refactored into separate app

#### **Analytics-FRT Application:**

-   **Location**: `apps/analytics-frt/` - Separate analytics application
-   **Purpose**: Analytics functionality refactored from Flowise core
-   **Build**: TypeScript + Gulp pipeline with `allowJs: true` configuration
-   **Integration**: Imported via alias `@apps/analytics-frt` in main UI
-   **Component**: Single React component `AnalyticsPage` in `src/pages/Analytics.jsx`

#### **Technical Achievement:**

-   🔧 **Build Fix**: Resolved TypeScript TS7016 error by adding `"allowJs": true` to tsconfig.json
-   ✅ **Verified**: Both individual and full project builds working correctly
-   📁 **Architecture**: Clean separation following APPs architecture pattern

### 🔄 Current Project State

-   **Base Version**: Flowise 2.2.8 (upgraded successfully) ✅
-   **Custom Features**: Fully functional (Enhanced Supabase auth, Secure profile management, Uniks, i18n, UPDL, AR.js quizzes)
-   **APPs Architecture**: 5 applications successfully implemented
-   **Last Achievement**: Profile-SRV workspace package conversion completed
-   **Security Level**: Enhanced with current password verification for password changes

### 🎯 NEXT PHASE: Chatbot App Refactoring & Platform Enhancement

**Priority**: HIGH | **Complexity**: Level 2 (Simple Enhancement)

#### **Completed Tasks:**

1. **Flowise Upstream Upgrade**: ✅ COMPLETED

    - ✅ Reviewed Flowise 2.2.8 changelog and resolved breaking changes
    - ✅ Updated package dependencies and service APIs
    - ✅ Resolved API changes (ASSISTANT type support, export-import enhancements)
    - ✅ Tested core functionality - all systems operational
    - ✅ Verified UPDL nodes work correctly with new version

#### **Next Tasks:**

2. **Chatbot Application Refactoring**:
    - Create `apps/chatbot-frt/` directory structure
    - Move chatbot functionality from Flowise core to separate app
    - Set up TypeScript build configuration
    - Configure integration with main UI via alias
    - Test chatbot functionality in new structure

### 🏗️ Current APPs Architecture

#### **Implemented Applications:**

1. **UPDL (`apps/updl/`)**: Universal Platform Definition Language

    - Pure node definitions for Flowise editor
    - Space, Object, Camera, Light, Data nodes
    - Two-layer interface system (core + integration)
    - Multi-scene support with quiz functionality

2. **Publish Frontend (`apps/publish-frt/`)**: Publication system frontend

    - Modular API architecture with technology-specific clients
    - AR.js builder with iframe-based rendering
    - Multi-object support with circular positioning
    - Library configuration system (CDN vs local)
    - Quiz support with lead collection

3. **Publish Backend (`apps/publish-srv/`)**: Publication system backend

    - Integrated with main Flowise server
    - AR.js publication API with streaming generation
    - Static library serving for CDN-blocked regions
    - Quiz results storage in Supabase

4. **Analytics Frontend (`apps/analytics-frt/`)**: Analytics functionality

    - Single React component for quiz analytics
    - TypeScript + JSX integration with `allowJs: true`
    - Imported via `@apps/analytics-frt` alias

5. **Profile Frontend (`apps/profile-frt/`)**: Enhanced user profile management

    - **Secure password change**: Current password verification required
    - **Email management**: Update email with confirmation flow
    - **Full internationalization**: Russian/English localization
    - **Security features**: Bcrypt hashing, input validation, error handling
    - **Backend integration**: Custom SQL functions for secure user data updates

6. **Profile Backend (`@universo/profile-srv`)**: Workspace package backend service
    - **Workspace Package**: Scoped package with clean import system
    - **Professional Architecture**: Eliminated complex relative paths
    - **Future-Ready**: Prepared for extraction to separate repository
    - **Clean Integration**: Main server imports via workspace dependency

#### **Technology Stack:**

-   **Frontend**: React with Material-UI + APPs architecture
-   **Backend**: Node.js with TypeScript + integrated publication system
-   **Database**: Supabase (PostgreSQL) with enhanced authentication and secure profile management
-   **Authentication**: Enhanced Supabase Auth with secure profile updates and multi-user support
-   **Security**: Bcrypt password hashing, current password verification, SQL functions with SECURITY DEFINER
-   **Internationalization**: English/Russian support with modular namespaces and full error message localization
-   **UPDL System**: Complete node system for AR.js export with quiz support
-   **AR Technology**: AR.js with A-Frame + local library serving

### 💡 Strategic Approach

1. **Maintain Security**: Keep enhanced profile security features intact
2. **Incremental Upgrade**: Update Flowise version step by step
3. **Preserve Compatibility**: Ensure all existing features continue working
4. **Modular Refactoring**: Move chatbot to separate app following established pattern
5. **Test Thoroughly**: Verify all applications work after upgrade

**COMPLEXITY LEVEL**: **Level 2** (Simple Enhancement)
**ESTIMATED IMPACT**: Updated platform + improved modular architecture + enhanced security
**RISK LEVEL**: Low (building on proven APPs architecture)
