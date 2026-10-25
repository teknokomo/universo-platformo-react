import { publicInterpretationNetworkReadResponseSchema } from '@universo-react/types'
import { listPublicInterpretationNetworkRuntimeRows } from '../../persistence/publicInterpretationNetworkRuntimeStore'
import { assertColumn, getField } from '../interpretationNetwork/runtimeInterpretationNetworkMetadata'
import { PAGE_SIZE, page, type PublicInterpretationNetworkReadInput } from './contracts'
import { publicStructure } from './projection'

/** Read the bounded Structure page, including the single-system filter when configured. */
export const readStructures = async (input: PublicInterpretationNetworkReadInput) => {
    const limit = PAGE_SIZE.structures
    const contract = input.surface.contracts.Structure
    const name = assertColumn(getField(contract, 'Name'), 'Structure.Name')
    const description = getField(contract, 'Description')?.column_name
    const filters: Array<{ field: string; operator: 'equals'; value: unknown }> = []
    if (input.surface.structureMode === 'singleSystem') {
        const systemKey = assertColumn(getField(contract, 'SystemKey'), 'Structure.SystemKey')
        filters.push({ field: systemKey, operator: 'equals', value: 'primary' })
    }
    const rows = await listPublicInterpretationNetworkRuntimeRows({
        executor: input.executor,
        surface: input.surface,
        contract,
        columns: [{ field: name, alias: 'name' }, ...(description ? [{ field: description, alias: 'description' }] : [])],
        filters,
        limit,
        offset: input.offset
    })
    return publicInterpretationNetworkReadResponseSchema.parse({
        locale: input.locale,
        view: 'structures',
        items: rows.slice(0, limit).map((row) => publicStructure(input, row)),
        page: page(input.offset, limit, rows.length)
    })
}
