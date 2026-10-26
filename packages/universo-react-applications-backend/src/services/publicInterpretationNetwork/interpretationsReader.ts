import { publicInterpretationNetworkReadResponseSchema } from '@universo-react/types'
import {
    findPublicInterpretationNetworkRuntimeRecord,
    listPublicInterpretationNetworkRuntimeRows
} from '../../persistence/publicInterpretationNetworkRuntimeStore'
import { assertColumn, getField } from '../interpretationNetwork/runtimeInterpretationNetworkMetadata'
import { PAGE_SIZE, page, PublicInterpretationNetworkUnavailableError, type PublicInterpretationNetworkReadInput } from './contracts'
import { issueHandle, readHandle } from './handles'
import { localizeFallback, publicStructure, safeDisplayText } from './projection'

/** Validate the Structure handle and read its bounded Interpretation page. */
export const readInterpretations = async (input: PublicInterpretationNetworkReadInput) => {
    const limit = PAGE_SIZE.interpretations
    const parentHandle = input.parentHandle
    if (!parentHandle) throw new PublicInterpretationNetworkUnavailableError()
    const claims = readHandle(parentHandle, input, 'structure')
    const structureContract = input.surface.contracts.Structure
    const name = assertColumn(getField(structureContract, 'Name'), 'Structure.Name')
    const description = getField(structureContract, 'Description')?.column_name
    const structureRow = await findPublicInterpretationNetworkRuntimeRecord(
        input.executor,
        input.surface,
        structureContract,
        claims.recordId,
        [{ field: name, alias: 'name' }, ...(description ? [{ field: description, alias: 'description' }] : [])]
    )
    if (!structureRow) throw new PublicInterpretationNetworkUnavailableError()
    const parent = assertColumn(getField(input.surface.contracts.Interpretation, 'ParentStructure'), 'Interpretation.ParentStructure')
    const title = assertColumn(getField(input.surface.contracts.Interpretation, 'Title'), 'Interpretation.Title')
    const rows = await listPublicInterpretationNetworkRuntimeRows({
        executor: input.executor,
        surface: input.surface,
        contract: input.surface.contracts.Interpretation,
        columns: [{ field: title, alias: 'title' }],
        filters: [{ field: parent, operator: 'equals', value: claims.recordId }],
        limit,
        offset: input.offset
    })
    return publicInterpretationNetworkReadResponseSchema.parse({
        locale: input.locale,
        view: 'interpretations',
        structure: { ...publicStructure(input, structureRow), handle: parentHandle },
        items: rows.slice(0, limit).map((row) => ({
            handle: issueHandle(input, { kind: 'interpretation', recordId: String(row.id) }),
            title: safeDisplayText(
                row.title,
                input.locale,
                255,
                localizeFallback(input.locale, 'Untitled interpretation', 'Трактовка без названия')
            )
        })),
        page: page(input.offset, limit, rows.length)
    })
}
