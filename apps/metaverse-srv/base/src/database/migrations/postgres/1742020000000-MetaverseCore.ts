import { MigrationInterface, QueryRunner } from 'typeorm'

export class MetaverseCore1742020000000 implements MigrationInterface {
	name = 'MetaverseCore1742020000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// 1) Schema and tables
		await queryRunner.query(`
			CREATE SCHEMA IF NOT EXISTS "metaverse";
		`)

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "metaverse"."metaverses" (
				"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"name" text NOT NULL,
				"description" text,
				"visibility" text NOT NULL DEFAULT 'private',
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"created_by_user_id" uuid NOT NULL
			);
		`)

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "metaverse"."user_metaverses" (
				"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"user_id" uuid NOT NULL,
				"metaverse_id" uuid NOT NULL,
				"role" text NOT NULL DEFAULT 'owner',
				"is_default" boolean NOT NULL DEFAULT false,
				CONSTRAINT "UQ_user_metaverses_user_mv" UNIQUE ("user_id", "metaverse_id")
			);
		`)

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "metaverse"."metaverse_links" (
				"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"src_metaverse_id" uuid NOT NULL,
				"dst_metaverse_id" uuid NOT NULL,
				"relation_type" text NOT NULL CHECK (relation_type IN ('child','partner','location')),
				"created_at" timestamptz NOT NULL DEFAULT now()
			);
		`)

		// 2) Foreign keys (best effort)
		try {
			await queryRunner.query(`
				ALTER TABLE "metaverse"."user_metaverses"
					ADD CONSTRAINT "FK_user_metaverses_users" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
			`)
		} catch (e) {
			console.warn('[MetaverseCore] Unable to add FK user_metaverses.user_id -> auth.users(id). Continuing without it.', e)
		}
		try {
			await queryRunner.query(`
				ALTER TABLE "metaverse"."user_metaverses"
					ADD CONSTRAINT "FK_user_metaverses_metaverses" FOREIGN KEY ("metaverse_id") REFERENCES "metaverse"."metaverses"("id") ON DELETE CASCADE;
			`)
		} catch (e) {
			console.warn('[MetaverseCore] Unable to add FK user_metaverses.metaverse_id -> metaverse.metaverses(id). Continuing without it.', e)
		}
		try {
			await queryRunner.query(`
				ALTER TABLE "metaverse"."metaverse_links"
					ADD CONSTRAINT "FK_links_src" FOREIGN KEY ("src_metaverse_id") REFERENCES "metaverse"."metaverses"("id") ON DELETE CASCADE;
			`)
		} catch (e) {
			console.warn('[MetaverseCore] Unable to add FK links.src_metaverse_id. Continuing without it.', e)
		}
		try {
			await queryRunner.query(`
				ALTER TABLE "metaverse"."metaverse_links"
					ADD CONSTRAINT "FK_links_dst" FOREIGN KEY ("dst_metaverse_id") REFERENCES "metaverse"."metaverses"("id") ON DELETE CASCADE;
			`)
		} catch (e) {
			console.warn('[MetaverseCore] Unable to add FK links.dst_metaverse_id. Continuing without it.', e)
		}

		// 3) Indexes
		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS uq_user_default_metaverse ON "metaverse"."user_metaverses"("user_id") WHERE is_default = true;
		`)
		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS uq_links ON "metaverse"."metaverse_links"("src_metaverse_id", "dst_metaverse_id", "relation_type");
		`)
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS idx_um_user ON "metaverse"."user_metaverses"("user_id");
		`)
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS idx_links_src ON "metaverse"."metaverse_links"("src_metaverse_id");
		`)
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS idx_links_dst ON "metaverse"."metaverse_links"("dst_metaverse_id");
		`)

		// 4) Enable RLS
		await queryRunner.query(`ALTER TABLE "metaverse"."metaverses" ENABLE ROW LEVEL SECURITY;`)
		await queryRunner.query(`ALTER TABLE "metaverse"."user_metaverses" ENABLE ROW LEVEL SECURITY;`)
		await queryRunner.query(`ALTER TABLE "metaverse"."metaverse_links" ENABLE ROW LEVEL SECURITY;`)

		// 5) Policies
		await queryRunner.query(`
			CREATE POLICY metaverses_select ON "metaverse"."metaverses"
			FOR SELECT USING (
				auth.role() = 'authenticated' AND (
					EXISTS (
						SELECT 1 FROM "metaverse"."user_metaverses" um
						WHERE um.metaverse_id = "metaverses".id AND um.user_id = auth.uid()
					)
					OR "metaverses".visibility = 'public'
				)
			);
		`)
		await queryRunner.query(`
			CREATE POLICY metaverses_insert ON "metaverse"."metaverses"
			FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND created_by_user_id = auth.uid());
		`)
		await queryRunner.query(`
			CREATE POLICY metaverses_modify ON "metaverse"."metaverses"
			FOR UPDATE, DELETE USING (
				auth.role() = 'authenticated' AND EXISTS (
					SELECT 1 FROM "metaverse"."user_metaverses" um
					WHERE um.metaverse_id = "metaverses".id AND um.user_id = auth.uid() AND um.role = 'owner'
				)
			);
		`)

		await queryRunner.query(`
			CREATE POLICY user_metaverses_select ON "metaverse"."user_metaverses"
			FOR SELECT USING (
				auth.role() = 'authenticated' AND (user_id = auth.uid() OR EXISTS (
					SELECT 1 FROM "metaverse"."user_metaverses" um
					WHERE um.metaverse_id = "user_metaverses".metaverse_id AND um.user_id = auth.uid() AND um.role = 'owner'
				))
			);
		`)
		await queryRunner.query(`
			CREATE POLICY user_metaverses_insert ON "metaverse"."user_metaverses"
			FOR INSERT WITH CHECK (
				auth.role() = 'authenticated' AND EXISTS (
					SELECT 1 FROM "metaverse"."user_metaverses" um
					WHERE um.metaverse_id = "user_metaverses".metaverse_id AND um.user_id = auth.uid() AND um.role = 'owner'
				)
			);
		`)
		await queryRunner.query(`
			CREATE POLICY user_metaverses_update_owner ON "metaverse"."user_metaverses"
			FOR UPDATE USING (auth.role() = 'authenticated' AND EXISTS (
				SELECT 1 FROM "metaverse"."user_metaverses" um
				WHERE um.metaverse_id = "user_metaverses".metaverse_id AND um.user_id = auth.uid() AND um.role = 'owner'
			));
		`)
		await queryRunner.query(`
			CREATE POLICY user_metaverses_update_self_default ON "metaverse"."user_metaverses"
			FOR UPDATE USING (auth.role() = 'authenticated' AND user_id = auth.uid());
		`)

		await queryRunner.query(`
			CREATE POLICY links_select ON "metaverse"."metaverse_links"
			FOR SELECT USING (auth.role() = 'authenticated' AND EXISTS (
				SELECT 1 FROM "metaverse"."user_metaverses" um
				WHERE um.metaverse_id = "metaverse_links".src_metaverse_id AND um.user_id = auth.uid()
			));
		`)
		await queryRunner.query(`
			CREATE POLICY links_modify ON "metaverse"."metaverse_links"
			FOR INSERT, UPDATE, DELETE USING (auth.role() = 'authenticated' AND EXISTS (
				SELECT 1 FROM "metaverse"."user_metaverses" um
				WHERE um.metaverse_id = "metaverse_links".src_metaverse_id AND um.user_id = auth.uid() AND um.role = 'owner'
			));
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop policies
		await queryRunner.query(`DROP POLICY IF EXISTS links_modify ON "metaverse"."metaverse_links";`)
		await queryRunner.query(`DROP POLICY IF EXISTS links_select ON "metaverse"."metaverse_links";`)
		await queryRunner.query(`DROP POLICY IF EXISTS user_metaverses_update_self_default ON "metaverse"."user_metaverses";`)
		await queryRunner.query(`DROP POLICY IF EXISTS user_metaverses_update_owner ON "metaverse"."user_metaverses";`)
		await queryRunner.query(`DROP POLICY IF EXISTS user_metaverses_insert ON "metaverse"."user_metaverses";`)
		await queryRunner.query(`DROP POLICY IF EXISTS user_metaverses_select ON "metaverse"."user_metaverses";`)
		await queryRunner.query(`DROP POLICY IF EXISTS metaverses_modify ON "metaverse"."metaverses";`)
		await queryRunner.query(`DROP POLICY IF EXISTS metaverses_insert ON "metaverse"."metaverses";`)
		await queryRunner.query(`DROP POLICY IF EXISTS metaverses_select ON "metaverse"."metaverses";`)

		// Drop indexes
		await queryRunner.query(`DROP INDEX IF EXISTS uq_links;`)
		await queryRunner.query(`DROP INDEX IF EXISTS uq_user_default_metaverse;`)
		await queryRunner.query(`DROP INDEX IF EXISTS idx_links_dst;`)
		await queryRunner.query(`DROP INDEX IF EXISTS idx_links_src;`)
		await queryRunner.query(`DROP INDEX IF EXISTS idx_um_user;`)

		// Drop tables (children first)
		await queryRunner.query(`DROP TABLE IF EXISTS "metaverse"."metaverse_links";`)
		await queryRunner.query(`DROP TABLE IF EXISTS "metaverse"."user_metaverses";`)
		await queryRunner.query(`DROP TABLE IF EXISTS "metaverse"."metaverses";`)
	}
}
