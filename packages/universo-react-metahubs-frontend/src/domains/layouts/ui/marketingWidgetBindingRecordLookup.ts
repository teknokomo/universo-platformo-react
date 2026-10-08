import * as recordsApi from '../../entities/metadata/record/api'
import type { RecordItem } from '../../../types'

/** Resolve a semantic record with an exact server-side component/value filter. */
export const findRecordBySemanticKey = async (
    metahubId: string,
    treeEntityId: string | null,
    objectId: string,
    componentCodename: string,
    semanticKey: string,
    kindKey: 'object' | 'page' = 'object'
): Promise<RecordItem> => {
    const params = {
        limit: 2,
        offset: 0,
        ...(kindKey === 'object' ? {} : { kindKey }),
        exactComponentCodename: componentCodename,
        exactValue: semanticKey,
        sortBy: 'updated',
        sortOrder: 'desc'
    } as const
    const response = treeEntityId
        ? await recordsApi.listRecords(metahubId, treeEntityId, objectId, params)
        : await recordsApi.listRecordsDirect(metahubId, objectId, params)
    if (response.pagination.total > 1 || response.items.length > 1) {
        throw new Error('MARKETING_WIDGET_SEMANTIC_RECORD_NOT_UNIQUE')
    }
    const match = response.items[0]
    if (!match || match.data?.[componentCodename] !== semanticKey) {
        throw new Error('MARKETING_WIDGET_SEMANTIC_RECORD_NOT_FOUND')
    }
    return match
}
