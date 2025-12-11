import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Infrastructure Migration: UUID v7 Function
 *
 * Creates the public.uuid_generate_v7() function for time-ordered UUID generation.
 * This function must run FIRST before any other migrations that use UUID v7 defaults.
 *
 * Background:
 * - UUID v7 is specified in RFC 9562 (May 2024)
 * - PostgreSQL 18+ has native uuidv7() support
 * - This custom function provides UUID v7 for PostgreSQL 17.x (Supabase)
 * - Provides 30-50% better index performance vs UUID v4 (random)
 *
 * Implementation follows RFC 9562:
 * - First 48 bits: Unix timestamp in milliseconds (time-ordered)
 * - Version bits: 0111 (7)
 * - Variant bits: 10 (RFC 4122)
 * - Remaining bits: cryptographically random
 *
 * References:
 * - RFC 9562: https://www.rfc-editor.org/rfc/rfc9562.html
 * - PostgreSQL UUID Type: https://www.postgresql.org/docs/current/datatype-uuid.html
 * - Best practices: https://medium.com/@peter.heller/postgresql-17-enhanced-code-with-uuid7...
 */
export class InitializeUuidV7Function1500000000000 implements MigrationInterface {
    name = 'InitializeUuidV7Function1500000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create UUID v7 generation function in public schema
        // This function is available to all schemas and tables in the database
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.uuid_generate_v7() RETURNS uuid AS $$
            DECLARE
                unix_ts_ms BIGINT;
                uuid_bytes BYTEA;
            BEGIN
                -- Get current timestamp in milliseconds (48 bits)
                unix_ts_ms = FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;

                -- Generate 16 random bytes as base
                uuid_bytes = gen_random_bytes(16);

                -- Set timestamp in first 48 bits (6 bytes)
                -- INT8SEND converts BIGINT to 8-byte big-endian representation
                -- We extract bytes 2-7 (skip first 2 bytes as timestamp fits in 48 bits)
                uuid_bytes = SET_BYTE(uuid_bytes, 0, GET_BYTE(INT8SEND(unix_ts_ms), 2));
                uuid_bytes = SET_BYTE(uuid_bytes, 1, GET_BYTE(INT8SEND(unix_ts_ms), 3));
                uuid_bytes = SET_BYTE(uuid_bytes, 2, GET_BYTE(INT8SEND(unix_ts_ms), 4));
                uuid_bytes = SET_BYTE(uuid_bytes, 3, GET_BYTE(INT8SEND(unix_ts_ms), 5));
                uuid_bytes = SET_BYTE(uuid_bytes, 4, GET_BYTE(INT8SEND(unix_ts_ms), 6));
                uuid_bytes = SET_BYTE(uuid_bytes, 5, GET_BYTE(INT8SEND(unix_ts_ms), 7));

                -- Set version to 7 (bits 48-51, byte 6 high nibble)
                -- Clear high nibble and set to 0111 (7)
                uuid_bytes = SET_BYTE(uuid_bytes, 6, (GET_BYTE(uuid_bytes, 6) & B'00001111'::INT) | B'01110000'::INT);

                -- Set variant to 10 (bits 64-65, byte 8 high 2 bits) per RFC 4122
                -- Clear high 2 bits and set to 10
                uuid_bytes = SET_BYTE(uuid_bytes, 8, (GET_BYTE(uuid_bytes, 8) & B'00111111'::INT) | B'10000000'::INT);

                -- Convert bytes to UUID format
                RETURN ENCODE(uuid_bytes, 'hex')::UUID;
            END;
            $$ LANGUAGE plpgsql VOLATILE;
        `)

        // Add comment for documentation
        await queryRunner.query(`
            COMMENT ON FUNCTION public.uuid_generate_v7() IS 
            'Generates RFC 9562 compliant UUID v7 (time-ordered). First 48 bits contain Unix timestamp in milliseconds for better index locality. Compatible with PostgreSQL 18+ native uuidv7() function. Performance: ~30-50% faster indexing vs UUID v4 due to sequential nature.';
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the UUID v7 function
        // WARNING: This will break all tables that use DEFAULT public.uuid_generate_v7()
        await queryRunner.query(`DROP FUNCTION IF EXISTS public.uuid_generate_v7()`)
    }
}
