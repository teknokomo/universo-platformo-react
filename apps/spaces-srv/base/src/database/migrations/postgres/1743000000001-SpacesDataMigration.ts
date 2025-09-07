import { MigrationInterface, QueryRunner } from 'typeorm'

export class SpacesDataMigration1743000000001 implements MigrationInterface {
    name = 'SpacesDataMigration1743000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('[SpacesDataMigration] Starting data migration from chat_flow to spaces/canvases...')

        // Check if chat_flow table exists
        const chatFlowExists = await queryRunner.hasTable('chat_flow')
        if (!chatFlowExists) {
            console.log('[SpacesDataMigration] chat_flow table does not exist, skipping migration')
            return
        }

        // 1) Migrate data from chat_flow to spaces table
        console.log('[SpacesDataMigration] Step 1: Migrating data to spaces table...')
        await queryRunner.query(`
            INSERT INTO "public"."spaces"(id, name, description, visibility, unik_id, created_date, updated_date)
            SELECT 
                cf.id, 
                cf.name, 
                NULL as description, 
                'private' as visibility, 
                cf.unik_id, 
                cf."createdDate", 
                cf."updatedDate"
            FROM chat_flow cf
            ON CONFLICT (id) DO NOTHING;
        `)

        // 2) Migrate data from chat_flow to canvases table with the SAME id
        console.log('[SpacesDataMigration] Step 2: Migrating data to canvases table...')
        await queryRunner.query(`
            INSERT INTO "public"."canvases"(
                id, name, "flowData", deployed, "isPublic", apikeyid, 
                "chatbotConfig", "apiConfig", analytic, "speechToText", 
                "followUpPrompts", category, type, created_date, updated_date
            )
            SELECT 
                cf.id, 
                'Main Canvas' as name, 
                cf."flowData", 
                cf.deployed, 
                cf."isPublic", 
                cf.apikeyid,
                cf."chatbotConfig", 
                cf."apiConfig", 
                cf.analytic, 
                cf."speechToText",
                cf."followUpPrompts", 
                cf.category, 
                cf.type,
                cf."createdDate", 
                cf."updatedDate"
            FROM chat_flow cf
            ON CONFLICT (id) DO NOTHING;
        `)

        // 3) Create relationships in spaces_canvases table
        console.log('[SpacesDataMigration] Step 3: Creating space-canvas relationships...')
        await queryRunner.query(`
            INSERT INTO "public"."spaces_canvases"(space_id, canvas_id, sort_order, created_date)
            SELECT 
                cf.id as space_id, 
                cf.id as canvas_id, 
                1 as sort_order,
                cf."createdDate"
            FROM chat_flow cf
            ON CONFLICT (space_id, canvas_id) DO NOTHING;
        `)

        // 4) Verify migration results
        const spacesCount = await queryRunner.query('SELECT COUNT(*) as count FROM "public"."spaces"')
        const canvasesCount = await queryRunner.query('SELECT COUNT(*) as count FROM "public"."canvases"')
        const relationshipsCount = await queryRunner.query('SELECT COUNT(*) as count FROM "public"."spaces_canvases"')
        const chatFlowCount = await queryRunner.query('SELECT COUNT(*) as count FROM chat_flow')

        console.log(`[SpacesDataMigration] Migration completed:`)
        console.log(`  - chat_flow records: ${chatFlowCount[0].count}`)
        console.log(`  - spaces created: ${spacesCount[0].count}`)
        console.log(`  - canvases created: ${canvasesCount[0].count}`)
        console.log(`  - relationships created: ${relationshipsCount[0].count}`)

        // Verify that counts match
        if (spacesCount[0].count !== chatFlowCount[0].count ||
            canvasesCount[0].count !== chatFlowCount[0].count ||
            relationshipsCount[0].count !== chatFlowCount[0].count) {
            throw new Error('[SpacesDataMigration] Migration verification failed: record counts do not match')
        }

        console.log('[SpacesDataMigration] Data migration completed successfully!')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('[SpacesDataMigration] Rolling back data migration...')

        // Remove migrated data (in reverse order)
        await queryRunner.query('DELETE FROM "public"."spaces_canvases"')
        await queryRunner.query('DELETE FROM "public"."canvases"')
        await queryRunner.query('DELETE FROM "public"."spaces"')

        console.log('[SpacesDataMigration] Rollback completed')
    }
}