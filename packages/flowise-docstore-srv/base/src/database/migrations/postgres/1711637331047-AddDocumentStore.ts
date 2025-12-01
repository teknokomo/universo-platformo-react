/**
 * Consolidated migration for document_store, document_store_file_chunk, and upsert_history tables.
 * Creates tables with all columns if they don't exist, or adds missing columns to existing tables.
 *
 * This migration consolidates:
 * - 1709814301358-AddUpsertHistoryEntity (upsert_history table)
 * - 1711637331047-AddDocumentStore (document_store, document_store_file_chunk tables)
 * - 1715861032479-AddVectorStoreConfigToDocStore (vectorStoreConfig, embeddingConfig, recordManagerConfig)
 *
 * NOTE: unik_id foreign key is NOT created here - it's handled by uniks-srv migration.
 */
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDocumentStore1711637331047 implements MigrationInterface {
    name = 'AddDocumentStore1711637331047'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create document_store table with ALL columns
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS document_store (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" varchar NOT NULL,
                "description" varchar,
                "loaders" text,
                "whereUsed" text,
                "status" varchar NOT NULL,
                "vectorStoreConfig" text,
                "embeddingConfig" text,
                "recordManagerConfig" text,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_document_store" PRIMARY KEY (id)
            );
        `)

        // 2. Create document_store_file_chunk table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS document_store_file_chunk (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "docId" uuid NOT NULL,
                "chunkNo" integer NOT NULL,
                "storeId" uuid NOT NULL,
                "pageContent" text,
                "metadata" text,
                CONSTRAINT "PK_document_store_file_chunk" PRIMARY KEY (id)
            );
        `)

        // 3. Create indices for document_store_file_chunk
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_document_store_file_chunk_docId" 
            ON document_store_file_chunk USING btree ("docId");
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_document_store_file_chunk_storeId" 
            ON document_store_file_chunk USING btree ("storeId");
        `)

        // 4. Create upsert_history table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS upsert_history (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "canvas_id" uuid NOT NULL,
                "result" text NOT NULL,
                "flowData" text NOT NULL,
                "date" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_upsert_history" PRIMARY KEY (id)
            );
        `)

        // 5. Create index for upsert_history
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_upsert_history_canvas_id" 
            ON upsert_history USING btree ("canvas_id");
        `)

        // 6. Add VectorStore columns if they don't exist (for existing DBs migrating from old schema)
        const columnsToAdd = [
            { name: 'vectorStoreConfig', type: 'text' },
            { name: 'embeddingConfig', type: 'text' },
            { name: 'recordManagerConfig', type: 'text' }
        ]

        for (const col of columnsToAdd) {
            await queryRunner.query(`
                DO $$ BEGIN
                    ALTER TABLE document_store ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type};
                EXCEPTION WHEN duplicate_column THEN NULL;
                END $$;
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_upsert_history_canvas_id"`)
        await queryRunner.query(`DROP TABLE IF EXISTS upsert_history`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_document_store_file_chunk_storeId"`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_document_store_file_chunk_docId"`)
        await queryRunner.query(`DROP TABLE IF EXISTS document_store_file_chunk`)
        await queryRunner.query(`DROP TABLE IF EXISTS document_store`)
    }
}
