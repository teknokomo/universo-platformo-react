import type { Request, Response } from 'express'
import { qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'
import { createQueryHelper, resolveRuntimeSchema } from '../shared/runtimeHelpers'
import { computePlayCanvasRuntimeManifestChecksum, parseAndValidatePlayCanvasRuntimeManifest } from '../shared/playCanvasRuntimeManifest'

export { computePlayCanvasRuntimeManifestChecksum }

type PlayCanvasManifestRow = {
    source_project_id: string
    source_scene_id: string | null
    manifest_checksum: string
    runtime_manifest: unknown
}

const isTableExistsValue = (value: boolean | string | number | null | undefined): boolean =>
    value === true || value === 't' || value === 'true' || value === 1

export function createRuntimePlayCanvasController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

    const listManifests = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        const tableRows = await query<{ exists: boolean | string | number }>(
            req,
            `SELECT EXISTS (
                SELECT 1
                  FROM information_schema.tables
                 WHERE table_schema = $1
                   AND table_name = '_app_playcanvas_manifests'
            ) AS "exists"`,
            [ctx.schemaName]
        )
        if (!isTableExistsValue(tableRows[0]?.exists)) {
            res.json({ manifests: [] })
            return
        }

        const rows = await query<PlayCanvasManifestRow>(
            req,
            `SELECT source_project_id, source_scene_id, manifest_checksum, runtime_manifest
               FROM ${qSchemaTable(ctx.schemaName, '_app_playcanvas_manifests')}
              WHERE _upl_deleted = false
                AND _app_deleted = false
              ORDER BY source_project_id ASC, source_scene_id ASC NULLS FIRST`,
            []
        )

        const manifests = rows.map((row) => {
            const parsed = parseAndValidatePlayCanvasRuntimeManifest(row.runtime_manifest, {
                sourceProjectId: row.source_project_id,
                sourceSceneId: row.source_scene_id,
                manifestChecksum: row.manifest_checksum
            })
            return {
                ...parsed,
                sceneId: parsed.sceneId ?? null
            }
        })

        res.json({ manifests })
    }

    return {
        listManifests
    }
}
