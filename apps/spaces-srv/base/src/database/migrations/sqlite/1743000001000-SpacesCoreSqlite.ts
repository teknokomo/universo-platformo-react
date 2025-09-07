import { MigrationInterface, QueryRunner } from 'typeorm'

export class SpacesCoreSqlite1743000001000 implements MigrationInterface {
    name = 'SpacesCoreSqlite1743000001000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable FKs
        await queryRunner.query(`PRAGMA foreign_keys = ON;`)

        // spaces
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "spaces" (
                "id" varchar PRIMARY KEY NOT NULL,
                "name" varchar NOT NULL,
                "description" text,
                "visibility" varchar NOT NULL DEFAULT 'private',
                "unik_id" varchar NOT NULL,
                "created_date" datetime NOT NULL DEFAULT (datetime('now')),
                "updated_date" datetime NOT NULL DEFAULT (datetime('now'))
            );
        `)

        // canvases
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "canvases" (
                "id" varchar PRIMARY KEY NOT NULL,
                "name" varchar NOT NULL DEFAULT 'Canvas 1',
                "flowData" text NOT NULL,
                "deployed" integer,
                "isPublic" integer,
                "apikeyid" varchar,
                "chatbotConfig" text,
                "apiConfig" text,
                "analytic" text,
                "speechToText" text,
                "followUpPrompts" text,
                "category" text,
                "type" varchar,
                "created_date" datetime NOT NULL DEFAULT (datetime('now')),
                "updated_date" datetime NOT NULL DEFAULT (datetime('now'))
            );
        `)

        // spaces_canvases
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "spaces_canvases" (
                "id" varchar PRIMARY KEY NOT NULL,
                "space_id" varchar NOT NULL,
                "canvas_id" varchar NOT NULL,
                "sort_order" integer NOT NULL DEFAULT 1,
                "created_date" datetime NOT NULL DEFAULT (datetime('now')),
                CONSTRAINT "uq_space_canvas" UNIQUE("space_id", "canvas_id"),
                CONSTRAINT "uq_space_sort" UNIQUE("space_id", "sort_order"),
                FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE,
                FOREIGN KEY ("canvas_id") REFERENCES "canvases"("id") ON DELETE CASCADE
            );
        `)

        // indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_spaces_unik" ON "spaces"("unik_id");`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_canvases_updated" ON "canvases"("updated_date");`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_canvases_apikey" ON "canvases"("apikeyid");`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sc_space" ON "spaces_canvases"("space_id");`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sc_space_sort" ON "spaces_canvases"("space_id", "sort_order");`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sc_space_sort";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sc_space";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_canvases_apikey";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_canvases_updated";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_spaces_unik";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "spaces_canvases";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "canvases";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "spaces";`)
    }
}

