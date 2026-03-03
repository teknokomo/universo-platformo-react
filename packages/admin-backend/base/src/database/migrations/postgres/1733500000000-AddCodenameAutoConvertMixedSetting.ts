import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Add metahubs.codenameAutoConvertMixedAlphabets setting.
 *
 * Default behavior:
 * - true: when mixed alphabets are disallowed, mixed value can be auto-converted on blur
 */
export class AddCodenameAutoConvertMixedSetting1733500000000 implements MigrationInterface {
    name = 'AddCodenameAutoConvertMixedSetting1733500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO admin.settings (category, key, value)
            VALUES ('metahubs', 'codenameAutoConvertMixedAlphabets', '{"_value": true}'::jsonb)
            ON CONFLICT (category, key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO admin.settings (category, key, value)
            VALUES ('metahubs', 'codenameAutoConvertMixedAlphabets', '{"_value": false}'::jsonb)
            ON CONFLICT (category, key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `)
    }
}
