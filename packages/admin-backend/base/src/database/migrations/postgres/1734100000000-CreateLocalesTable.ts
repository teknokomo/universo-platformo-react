import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Create locales table for dynamic language management
 *
 * Flags:
 * - is_enabled_content: Locale available for localized content fields (dynamic)
 * - is_enabled_ui: Locale available for UI i18n (informational, requires JSON files)
 * - is_default_content: Default locale for localized content (only one allowed)
 * - is_default_ui: Default locale for UI (only one allowed)
 * - is_system: System locales cannot be deleted (en, ru)
 *
 * Constraints:
 * - Partial unique index ensures only one default content locale
 * - Partial unique index ensures only one default UI locale
 */
export class CreateLocalesTable1734100000000 implements MigrationInterface {
    name = 'CreateLocalesTable1734100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create locales table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS admin.locales (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                code VARCHAR(10) NOT NULL UNIQUE,
                name JSONB NOT NULL DEFAULT '{}',
                native_name VARCHAR(100),
                is_enabled_content BOOLEAN NOT NULL DEFAULT true,
                is_enabled_ui BOOLEAN NOT NULL DEFAULT false,
                is_default_content BOOLEAN NOT NULL DEFAULT false,
                is_default_ui BOOLEAN NOT NULL DEFAULT false,
                is_system BOOLEAN NOT NULL DEFAULT false,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)

        // Partial unique index: only one default content locale
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_locales_default_content 
            ON admin.locales (is_default_content) WHERE is_default_content = true
        `)

        // Partial unique index: only one default UI locale
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_locales_default_ui 
            ON admin.locales (is_default_ui) WHERE is_default_ui = true
        `)

        // Index for enabled content locales (frequent query)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_locales_enabled_content 
            ON admin.locales (is_enabled_content) WHERE is_enabled_content = true
        `)

        // Seed system locales (en, ru)
        await queryRunner.query(`
            INSERT INTO admin.locales (code, name, native_name, is_enabled_content, is_enabled_ui, is_default_content, is_default_ui, is_system, sort_order)
            VALUES
                (
                    'en',
                    '{
                        "_schema": "1",
                        "_primary": "en",
                        "locales": {
                            "en": {"content": "English", "version": 1, "isActive": true, "createdAt": "2024-12-13T00:00:00.000Z", "updatedAt": "2024-12-13T00:00:00.000Z"},
                            "ru": {"content": "Английский", "version": 1, "isActive": true, "createdAt": "2024-12-13T00:00:00.000Z", "updatedAt": "2024-12-13T00:00:00.000Z"}
                        }
                    }'::jsonb,
                    'English',
                    true,
                    true,
                    true,
                    true,
                    true,
                    1
                ),
                (
                    'ru',
                    '{
                        "_schema": "1",
                        "_primary": "en",
                        "locales": {
                            "en": {"content": "Russian", "version": 1, "isActive": true, "createdAt": "2024-12-13T00:00:00.000Z", "updatedAt": "2024-12-13T00:00:00.000Z"},
                            "ru": {"content": "Русский", "version": 1, "isActive": true, "createdAt": "2024-12-13T00:00:00.000Z", "updatedAt": "2024-12-13T00:00:00.000Z"}
                        }
                    }'::jsonb,
                    'Русский',
                    true,
                    true,
                    false,
                    false,
                    true,
                    2
                )
            ON CONFLICT (code) DO NOTHING
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS admin.idx_locales_enabled_content`)
        await queryRunner.query(`DROP INDEX IF EXISTS admin.idx_locales_default_ui`)
        await queryRunner.query(`DROP INDEX IF EXISTS admin.idx_locales_default_content`)
        await queryRunner.query(`DROP TABLE IF EXISTS admin.locales`)
    }
}
