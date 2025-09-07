import { MigrationInterface, QueryRunner } from 'typeorm'

export class SpacesCore1743000000000 implements MigrationInterface {
    name = 'SpacesCore1743000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1) Create spaces table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "public"."spaces" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" varchar NOT NULL,
                "description" text,
                "visibility" varchar NOT NULL DEFAULT 'private',
                "unik_id" uuid NOT NULL,
                "created_date" timestamptz NOT NULL DEFAULT now(),
                "updated_date" timestamptz NOT NULL DEFAULT now()
            );
        `)

        // 2) Create canvases table (with fields from ChatFlow)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "public"."canvases" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" varchar NOT NULL DEFAULT 'Canvas 1',
                "flowData" text NOT NULL,
                "deployed" boolean,
                "isPublic" boolean,
                "apikeyid" varchar,
                "chatbotConfig" text,
                "apiConfig" text,
                "analytic" text,
                "speechToText" text,
                "followUpPrompts" text,
                "category" text,
                "type" varchar,
                "created_date" timestamptz NOT NULL DEFAULT now(),
                "updated_date" timestamptz NOT NULL DEFAULT now()
            );
        `)

        // 3) Create spaces_canvases junction table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "public"."spaces_canvases" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "space_id" uuid NOT NULL,
                "canvas_id" uuid NOT NULL,
                "sort_order" integer NOT NULL DEFAULT 1,
                "created_date" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "uq_space_canvas" UNIQUE("space_id", "canvas_id"),
                CONSTRAINT "uq_space_sort" UNIQUE("space_id", "sort_order")
            );
        `)

        // 4) Add foreign keys (best effort)
        try {
            await queryRunner.query(`
                ALTER TABLE "public"."spaces"
                    ADD CONSTRAINT "FK_spaces_unik" FOREIGN KEY ("unik_id") REFERENCES "uniks"("id") ON DELETE CASCADE;
            `)
        } catch (e) {
            console.warn('[SpacesCore] Unable to add FK spaces.unik_id -> uniks(id). Continuing without it.', e)
        }

        try {
            await queryRunner.query(`
                ALTER TABLE "public"."spaces_canvases"
                    ADD CONSTRAINT "FK_spaces_canvases_space" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;
            `)
        } catch (e) {
            console.warn('[SpacesCore] Unable to add FK spaces_canvases.space_id -> spaces(id). Continuing without it.', e)
        }

        try {
            await queryRunner.query(`
                ALTER TABLE "public"."spaces_canvases"
                    ADD CONSTRAINT "FK_spaces_canvases_canvas" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE CASCADE;
            `)
        } catch (e) {
            console.warn('[SpacesCore] Unable to add FK spaces_canvases.canvas_id -> canvases(id). Continuing without it.', e)
        }

        // 5) Create indexes
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_spaces_unik" ON "public"."spaces"("unik_id");
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_canvases_updated" ON "public"."canvases"("updated_date");
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_canvases_apikey" ON "public"."canvases"("apikeyid");
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sc_space" ON "public"."spaces_canvases"("space_id");
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sc_space_sort" ON "public"."spaces_canvases"("space_id", "sort_order");
        `)

        // 6) Enable RLS (soft mode - authenticated users can read)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE "public"."spaces_canvases" ENABLE ROW LEVEL SECURITY;`)

        // 7) Create basic RLS policies (soft mode)
        // Drop existing policies to avoid conflicts on re-run
        await queryRunner.query(`DROP POLICY IF EXISTS spaces_select ON "public"."spaces";`)
        await queryRunner.query(`DROP POLICY IF EXISTS canvases_select ON "public"."canvases";`)
        await queryRunner.query(`DROP POLICY IF EXISTS sc_select ON "public"."spaces_canvases";`)

        await queryRunner.query(`
            CREATE POLICY spaces_select ON "public"."spaces"
            FOR SELECT TO authenticated
            USING ( true );
        `)

        await queryRunner.query(`
            CREATE POLICY canvases_select ON "public"."canvases"
            FOR SELECT TO authenticated
            USING ( true );
        `)

        await queryRunner.query(`
            CREATE POLICY sc_select ON "public"."spaces_canvases"
            FOR SELECT TO authenticated
            USING ( true );
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop policies
        await queryRunner.query(`DROP POLICY IF EXISTS sc_select ON "public"."spaces_canvases";`)
        await queryRunner.query(`DROP POLICY IF EXISTS canvases_select ON "public"."canvases";`)
        await queryRunner.query(`DROP POLICY IF EXISTS spaces_select ON "public"."spaces";`)

        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sc_space_sort";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sc_space";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_canvases_apikey";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_canvases_updated";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_spaces_unik";`)

        // Drop tables (children first)
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."spaces_canvases";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."canvases";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."spaces";`)
    }
}