import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Consolidated migration for Assistant table creation.
 * Combines AddAssistantEntity (1699325775451), AddTypeToAssistant (1733011290987),
 * and FieldTypes (1710497452584 - credential varchar→uuid conversion).
 *
 * NOTE: unik_id column and FK constraint are added by AddUniksAndLinked migration
 * which runs later and handles all Flowise table integrations with Uniks.
 */
export class AddAssistant1699325775451 implements MigrationInterface {
    name = 'AddAssistant1699325775451'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table already exists (for existing databases)
        const tableExists = await queryRunner.hasTable('assistant')

        if (!tableExists) {
            // Create assistant table with type column and credential as uuid from start
            // (unik_id will be added by AddUniksAndLinked migration)
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "public"."assistant" (
                    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                    "credential" uuid NOT NULL,
                    "details" text NOT NULL,
                    "iconSrc" varchar NULL,
                    "type" text NULL,
                    "createdDate" timestamp NOT NULL DEFAULT now(),
                    "updatedDate" timestamp NOT NULL DEFAULT now()
                );
            `)
            console.log('✅ [AddAssistant] Created assistant table with uuid credential')
        } else {
            // Table exists - ensure type column exists (from AddTypeToAssistant migration)
            const typeColumnExists = await queryRunner.hasColumn('assistant', 'type')
            if (!typeColumnExists) {
                await queryRunner.query(`ALTER TABLE "assistant" ADD COLUMN "type" TEXT;`)
                await queryRunner.query(`UPDATE "assistant" SET "type" = 'OPENAI' WHERE "type" IS NULL;`)
                console.log('✅ [AddAssistant] Added type column to existing assistant table')
            }

            // Convert credential from varchar to uuid if needed (from FieldTypes migration)
            // This handles existing databases that were created with varchar credential
            const credentialColumn = await queryRunner.query(`
                SELECT data_type FROM information_schema.columns 
                WHERE table_name = 'assistant' AND column_name = 'credential'
            `)
            if (credentialColumn.length > 0 && credentialColumn[0].data_type !== 'uuid') {
                await queryRunner.query(`ALTER TABLE "assistant" ALTER COLUMN "credential" TYPE uuid USING "credential"::uuid`)
                console.log('✅ [AddAssistant] Converted credential column to uuid type')
            } else {
                console.log('ℹ️ [AddAssistant] Assistant table already has uuid credential, skipping')
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."assistant";`)
    }
}
