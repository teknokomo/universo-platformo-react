import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Consolidated migration for Assistant table creation.
 * Combines AddAssistantEntity (1699325775451) and AddTypeToAssistant (1733011290987).
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
            // Create assistant table with type column included
            // (unik_id will be added by AddUniksAndLinked migration)
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "public"."assistant" (
                    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                    "credential" varchar NOT NULL,
                    "details" text NOT NULL,
                    "iconSrc" varchar NULL,
                    "type" text NULL,
                    "createdDate" timestamp NOT NULL DEFAULT now(),
                    "updatedDate" timestamp NOT NULL DEFAULT now()
                );
            `)
            console.log('✅ [AddAssistant] Created assistant table')
        } else {
            // Table exists - ensure type column exists (from AddTypeToAssistant migration)
            const typeColumnExists = await queryRunner.hasColumn('assistant', 'type')
            if (!typeColumnExists) {
                await queryRunner.query(`ALTER TABLE "assistant" ADD COLUMN "type" TEXT;`)
                await queryRunner.query(`UPDATE "assistant" SET "type" = 'OPENAI' WHERE "type" IS NULL;`)
                console.log('✅ [AddAssistant] Added type column to existing assistant table')
            } else {
                console.log('ℹ️ [AddAssistant] Assistant table already exists with type column, skipping')
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."assistant";`)
    }
}
