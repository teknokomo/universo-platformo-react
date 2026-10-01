import type { DbExecutor } from '@universo-react/utils'

/** Check optional per-application layout tables before querying layout data. */
export async function applicationLayoutTablesExist(executor: DbExecutor, schemaName: string): Promise<boolean> {
    const rows = await executor.query<{ layouts: boolean; widgets: boolean }>(
        `
        SELECT
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = '_app_layouts') AS layouts,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = '_app_widgets') AS widgets
        `,
        [schemaName]
    )
    return rows[0]?.layouts === true && rows[0]?.widgets === true
}
