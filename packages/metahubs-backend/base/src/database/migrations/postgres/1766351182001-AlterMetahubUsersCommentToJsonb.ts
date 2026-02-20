import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migrates the `comment` column in `metahubs.metahubs_users` from TEXT to JSONB.
 *
 * Background: The original CreateMetahubsSchema migration (1766351182000) created
 * the column as TEXT. The VLC (Versioned Localized Content) feature requires JSONB
 * storage for structured localized data. This migration performs the type change
 * safely using `USING comment::jsonb` for any existing plain-text values that
 * happen to be valid JSON, and nullifies the rest.
 */
export class AlterMetahubUsersCommentToJsonb1766351182001 implements MigrationInterface {
    name = 'AlterMetahubUsersCommentToJsonb1766351182001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Nullify any non-JSON text values first to prevent cast errors
        await queryRunner.query(`
            UPDATE metahubs.metahubs_users
            SET comment = NULL
            WHERE comment IS NOT NULL
              AND comment !~ '^\\s*\\{.*\\}\\s*$'
        `)

        // Alter column type from TEXT to JSONB
        await queryRunner.query(`
            ALTER TABLE metahubs.metahubs_users
            ALTER COLUMN comment TYPE JSONB USING comment::jsonb
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert column type from JSONB back to TEXT
        await queryRunner.query(`
            ALTER TABLE metahubs.metahubs_users
            ALTER COLUMN comment TYPE TEXT USING comment::text
        `)
    }
}
