import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitStorages1741364300000 implements MigrationInterface {
    name = 'InitStorages1741364300000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

        // 1) Core tables: storages, containers, slots
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS storages;`)

        // Core tables in storages schema
        await queryRunner.query(`
            CREATE TABLE storages.storages (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE storages.containers (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE storages.slots (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        // 2) User-storage relationship table (storage-centric naming)
        await queryRunner.query(`
            CREATE TABLE storages.storages_users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                storage_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'owner',
                comment TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(storage_id, user_id),
                FOREIGN KEY (storage_id) REFERENCES storages.storages(id) ON DELETE CASCADE
            )
        `)

        // 3) Junction tables for many-to-many relationships
        await queryRunner.query(`
            CREATE TABLE storages.slots_containers (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                slot_id UUID NOT NULL,
                container_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(slot_id, container_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE storages.slots_storages (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                slot_id UUID NOT NULL,
                storage_id UUID NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(slot_id, storage_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE storages.containers_storages (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                container_id UUID NOT NULL,
                storage_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(container_id, storage_id)
            )
        `)

        // 4) Foreign key constraints with CASCADE delete
        // Add foreign key for user_id to auth.users
        try {
            await queryRunner.query(`
                ALTER TABLE storages.storages_users
                ADD CONSTRAINT fk_cu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `)
        } catch (error) {
            console.warn(
                'Warning: Unable to add FK constraint on storages_users.user_id referencing auth.users. Continuing without it.',
                error
            )
        }

        await queryRunner.query(`
            ALTER TABLE storages.storages_users
                ADD CONSTRAINT fk_cu_storage FOREIGN KEY (storage_id) REFERENCES storages.storages(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE storages.slots_containers
                ADD CONSTRAINT fk_rd_slot FOREIGN KEY (slot_id) REFERENCES storages.slots(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE storages.slots_containers
                ADD CONSTRAINT fk_rd_container FOREIGN KEY (container_id) REFERENCES storages.containers(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE storages.slots_storages
                ADD CONSTRAINT fk_rc_slot FOREIGN KEY (slot_id) REFERENCES storages.slots(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE storages.slots_storages
                ADD CONSTRAINT fk_rc_storage FOREIGN KEY (storage_id) REFERENCES storages.storages(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE storages.containers_storages
                ADD CONSTRAINT fk_dc_container FOREIGN KEY (container_id) REFERENCES storages.containers(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE storages.containers_storages
                ADD CONSTRAINT fk_dc_storage FOREIGN KEY (storage_id) REFERENCES storages.storages(id) ON DELETE CASCADE
        `)

        // 5) Performance indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cu_storage ON storages.storages_users(storage_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cu_user ON storages.storages_users(user_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rd_res ON storages.slots_containers(slot_id)`)

        // RLS Policies for storage isolation
        // Enable RLS on all tables
        await queryRunner.query(`ALTER TABLE storages.storages ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE storages.storages_users ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE storages.containers ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE storages.slots ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE storages.slots_containers ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE storages.slots_storages ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE storages.containers_storages ENABLE ROW LEVEL SECURITY;`)

        // RLS Policies for storages_users table
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their storage memberships" ON storages.storages_users
            FOR ALL
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid())
        `)

        // RLS Policies for storages (based on storage-user relationship)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their own storages" ON storages.storages
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM storages.storages_users cu
                    WHERE cu.storage_id = storages.storages.id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM storages.storages_users cu
                    WHERE cu.storage_id = storages.storages.id AND cu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for containers (based on storage membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage containers in their storages" ON storages.containers
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM storages.containers_storages dc
                    JOIN storages.storages_users cu ON dc.storage_id = cu.storage_id
                    WHERE dc.container_id = storages.containers.id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM storages.containers_storages dc
                    JOIN storages.storages_users cu ON dc.storage_id = cu.storage_id
                    WHERE dc.container_id = storages.containers.id AND cu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for slots (based on storage membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage slots in their storages" ON storages.slots
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM storages.slots_storages rc
                    JOIN storages.storages_users cu ON rc.storage_id = cu.storage_id
                    WHERE rc.slot_id = storages.slots.id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM storages.slots_storages rc
                    JOIN storages.storages_users cu ON rc.storage_id = cu.storage_id
                    WHERE rc.slot_id = storages.slots.id AND cu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for junction tables (based on storage membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage slots_containers in their storages" ON storages.slots_containers
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM storages.slots_storages rc
                    JOIN storages.storages_users cu ON rc.storage_id = cu.storage_id
                    WHERE rc.slot_id = storages.slots_containers.slot_id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM storages.slots_storages rc
                    JOIN storages.storages_users cu ON rc.storage_id = cu.storage_id
                    WHERE rc.slot_id = storages.slots_containers.slot_id AND cu.user_id = auth.uid()
                )
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage slots_storages in their storages" ON storages.slots_storages
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM storages.storages_users cu
                    WHERE cu.storage_id = storages.slots_storages.storage_id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM storages.storages_users cu
                    WHERE cu.storage_id = storages.slots_storages.storage_id AND cu.user_id = auth.uid()
                )
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage containers_storages in their storages" ON storages.containers_storages
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM storages.storages_users cu
                    WHERE cu.storage_id = storages.containers_storages.storage_id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM storages.storages_users cu
                    WHERE cu.storage_id = storages.containers_storages.storage_id AND cu.user_id = auth.uid()
                )
            )
        `)

        // Additional performance indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rd_dom ON storages.slots_containers(container_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rc_res ON storages.slots_storages(slot_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rc_clu ON storages.slots_storages(storage_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rc_storage_sort ON storages.slots_storages(storage_id, sort_order)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dc_dom ON storages.containers_storages(container_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dc_clu ON storages.containers_storages(storage_id)`)

        // Search performance indexes (case-insensitive)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_storage_name_lower 
            ON storages.storages (LOWER("name"))
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_storage_description_lower 
            ON storages.storages (LOWER("description"))
        `)

        // Full-text search indexes (GIN)
        await queryRunner.query(`
            CREATE INDEX idx_containers_name_fts 
            ON storages.containers 
            USING GIN (to_tsvector('english', name))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_containers_description_fts 
            ON storages.containers 
            USING GIN (to_tsvector('english', description))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_slots_name_fts 
            ON storages.slots 
            USING GIN (to_tsvector('english', name))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_slots_description_fts 
            ON storages.slots 
            USING GIN (to_tsvector('english', description))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_containers_combined_fts 
            ON storages.containers 
            USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_slots_combined_fts 
            ON storages.slots 
            USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')))
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop full-text search indexes
        await queryRunner.query(`DROP INDEX IF EXISTS storages.idx_slots_combined_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS storages.idx_containers_combined_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS storages.idx_slots_description_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS storages.idx_slots_name_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS storages.idx_containers_description_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS storages.idx_containers_name_fts`)

        // Drop search indexes
        await queryRunner.query(`DROP INDEX IF EXISTS storages.idx_storage_description_lower`)
        await queryRunner.query(`DROP INDEX IF EXISTS storages.idx_storage_name_lower`)

        // Drop RLS policies first
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their storage memberships" ON storages.storages_users;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own storages" ON storages.storages;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage containers in their storages" ON storages.containers;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage slots in their storages" ON storages.slots;`)
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage slots_containers in their storages" ON storages.slots_containers;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage slots_storages in their storages" ON storages.slots_storages;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage containers_storages in their storages" ON storages.containers_storages;`
        )

        // Disable RLS
        await queryRunner.query(`ALTER TABLE storages.storages DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE storages.storages_users DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE storages.containers DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE storages.slots DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE storages.slots_containers DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE storages.slots_storages DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE storages.containers_storages DISABLE ROW LEVEL SECURITY;`)

        // Drop junction tables first to avoid FK constraint errors
        await queryRunner.query(`DROP TABLE IF EXISTS storages.containers_storages`)
        await queryRunner.query(`DROP TABLE IF EXISTS storages.slots_storages`)
        await queryRunner.query(`DROP TABLE IF EXISTS storages.slots_containers`)
        await queryRunner.query(`DROP TABLE IF EXISTS storages.storages_users`)
        // Drop core tables
        await queryRunner.query(`DROP TABLE IF EXISTS storages.slots`)
        await queryRunner.query(`DROP TABLE IF EXISTS storages.containers`)
        await queryRunner.query(`DROP TABLE IF EXISTS storages.storages`)
        await queryRunner.query(`DROP SCHEMA IF EXISTS storages CASCADE`)
    }
}
