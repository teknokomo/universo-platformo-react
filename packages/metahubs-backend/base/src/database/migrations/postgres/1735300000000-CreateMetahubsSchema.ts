import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Create MetaHubs Schema
 *
 * Creates the complete metahubs schema with tables for metadata-driven architecture.
 * RLS policies include global admin bypass.
 *
 * Schema includes:
 * - metahubs: Core metahub container (analogous to "configuration")
 * - metahubs_users: User-metahub membership with roles
 * - sys_entities: Entity type definitions (virtual table schemas)
 * - sys_fields: Field definitions for entities
 * - user_data_store: JSONB storage for user records
 *
 * IMPORTANT: This migration must run AFTER admin.CreateAdminRBAC (1733400000000)
 * which creates the admin schema and is_superuser() function.
 */
export class CreateMetahubsSchema1735300000000 implements MigrationInterface {
    name = 'CreateMetahubsSchema1735300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension (if not already enabled)
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

        // ===== 1) Create schema =====
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS metahubs;`)

        // ===== 2) Core tables =====
        await queryRunner.query(`
            CREATE TABLE metahubs.metahubs (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        // ===== 3) User-metahub membership table =====
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

        // FK to auth.users (may fail if auth schema not available, continue without it)
        try {
            await queryRunner.query(`
                ALTER TABLE metahubs.metahubs_users
                ADD CONSTRAINT fk_mhu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `)
        } catch {
            console.warn('Warning: Unable to add FK constraint on metahubs_users.user_id referencing auth.users. Continuing without it.')
        }

        // ===== 4) SysEntity - entity type definitions =====
        await queryRunner.query(`
            CREATE TABLE metahubs.sys_entities (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                metahub_id UUID NOT NULL,
                name VARCHAR(255) NOT NULL,
                codename VARCHAR(100) NOT NULL,
                description TEXT,
                display_config JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now(),
                FOREIGN KEY (metahub_id) REFERENCES metahubs.metahubs(id) ON DELETE CASCADE,
                UNIQUE(metahub_id, codename)
            )
        `)

        // ===== 5) SysField - field definitions =====
        await queryRunner.query(`
            CREATE TABLE metahubs.sys_fields (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                entity_id UUID NOT NULL,
                name VARCHAR(255) NOT NULL,
                codename VARCHAR(100) NOT NULL,
                field_type VARCHAR(50) NOT NULL,
                required BOOLEAN NOT NULL DEFAULT false,
                field_config JSONB,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now(),
                FOREIGN KEY (entity_id) REFERENCES metahubs.sys_entities(id) ON DELETE CASCADE,
                UNIQUE(entity_id, codename)
            )
        `)

        // ===== 6) UserDataStore - JSONB records storage =====
        await queryRunner.query(`
            CREATE TABLE metahubs.user_data_store (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                entity_id UUID NOT NULL,
                data JSONB NOT NULL DEFAULT '{}',
                created_by UUID,
                updated_by UUID,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now(),
                FOREIGN KEY (entity_id) REFERENCES metahubs.sys_entities(id) ON DELETE CASCADE
            )
        `)

        // ===== 7) Performance indexes =====
        await queryRunner.query(`CREATE INDEX idx_mhu_metahub ON metahubs.metahubs_users(metahub_id)`)
        await queryRunner.query(`CREATE INDEX idx_mhu_user ON metahubs.metahubs_users(user_id)`)
        await queryRunner.query(`CREATE INDEX idx_se_metahub ON metahubs.sys_entities(metahub_id)`)
        await queryRunner.query(`CREATE INDEX idx_sf_entity ON metahubs.sys_fields(entity_id)`)
        await queryRunner.query(`CREATE INDEX idx_sf_sort ON metahubs.sys_fields(entity_id, sort_order)`)
        await queryRunner.query(`CREATE INDEX idx_uds_entity ON metahubs.user_data_store(entity_id)`)
        // GIN index for JSONB queries
        await queryRunner.query(`CREATE INDEX idx_uds_data ON metahubs.user_data_store USING GIN(data)`)

        // ===== 8) Enable RLS on all tables =====
        await queryRunner.query(`ALTER TABLE metahubs.metahubs ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs_users ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.sys_entities ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.sys_fields ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.user_data_store ENABLE ROW LEVEL SECURITY;`)

        // ===== 9) RLS Policies WITH global admin bypass =====

        // Policy for metahubs
        await queryRunner.query(`
            CREATE POLICY "metahubs_access_policy" ON metahubs.metahubs
            FOR ALL
            USING (
                EXISTS (
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

        // Policy for metahubs_users
        await queryRunner.query(`
            CREATE POLICY "metahubs_users_access_policy" ON metahubs.metahubs_users
            FOR ALL
            USING (
                user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu2
                    WHERE mu2.metahub_id = metahubs.metahubs_users.metahub_id
                    AND mu2.user_id = auth.uid()
                    AND mu2.role IN ('owner', 'admin')
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu2
                    WHERE mu2.metahub_id = metahubs.metahubs_users.metahub_id
                    AND mu2.user_id = auth.uid()
                    AND mu2.role IN ('owner', 'admin')
                )
                OR admin.is_superuser(auth.uid())
            )
        `)

        // Policy for sys_entities - inherits from metahub access
        await queryRunner.query(`
            CREATE POLICY "sys_entities_access_policy" ON metahubs.sys_entities
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu
                    WHERE mu.metahub_id = metahubs.sys_entities.metahub_id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu
                    WHERE mu.metahub_id = metahubs.sys_entities.metahub_id
                    AND mu.user_id = auth.uid()
                    AND mu.role IN ('owner', 'admin')
                )
                OR admin.is_superuser(auth.uid())
            )
        `)

        // Policy for sys_fields - inherits from entity access
        await queryRunner.query(`
            CREATE POLICY "sys_fields_access_policy" ON metahubs.sys_fields
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metahubs.sys_entities se
                    JOIN metahubs.metahubs_users mu ON mu.metahub_id = se.metahub_id
                    WHERE se.id = metahubs.sys_fields.entity_id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metahubs.sys_entities se
                    JOIN metahubs.metahubs_users mu ON mu.metahub_id = se.metahub_id
                    WHERE se.id = metahubs.sys_fields.entity_id
                    AND mu.user_id = auth.uid()
                    AND mu.role IN ('owner', 'admin')
                )
                OR admin.is_superuser(auth.uid())
            )
        `)

        // Policy for user_data_store - read access for members, write for editors+
        await queryRunner.query(`
            CREATE POLICY "user_data_store_access_policy" ON metahubs.user_data_store
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metahubs.sys_entities se
                    JOIN metahubs.metahubs_users mu ON mu.metahub_id = se.metahub_id
                    WHERE se.id = metahubs.user_data_store.entity_id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metahubs.sys_entities se
                    JOIN metahubs.metahubs_users mu ON mu.metahub_id = se.metahub_id
                    WHERE se.id = metahubs.user_data_store.entity_id
                    AND mu.user_id = auth.uid()
                    AND mu.role IN ('owner', 'admin', 'editor')
                )
                OR admin.is_superuser(auth.uid())
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop policies first
        await queryRunner.query(`DROP POLICY IF EXISTS "user_data_store_access_policy" ON metahubs.user_data_store`)
        await queryRunner.query(`DROP POLICY IF EXISTS "sys_fields_access_policy" ON metahubs.sys_fields`)
        await queryRunner.query(`DROP POLICY IF EXISTS "sys_entities_access_policy" ON metahubs.sys_entities`)
        await queryRunner.query(`DROP POLICY IF EXISTS "metahubs_users_access_policy" ON metahubs.metahubs_users`)
        await queryRunner.query(`DROP POLICY IF EXISTS "metahubs_access_policy" ON metahubs.metahubs`)

        // Drop tables in reverse order
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.user_data_store`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.sys_fields`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.sys_entities`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.metahubs_users`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.metahubs`)

        // Drop schema
        await queryRunner.query(`DROP SCHEMA IF EXISTS metahubs`)
    }
}
