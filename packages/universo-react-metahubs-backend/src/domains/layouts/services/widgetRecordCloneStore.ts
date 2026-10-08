import { qSchemaTable } from '@universo-react/database'
import type { SqlQueryable } from '@universo-react/utils/database'
import { queryMany } from '@universo-react/utils/database'

export interface WidgetRecordCloneCandidate {
    readonly id: string
}

/**
 * Find candidates without taking row locks. The caller must first lock the
 * Object, then use MetahubRecordsService.lockForCopy to take sort/record locks,
 * and finally recheck uniqueness through the locked binding store.
 */
export const findWidgetRecordCloneCandidatesBySemanticKey = (
    executor: SqlQueryable,
    schemaName: string,
    objectId: string,
    componentCodename: string,
    semanticKey: string
): Promise<WidgetRecordCloneCandidate[]> =>
    queryMany<WidgetRecordCloneCandidate>(
        executor,
        `SELECT id
           FROM ${qSchemaTable(schemaName, '_mhb_elements')}
          WHERE object_id = $1
            AND _upl_deleted = false
            AND _mhb_deleted = false
            AND data ->> $2::text = $3
          ORDER BY id ASC
          LIMIT 2`,
        [objectId, componentCodename, semanticKey]
    )
