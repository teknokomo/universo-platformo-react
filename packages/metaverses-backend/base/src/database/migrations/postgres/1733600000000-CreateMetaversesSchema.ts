import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Create Metaverses Schema
 *
 * Creates the complete metaverses schema with tables, indexes, and RLS policies.
 * RLS policies include global admin bypass from the start.
 *
 * Schema includes:
 * - metaverses: Core metaverse table
 * - sections: Sections within metaverses
 * - entities: Entities that can belong to sections and metaverses
 * - metaverses_users: User-metaverse membership (roles: owner, member, viewer)
 * - entities_sections: Many-to-many junction table
 * - entities_metaverses: Many-to-many junction table with sort_order
 * - sections_metaverses: Many-to-many junction table
 *
 * IMPORTANT: This migration must run AFTER admin.CreateAdminRBAC (1733400000000)
 * which creates the admin schema and has_global_access() function.
 */
export class CreateMetaversesSchema1733600000000 implements MigrationInterface {
    name = 'CreateMetaversesSchema1733600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

        // ===== 1) Create schema =====
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS metaverses;`)

        // ===== 2) Core tables =====
        await queryRunner.query(`
            CREATE TABLE metaverses.metaverses (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE metaverses.sections (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE metaverses.entities (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        // ===== 3) User-metaverse relationship table =====
        await queryRunner.query(`
            CREATE TABLE metaverses.metaverses_users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                metaverse_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'owner',
                comment TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(metaverse_id, user_id),
                FOREIGN KEY (metaverse_id) REFERENCES metaverses.metaverses(id) ON DELETE CASCADE
            )
        `)

        // ===== 4) Junction tables for many-to-many relationships =====
        await queryRunner.query(`
            CREATE TABLE metaverses.entities_sections (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                entity_id UUID NOT NULL,
                section_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(entity_id, section_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE metaverses.entities_metaverses (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                entity_id UUID NOT NULL,
                metaverse_id UUID NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(entity_id, metaverse_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE metaverses.sections_metaverses (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                section_id UUID NOT NULL,
                metaverse_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(section_id, metaverse_id)
            )
        `)

        // ===== 5) Foreign key constraints =====
        // FK to auth.users (may fail if auth schema not available, continue without it)
        try {
            await queryRunner.query(`
                ALTER TABLE metaverses.metaverses_users
                ADD CONSTRAINT fk_cu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `)
        } catch (error) {
            console.warn(
                'Warning: Unable to add FK constraint on metaverses_users.user_id referencing auth.users. Continuing without it.',
                error
            )
        }

        await queryRunner.query(`
            ALTER TABLE metaverses.metaverses_users
            ADD CONSTRAINT fk_cu_metaverse FOREIGN KEY (metaverse_id) REFERENCES metaverses.metaverses(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE metaverses.entities_sections
            ADD CONSTRAINT fk_rd_entity FOREIGN KEY (entity_id) REFERENCES metaverses.entities(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE metaverses.entities_sections
            ADD CONSTRAINT fk_rd_section FOREIGN KEY (section_id) REFERENCES metaverses.sections(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE metaverses.entities_metaverses
            ADD CONSTRAINT fk_rc_entity FOREIGN KEY (entity_id) REFERENCES metaverses.entities(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE metaverses.entities_metaverses
            ADD CONSTRAINT fk_rc_metaverse FOREIGN KEY (metaverse_id) REFERENCES metaverses.metaverses(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE metaverses.sections_metaverses
            ADD CONSTRAINT fk_dc_section FOREIGN KEY (section_id) REFERENCES metaverses.sections(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE metaverses.sections_metaverses
            ADD CONSTRAINT fk_dc_metaverse FOREIGN KEY (metaverse_id) REFERENCES metaverses.metaverses(id) ON DELETE CASCADE
        `)

        // ===== 6) Performance indexes =====
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cu_metaverse ON metaverses.metaverses_users(metaverse_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cu_user ON metaverses.metaverses_users(user_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rd_res ON metaverses.entities_sections(entity_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rd_dom ON metaverses.entities_sections(section_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rc_res ON metaverses.entities_metaverses(entity_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rc_clu ON metaverses.entities_metaverses(metaverse_id)`)
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS idx_rc_metaverse_sort ON metaverses.entities_metaverses(metaverse_id, sort_order)`
        )
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dc_dom ON metaverses.sections_metaverses(section_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dc_clu ON metaverses.sections_metaverses(metaverse_id)`)

        // ===== 7) Enable RLS on all tables =====
        await queryRunner.query(`ALTER TABLE metaverses.metaverses ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metaverses.metaverses_users ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metaverses.sections ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metaverses.entities ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metaverses.entities_sections ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metaverses.entities_metaverses ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metaverses.sections_metaverses ENABLE ROW LEVEL SECURITY;`)

        // ===== 8) RLS Policies WITH global admin bypass =====
        // Policy for metaverses_users
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their metaverse memberships" ON metaverses.metaverses_users
            FOR ALL
            USING (
                user_id = auth.uid() 
                OR admin.has_global_access(auth.uid())
            )
            WITH CHECK (
                user_id = auth.uid()
                OR admin.has_global_access(auth.uid())
            )
        `)

        // Policy for metaverses
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their own metaverses" ON metaverses.metaverses
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metaverses.metaverses_users cu
                    WHERE cu.metaverse_id = metaverses.metaverses.id AND cu.user_id = auth.uid()
                )
                OR admin.has_global_access(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metaverses.metaverses_users cu
                    WHERE cu.metaverse_id = metaverses.metaverses.id AND cu.user_id = auth.uid()
                )
                OR admin.has_global_access(auth.uid())
            )
        `)

        // Policy for sections
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage sections in their metaverses" ON metaverses.sections
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metaverses.sections_metaverses dc
                    JOIN metaverses.metaverses_users cu ON dc.metaverse_id = cu.metaverse_id
                    WHERE dc.section_id = metaverses.sections.id AND cu.user_id = auth.uid()
                )
                OR admin.has_global_access(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metaverses.sections_metaverses dc
                    JOIN metaverses.metaverses_users cu ON dc.metaverse_id = cu.metaverse_id
                    WHERE dc.section_id = metaverses.sections.id AND cu.user_id = auth.uid()
                )
                OR admin.has_global_access(auth.uid())
            )
        `)

        // Policy for entities
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage entities in their metaverses" ON metaverses.entities
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metaverses.entities_metaverses rc
                    JOIN metaverses.metaverses_users cu ON rc.metaverse_id = cu.metaverse_id
                    WHERE rc.entity_id = metaverses.entities.id AND cu.user_id = auth.uid()
                )
                OR admin.has_global_access(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metaverses.entities_metaverses rc
                    JOIN metaverses.metaverses_users cu ON rc.metaverse_id = cu.metaverse_id
                    WHERE rc.entity_id = metaverses.entities.id AND cu.user_id = auth.uid()
                )
                OR admin.has_global_access(auth.uid())
            )
        `)

        // Policy for entities_sections junction table
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage entities_sections in their metaverses" ON metaverses.entities_sections
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metaverses.entities_metaverses rc
                    JOIN metaverses.metaverses_users cu ON rc.metaverse_id = cu.metaverse_id
                    WHERE rc.entity_id = metaverses.entities_sections.entity_id AND cu.user_id = auth.uid()
                )
                OR admin.has_global_access(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metaverses.entities_metaverses rc
                    JOIN metaverses.metaverses_users cu ON rc.metaverse_id = cu.metaverse_id
                    WHERE rc.entity_id = metaverses.entities_sections.entity_id AND cu.user_id = auth.uid()
                )
                OR admin.has_global_access(auth.uid())
            )
        `)

        // Policy for sections_metaverses junction table
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage sections_metaverses in their metaverses" ON metaverses.sections_metaverses
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metaverses.metaverses_users cu
                    WHERE cu.metaverse_id = metaverses.sections_metaverses.metaverse_id AND cu.user_id = auth.uid()
                )
                OR admin.has_global_access(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metaverses.metaverses_users cu
                    WHERE cu.metaverse_id = metaverses.sections_metaverses.metaverse_id AND cu.user_id = auth.uid()
                )
                OR admin.has_global_access(auth.uid())
            )
        `)

        // Policy for entities_metaverses junction table
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage entities_metaverses in their metaverses" ON metaverses.entities_metaverses
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metaverses.metaverses_users cu
                    WHERE cu.metaverse_id = metaverses.entities_metaverses.metaverse_id AND cu.user_id = auth.uid()
                )
                OR admin.has_global_access(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metaverses.metaverses_users cu
                    WHERE cu.metaverse_id = metaverses.entities_metaverses.metaverse_id AND cu.user_id = auth.uid()
                )
                OR admin.has_global_access(auth.uid())
            )
        `)

        // ===== 9) Search indexes =====
        // Case-insensitive indexes for metaverses
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_metaverse_name_lower 
            ON metaverses.metaverses (LOWER("name"))
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_metaverse_description_lower 
            ON metaverses.metaverses (LOWER("description"))
        `)

        // Full-text search indexes for sections
        await queryRunner.query(`
            CREATE INDEX idx_sections_name_fts 
            ON metaverses.sections 
            USING GIN (to_tsvector('english', name))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_sections_description_fts 
            ON metaverses.sections 
            USING GIN (to_tsvector('english', description))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_sections_combined_fts 
            ON metaverses.sections 
            USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')))
        `)

        // Full-text search indexes for entities
        await queryRunner.query(`
            CREATE INDEX idx_entities_name_fts 
            ON metaverses.entities 
            USING GIN (to_tsvector('english', name))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_entities_description_fts 
            ON metaverses.entities 
            USING GIN (to_tsvector('english', description))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_entities_combined_fts 
            ON metaverses.entities 
            USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')))
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop full-text search indexes
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_entities_combined_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_entities_description_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_entities_name_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_sections_combined_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_sections_description_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_sections_name_fts`)

        // Drop search indexes
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_metaverse_description_lower`)
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_metaverse_name_lower`)

        // Drop RLS policies
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their metaverse memberships" ON metaverses.metaverses_users;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own metaverses" ON metaverses.metaverses;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage sections in their metaverses" ON metaverses.sections;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage entities in their metaverses" ON metaverses.entities;`)
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage entities_sections in their metaverses" ON metaverses.entities_sections;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage entities_metaverses in their metaverses" ON metaverses.entities_metaverses;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage sections_metaverses in their metaverses" ON metaverses.sections_metaverses;`
        )

        // Disable RLS
        await queryRunner.query(`ALTER TABLE metaverses.metaverses DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metaverses.metaverses_users DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metaverses.sections DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metaverses.entities DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metaverses.entities_sections DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metaverses.entities_metaverses DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metaverses.sections_metaverses DISABLE ROW LEVEL SECURITY;`)

        // Drop tables (junction tables first to avoid FK errors)
        await queryRunner.query(`DROP TABLE IF EXISTS metaverses.sections_metaverses`)
        await queryRunner.query(`DROP TABLE IF EXISTS metaverses.entities_metaverses`)
        await queryRunner.query(`DROP TABLE IF EXISTS metaverses.entities_sections`)
        await queryRunner.query(`DROP TABLE IF EXISTS metaverses.metaverses_users`)
        await queryRunner.query(`DROP TABLE IF EXISTS metaverses.entities`)
        await queryRunner.query(`DROP TABLE IF EXISTS metaverses.sections`)
        await queryRunner.query(`DROP TABLE IF EXISTS metaverses.metaverses`)

        // Drop schema
        await queryRunner.query(`DROP SCHEMA IF EXISTS metaverses CASCADE`)
    }
}
