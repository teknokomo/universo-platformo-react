/**
 * PostgreSQL Migrations Registry
 *
 * Migration order is CRITICAL for FK constraints and data integrity.
 * Migrations are grouped by domain and executed in sequence.
 *
 * Order rationale:
 * 0. Infrastructure (creates database-wide functions like uuid_generate_v7)
 * 1. Admin (creates admin schema and has_permission function used by RLS in other modules)
 * 2. Profile, Metahubs, Applications
 *
 * Note: Legacy phases (Foundation/Flowise tables, Uniks, Spaces, Executions,
 * CustomTemplates, Publish) have been removed — those packages were deleted.
 * The test database will be recreated from scratch.
 */

// Infrastructure migrations
import { InitializeUuidV7Function1500000000000 } from './1500000000000-InitializeUuidV7Function'

export const infrastructureMigrations = [InitializeUuidV7Function1500000000000]

// Universo package migrations
import { adminMigrations } from '@universo/admin-backend'
import { profileMigrations } from '@universo/profile-backend'
import { metahubsMigrations } from '@universo/metahubs-backend'
import { applicationsMigrations } from '@universo/applications-backend'

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
    // PHASE 2: Profile & Resource modules
    // ═══════════════════════════════════════════════════════════════════════
    ...profileMigrations,
    ...metahubsMigrations,
    ...applicationsMigrations
]
