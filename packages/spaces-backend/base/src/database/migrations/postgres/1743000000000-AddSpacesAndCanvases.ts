import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Creates Spaces and Canvases tables with all required columns.
 * This is the consolidated migration for the visual builder domain.
 *
 * Tables created:
 * - spaces: Top-level containers that group related canvases (versioned)
 * - canvases: Individual flow editors (replaces the old chat_flow table, versioned)
 * - spaces_canvases: Junction table for space-canvas relationships
 *
 * System status fields (on both spaces and canvases):
 * - is_active: Active version in the version group (default: true)
 * - is_published: Published for public access (default: false)
 * - is_deleted: Soft delete marker (default: false)
 * - deleted_date: When the record was soft-deleted
 * - deleted_by: UUID of user who deleted the record
 */
export class AddSpacesAndCanvases1743000000000 implements MigrationInterface {
    name = 'AddSpacesAndCanvases1743000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('[AddSpacesAndCanvases] Starting migration...')

        // ═══════════════════════════════════════════════════════════════════════
        // 1) CREATE SPACES TABLE (with versioning and status fields)
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[AddSpacesAndCanvases] Creating spaces table...')
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "public"."spaces" (
                "id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                "name" varchar NOT NULL,
                "description" text,
                "visibility" varchar NOT NULL DEFAULT 'private',
                "unik_id" uuid NOT NULL,

                -- Versioning fields
                "version_group_id" uuid NOT NULL DEFAULT public.uuid_generate_v7(),
                "version_uuid" uuid NOT NULL DEFAULT public.uuid_generate_v7(),
                "version_label" varchar NOT NULL DEFAULT 'v1',
                "version_description" text,
                "version_index" integer NOT NULL DEFAULT 1,

                -- System status fields
                "is_active" boolean NOT NULL DEFAULT true,
                "is_published" boolean NOT NULL DEFAULT false,
                "is_deleted" boolean NOT NULL DEFAULT false,
                "deleted_date" timestamptz,
                "deleted_by" uuid,

                -- Timestamps
                "created_date" timestamptz NOT NULL DEFAULT now(),
                "updated_date" timestamptz NOT NULL DEFAULT now()
            );
        `)

        // ═══════════════════════════════════════════════════════════════════════
        // 2) CREATE CANVASES TABLE (with versioning and status fields)
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[AddSpacesAndCanvases] Creating canvases table...')
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "public"."canvases" (
                "id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                "name" varchar NOT NULL DEFAULT 'Canvas 1',
                "flowData" text NOT NULL,

                -- Canvas-specific fields (from ChatFlow)
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

                -- Versioning fields
                "version_group_id" uuid NOT NULL DEFAULT public.uuid_generate_v7(),
                "version_uuid" uuid NOT NULL DEFAULT public.uuid_generate_v7(),
                "version_label" varchar NOT NULL DEFAULT 'v1',
                "version_description" text,
                "version_index" integer NOT NULL DEFAULT 1,

                -- System status fields
                "is_active" boolean NOT NULL DEFAULT true,
                "is_published" boolean NOT NULL DEFAULT false,
                "is_deleted" boolean NOT NULL DEFAULT false,
                "deleted_date" timestamptz,
                "deleted_by" uuid,

                -- Timestamps
                "created_date" timestamptz NOT NULL DEFAULT now(),
                "updated_date" timestamptz NOT NULL DEFAULT now()
            );
        `)

        // ═══════════════════════════════════════════════════════════════════════
        // 3) CREATE SPACES_CANVASES JUNCTION TABLE
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[AddSpacesAndCanvases] Creating spaces_canvases junction table...')
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "public"."spaces_canvases" (
                "id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
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

        // ═══════════════════════════════════════════════════════════════════════
        // 4) IDEMPOTENT COLUMN ADDITIONS (for existing tables)
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[AddSpacesAndCanvases] Adding columns idempotently...')

        // Spaces versioning columns
        await queryRunner.query(`ALTER TABLE "public"."spaces" ADD COLUMN IF NOT EXISTS "version_group_id" uuid`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ADD COLUMN IF NOT EXISTS "version_uuid" uuid`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ADD COLUMN IF NOT EXISTS "version_label" varchar`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ADD COLUMN IF NOT EXISTS "version_description" text`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ADD COLUMN IF NOT EXISTS "version_index" integer`)

        // Spaces status columns
        await queryRunner.query(`ALTER TABLE "public"."spaces" ADD COLUMN IF NOT EXISTS "is_active" boolean`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ADD COLUMN IF NOT EXISTS "is_published" boolean`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ADD COLUMN IF NOT EXISTS "is_deleted" boolean`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ADD COLUMN IF NOT EXISTS "deleted_date" timestamptz`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ADD COLUMN IF NOT EXISTS "deleted_by" uuid`)

        // Canvases versioning columns
        await queryRunner.query(`ALTER TABLE "public"."canvases" ADD COLUMN IF NOT EXISTS "version_group_id" uuid`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ADD COLUMN IF NOT EXISTS "version_uuid" uuid`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ADD COLUMN IF NOT EXISTS "version_label" varchar`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ADD COLUMN IF NOT EXISTS "version_description" text`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ADD COLUMN IF NOT EXISTS "version_index" integer`)

        // Canvases status columns
        await queryRunner.query(`ALTER TABLE "public"."canvases" ADD COLUMN IF NOT EXISTS "is_active" boolean`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ADD COLUMN IF NOT EXISTS "is_published" boolean`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ADD COLUMN IF NOT EXISTS "is_deleted" boolean`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ADD COLUMN IF NOT EXISTS "deleted_date" timestamptz`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ADD COLUMN IF NOT EXISTS "deleted_by" uuid`)

        // Spaces_canvases version group linkage
        await queryRunner.query(`ALTER TABLE "public"."spaces_canvases" ADD COLUMN IF NOT EXISTS "version_group_id" uuid`)

        // ═══════════════════════════════════════════════════════════════════════
        // 5) BACKFILL EXISTING DATA
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[AddSpacesAndCanvases] Backfilling existing data...')

        // Backfill spaces
        await queryRunner.query(`
            UPDATE "public"."spaces"
            SET
                version_group_id = COALESCE(version_group_id, id),
                version_uuid = COALESCE(version_uuid, public.uuid_generate_v7()),
                version_label = COALESCE(NULLIF(version_label, ''), 'v1'),
                version_index = COALESCE(version_index, 1),
                is_active = COALESCE(is_active, true),
                is_published = COALESCE(is_published, false),
                is_deleted = COALESCE(is_deleted, false)
        `)

        // Backfill canvases
        await queryRunner.query(`
            UPDATE "public"."canvases"
            SET
                version_group_id = COALESCE(version_group_id, id),
                version_uuid = COALESCE(version_uuid, public.uuid_generate_v7()),
                version_label = COALESCE(NULLIF(version_label, ''), 'v1'),
                version_index = COALESCE(version_index, 1),
                is_active = COALESCE(is_active, true),
                is_published = COALESCE(is_published, false),
                is_deleted = COALESCE(is_deleted, false)
        `)

        // Backfill junction table version groups
        await queryRunner.query(`
            UPDATE "public"."spaces_canvases"
            SET version_group_id = COALESCE(version_group_id, canvas_id)
        `)

        // ═══════════════════════════════════════════════════════════════════════
        // 6) FIX ACTIVE VERSIONS (ensure one active per group)
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[AddSpacesAndCanvases] Fixing active versions...')

        // Fix spaces: set first version as active where no active version exists
        await queryRunner.query(`
            WITH groups_without_active AS (
                SELECT version_group_id
                FROM "public"."spaces"
                WHERE NOT COALESCE(is_deleted, false)
                GROUP BY version_group_id
                HAVING NOT bool_or(COALESCE(is_active, false))
            ),
            first_versions AS (
                SELECT DISTINCT ON (s.version_group_id) s.id
                FROM "public"."spaces" s
                INNER JOIN groups_without_active gwa ON s.version_group_id = gwa.version_group_id
                WHERE NOT COALESCE(s.is_deleted, false)
                ORDER BY s.version_group_id, s.version_index ASC, s.created_date ASC
            )
            UPDATE "public"."spaces"
            SET is_active = true
            FROM first_versions fv
            WHERE "public"."spaces".id = fv.id
        `)

        // Fix canvases: set first version as active where no active version exists
        await queryRunner.query(`
            WITH groups_without_active AS (
                SELECT version_group_id
                FROM "public"."canvases"
                WHERE NOT COALESCE(is_deleted, false)
                GROUP BY version_group_id
                HAVING NOT bool_or(COALESCE(is_active, false))
            ),
            first_versions AS (
                SELECT DISTINCT ON (c.version_group_id) c.id
                FROM "public"."canvases" c
                INNER JOIN groups_without_active gwa ON c.version_group_id = gwa.version_group_id
                WHERE NOT COALESCE(c.is_deleted, false)
                ORDER BY c.version_group_id, c.version_index ASC, c.created_date ASC
            )
            UPDATE "public"."canvases"
            SET is_active = true
            FROM first_versions fv
            WHERE "public"."canvases".id = fv.id
        `)

        // ═══════════════════════════════════════════════════════════════════════
        // 7) ENFORCE CONSTRAINTS AND DEFAULTS
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[AddSpacesAndCanvases] Enforcing constraints...')

        // Spaces constraints
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "version_group_id" SET DEFAULT public.uuid_generate_v7()`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "version_group_id" SET NOT NULL`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "version_uuid" SET DEFAULT public.uuid_generate_v7()`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "version_uuid" SET NOT NULL`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "version_label" SET DEFAULT 'v1'`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "version_label" SET NOT NULL`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "version_index" SET DEFAULT 1`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "version_index" SET NOT NULL`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "is_active" SET DEFAULT true`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "is_active" SET NOT NULL`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "is_published" SET DEFAULT false`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "is_published" SET NOT NULL`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "is_deleted" SET DEFAULT false`)
        await queryRunner.query(`ALTER TABLE "public"."spaces" ALTER COLUMN "is_deleted" SET NOT NULL`)

        // Canvases constraints
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "version_group_id" SET DEFAULT public.uuid_generate_v7()`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "version_group_id" SET NOT NULL`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "version_uuid" SET DEFAULT public.uuid_generate_v7()`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "version_uuid" SET NOT NULL`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "version_label" SET DEFAULT 'v1'`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "version_label" SET NOT NULL`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "version_index" SET DEFAULT 1`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "version_index" SET NOT NULL`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "is_active" SET DEFAULT true`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "is_active" SET NOT NULL`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "is_published" SET DEFAULT false`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "is_published" SET NOT NULL`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "is_deleted" SET DEFAULT false`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ALTER COLUMN "is_deleted" SET NOT NULL`)

        // Spaces_canvases constraints
        await queryRunner.query(`ALTER TABLE "public"."spaces_canvases" ALTER COLUMN "version_group_id" SET NOT NULL`)

        // Unique constraint for space-canvas group (idempotent)
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

        // ═══════════════════════════════════════════════════════════════════════
        // 8) FOREIGN KEYS (best effort)
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[AddSpacesAndCanvases] Adding foreign keys...')

        try {
            await queryRunner.query(`
                ALTER TABLE "public"."spaces"
                    ADD CONSTRAINT "FK_spaces_unik" FOREIGN KEY ("unik_id") REFERENCES uniks.uniks(id) ON DELETE CASCADE;
            `)
        } catch (e) {
            console.warn('[AddSpacesAndCanvases] FK spaces.unik_id -> uniks.uniks(id) already exists or failed.', e)
        }

        try {
            await queryRunner.query(`
                ALTER TABLE "public"."spaces_canvases"
                    ADD CONSTRAINT "FK_spaces_canvases_space" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;
            `)
        } catch (e) {
            console.warn('[AddSpacesAndCanvases] FK spaces_canvases.space_id already exists or failed.', e)
        }

        try {
            await queryRunner.query(`
                ALTER TABLE "public"."spaces_canvases"
                    ADD CONSTRAINT "FK_spaces_canvases_canvas" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE CASCADE;
            `)
        } catch (e) {
            console.warn('[AddSpacesAndCanvases] FK spaces_canvases.canvas_id already exists or failed.', e)
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 9) INDEXES
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[AddSpacesAndCanvases] Creating indexes...')

        // Spaces indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_spaces_unik" ON "public"."spaces"("unik_id")`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_spaces_version_group" ON "public"."spaces"("version_group_id")`)
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_spaces_version_uuid" ON "public"."spaces"("version_uuid")`)
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "uq_spaces_active_version" ON "public"."spaces"("version_group_id") WHERE is_active AND NOT is_deleted`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_spaces_published" ON "public"."spaces"("is_published") WHERE is_published AND NOT is_deleted`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_spaces_not_deleted" ON "public"."spaces"("is_deleted") WHERE NOT is_deleted`
        )

        // Canvases indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_canvases_updated" ON "public"."canvases"("updated_date")`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_canvases_apikey" ON "public"."canvases"("apikeyid")`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_canvases_version_group" ON "public"."canvases"("version_group_id")`)
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_canvases_version_uuid" ON "public"."canvases"("version_uuid")`)
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "uq_canvases_active_version" ON "public"."canvases"("version_group_id") WHERE is_active AND NOT is_deleted`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_canvases_published" ON "public"."canvases"("is_published") WHERE is_published AND NOT is_deleted`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_canvases_not_deleted" ON "public"."canvases"("is_deleted") WHERE NOT is_deleted`
        )

        // Junction table indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sc_space" ON "public"."spaces_canvases"("space_id")`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sc_space_sort" ON "public"."spaces_canvases"("space_id", "sort_order")`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sc_version_group" ON "public"."spaces_canvases"("version_group_id")`)

        // ═══════════════════════════════════════════════════════════════════════
        // 10) ROW LEVEL SECURITY
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[AddSpacesAndCanvases] Enabling RLS...')

        await queryRunner.query(`ALTER TABLE "public"."spaces" ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE "public"."canvases" ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE "public"."spaces_canvases" ENABLE ROW LEVEL SECURITY;`)

        // Drop existing policies to avoid conflicts on re-run
        await queryRunner.query(`DROP POLICY IF EXISTS spaces_select ON "public"."spaces";`)
        await queryRunner.query(`DROP POLICY IF EXISTS canvases_select ON "public"."canvases";`)
        await queryRunner.query(`DROP POLICY IF EXISTS sc_select ON "public"."spaces_canvases";`)

        // Create policies (soft mode - authenticated users can read non-deleted records)
        await queryRunner.query(`
            CREATE POLICY spaces_select ON "public"."spaces"
            FOR SELECT TO authenticated
            USING ( NOT is_deleted );
        `)

        await queryRunner.query(`
            CREATE POLICY canvases_select ON "public"."canvases"
            FOR SELECT TO authenticated
            USING ( NOT is_deleted );
        `)

        await queryRunner.query(`
            CREATE POLICY sc_select ON "public"."spaces_canvases"
            FOR SELECT TO authenticated
            USING ( true );
        `)

        console.log('[AddSpacesAndCanvases] Migration completed successfully!')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('[AddSpacesAndCanvases] Rolling back migration...')

        // Drop policies
        await queryRunner.query(`DROP POLICY IF EXISTS sc_select ON "public"."spaces_canvases";`)
        await queryRunner.query(`DROP POLICY IF EXISTS canvases_select ON "public"."canvases";`)
        await queryRunner.query(`DROP POLICY IF EXISTS spaces_select ON "public"."spaces";`)

        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sc_version_group";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sc_space_sort";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sc_space";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_canvases_not_deleted";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_canvases_published";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_canvases_active_version";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_canvases_version_uuid";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_canvases_version_group";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_canvases_apikey";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_canvases_updated";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_spaces_not_deleted";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_spaces_published";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_spaces_active_version";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_spaces_version_uuid";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_spaces_version_group";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_spaces_unik";`)

        // Drop tables (children first)
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."spaces_canvases";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."canvases";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."spaces";`)

        console.log('[AddSpacesAndCanvases] Rollback completed!')
    }
}
