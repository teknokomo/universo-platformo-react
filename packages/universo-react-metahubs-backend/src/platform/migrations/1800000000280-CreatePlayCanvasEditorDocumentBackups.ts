import type { PlatformMigrationFile } from '@universo-react/migrations-core'

export const createPlayCanvasEditorDocumentBackupsMigration: PlatformMigrationFile = {
    id: 'CreatePlayCanvasEditorDocumentBackups1800000000280',
    version: '1800000000280',
    scope: {
        kind: 'platform_schema',
        key: 'metahubs'
    },
    sourceKind: 'file',
    transactionMode: 'single',
    lockMode: 'transaction_advisory',
    summary: 'Create PlayCanvas Editor derived document backup sets for fail-closed editor session recovery',
    async up(ctx) {
        await ctx.knex.raw(`
            CREATE TABLE IF NOT EXISTS metahubs.playcanvas_editor_document_backups (
                id UUID PRIMARY KEY,
                metahub_id UUID NOT NULL,
                project_id UUID NOT NULL,
                opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                collection TEXT NOT NULL,
                document_id TEXT NOT NULL,
                data JSONB NOT NULL,
                version INTEGER NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
        await ctx.knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_playcanvas_editor_document_backups_opened_at
                ON metahubs.playcanvas_editor_document_backups (metahub_id, project_id, opened_at DESC)
        `)
    }
}
