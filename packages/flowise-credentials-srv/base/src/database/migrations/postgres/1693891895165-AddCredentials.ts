import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration for Credential table creation.
 * Creates the base credential table structure with encryptedData as TEXT.
 * 
 * NOTE: unik_id column and RLS policy are added by AddUniksAndLinked migration
 * which runs later and handles all Flowise table integrations with Uniks.
 * 
 * This migration runs right after AddTools (1693891895164).
 */
export class AddCredentials1693891895165 implements MigrationInterface {
    name = 'AddCredentials1693891895165'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table already exists (for existing databases)
        const tableExists = await queryRunner.hasTable('credential')

        if (!tableExists) {
            // Create credential table with encryptedData as TEXT from start
            // (unik_id will be added by AddUniksAndLinked migration)
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "public"."credential" (
                    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                    "name" varchar NOT NULL,
                    "credentialName" varchar NOT NULL,
                    "encryptedData" text NOT NULL,
                    "createdDate" timestamp NOT NULL DEFAULT now(),
                    "updatedDate" timestamp NOT NULL DEFAULT now()
                );
            `)
            console.log('✅ [AddCredentials] Created credential table')
        } else {
            console.log('ℹ️ [AddCredentials] Credential table already exists, skipping creation')
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."credential";`)
    }
}
