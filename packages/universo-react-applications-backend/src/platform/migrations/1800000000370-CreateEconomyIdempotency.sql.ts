import type { SqlMigrationDefinition } from './1800000000000-CreateApplicationsSchema.sql'

export const createEconomyIdempotencyMigrationDefinition: SqlMigrationDefinition = {
    id: 'CreateEconomyIdempotency1800000000370',
    version: '1800000000370',
    summary: 'Persist scope-bound runtime economy idempotency records for replay-safe trade actions',
    up: [
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.obj_economy_idempotency (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    application_id UUID NOT NULL,
                    user_id UUID NOT NULL,
                    workspace_id UUID,
                    key_hash VARCHAR(64) NOT NULL,
                    body_fingerprint TEXT NOT NULL,
                    response JSONB NOT NULL,
                    status_code INTEGER NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    expires_at TIMESTAMPTZ NOT NULL,
                    CONSTRAINT economy_idempotency_application_fk
                        FOREIGN KEY (application_id)
                        REFERENCES applications.obj_applications(id)
                        ON DELETE CASCADE,
                    CONSTRAINT economy_idempotency_scope_uk
                        UNIQUE (application_id, user_id, key_hash),
                    CONSTRAINT economy_idempotency_id_uuid_v7_ck
                        CHECK (
                            substring(id::text FROM 15 FOR 1) = '7'
                            AND lower(substring(id::text FROM 20 FOR 1)) IN ('8', '9', 'a', 'b')
                        ),
                    CONSTRAINT economy_idempotency_key_hash_ck
                        CHECK (key_hash ~ '^[a-f0-9]{64}$'),
                    CONSTRAINT economy_idempotency_status_code_ck
                        CHECK (status_code BETWEEN 200 AND 599)
                )
            `
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS economy_idempotency_expires_at_idx ON applications.obj_economy_idempotency (expires_at)`
        },
        {
            sql: `ALTER TABLE applications.obj_economy_idempotency ENABLE ROW LEVEL SECURITY`
        },
        {
            sql: `REVOKE ALL ON TABLE applications.obj_economy_idempotency FROM PUBLIC, anon, authenticated`
        },
        {
            sql: `GRANT ALL ON TABLE applications.obj_economy_idempotency TO service_role`
        }
    ],
    down: [
        {
            sql: `DROP TABLE IF EXISTS applications.obj_economy_idempotency`
        }
    ]
}
