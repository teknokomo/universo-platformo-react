import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPublicationVersions1769200000000 implements MigrationInterface {
    name = 'AddPublicationVersions1769200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create publication_versions table
        await queryRunner.query(`
            CREATE TABLE "metahubs"."publication_versions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
                "publication_id" uuid NOT NULL,
                "version_number" integer NOT NULL,
                "name" jsonb NOT NULL DEFAULT '{}',
                "description" jsonb DEFAULT '{}',
                "snapshot_json" jsonb NOT NULL,
                "snapshot_hash" character varying(64) NOT NULL,
                "is_active" boolean NOT NULL DEFAULT false,
                "created_by" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "pk_publication_versions" PRIMARY KEY ("id"),
                CONSTRAINT "fk_publication_versions_publication" FOREIGN KEY ("publication_id") REFERENCES "metahubs"."publications"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_publication_versions_user" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL,
                CONSTRAINT "uq_publication_version" UNIQUE ("publication_id", "version_number")
            )
        `)

        // Partial unique index for active version (only one active per publication)
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_active_version" ON "metahubs"."publication_versions" ("publication_id", "is_active") 
            WHERE is_active = true
        `)

        // Indexes
        await queryRunner.query(`
            CREATE INDEX "idx_publication_versions_publication" ON "metahubs"."publication_versions" ("publication_id")
        `)

        // Add active_version_id to publications table (nullable initially)
        await queryRunner.query(`
            ALTER TABLE "metahubs"."publications" ADD "active_version_id" uuid
        `)

        // Enable RLS
        await queryRunner.query(`ALTER TABLE "metahubs"."publication_versions" ENABLE ROW LEVEL SECURITY`)

        // Create RLS Policy
        // Users can access versions if they have access to the metahub
        await queryRunner.query(`
            CREATE POLICY "publication_versions_policy" ON "metahubs"."publication_versions"
            USING (
                publication_id IN (
                    SELECT p.id FROM metahubs.publications p
                    JOIN metahubs.metahubs_users mu ON p.metahub_id = mu.metahub_id
                    WHERE mu.user_id = auth.uid()
                )
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP POLICY "publication_versions_policy" ON "metahubs"."publication_versions"`)
        await queryRunner.query(`ALTER TABLE "metahubs"."publications" DROP COLUMN "active_version_id"`)
        await queryRunner.query(`DROP TABLE "metahubs"."publication_versions"`)
    }
}
