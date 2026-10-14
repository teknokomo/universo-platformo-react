import type { SqlMigrationDefinition } from './1800000000000-CreateApplicationsSchema.sql'

export const createGuestSessionIdempotencyMigrationDefinition: SqlMigrationDefinition = {
    id: 'CreateGuestSessionIdempotency1800000000300',
    version: '1800000000300',
    summary: 'Persist encrypted, scope-bound guest-session idempotency records',
    up: [
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.obj_guest_session_idempotency (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    idempotency_key_hash VARCHAR(64) NOT NULL UNIQUE,
                    payload_hash VARCHAR(64) NOT NULL,
                    application_id UUID NOT NULL,
                    access_link_id UUID NOT NULL,
                    workspace_id UUID,
                    participant_id UUID NOT NULL,
                    expires_at TIMESTAMPTZ NOT NULL,
                    secret_nonce BYTEA NOT NULL,
                    secret_ciphertext BYTEA NOT NULL,
                    secret_auth_tag BYTEA NOT NULL,
                    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT guest_session_idempotency_application_fk
                        FOREIGN KEY (application_id)
                        REFERENCES applications.obj_applications(id)
                        ON DELETE CASCADE,
                    CONSTRAINT guest_session_idempotency_id_uuid_v7_ck
                        CHECK (
                            substring(id::text FROM 15 FOR 1) = '7'
                            AND lower(substring(id::text FROM 20 FOR 1)) IN ('8', '9', 'a', 'b')
                        ),
                    CONSTRAINT guest_session_idempotency_key_hash_ck
                        CHECK (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
                    CONSTRAINT guest_session_idempotency_payload_hash_ck
                        CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
                    CONSTRAINT guest_session_idempotency_secret_lengths_ck
                        CHECK (
                            octet_length(secret_nonce) = 12
                            AND octet_length(secret_ciphertext) > 0
                            AND octet_length(secret_auth_tag) = 16
                        )
                )
            `
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS guest_session_idempotency_expires_at_idx ON applications.obj_guest_session_idempotency (expires_at)`
        },
        {
            sql: `ALTER TABLE applications.obj_guest_session_idempotency ENABLE ROW LEVEL SECURITY`
        },
        {
            sql: `REVOKE ALL ON TABLE applications.obj_guest_session_idempotency FROM PUBLIC, anon, authenticated`
        },
        {
            sql: `GRANT ALL ON TABLE applications.obj_guest_session_idempotency TO service_role`
        }
    ],
    down: [
        {
            sql: `DROP TABLE IF EXISTS applications.obj_guest_session_idempotency`
        }
    ]
}
