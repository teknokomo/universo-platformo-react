import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to add consent tracking fields to lead table.
 *
 * These columns track user acceptance of Terms of Service and Privacy Policy
 * during quiz/lead collection:
 * - terms_accepted: boolean flag indicating Terms acceptance
 * - terms_accepted_at: timestamp of Terms acceptance
 * - privacy_accepted: boolean flag indicating Privacy Policy acceptance
 * - privacy_accepted_at: timestamp of Privacy Policy acceptance
 * - terms_version: version of Terms document at time of acceptance
 * - privacy_version: version of Privacy Policy at time of acceptance
 *
 * Important: Existing leads will have FALSE defaults - they were created
 * before consent collection was implemented.
 */
export class AddConsentFieldsToLead1735638000000 implements MigrationInterface {
    name = 'AddConsentFieldsToLead1735638000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add terms_accepted column with default false
        await queryRunner.query(`
            ALTER TABLE "lead" 
            ADD COLUMN IF NOT EXISTS "terms_accepted" BOOLEAN NOT NULL DEFAULT false
        `)

        // Add terms_accepted_at timestamp column (nullable for existing leads)
        await queryRunner.query(`
            ALTER TABLE "lead" 
            ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP WITH TIME ZONE
        `)

        // Add privacy_accepted column with default false
        await queryRunner.query(`
            ALTER TABLE "lead" 
            ADD COLUMN IF NOT EXISTS "privacy_accepted" BOOLEAN NOT NULL DEFAULT false
        `)

        // Add privacy_accepted_at timestamp column (nullable for existing leads)
        await queryRunner.query(`
            ALTER TABLE "lead" 
            ADD COLUMN IF NOT EXISTS "privacy_accepted_at" TIMESTAMP WITH TIME ZONE
        `)

        // Add terms_version to track which version of Terms user accepted
        await queryRunner.query(`
            ALTER TABLE "lead" 
            ADD COLUMN IF NOT EXISTS "terms_version" VARCHAR(50)
        `)

        // Add privacy_version to track which version of Privacy Policy user accepted
        await queryRunner.query(`
            ALTER TABLE "lead" 
            ADD COLUMN IF NOT EXISTS "privacy_version" VARCHAR(50)
        `)

        // Add indexes for efficient filtering (useful for compliance queries)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_lead_terms_accepted" 
            ON "lead" ("terms_accepted")
        `)

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_lead_privacy_accepted" 
            ON "lead" ("privacy_accepted")
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_lead_privacy_accepted"`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_lead_terms_accepted"`)
        await queryRunner.query(`ALTER TABLE "lead" DROP COLUMN IF EXISTS "privacy_version"`)
        await queryRunner.query(`ALTER TABLE "lead" DROP COLUMN IF EXISTS "terms_version"`)
        await queryRunner.query(`ALTER TABLE "lead" DROP COLUMN IF EXISTS "privacy_accepted_at"`)
        await queryRunner.query(`ALTER TABLE "lead" DROP COLUMN IF EXISTS "privacy_accepted"`)
        await queryRunner.query(`ALTER TABLE "lead" DROP COLUMN IF EXISTS "terms_accepted_at"`)
        await queryRunner.query(`ALTER TABLE "lead" DROP COLUMN IF EXISTS "terms_accepted"`)
    }
}
