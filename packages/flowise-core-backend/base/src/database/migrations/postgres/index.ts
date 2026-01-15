/**
 * PostgreSQL Migrations Registry
 *
 * Migration order is CRITICAL for FK constraints and data integrity.
 * Migrations are grouped by domain and executed in sequence.
 *
 * Order rationale:
 * 0. Infrastructure (creates database-wide functions like uuid_generate_v7)
 * 1. Admin (creates admin schema and has_permission function used by RLS in other modules)
 * 2. Foundation tables (no FK dependencies): chat_message, tools, credentials, etc.
 * 3. Uniks (creates uniks schema, adds unik_id to Flowise tables)
 * 4. Profile, Metaverses, Clusters, etc. (depend on uniks)
 * 5. Spaces & Canvases (depend on uniks, create canvases table)
 * 6. CustomTemplates (may reference canvases)
 * 7. Publish (depends on spaces and canvases - has FK constraints)
 */

// Infrastructure migrations
import { infrastructureMigrations } from '@universo/core-backend'

// Feature package migrations
import { chatMessageMigrations } from '@flowise/chatmessage-backend'
import { toolsMigrations } from '@flowise/tools-backend'
import { credentialsMigrations } from '@flowise/credentials-backend'
import { assistantsMigrations } from '@flowise/assistants-backend'
import { variablesMigrations } from '@flowise/variables-backend'
import { docstoreMigrations } from '@flowise/docstore-backend'
import { leadsMigrations } from '@flowise/leads-backend'
import { executionsMigrations } from '@flowise/executions-backend'
import { apikeyMigrations } from '@flowise/apikey-backend'
import { customTemplatesMigrations } from '@flowise/customtemplates-backend'

// Universo package migrations
import { adminMigrations } from '@universo/admin-backend'
import { uniksMigrations } from '@universo/uniks-backend'
import { profileMigrations } from '@universo/profile-backend'
import { metaversesMigrations } from '@universo/metaverses-backend'
import { metahubsMigrations } from '@universo/metahubs-backend'
import { applicationsMigrations } from '@universo/applications-backend'
import { clustersMigrations } from '@universo/clusters-backend'
import { projectsMigrations } from '@universo/projects-backend'
import { campaignsMigrations } from '@universo/campaigns-backend'
import { organizationsMigrations } from '@universo/organizations-backend'
import { storagesMigrations } from '@universo/storages-backend'
import { spacesMigrations } from '@universo/spaces-backend'
import { publishMigrations } from '@universo/publish-backend'

export const postgresMigrations = [
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 0: Infrastructure (MUST BE FIRST - creates database-wide functions)
    // Creates uuid_generate_v7() function required by all tables with UUID v7 primary keys
    // ═══════════════════════════════════════════════════════════════════════
    ...infrastructureMigrations,

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: Admin (creates admin schema and has_permission function)
    // Other modules' RLS policies depend on this function
    // ═══════════════════════════════════════════════════════════════════════
    ...adminMigrations,

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: Foundation tables (no FK dependencies)
    // ═══════════════════════════════════════════════════════════════════════
    ...chatMessageMigrations, // Creates chat_message, chat_message_feedback
    ...toolsMigrations, // Creates tool table
    ...credentialsMigrations, // Creates credential table
    ...assistantsMigrations, // Creates assistant table
    ...variablesMigrations, // Creates variable table
    ...docstoreMigrations, // Creates document_store, document_store_file_chunk, upsert_history
    ...leadsMigrations, // Creates lead table
    ...apikeyMigrations, // Creates apikey table

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: Uniks (workspace system)
    // Adds unik_id column to foundation tables
    // ═══════════════════════════════════════════════════════════════════════
    ...uniksMigrations,

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: Profile & Resource modules (depend on uniks)
    // ═══════════════════════════════════════════════════════════════════════
    ...profileMigrations,
    ...metaversesMigrations,
    ...metahubsMigrations,
    ...applicationsMigrations,
    ...clustersMigrations,
    ...projectsMigrations,
    ...campaignsMigrations,
    ...organizationsMigrations,
    ...storagesMigrations,

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 4: Spaces & Canvases (core visual builder)
    // Creates spaces, canvases, spaces_canvases tables
    // ═══════════════════════════════════════════════════════════════════════
    ...spacesMigrations,

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 5: Executions (depends on canvases - has FK to canvas table)
    // Creates execution table for tracking agent flow executions
    // ═══════════════════════════════════════════════════════════════════════
    ...executionsMigrations,

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 6: Custom templates
    // ═══════════════════════════════════════════════════════════════════════
    ...customTemplatesMigrations,

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 7: Publish (depends on spaces/canvases - has FK constraints)
    // ═══════════════════════════════════════════════════════════════════════
    ...publishMigrations
]
