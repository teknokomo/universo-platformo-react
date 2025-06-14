# Current Research Context

## 🎯 ACTIVE: Flowise 2.2.8 Upgrade & Chatbot Refactoring Research

### APPs Architecture Implementation Research ✅

**Status**: COMPLETED - All research objectives achieved

#### APPs Architecture Pattern Analysis

-   ✅ **4 Applications Successfully Implemented**: UPDL, Publish-FRT, Publish-SRV, Analytics-FRT
-   ✅ **TypeScript + JSX Integration**: Solved with `allowJs: true` pattern in tsconfig.json
-   ✅ **Modular Build System**: Consistent TypeScript + Gulp pipeline across all applications
-   ✅ **Alias Integration**: Clean integration with main UI via `@apps/*` aliases

#### Results Achieved:

-   **UPDL Application**: Pure node definitions with Data nodes for quiz functionality
-   **Publish Frontend**: Complete AR.js builder with iframe rendering and multi-object support
-   **Publish Backend**: Integrated with main Flowise server, quiz results storage
-   **Analytics Frontend**: Single component architecture with JSX integration

### 🔍 NEXT: Flowise Upgrade & Chatbot Refactoring Research

#### Research Questions for Platform Upgrade:

1. **Breaking Changes**: What API changes exist between Flowise 2.2.7-patch.1 and 2.2.8?
2. **Dependency Updates**: Which packages need version updates and compatibility checks?
3. **Custom Integration Points**: How will UPDL nodes and APPs architecture be affected?
4. **Chatbot Extraction**: What components need to be moved to separate chatbot-frt application?

#### Research Areas:

-   **Flowise 2.2.8 Changelog**: Study official release notes and breaking changes
-   **Dependency Compatibility**: Research package version compatibility matrix
-   **Migration Strategy**: Plan step-by-step upgrade process with rollback options
-   **Chatbot Architecture**: Design chatbot-frt application following proven APPs pattern

### 🏗️ Technical Research Focus

#### Platform Upgrade Considerations:

-   **Backward Compatibility**: Ensure all 4 existing applications continue working
-   **UPDL Node Compatibility**: Verify node definitions work with new Flowise version
-   **API Stability**: Check publication system API compatibility
-   **Build Process**: Ensure all TypeScript + Gulp pipelines remain functional

#### Chatbot Refactoring Strategy:

-   **Component Identification**: Map chatbot-specific components in main UI
-   **Dependency Analysis**: Identify chatbot dependencies and shared utilities
-   **Integration Points**: Design clean API between chatbot-frt and main application
-   **Migration Path**: Plan gradual migration without breaking existing functionality

### 📚 Background Context

#### Current Technology Stack:

-   **Base**: Flowise 2.2.7-patch.1 (stable) → **Target**: Flowise 2.2.8
-   **APPs Architecture**: 4 applications successfully implemented and working
-   **Custom Features**: Supabase auth, Uniks workspaces, i18n, UPDL nodes with quiz support
-   **AR Technology**: AR.js with A-Frame, iframe rendering, local library serving
-   **UI Framework**: React with Material-UI + modular APPs integration

#### Proven Patterns:

-   **APPs Architecture**: 4 applications working in production with clean separation
-   **UPDL System**: Complete AR.js export with quiz functionality and lead collection
-   **TypeScript + JSX**: `allowJs: true` pattern for mixed TypeScript/JSX applications
-   **Publication Flow**: Integrated with main Flowise server, `/p/{uuid}` URLs working
-   **Multi-language**: English/Russian support with modular namespace architecture
-   **Build System**: Consistent TypeScript + Gulp pipeline across all applications
