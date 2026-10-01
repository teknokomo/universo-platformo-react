import * as recordsApi from '../../entities/metadata/record/api'
import type { RecordItem } from '../../../types'

/** Resolve a semantic record with an exact server-side component/value filter. */
export const findRecordBySemanticKey = async (
    metahubId: string,
    treeEntityId: string,
    objectId: string,
    componentCodename: string,
    semanticKey: string
): Promise<RecordItem> => {
    const response = await recordsApi.listRecords(metahubId, treeEntityId, objectId, {
        limit: 2,
        offset: 0,
        exactComponentCodename: componentCodename,
        exactValue: semanticKey,
        sortBy: 'updated',
        sortOrder: 'desc'
    })
    if (response.pagination.total > 1 || response.items.length > 1) {
        throw new Error('MARKETING_WIDGET_SEMANTIC_RECORD_NOT_UNIQUE')
    }
    const match = response.items[0]
    if (!match || match.data?.[componentCodename] !== semanticKey) {
        throw new Error('MARKETING_WIDGET_SEMANTIC_RECORD_NOT_FOUND')
    }
    return match
}
