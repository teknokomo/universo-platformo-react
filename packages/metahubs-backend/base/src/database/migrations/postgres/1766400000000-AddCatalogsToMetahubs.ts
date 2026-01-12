import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Add Catalogs entity to Metahubs schema with Many-to-Many Hub relationship
 *
 * Catalogs are analogous to "Справочники" (Reference/Catalog) in 1C:Enterprise.
 * Each Catalog belongs to a Metahub (metahub_id is REQUIRED for ownership).
 * Catalogs can be associated with multiple Hubs via the catalogs_hubs junction table.
 * Attributes and Records are scoped to Catalogs.
 *
 * Since there is NO production data in the current metahubs structure,
 * we can safely restructure without data migration.
 */
export class AddCatalogsToMetahubs1766400000000 implements MigrationInterface {
    name = 'AddCatalogsToMetahubs1766400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ===== 1) Create catalogs table with metahub_id (ownership) =====
        await queryRunner.query(`
            CREATE TABLE metahubs.catalogs (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                metahub_id UUID NOT NULL,
                name JSONB NOT NULL DEFAULT '{}',
                description JSONB DEFAULT '{}',
                codename VARCHAR(100) NOT NULL,
                is_single_hub BOOLEAN NOT NULL DEFAULT false,
                is_required_hub BOOLEAN NOT NULL DEFAULT false,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now(),
                FOREIGN KEY (metahub_id) REFERENCES metahubs.metahubs(id) ON DELETE CASCADE,
                UNIQUE(metahub_id, codename)
            )
        `)

        // ===== 2) Create catalogs_hubs junction table for N:M relationship =====
        await queryRunner.query(`
            CREATE TABLE metahubs.catalogs_hubs (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                catalog_id UUID NOT NULL,
                hub_id UUID NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                FOREIGN KEY (catalog_id) REFERENCES metahubs.catalogs(id) ON DELETE CASCADE,
                FOREIGN KEY (hub_id) REFERENCES metahubs.hubs(id) ON DELETE CASCADE,
                UNIQUE(catalog_id, hub_id)
            )
        `)

        // ===== 2) Add catalog_id column to attributes =====
        await queryRunner.query(`
            ALTER TABLE metahubs.attributes
            ADD COLUMN catalog_id UUID
        `)

        // ===== 3) Add catalog_id column to records =====
        await queryRunner.query(`
            ALTER TABLE metahubs.records
            ADD COLUMN catalog_id UUID
        `)

        // ===== 4) Drop old indexes on hub_id BEFORE dropping the column =====
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_attrs_hub`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_recs_hub`)

        // ===== 5) Drop hub_id columns with CASCADE (removes all dependent FKs/constraints) =====
        await queryRunner.query(`
            ALTER TABLE metahubs.attributes
            DROP COLUMN IF EXISTS hub_id CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE metahubs.records
            DROP COLUMN IF EXISTS hub_id CASCADE
        `)

        // ===== 6) Make catalog_id NOT NULL and add FKs =====
        await queryRunner.query(`
            ALTER TABLE metahubs.attributes
            ALTER COLUMN catalog_id SET NOT NULL
        `)
        await queryRunner.query(`
            ALTER TABLE metahubs.records
            ALTER COLUMN catalog_id SET NOT NULL
        `)

        await queryRunner.query(`
            ALTER TABLE metahubs.attributes
            ADD CONSTRAINT fk_attr_catalog FOREIGN KEY (catalog_id)
            REFERENCES metahubs.catalogs(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE metahubs.records
            ADD CONSTRAINT fk_rec_catalog FOREIGN KEY (catalog_id)
            REFERENCES metahubs.catalogs(id) ON DELETE CASCADE
        `)

        // ===== 7) Add target_catalog_id for REF type attributes =====
        await queryRunner.query(`
            ALTER TABLE metahubs.attributes
            ADD COLUMN target_catalog_id UUID,
            ADD CONSTRAINT fk_attr_target_catalog FOREIGN KEY (target_catalog_id)
            REFERENCES metahubs.catalogs(id) ON DELETE SET NULL
        `)

        // ===== 8) Add new unique constraint for attributes =====
        await queryRunner.query(`
            ALTER TABLE metahubs.attributes
            ADD CONSTRAINT attributes_catalog_id_codename_key UNIQUE(catalog_id, codename)
        `)

        // ===== 9) Performance indexes =====
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_catalogs_metahub ON metahubs.catalogs(metahub_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_catalogs_codename ON metahubs.catalogs(codename)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_catalogs_hubs_catalog ON metahubs.catalogs_hubs(catalog_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_catalogs_hubs_hub ON metahubs.catalogs_hubs(hub_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_attrs_catalog ON metahubs.attributes(catalog_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_recs_catalog ON metahubs.records(catalog_id)`)
        // Partial index for efficient blocking catalogs queries
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_catalogs_is_required_hub ON metahubs.catalogs(is_required_hub) WHERE is_required_hub = true`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse migration (restore hub_id structure)

        // Drop new indexes
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_catalogs_metahub`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_catalogs_codename`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_catalogs_hubs_catalog`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_catalogs_hubs_hub`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_attrs_catalog`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_recs_catalog`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_catalogs_is_required_hub`)

        // Drop constraints
        await queryRunner.query(`
            ALTER TABLE metahubs.attributes DROP CONSTRAINT IF EXISTS attributes_catalog_id_codename_key
        `)
        await queryRunner.query(`
            ALTER TABLE metahubs.attributes DROP CONSTRAINT IF EXISTS fk_attr_target_catalog
        `)
        await queryRunner.query(`
            ALTER TABLE metahubs.attributes DROP COLUMN IF EXISTS target_catalog_id
        `)
        await queryRunner.query(`
            ALTER TABLE metahubs.attributes DROP CONSTRAINT IF EXISTS fk_attr_catalog
        `)
        await queryRunner.query(`
            ALTER TABLE metahubs.records DROP CONSTRAINT IF EXISTS fk_rec_catalog
        `)

        // Add hub_id back
        await queryRunner.query(`
            ALTER TABLE metahubs.attributes ADD COLUMN hub_id UUID
        `)
        await queryRunner.query(`
            ALTER TABLE metahubs.records ADD COLUMN hub_id UUID
        `)

        // Drop catalog_id
        await queryRunner.query(`ALTER TABLE metahubs.attributes DROP COLUMN catalog_id`)
        await queryRunner.query(`ALTER TABLE metahubs.records DROP COLUMN catalog_id`)

        // Drop junction table first (before catalogs)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.catalogs_hubs`)

        // Drop catalogs table
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.catalogs`)

        // Restore old indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_attrs_hub ON metahubs.attributes(hub_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_recs_hub ON metahubs.records(hub_id)`)
    }
}
