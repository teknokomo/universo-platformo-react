import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMetaversesSectionsEntities1741277700000 implements MigrationInterface {
    name = 'AddMetaversesSectionsEntities1741277700000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

        // 1) Core tables: metaverses, sections, entities
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS entities;`)

        // Core tables in entities schema
        await queryRunner.query(`
            CREATE TABLE entities.metaverses (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE entities.sections (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE entities.entities (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        // 2) User-metaverse relationship table (metaverse-centric naming)
        await queryRunner.query(`
            CREATE TABLE entities.metaverses_users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                metaverse_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'owner',
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(metaverse_id, user_id),
                FOREIGN KEY (metaverse_id) REFERENCES entities.metaverses(id) ON DELETE CASCADE
            )
        `)

        // 3) Junction tables for many-to-many relationships
        await queryRunner.query(`
            CREATE TABLE entities.entities_sections (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                entity_id UUID NOT NULL,
                section_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(entity_id, section_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE entities.entities_metaverses (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                entity_id UUID NOT NULL,
                metaverse_id UUID NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(entity_id, metaverse_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE entities.sections_metaverses (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                section_id UUID NOT NULL,
                metaverse_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(section_id, metaverse_id)
            )
        `)

        // 4) Foreign key constraints with CASCADE delete
        // Add foreign key for user_id to auth.users
        try {
            await queryRunner.query(`
                ALTER TABLE entities.metaverses_users
                ADD CONSTRAINT fk_cu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `)
        } catch (error) {
            console.warn(
                'Warning: Unable to add FK constraint on metaverses_users.user_id referencing auth.users. Continuing without it.',
                error
            )
        }

        await queryRunner.query(`
            ALTER TABLE entities.metaverses_users
                ADD CONSTRAINT fk_cu_metaverse FOREIGN KEY (metaverse_id) REFERENCES entities.metaverses(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE entities.entities_sections
                ADD CONSTRAINT fk_rd_entity FOREIGN KEY (entity_id) REFERENCES entities.entities(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE entities.entities_sections
                ADD CONSTRAINT fk_rd_section FOREIGN KEY (section_id) REFERENCES entities.sections(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE entities.entities_metaverses
                ADD CONSTRAINT fk_rc_entity FOREIGN KEY (entity_id) REFERENCES entities.entities(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE entities.entities_metaverses
                ADD CONSTRAINT fk_rc_metaverse FOREIGN KEY (metaverse_id) REFERENCES entities.metaverses(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE entities.sections_metaverses
                ADD CONSTRAINT fk_dc_section FOREIGN KEY (section_id) REFERENCES entities.sections(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE entities.sections_metaverses
                ADD CONSTRAINT fk_dc_metaverse FOREIGN KEY (metaverse_id) REFERENCES entities.metaverses(id) ON DELETE CASCADE
        `)

        // 5) Performance indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cu_metaverse ON entities.metaverses_users(metaverse_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cu_user ON entities.metaverses_users(user_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rd_res ON entities.entities_sections(entity_id)`)

        // RLS Policies for metaverse isolation
        // Enable RLS on all tables
        await queryRunner.query(`ALTER TABLE entities.metaverses ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE entities.metaverses_users ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE entities.sections ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE entities.entities ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE entities.entities_sections ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE entities.entities_metaverses ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE entities.sections_metaverses ENABLE ROW LEVEL SECURITY;`)

        // RLS Policies for metaverses_users table
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their metaverse memberships" ON entities.metaverses_users
            FOR ALL
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid())
        `)

        // RLS Policies for metaverses (based on metaverse-user relationship)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their own metaverses" ON entities.metaverses
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM entities.metaverses_users cu
                    WHERE cu.metaverse_id = entities.metaverses.id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM entities.metaverses_users cu
                    WHERE cu.metaverse_id = entities.metaverses.id AND cu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for sections (based on metaverse membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage sections in their metaverses" ON entities.sections
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM entities.sections_metaverses dc
                    JOIN entities.metaverses_users cu ON dc.metaverse_id = cu.metaverse_id
                    WHERE dc.section_id = entities.sections.id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM entities.sections_metaverses dc
                    JOIN entities.metaverses_users cu ON dc.metaverse_id = cu.metaverse_id
                    WHERE dc.section_id = entities.sections.id AND cu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for entities (based on metaverse membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage entities in their metaverses" ON entities.entities
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM entities.entities_metaverses rc
                    JOIN entities.metaverses_users cu ON rc.metaverse_id = cu.metaverse_id
                    WHERE rc.entity_id = entities.entities.id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM entities.entities_metaverses rc
                    JOIN entities.metaverses_users cu ON rc.metaverse_id = cu.metaverse_id
                    WHERE rc.entity_id = entities.entities.id AND cu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for junction tables (based on metaverse membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage entities_sections in their metaverses" ON entities.entities_sections
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM entities.entities_metaverses rc
                    JOIN entities.metaverses_users cu ON rc.metaverse_id = cu.metaverse_id
                    WHERE rc.entity_id = entities.entities_sections.entity_id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM entities.entities_metaverses rc
                    JOIN entities.metaverses_users cu ON rc.metaverse_id = cu.metaverse_id
                    WHERE rc.entity_id = entities.entities_sections.entity_id AND cu.user_id = auth.uid()
                )
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage entities_metaverses in their metaverses" ON entities.entities_metaverses
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM entities.metaverses_users cu
                    WHERE cu.metaverse_id = entities.entities_metaverses.metaverse_id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM entities.metaverses_users cu
                    WHERE cu.metaverse_id = entities.entities_metaverses.metaverse_id AND cu.user_id = auth.uid()
                )
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage sections_metaverses in their metaverses" ON entities.sections_metaverses
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM entities.metaverses_users cu
                    WHERE cu.metaverse_id = entities.sections_metaverses.metaverse_id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM entities.metaverses_users cu
                    WHERE cu.metaverse_id = entities.sections_metaverses.metaverse_id AND cu.user_id = auth.uid()
                )
            )
        `)

        // Additional performance indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rd_dom ON entities.entities_sections(section_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rc_res ON entities.entities_metaverses(entity_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rc_clu ON entities.entities_metaverses(metaverse_id)`)
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS idx_rc_metaverse_sort ON entities.entities_metaverses(metaverse_id, sort_order)`
        )
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dc_dom ON entities.sections_metaverses(section_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dc_clu ON entities.sections_metaverses(metaverse_id)`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop RLS policies first
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their metaverse memberships" ON entities.metaverses_users;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own metaverses" ON entities.metaverses;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage sections in their metaverses" ON entities.sections;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage entities in their metaverses" ON entities.entities;`)
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage entities_sections in their metaverses" ON entities.entities_sections;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage entities_metaverses in their metaverses" ON entities.entities_metaverses;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage sections_metaverses in their metaverses" ON entities.sections_metaverses;`
        )

        // Disable RLS
        await queryRunner.query(`ALTER TABLE entities.metaverses DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE entities.metaverses_users DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE entities.sections DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE entities.entities DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE entities.entities_sections DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE entities.entities_metaverses DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE entities.sections_metaverses DISABLE ROW LEVEL SECURITY;`)

        // Drop junction tables first to avoid FK constraint errors
        await queryRunner.query(`DROP TABLE IF EXISTS entities.sections_metaverses`)
        await queryRunner.query(`DROP TABLE IF EXISTS entities.entities_metaverses`)
        await queryRunner.query(`DROP TABLE IF EXISTS entities.entities_sections`)
        await queryRunner.query(`DROP TABLE IF EXISTS entities.metaverses_users`)
        // Drop core tables
        await queryRunner.query(`DROP TABLE IF EXISTS entities.entities`)
        await queryRunner.query(`DROP TABLE IF EXISTS entities.sections`)
        await queryRunner.query(`DROP TABLE IF EXISTS entities.metaverses`)
        await queryRunner.query(`DROP SCHEMA IF EXISTS entities CASCADE`)
    }
}
