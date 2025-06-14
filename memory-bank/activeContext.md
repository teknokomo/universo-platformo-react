# Current Active Context

## CURRENT PROJECT FOCUS: Flowise 2.2.8 Upgrade & Chatbot App Refactoring

### 🎯 Primary Objective

Upgrade Flowise platform and refactor chatbot functionality into modular apps architecture:

1. **Flowise Upstream Upgrade** - Update from 2.2.7-patch.1 to 2.2.8
2. **Chatbot App Refactoring** - Move chatbot functionality to separate `apps/chatbot-frt` structure
3. **Preserve existing functionality** - Maintain all UPDL, AR.js, and analytics capabilities

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

-   **Base Version**: Flowise 2.2.7-patch.1 (stable) → **Target**: Flowise 2.2.8
-   **Custom Features**: Fully functional (Supabase auth, Uniks, i18n, UPDL, AR.js quizzes)
-   **APPs Architecture**: 4 applications successfully implemented
-   **Last Achievement**: Analytics-FRT application setup completed
-   **Current Focus**: Flowise upgrade and chatbot refactoring

### 🎯 NEXT PHASE: Flowise 2.2.8 Upgrade & Chatbot Refactoring

**Priority**: HIGH | **Complexity**: Level 2 (Simple Enhancement)

#### **Planned Tasks:**

1. **Flowise Upstream Upgrade**:

    - Review Flowise 2.2.8 changelog and breaking changes
    - Update package.json dependencies
    - Resolve any API changes or deprecations
    - Test core functionality after upgrade
    - Verify UPDL nodes still work correctly

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

#### **Technology Stack:**

-   **Frontend**: React with Material-UI + APPs architecture
-   **Backend**: Node.js with TypeScript + integrated publication system
-   **Database**: Supabase (PostgreSQL) with quiz results storage
-   **Authentication**: Supabase Auth with multi-user support
-   **Internationalization**: English/Russian support with modular namespaces
-   **UPDL System**: Complete node system for AR.js export with quiz support
-   **AR Technology**: AR.js with A-Frame + local library serving

### 💡 Strategic Approach

1. **Maintain Stability**: Keep current working APPs architecture intact
2. **Incremental Upgrade**: Update Flowise version step by step
3. **Preserve Compatibility**: Ensure all existing features continue working
4. **Modular Refactoring**: Move chatbot to separate app following established pattern
5. **Test Thoroughly**: Verify all applications work after upgrade

**COMPLEXITY LEVEL**: **Level 2** (Simple Enhancement)
**ESTIMATED IMPACT**: Updated platform + improved modular architecture
**RISK LEVEL**: Low (building on proven APPs architecture)
