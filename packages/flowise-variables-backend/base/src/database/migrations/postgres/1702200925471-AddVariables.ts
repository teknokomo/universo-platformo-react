import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration for Variable table creation.
 * Creates the base variable table structure.
 * 
 * NOTE: unik_id column and RLS policy are added by AddUniksAndLinked migration
 * which runs later and handles all Flowise table integrations with Uniks.
 * 
 * This migration uses the original timestamp from flowise-server.
 */
export class AddVariables1702200925471 implements MigrationInterface {
    name = 'AddVariables1702200925471'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table already exists (for existing databases)
        const tableExists = await queryRunner.hasTable('variable')

        if (!tableExists) {
            // Create variable table
            // (unik_id will be added by AddUniksAndLinked migration)
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "public"."variable" (
                    "id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    "name" varchar NOT NULL,
                    "value" text,
                    "type" text DEFAULT 'static',
                    "createdDate" timestamp NOT NULL DEFAULT now(),
                    "updatedDate" timestamp NOT NULL DEFAULT now()
                );
            `)
            console.log('✅ [AddVariables] Created variable table')
        } else {
            console.log('ℹ️ [AddVariables] Variable table already exists, skipping creation')
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('variable')
        if (tableExists) {
            // Note: FK to unik will be removed by AddUniksAndLinked.down() which runs before this
            await queryRunner.query(`DROP TABLE IF EXISTS "public"."variable";`)
            console.log('✅ [AddVariables] Dropped variable table')
        } else {
            console.log('ℹ️ [AddVariables] Variable table does not exist, skipping drop')
        }
    }
}
