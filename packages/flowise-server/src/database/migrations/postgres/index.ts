/**
 * PostgreSQL Migrations Registry
 *
 * Migration order is CRITICAL for FK constraints and data integrity.
 * Migrations are grouped by domain and executed in sequence.
 *
 * Order rationale:
 * 1. Foundation tables (no FK dependencies): chat_message, tools, credentials, etc.
 * 2. Uniks (creates uniks schema, adds unik_id to Flowise tables)
 * 3. Profile, Metaverses, Clusters, etc. (depend on uniks)
 * 4. Spaces & Canvases (depend on uniks, create canvases table)
 * 5. CustomTemplates (may reference canvases)
 * 6. Publish (depends on spaces and canvases - has FK constraints)
 */

// Feature package migrations
import { chatMessageMigrations } from '@flowise/chatmessage-srv'
import { toolsMigrations } from '@flowise/tools-srv'
import { credentialsMigrations } from '@flowise/credentials-srv'
import { assistantsMigrations } from '@flowise/assistants-srv'
import { variablesMigrations } from '@flowise/variables-srv'
import { docstoreMigrations } from '@flowise/docstore-srv'
import { leadsMigrations } from '@flowise/leads-srv'
import { apikeyMigrations } from '@flowise/apikey-srv'
import { customTemplatesMigrations } from '@flowise/customtemplates-srv'

// Universo package migrations
import { uniksMigrations } from '@universo/uniks-srv'
import { profileMigrations } from '@universo/profile-srv'
import { metaversesMigrations } from '@universo/metaverses-srv'
import { clustersMigrations } from '@universo/clusters-srv'
import { projectsMigrations } from '@universo/projects-srv'
import { campaignsMigrations } from '@universo/campaigns-srv'
import { organizationsMigrations } from '@universo/organizations-srv'
import { storagesMigrations } from '@universo/storages-srv'
import { spacesMigrations } from '@universo/spaces-srv'
import { publishMigrations } from '@universo/publish-srv'

export const postgresMigrations = [
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: Foundation tables (no FK dependencies)
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
    // PHASE 5: Custom templates
    // ═══════════════════════════════════════════════════════════════════════
    ...customTemplatesMigrations,

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 6: Publish (depends on spaces/canvases - has FK constraints)
    // ═══════════════════════════════════════════════════════════════════════
    ...publishMigrations
]
