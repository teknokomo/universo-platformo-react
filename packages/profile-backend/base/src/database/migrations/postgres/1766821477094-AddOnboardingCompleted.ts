import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to add onboarding_completed column to profiles table.
 *
 * This column tracks whether a user has completed the onboarding wizard.
 * - Default value is FALSE - all existing users will need to complete onboarding
 * - Set to TRUE when user completes the final step of the onboarding wizard
 */
export class AddOnboardingCompleted1766821477094 implements MigrationInterface {
    name = 'AddOnboardingCompleted1766821477094'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add onboarding_completed column with default false
        // Using IF NOT EXISTS for idempotency (safe to run multiple times)
        await queryRunner.query(`
            ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "onboarding_completed" BOOLEAN NOT NULL DEFAULT false
        `)

        // Add index for efficient filtering (useful for analytics queries)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_profiles_onboarding_completed" 
            ON "profiles" ("onboarding_completed")
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_profiles_onboarding_completed"`)
        await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "onboarding_completed"`)
    }
}
