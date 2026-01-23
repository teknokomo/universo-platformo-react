import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Create Metahubs Schema (Metadata-Driven Platform)
 *
 * Creates the metahubs schema for a metadata-driven platform similar to 1C:Enterprise.
 * Uses JSONB for dynamic data storage and VersionedLocalizedContent for i18n.
 *
 * Schema includes:
 * - metahubs: Main configuration entity (like a "database")
 * - metahubs_users: User-metahub membership (roles: owner, member, viewer)
 *
 * Note: Hubs, Catalogs, Attributes and Records are stored in isolated per-metahub schemas
 * (e.g., mhb_<metahubId>) using tables: _mhb_hubs, _mhb_objects, _mhb_attributes.
 *
 * IMPORTANT: This migration must run AFTER admin.CreateAdminRBAC (1733400000000)
 * which creates the admin schema and is_superuser() function.
 */
export class CreateMetahubsSchema1766351182000 implements MigrationInterface {
    name = 'CreateMetahubsSchema1766351182000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

        // ===== 1) Create schema =====
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS metahubs;`)

        // ===== 2) Create ENUM for attribute data types =====
        // Use DO block to check if type exists before creating
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE metahubs.attribute_data_type AS ENUM (
                    'STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'REF', 'JSON'
                );
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
        `)

        // ===== 3) Core tables =====

        // Metahub - main configuration container
        await queryRunner.query(`
            CREATE TABLE metahubs.metahubs (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                name JSONB NOT NULL DEFAULT '{}',
                description JSONB DEFAULT '{}',
                slug VARCHAR(100) UNIQUE,
                is_public BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        // ===== 4) User-metahub relationship table =====
        await queryRunner.query(`
            CREATE TABLE metahubs.metahubs_users (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                metahub_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'owner',
                comment TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(metahub_id, user_id),
                FOREIGN KEY (metahub_id) REFERENCES metahubs.metahubs(id) ON DELETE CASCADE
            )
        `)

        // ===== 5) Foreign key to auth.users =====
        try {
            await queryRunner.query(`
                ALTER TABLE metahubs.metahubs_users
                ADD CONSTRAINT fk_mu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `)
        } catch (error) {
            console.warn(
                'Warning: Unable to add FK constraint on metahubs_users.user_id referencing auth.users. Continuing without it.',
                error
            )
        }

        // ===== 5) Performance indexes =====
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mu_metahub ON metahubs.metahubs_users(metahub_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mu_user ON metahubs.metahubs_users(user_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_metahub_slug ON metahubs.metahubs(slug)`)

        // GIN indexes for JSONB name fields (for text search)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_metahub_name_gin ON metahubs.metahubs USING GIN (name)`)

        // ===== 6) Enable RLS on all tables =====
        await queryRunner.query(`ALTER TABLE metahubs.metahubs ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs_users ENABLE ROW LEVEL SECURITY;`)

        // ===== 7) RLS Policies WITH global admin bypass =====

        // Policy for metahubs_users
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their metahub memberships" ON metahubs.metahubs_users
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

        // Policy for metahubs (including public access for is_public=true)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their own metahubs" ON metahubs.metahubs
            FOR ALL
            USING (
                is_public = true
                OR EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu
                    WHERE mu.metahub_id = metahubs.metahubs.id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu
                    WHERE mu.metahub_id = metahubs.metahubs.id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop RLS policies
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own metahubs" ON metahubs.metahubs;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their metahub memberships" ON metahubs.metahubs_users;`)

        // Disable RLS
        await queryRunner.query(`ALTER TABLE metahubs.metahubs DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs_users DISABLE ROW LEVEL SECURITY;`)

        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahub_name_gin`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahub_slug`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_mu_user`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_mu_metahub`)

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.metahubs_users`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.metahubs`)

        // Drop ENUM type
        await queryRunner.query(`DROP TYPE IF EXISTS metahubs.attribute_data_type`)

        // Drop schema
        await queryRunner.query(`DROP SCHEMA IF EXISTS metahubs CASCADE`)
    }
}
