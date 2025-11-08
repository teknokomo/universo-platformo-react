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
                "version_group_id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "version_uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
                "version_label" varchar NOT NULL DEFAULT 'v1',
                "version_description" text,
                "version_index" integer NOT NULL DEFAULT 1,
                "is_active" boolean NOT NULL DEFAULT false,
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
                "version_group_id" uuid NOT NULL,
                "sort_order" integer NOT NULL DEFAULT 1,
                "created_date" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "uq_space_canvas" UNIQUE("space_id", "canvas_id"),
                CONSTRAINT "uq_space_canvas_group" UNIQUE("space_id", "version_group_id"),
                CONSTRAINT "uq_space_sort" UNIQUE("space_id", "sort_order")
            );
        `)

        // Ensure versioning columns exist on canvases (idempotent migrations)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ADD COLUMN IF NOT EXISTS "version_group_id" uuid
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ADD COLUMN IF NOT EXISTS "version_uuid" uuid
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ADD COLUMN IF NOT EXISTS "version_label" varchar
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ADD COLUMN IF NOT EXISTS "version_description" text
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ADD COLUMN IF NOT EXISTS "version_index" integer
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ADD COLUMN IF NOT EXISTS "is_active" boolean
        `)

        // Ensure version group linkage exists on spaces_canvases
        await queryRunner.query(`
            ALTER TABLE "public"."spaces_canvases"
                ADD COLUMN IF NOT EXISTS "version_group_id" uuid
        `)

        // Backfill existing canvas rows with version metadata
        await queryRunner.query(`
            UPDATE "public"."canvases"
            SET
                version_group_id = COALESCE(version_group_id, id),
                version_uuid = COALESCE(version_uuid, gen_random_uuid()),
                version_label = COALESCE(NULLIF(version_label, ''), 'v1'),
                version_index = COALESCE(version_index, 1),
                is_active = COALESCE(is_active, true)
        `)

        // Backfill junction table to align with version groups
        await queryRunner.query(`
            UPDATE "public"."spaces_canvases" sc
            SET version_group_id = COALESCE(version_group_id, canvas_id)
        `)

        // Enforce non-null constraints and defaults for version metadata
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ALTER COLUMN "version_group_id" SET DEFAULT gen_random_uuid()
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ALTER COLUMN "version_group_id" SET NOT NULL
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ALTER COLUMN "version_uuid" SET DEFAULT gen_random_uuid()
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ALTER COLUMN "version_uuid" SET NOT NULL
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ALTER COLUMN "version_label" SET DEFAULT 'v1'
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ALTER COLUMN "version_label" SET NOT NULL
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ALTER COLUMN "version_index" SET DEFAULT 1
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ALTER COLUMN "version_index" SET NOT NULL
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ALTER COLUMN "is_active" SET DEFAULT true
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ALTER COLUMN "is_active" SET NOT NULL
        `)
        await queryRunner.query(`
            ALTER TABLE "public"."spaces_canvases"
                ALTER COLUMN "version_group_id" SET NOT NULL
        `)

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_space_canvas_group'
                ) THEN
                    ALTER TABLE "public"."spaces_canvases"
                        ADD CONSTRAINT "uq_space_canvas_group" UNIQUE ("space_id", "version_group_id");
                END IF;
            END $$;
        `)

        // 4) Add foreign keys (best effort)
        try {
            await queryRunner.query(`
                ALTER TABLE "public"."spaces"
                    ADD CONSTRAINT "FK_spaces_unik" FOREIGN KEY ("unik_id") REFERENCES uniks.uniks(id) ON DELETE CASCADE;
            `)
        } catch (e) {
            console.warn('[SpacesCore] Unable to add FK spaces.unik_id -> uniks.uniks(id). Continuing without it.', e)
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
            CREATE INDEX IF NOT EXISTS "idx_canvases_version_group" ON "public"."canvases"("version_group_id");
        `)
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_canvases_version_uuid" ON "public"."canvases"("version_uuid");
        `)
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_canvases_active_version" ON "public"."canvases"("version_group_id") WHERE is_active;
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sc_space" ON "public"."spaces_canvases"("space_id");
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sc_space_sort" ON "public"."spaces_canvases"("space_id", "sort_order");
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sc_version_group" ON "public"."spaces_canvases"("version_group_id");
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
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sc_version_group";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sc_space_sort";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sc_space";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_canvases_active_version";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_canvases_version_uuid";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_canvases_version_group";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_canvases_apikey";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_canvases_updated";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_spaces_unik";`)

        // Drop tables (children first)
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."spaces_canvases";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."canvases";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."spaces";`)
    }
}
