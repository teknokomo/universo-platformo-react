/**
 * PostgreSQL Infrastructure Migrations Registry
 *
 * This module contains core infrastructure migrations that must run
 * BEFORE any application-specific migrations. These migrations create
 * database-wide functions and schemas required by other modules.
 *
 * Order: Infrastructure migrations run first (Phase 0) in the global
 * migration sequence defined in flowise-core-backend.
 */

// Infrastructure migrations
import { InitializeUuidV7Function1500000000000 } from './1500000000000-InitializeUuidV7Function'

export const infrastructureMigrations = [
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 0: Core Infrastructure (MUST BE FIRST)
    // Creates database-wide functions like uuid_generate_v7() required by all modules
    // ═══════════════════════════════════════════════════════════════════════
    InitializeUuidV7Function1500000000000
]
