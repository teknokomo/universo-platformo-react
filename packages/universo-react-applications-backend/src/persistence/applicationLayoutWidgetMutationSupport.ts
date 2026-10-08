import { qSchemaTable } from '@universo-react/database'
import type { ApplicationLayoutWidget, ApplicationTemplateKey } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { hashApplicationLayoutContentFromStore } from './applicationLayoutHashContext'
import {
    encodeLayoutConfigForStorage,
    getApplicationLayoutDetail,
    getApplicationLayoutRawConfig,
    layoutCompositionToNeutral,
    mapWidget,
    readLayoutConfigEnvelope,
    resolveExistingLayoutComposition,
    type WidgetRow
} from './applicationLayoutStoreSupport'

export const refreshLayoutLocalContentHash = async (
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    userId: string | null
): Promise<void> => {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const current = await getApplicationLayoutDetail(executor, schemaName, layoutId)
    if (!current) return
    const currentEnvelope = readLayoutConfigEnvelope(current.item.templateKey, getApplicationLayoutRawConfig(current))
    const composition = resolveExistingLayoutComposition(current.item)
    const config = encodeLayoutConfigForStorage(current.item.templateKey, current.item.config, {
        ...currentEnvelope.neutral,
        composition: layoutCompositionToNeutral(composition)
    })
    const layout = { ...current.item, config }
    const localHash = await hashApplicationLayoutContentFromStore(executor, schemaName, { layout, widgets: current.widgets })
    const syncState = current.item.sourceKind === 'metahub' && localHash !== current.item.sourceContentHash ? 'local_modified' : 'clean'
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE ${layoutsTable}
        SET config = $2::jsonb,
            local_content_hash = $3,
            sync_state = $4,
            _upl_updated_at = NOW(),
            _upl_updated_by = $5,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = $1
          AND _upl_deleted = false
          AND _app_deleted = false
          AND COALESCE(_upl_version, 1) = $6
        RETURNING id
        `,
        [layoutId, JSON.stringify(config), localHash, syncState, userId, current.item.version]
    )
    if (!rows[0]) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
}

export const mapWidgetWithCanonicalSourceState = (row: WidgetRow, templateKey: ApplicationTemplateKey): ApplicationLayoutWidget =>
    mapWidget(row, templateKey)
