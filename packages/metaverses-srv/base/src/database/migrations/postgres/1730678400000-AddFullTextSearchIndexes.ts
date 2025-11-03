import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFullTextSearchIndexes1730678400000 implements MigrationInterface {
    name = 'AddFullTextSearchIndexes1730678400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add GIN indexes for full-text search on sections
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

        // Add GIN indexes for full-text search on entities
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

        // Optional: Add combined index for searching both name and description together
        await queryRunner.query(`
            CREATE INDEX idx_sections_combined_fts 
            ON metaverses.sections 
            USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')))
        `)

        await queryRunner.query(`
            CREATE INDEX idx_entities_combined_fts 
            ON metaverses.entities 
            USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')))
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes in reverse order
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_entities_combined_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_sections_combined_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_entities_description_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_entities_name_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_sections_description_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS metaverses.idx_sections_name_fts`)
    }
}
