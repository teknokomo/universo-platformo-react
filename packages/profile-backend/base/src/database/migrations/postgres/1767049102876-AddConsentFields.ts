import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to add consent tracking fields to profiles table.
 *
 * These columns track user acceptance of Terms of Service and Privacy Policy:
 * - terms_accepted: boolean flag indicating Terms acceptance
 * - terms_accepted_at: timestamp of Terms acceptance
 * - privacy_accepted: boolean flag indicating Privacy Policy acceptance
 * - privacy_accepted_at: timestamp of Privacy Policy acceptance
 *
 * Important: Existing users will have FALSE defaults - they won't be required
 * to re-accept since they're already registered. Only new registrations
 * require explicit consent.
 */
export class AddConsentFields1767049102876 implements MigrationInterface {
    name = 'AddConsentFields1767049102876'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add terms_accepted column with default false
        await queryRunner.query(`
            ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "terms_accepted" BOOLEAN NOT NULL DEFAULT false
        `)

        // Add terms_accepted_at timestamp column (nullable for existing users)
        await queryRunner.query(`
            ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP WITH TIME ZONE
        `)

        // Add privacy_accepted column with default false
        await queryRunner.query(`
            ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "privacy_accepted" BOOLEAN NOT NULL DEFAULT false
        `)

        // Add privacy_accepted_at timestamp column (nullable for existing users)
        await queryRunner.query(`
            ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "privacy_accepted_at" TIMESTAMP WITH TIME ZONE
        `)

        // Add terms_version to track which version of Terms of Service user accepted
        await queryRunner.query(`
            ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "terms_version" VARCHAR(50)
        `)

        // Add privacy_version to track which version of Privacy Policy user accepted
        await queryRunner.query(`
            ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "privacy_version" VARCHAR(50)
        `)

        // Add indexes for efficient filtering (useful for compliance queries)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_profiles_terms_accepted" 
            ON "profiles" ("terms_accepted")
        `)

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_profiles_privacy_accepted" 
            ON "profiles" ("privacy_accepted")
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_profiles_privacy_accepted"`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_profiles_terms_accepted"`)
        await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "privacy_version"`)
        await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "terms_version"`)
        await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "privacy_accepted_at"`)
        await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "privacy_accepted"`)
        await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "terms_accepted_at"`)
        await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "terms_accepted"`)
    }
}
