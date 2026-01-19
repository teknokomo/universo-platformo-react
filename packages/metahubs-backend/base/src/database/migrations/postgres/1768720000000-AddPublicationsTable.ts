import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Add Publications Table to Metahubs Schema
 *
 * Creates metahubs.publications table for standalone Publication entities.
 * Publications are the external interfaces of Metahubs with API access control.
 *
 * Replaces the previous approach where Publication was an alias for Application.
 *
 * IMPORTANT: This migration must run AFTER:
 * - admin.CreateAdminRBAC (1733400000000) - creates admin schema and is_superuser() function
 * - metahubs.CreateMetahubsSchema (1766351182000) - creates metahubs.metahubs table
 */
export class AddPublicationsTable1768720000000 implements MigrationInterface {
    name = 'AddPublicationsTable1768720000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ===== 1) Create enum for publication access mode =====
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'publication_access_mode' AND typnamespace = 'metahubs'::regnamespace) THEN
                    CREATE TYPE metahubs.publication_access_mode AS ENUM (
                        'full',
                        'restricted'
                    );
                END IF;
            END $$;
        `)

        // ===== 2) Create enum for schema status =====
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'publication_schema_status' AND typnamespace = 'metahubs'::regnamespace) THEN
                    CREATE TYPE metahubs.publication_schema_status AS ENUM (
                        'draft',
                        'pending',
                        'synced',
                        'outdated',
                        'error'
                    );
                END IF;
            END $$;
        `)

        // ===== 3) Create publications table =====
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS metahubs.publications (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                metahub_id UUID NOT NULL,
                name JSONB NOT NULL DEFAULT '{}',
                description JSONB DEFAULT '{}',
                -- Access control
                access_mode metahubs.publication_access_mode NOT NULL DEFAULT 'full',
                access_config JSONB DEFAULT '{}',
                -- Schema sync fields (moved from applications.applications)
                schema_name VARCHAR(100) UNIQUE,
                schema_status metahubs.publication_schema_status DEFAULT 'draft',
                schema_error TEXT,
                schema_synced_at TIMESTAMPTZ,
                schema_snapshot JSONB,
                -- Auto-create application flag
                auto_create_application BOOLEAN NOT NULL DEFAULT false,
                -- Timestamps
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now(),
                -- FK to metahub
                CONSTRAINT fk_publication_metahub FOREIGN KEY (metahub_id)
                    REFERENCES metahubs.metahubs(id) ON DELETE CASCADE
            )
        `)

        // ===== 4) Create user association table =====
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS metahubs.publications_users (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                publication_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'owner',
                comment TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(publication_id, user_id),
                FOREIGN KEY (publication_id) REFERENCES metahubs.publications(id) ON DELETE CASCADE
            )
        `)

        // FK to auth.users (idempotent)
        try {
            await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_pu_auth_user'
                    ) THEN
                        ALTER TABLE metahubs.publications_users
                        ADD CONSTRAINT fk_pu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
                    END IF;
                END $$;
            `)
        } catch (error) {
            console.warn('Warning: Unable to add FK constraint fk_pu_auth_user. Continuing without it.', error)
        }

        // ===== 5) Indexes =====
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_metahub ON metahubs.publications(metahub_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_schema_name ON metahubs.publications(schema_name)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_status ON metahubs.publications(schema_status)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_name_gin ON metahubs.publications USING GIN (name)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pu_publication ON metahubs.publications_users(publication_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pu_user ON metahubs.publications_users(user_id)`)

        // ===== 6) Enable RLS =====
        await queryRunner.query(`ALTER TABLE metahubs.publications ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.publications_users ENABLE ROW LEVEL SECURITY;`)

        // ===== 7) RLS Policies =====
        await queryRunner.query(`DROP POLICY IF EXISTS "pub_users_manage_own" ON metahubs.publications_users;`)
        await queryRunner.query(`
            CREATE POLICY "pub_users_manage_own" ON metahubs.publications_users
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

        await queryRunner.query(`DROP POLICY IF EXISTS "pub_access_via_membership" ON metahubs.publications;`)
        await queryRunner.query(`
            CREATE POLICY "pub_access_via_membership" ON metahubs.publications
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metahubs.publications_users pu
                    WHERE pu.publication_id = metahubs.publications.id AND pu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metahubs.publications_users pu
                    WHERE pu.publication_id = metahubs.publications.id AND pu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP POLICY IF EXISTS "pub_access_via_membership" ON metahubs.publications;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "pub_users_manage_own" ON metahubs.publications_users;`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.publications_users;`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.publications;`)
        await queryRunner.query(`DROP TYPE IF EXISTS metahubs.publication_schema_status;`)
        await queryRunner.query(`DROP TYPE IF EXISTS metahubs.publication_access_mode;`)
    }
}
