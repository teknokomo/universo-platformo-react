import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Create Applications Schema
 *
 * Creates the applications schema for managing standalone applications.
 * Applications contain Connectors which connect to data providers via Publications.
 *
 * Schema includes:
 * - applications: Main application container with schema sync fields for Metahub publishing
 * - connectors: Data connectors within an application (link to Publications)
 * - connectors_publications: Junction table for Connectors ↔ Publications many-to-many relationship
 * - applications_users: User-application membership (roles: owner, admin, editor, member)
 *
 * IMPORTANT: This migration must run AFTER:
 * - admin.CreateAdminRBAC (1733400000000) - creates admin schema and is_superuser() function
 * - metahubs.CreateMetahubsSchema (1766351182000) - creates metahubs.metahubs table
 * - metahubs.CreatePublicationsSchema - creates metahubs.publications table for FK
 */
export class CreateApplicationsSchema1800000000000 implements MigrationInterface {
    name = 'CreateApplicationsSchema1800000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

        // ===== 1) Create schema =====
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS applications;`)

        // ===== 2) Create enum for application schema status (idempotent) =====
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_schema_status' AND typnamespace = 'applications'::regnamespace) THEN
                    CREATE TYPE applications.application_schema_status AS ENUM (
                        'draft',
                        'pending',
                        'synced',
                        'outdated',
                        'error',
                        'update_available',
                        'maintenance'
                    );
                END IF;
            END $$;
        `)

        // ===== 3) Core tables (idempotent) =====

        // Application - main application container with schema sync fields
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS applications.applications (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                name JSONB NOT NULL DEFAULT '{}',
                description JSONB DEFAULT '{}',
                slug VARCHAR(100),
                is_public BOOLEAN NOT NULL DEFAULT false,
                -- Schema sync fields (for Metahub → Application publishing)
                schema_name VARCHAR(100),
                schema_status applications.application_schema_status DEFAULT 'draft',
                schema_error TEXT,
                schema_synced_at TIMESTAMPTZ,
                schema_snapshot JSONB,
                app_structure_version INTEGER DEFAULT NULL,
                last_synced_publication_version_id UUID DEFAULT NULL,

                -- Platform-level system fields (_upl_*)
                _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                _upl_created_by UUID,
                _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                _upl_updated_by UUID,
                _upl_version INTEGER NOT NULL DEFAULT 1,

                _upl_archived BOOLEAN NOT NULL DEFAULT false,
                _upl_archived_at TIMESTAMPTZ,
                _upl_archived_by UUID,

                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _upl_deleted_at TIMESTAMPTZ,
                _upl_deleted_by UUID,
                _upl_purge_after TIMESTAMPTZ,

                _upl_locked BOOLEAN NOT NULL DEFAULT false,
                _upl_locked_at TIMESTAMPTZ,
                _upl_locked_by UUID,
                _upl_locked_reason TEXT,

                -- Application-level system fields (_app_*)
                _app_published BOOLEAN NOT NULL DEFAULT true,
                _app_published_at TIMESTAMPTZ,
                _app_published_by UUID,

                _app_archived BOOLEAN NOT NULL DEFAULT false,
                _app_archived_at TIMESTAMPTZ,
                _app_archived_by UUID,

                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted_at TIMESTAMPTZ,
                _app_deleted_by UUID,

                _app_owner_id UUID,
                _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private'
            )
        `)

        // Partial unique indexes (exclude soft-deleted records)
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_applications_slug_active
            ON applications.applications (slug)
            WHERE _upl_deleted = false AND slug IS NOT NULL
        `)
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_applications_schema_name_active
            ON applications.applications (schema_name)
            WHERE _upl_deleted = false AND schema_name IS NOT NULL
        `)
        // Index for trash queries
        await queryRunner.query(`
            CREATE INDEX idx_applications_deleted
            ON applications.applications (_upl_deleted_at)
            WHERE _upl_deleted = true
        `)
        // Index for archived queries
        await queryRunner.query(`
            CREATE INDEX idx_applications_archived
            ON applications.applications (_upl_archived)
            WHERE _upl_archived = true
        `)

        // Connector - data connector within an application with metahub constraints
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS applications.connectors (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                application_id UUID NOT NULL,
                name JSONB NOT NULL DEFAULT '{}',
                description JSONB DEFAULT '{}',
                sort_order INTEGER NOT NULL DEFAULT 0,
                -- Metahub constraint flags
                is_single_metahub BOOLEAN NOT NULL DEFAULT true,
                is_required_metahub BOOLEAN NOT NULL DEFAULT true,

                -- Platform-level system fields (_upl_*)
                _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                _upl_created_by UUID,
                _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                _upl_updated_by UUID,
                _upl_version INTEGER NOT NULL DEFAULT 1,

                _upl_archived BOOLEAN NOT NULL DEFAULT false,
                _upl_archived_at TIMESTAMPTZ,
                _upl_archived_by UUID,

                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _upl_deleted_at TIMESTAMPTZ,
                _upl_deleted_by UUID,
                _upl_purge_after TIMESTAMPTZ,

                _upl_locked BOOLEAN NOT NULL DEFAULT false,
                _upl_locked_at TIMESTAMPTZ,
                _upl_locked_by UUID,
                _upl_locked_reason TEXT,

                -- Application-level system fields (_app_*)
                _app_published BOOLEAN NOT NULL DEFAULT true,
                _app_published_at TIMESTAMPTZ,
                _app_published_by UUID,

                _app_archived BOOLEAN NOT NULL DEFAULT false,
                _app_archived_at TIMESTAMPTZ,
                _app_archived_by UUID,

                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted_at TIMESTAMPTZ,
                _app_deleted_by UUID,

                _app_owner_id UUID,
                _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private',

                FOREIGN KEY (application_id) REFERENCES applications.applications(id) ON DELETE CASCADE
            )
        `)

        // ===== 4) Junction table for Connectors ↔ Publications =====
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS applications.connectors_publications (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                connector_id UUID NOT NULL,
                publication_id UUID NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,

                -- Platform-level system fields (_upl_*)
                _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                _upl_created_by UUID,
                _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                _upl_updated_by UUID,
                _upl_version INTEGER NOT NULL DEFAULT 1,

                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _upl_deleted_at TIMESTAMPTZ,
                _upl_deleted_by UUID,

                -- Application-level system fields (_app_*)
                _app_published BOOLEAN NOT NULL DEFAULT true,
                _app_published_at TIMESTAMPTZ,
                _app_published_by UUID,

                _app_archived BOOLEAN NOT NULL DEFAULT false,
                _app_archived_at TIMESTAMPTZ,
                _app_archived_by UUID,

                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted_at TIMESTAMPTZ,
                _app_deleted_by UUID,

                FOREIGN KEY (connector_id) REFERENCES applications.connectors(id) ON DELETE CASCADE
            )
        `)

        // Partial unique index (exclude soft-deleted at both levels)
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_connectors_publications_active
            ON applications.connectors_publications (connector_id, publication_id)
            WHERE _upl_deleted = false AND _app_deleted = false
        `)

        // Cross-schema FK to metahubs.publications (idempotent)
        try {
            await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_cp_publication'
                    ) THEN
                        ALTER TABLE applications.connectors_publications
                        ADD CONSTRAINT fk_cp_publication FOREIGN KEY (publication_id) 
                        REFERENCES metahubs.publications(id) ON DELETE CASCADE;
                    END IF;
                END $$;
            `)
        } catch (error) {
            console.warn(
                'Warning: Unable to add FK constraint on connectors_publications.publication_id referencing metahubs.publications. Continuing without it.',
                error
            )
        }

        // ===== 5) User-application relationship table =====
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS applications.applications_users (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                application_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'owner',
                comment JSONB,

                -- Platform-level system fields (_upl_*)
                _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                _upl_created_by UUID,
                _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                _upl_updated_by UUID,
                _upl_version INTEGER NOT NULL DEFAULT 1,

                _upl_archived BOOLEAN NOT NULL DEFAULT false,
                _upl_archived_at TIMESTAMPTZ,
                _upl_archived_by UUID,

                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _upl_deleted_at TIMESTAMPTZ,
                _upl_deleted_by UUID,
                _upl_purge_after TIMESTAMPTZ,

                _upl_locked BOOLEAN NOT NULL DEFAULT false,
                _upl_locked_at TIMESTAMPTZ,
                _upl_locked_by UUID,
                _upl_locked_reason TEXT,

                -- Application-level system fields (_app_*)
                _app_published BOOLEAN NOT NULL DEFAULT true,
                _app_published_at TIMESTAMPTZ,
                _app_published_by UUID,

                _app_archived BOOLEAN NOT NULL DEFAULT false,
                _app_archived_at TIMESTAMPTZ,
                _app_archived_by UUID,

                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted_at TIMESTAMPTZ,
                _app_deleted_by UUID,

                FOREIGN KEY (application_id) REFERENCES applications.applications(id) ON DELETE CASCADE
            )
        `)

        // Partial unique index (exclude soft-deleted at both levels)
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_applications_users_active
            ON applications.applications_users (application_id, user_id)
            WHERE _upl_deleted = false AND _app_deleted = false
        `)

        // ===== 6) Foreign key to auth.users (idempotent) =====
        try {
            await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_au_auth_user'
                    ) THEN
                        ALTER TABLE applications.applications_users
                        ADD CONSTRAINT fk_au_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
                    END IF;
                END $$;
            `)
        } catch (error) {
            console.warn(
                'Warning: Unable to add FK constraint on applications_users.user_id referencing auth.users. Continuing without it.',
                error
            )
        }

        // ===== 7) Performance indexes =====
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_au_application ON applications.applications_users(application_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_au_user ON applications.applications_users(user_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_connectors_application ON applications.connectors(application_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_application_slug ON applications.applications(slug)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_application_schema_name ON applications.applications(schema_name)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_application_schema_status ON applications.applications(schema_status)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cp_connector ON applications.connectors_publications(connector_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cp_publication ON applications.connectors_publications(publication_id)`)

        // GIN indexes for JSONB name fields (for text search)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_application_name_gin ON applications.applications USING GIN (name)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_connector_name_gin ON applications.connectors USING GIN (name)`)

        // ===== 8) Enable RLS on all tables =====
        await queryRunner.query(`ALTER TABLE applications.applications ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE applications.applications_users ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE applications.connectors ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE applications.connectors_publications ENABLE ROW LEVEL SECURITY;`)

        // ===== 9) RLS Policies WITH global admin bypass (idempotent - drop first) =====

        // Policy for applications_users
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage their application memberships" ON applications.applications_users;`
        )
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their application memberships" ON applications.applications_users
            FOR ALL
            USING (
                user_id = auth.uid() 
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                user_id = auth.uid()
                OR admin.is_superuser(auth.uid())
            )
        `)

        // Policy for applications (including public access for is_public=true)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own applications" ON applications.applications;`)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their own applications" ON applications.applications
            FOR ALL
            USING (
                is_public = true
                OR EXISTS (
                    SELECT 1 FROM applications.applications_users au
                    WHERE au.application_id = applications.applications.id AND au.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM applications.applications_users au
                    WHERE au.application_id = applications.applications.id AND au.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
        `)

        // Policy for connectors
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage connectors in their applications" ON applications.connectors;`
        )
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage connectors in their applications" ON applications.connectors
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM applications.applications a
                    LEFT JOIN applications.applications_users au ON a.id = au.application_id
                    WHERE a.id = applications.connectors.application_id 
                    AND (a.is_public = true OR au.user_id = auth.uid())
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM applications.applications_users au
                    WHERE au.application_id = applications.connectors.application_id AND au.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
        `)

        // Policy for connectors_publications
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage connector-publication links" ON applications.connectors_publications;`
        )
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage connector-publication links" ON applications.connectors_publications
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM applications.connectors c
                    JOIN applications.applications_users au ON c.application_id = au.application_id
                    WHERE c.id = applications.connectors_publications.connector_id AND au.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM applications.connectors c
                    JOIN applications.applications_users au ON c.application_id = au.application_id
                    WHERE c.id = applications.connectors_publications.connector_id AND au.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop RLS policies
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage connector-publication links" ON applications.connectors_publications;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage connectors in their applications" ON applications.connectors;`
        )
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own applications" ON applications.applications;`)
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage their application memberships" ON applications.applications_users;`
        )

        // Disable RLS
        await queryRunner.query(`ALTER TABLE applications.connectors_publications DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE applications.connectors DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE applications.applications DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE applications.applications_users DISABLE ROW LEVEL SECURITY;`)

        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_connector_name_gin`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_application_name_gin`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_cp_publication`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_cp_connector`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_connectors_publications_active`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_application_schema_status`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_application_schema_name`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_applications_schema_name_active`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_applications_slug_active`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_applications_deleted`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_applications_users_active`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_application_slug`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_connectors_application`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_au_user`)
        await queryRunner.query(`DROP INDEX IF EXISTS applications.idx_au_application`)

        // Drop tables (child tables first)
        await queryRunner.query(`DROP TABLE IF EXISTS applications.connectors_publications`)
        await queryRunner.query(`DROP TABLE IF EXISTS applications.connectors`)
        await queryRunner.query(`DROP TABLE IF EXISTS applications.applications_users`)
        await queryRunner.query(`DROP TABLE IF EXISTS applications.applications`)

        // Drop enum
        await queryRunner.query(`DROP TYPE IF EXISTS applications.application_schema_status`)

        // Drop schema
        await queryRunner.query(`DROP SCHEMA IF EXISTS applications CASCADE`)
    }
}
