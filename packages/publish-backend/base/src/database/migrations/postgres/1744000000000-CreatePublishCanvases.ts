import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreatePublishCanvases1744000000000 implements MigrationInterface {
    name = 'CreatePublishCanvases1744000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
        await queryRunner.query('CREATE SCHEMA IF NOT EXISTS uniks;')

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS uniks.publish_canvases (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                unik_id UUID NOT NULL,
                space_id UUID NULL,
                technology VARCHAR(64) NOT NULL,
                target_type VARCHAR(16) NOT NULL,
                version_group_id UUID NULL,
                target_canvas_id UUID NULL,
                target_version_uuid UUID NULL,
                base_slug VARCHAR(32) NOT NULL,
                custom_slug VARCHAR(64) NULL,
                is_public BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE(base_slug),
                UNIQUE(custom_slug)
            )
        `)

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS publish_canvases_space_idx
                ON uniks.publish_canvases(space_id)
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS publish_canvases_version_group_idx
                ON uniks.publish_canvases(version_group_id)
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS publish_canvases_target_canvas_idx
                ON uniks.publish_canvases(target_canvas_id)
        `)

        // Unique index: only ONE group link per (version_group_id, technology)
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS publish_canvases_group_unique
                ON uniks.publish_canvases(version_group_id, technology)
                WHERE target_type = 'group'
        `)

        // CHECK constraint: version links must have target_version_uuid
        await queryRunner.query(`
            ALTER TABLE uniks.publish_canvases
                ADD CONSTRAINT check_version_has_uuid
                CHECK (
                    (target_type = 'version' AND target_version_uuid IS NOT NULL) OR
                    (target_type = 'group')
                )
        `)

        await queryRunner.query(`
            ALTER TABLE uniks.publish_canvases
                ADD CONSTRAINT publish_canvases_unik_fk
                    FOREIGN KEY (unik_id)
                    REFERENCES uniks.uniks(id)
                    ON DELETE CASCADE
        `)

        await queryRunner.query(`
            ALTER TABLE uniks.publish_canvases
                ADD CONSTRAINT publish_canvases_space_fk
                    FOREIGN KEY (space_id)
                    REFERENCES spaces(id)
                    ON DELETE CASCADE
        `)

        await queryRunner.query(`
            ALTER TABLE uniks.publish_canvases
                ADD CONSTRAINT publish_canvases_canvas_fk
                    FOREIGN KEY (target_canvas_id)
                    REFERENCES canvases(id)
                    ON DELETE CASCADE
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE IF EXISTS uniks.publish_canvases
                DROP CONSTRAINT IF EXISTS check_version_has_uuid
        `)
        await queryRunner.query(`
            DROP INDEX IF EXISTS uniks.publish_canvases_group_unique
        `)
        await queryRunner.query(`
            ALTER TABLE IF EXISTS uniks.publish_canvases
                DROP CONSTRAINT IF EXISTS publish_canvases_canvas_fk
        `)
        await queryRunner.query(`
            ALTER TABLE IF EXISTS uniks.publish_canvases
                DROP CONSTRAINT IF EXISTS publish_canvases_space_fk
        `)
        await queryRunner.query(`
            ALTER TABLE IF EXISTS uniks.publish_canvases
                DROP CONSTRAINT IF EXISTS publish_canvases_unik_fk
        `)

        await queryRunner.query('DROP TABLE IF EXISTS uniks.publish_canvases')
    }
}
