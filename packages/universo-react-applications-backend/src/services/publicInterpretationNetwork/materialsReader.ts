import { publicInterpretationNetworkReadResponseSchema } from '@universo-react/types'
import {
    findPublicInterpretationNetworkRuntimeRecord,
    listPublicInterpretationNetworkMatrixRows,
    listPublicInterpretationNetworkRuntimeRows
} from '../../persistence/publicInterpretationNetworkRuntimeStore'
import { assertColumn, getChildField, getField } from '../interpretationNetwork/runtimeInterpretationNetworkMetadata'
import {
    MAX_PUBLIC_BODY_BYTES,
    PAGE_SIZE,
    page,
    PublicInterpretationNetworkUnavailableError,
    type PublicInterpretationNetworkReadInput
} from './contracts'
import { readHandle } from './handles'
import { localizeFallback, projectBodyText, safeDisplayText } from './projection'

/** Validate the Cell handle and read only its public, non-template Materials. */
export const readMaterials = async (input: PublicInterpretationNetworkReadInput) => {
    const limit = PAGE_SIZE.materials
    const claims = readHandle(input.parentHandle, input, 'cell')
    if (!claims.cellId || claims.cellId.startsWith('row:') || claims.cellId.startsWith('column:')) {
        throw new PublicInterpretationNetworkUnavailableError()
    }
    const interpretationContract = input.surface.contracts.Interpretation
    const activeInterpretation = await findPublicInterpretationNetworkRuntimeRecord(
        input.executor,
        input.surface,
        interpretationContract,
        claims.recordId,
        []
    )
    if (!activeInterpretation) throw new PublicInterpretationNetworkUnavailableError()
    const cellId = assertColumn(getChildField(interpretationContract, 'CellId'), 'InterpretationMatrix.CellId')
    const materialRef = getChildField(interpretationContract, 'MaterialRef')?.column_name
    const materialColumns = [{ field: cellId, alias: 'cellId' }, ...(materialRef ? [{ field: materialRef, alias: 'materialRef' }] : [])]
    const matchingCells = await listPublicInterpretationNetworkMatrixRows({
        executor: input.executor,
        surface: input.surface,
        columns: materialColumns,
        parentId: String(claims.recordId),
        limit: 1,
        offset: 0,
        cellIdentity: claims.cellId,
        cellIdentityColumn: cellId
    })
    if (matchingCells.length === 0) throw new PublicInterpretationNetworkUnavailableError()
    const primaryMaterialId = String(matchingCells[0].materialRef ?? '')
    const materialContract = input.surface.contracts.Material
    const materialCellId = assertColumn(getField(materialContract, 'CellId'), 'Material.CellId')
    const materialInterpretationId = assertColumn(getField(materialContract, 'InterpretationId'), 'Material.InterpretationId')
    const templateOwnerId = assertColumn(getField(materialContract, 'TemplateOwnerId'), 'Material.TemplateOwnerId')
    const title = assertColumn(getField(materialContract, 'Title'), 'Material.Title')
    const description = getField(materialContract, 'Description')?.column_name
    const body = getField(materialContract, 'Body')?.column_name
    const rows = await listPublicInterpretationNetworkRuntimeRows({
        executor: input.executor,
        surface: input.surface,
        contract: materialContract,
        columns: [
            { field: title, alias: 'title' },
            ...(description ? [{ field: description, alias: 'description' }] : []),
            ...(body ? [{ field: body, alias: 'body', maxBytes: MAX_PUBLIC_BODY_BYTES, oversizedAlias: 'bodyOversized' }] : [])
        ],
        filters: [
            { field: materialInterpretationId, operator: 'equals', value: claims.recordId },
            { field: materialCellId, operator: 'equals', value: claims.cellId },
            { field: templateOwnerId, operator: 'is-null' }
        ],
        limit,
        offset: input.offset,
        priorityId: primaryMaterialId || undefined
    })
    const visibleRows = rows.slice(0, limit)
    if (visibleRows.some((row) => row.bodyOversized === true)) throw new PublicInterpretationNetworkUnavailableError()
    return publicInterpretationNetworkReadResponseSchema.parse({
        locale: input.locale,
        view: 'materials',
        cellHandle: input.parentHandle,
        items: visibleRows.map((row) => ({
            title: safeDisplayText(
                row.title,
                input.locale,
                255,
                localizeFallback(input.locale, 'Untitled material', 'Материал без названия')
            ),
            description: description ? safeDisplayText(row.description, input.locale, 2000) || null : null,
            bodyText: projectBodyText(row.body, input.locale),
            isPrimary: String(row.id) === primaryMaterialId
        })),
        page: page(input.offset, limit, rows.length)
    })
}
