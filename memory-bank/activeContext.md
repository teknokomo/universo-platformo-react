# Current Active Context

## MAJOR PROJECT INITIATIVE: Flowise 3.0.1 Upgrade

### 🎯 Primary Objective

Upgrade project from **Flowise 2.2.7-patch.1** to **Flowise 3.0.1** while preserving all custom functionality:

1. **Multi-user authentication via Supabase** (instead of single-user)
2. **Uniks functionality** (workspace concept with hierarchical entities)
3. **Internationalization** (English/Russian language support)
4. **UPDL nodes** (universal nodes for high-level logic with AR.js export)

### 🆕 New Flowise 3.0.1 Features to Integrate

-   **New Agents functionality**
-   **Passport.js authentication system**
-   **Updated node components**
-   **Various system improvements**

### 📋 Codex Task Categories (15 Major Tasks)

#### **PHASE 1: Foundation Updates (Low Risk)**

1. **Upgrade workspace dependencies and lockfile** - Update package.json and pnpm-lock.yaml
2. **Sync component nodes** - Replace packages/components (no custom changes)
3. **Apply new database migrations** - Import latest migrations

#### **PHASE 2: Architecture Updates (Medium Risk)**

4. **Update server architecture** - Merge server core changes
5. **Integrate Passport authentication with Supabase** - Adapt new auth to work with Supabase
6. **Align database entities with new features** - Sync server entities
7. **Refresh server utilities and helpers** - Update helper functions

#### **PHASE 3: API & Routes (Medium Risk)**

8. **Update API controllers and routes** - Sync API endpoints (agents, assistants, marketplace)

#### **PHASE 4: UI Integration (High Risk)**

9. **Replace UI package with Flowise 3.0.1 baseline** - Major UI updates
10. **Integrate new UI authentication flow** - Wire Supabase login with new UI
11. **Merge new UI pages** - Add agent executions, marketplaces views

#### **PHASE 5: Finalization (High Risk)**

12. **Update i18n keys** - Extend translation files with new labels
13. **Adjust build and deployment scripts** - Update build processes
14. **Validate UPDL nodes and publication flow** - Ensure UPDL integration still works
15. **Update documentation** - Refresh README and memory-bank files

### ⚠️ Critical Integration Points

-   **Passport.js ↔ Supabase**: Ensure new authentication works with our multi-user setup
-   **UPDL nodes**: Preserve all UPDL functionality in apps/ directory
-   **Uniks hierarchy**: Maintain workspace concept with entity relationships
-   **i18n system**: Integrate new texts with existing English/Russian support
-   **Custom chatbot functionality**: Preserve modifications moved to other files

### 🔄 Current Project State

-   **Base Version**: Flowise 2.2.7-patch.1
-   **Target Version**: Flowise 3.0.1
-   **Custom Features**: Fully functional (Supabase auth, Uniks, i18n, UPDL)
-   **Last Focus**: AR.js library configuration system (completed)
-   **Next Focus**: Begin systematic Flowise 3.0.1 upgrade process

### 💡 Strategic Approach

1. **Start with low-risk updates** (dependencies, components, migrations)
2. **Enable incremental testing** after foundation updates
3. **Preserve custom functionality** through careful integration
4. **Document all conflicts** and resolution strategies
5. **Maintain backward compatibility** where possible

**COMPLEXITY LEVEL**: **Level 4** (Complex System Update)
**ESTIMATED IMPACT**: Major upgrade affecting all system layers
**RISK LEVEL**: High (due to extensive custom modifications)
