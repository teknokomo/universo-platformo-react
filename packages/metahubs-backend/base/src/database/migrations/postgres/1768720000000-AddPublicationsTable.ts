import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Add Publications Table to Metahubs Schema
 *
 * Creates metahubs.publications table for standalone Publication entities.
 * Publications are the external interfaces of Metahubs with API access control.
 *
 * Access to Publications is controlled through the parent Metahub's membership
 * (metahubs_users table), not through a separate publications_users table.
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

        // ===== 4) Indexes =====
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_metahub ON metahubs.publications(metahub_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_schema_name ON metahubs.publications(schema_name)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_status ON metahubs.publications(schema_status)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_name_gin ON metahubs.publications USING GIN (name)`)

        // ===== 5) Enable RLS =====
        await queryRunner.query(`ALTER TABLE metahubs.publications ENABLE ROW LEVEL SECURITY;`)

        // ===== 6) RLS Policy - access via metahub membership =====
        // Users can access publications if they are members of the parent metahub
        await queryRunner.query(`DROP POLICY IF EXISTS "pub_access_via_metahub" ON metahubs.publications;`)
        await queryRunner.query(`
            CREATE POLICY "pub_access_via_metahub" ON metahubs.publications
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu
                    WHERE mu.metahub_id = metahubs.publications.metahub_id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu
                    WHERE mu.metahub_id = metahubs.publications.metahub_id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP POLICY IF EXISTS "pub_access_via_metahub" ON metahubs.publications;`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.publications;`)
        await queryRunner.query(`DROP TYPE IF EXISTS metahubs.publication_schema_status;`)
        await queryRunner.query(`DROP TYPE IF EXISTS metahubs.publication_access_mode;`)
    }
}
