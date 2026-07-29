import { createLocalizedContent, resolveLocalizedContent } from '@universo-react/utils'
import type { VersionedLocalizedContent } from '@universo-react/types'
import {
    SYSTEM_STRUCTURE_KEY,
    InterpretationNetworkCommandError,
    assertColumn,
    getField,
    interpretationNetworkCommandErrorCodes,
    selectActiveRows,
    type ObjectContract,
    type RuntimeSurfaceReady
} from './runtimeInterpretationNetworkCore'

export const getString = (row: Record<string, unknown>, columnName: string | undefined): string =>
    columnName ? String(row[columnName] ?? '').trim() : ''

export const buildMatrixTitle = (name: VersionedLocalizedContent<string>, locale: string): VersionedLocalizedContent<string> =>
    createLocalizedContent(locale, `${resolveLocalizedContent(name, locale, 'Structure')} matrix`)

export const assertNoOrdinaryStructuresInSingleSystemMode = async (
    executor: Parameters<typeof selectActiveRows>[0],
    params: {
        schemaName: string
        structureContract: RuntimeSurfaceReady['contracts']['Structure']
        systemKeyColumn: string
        workspaceId: string | null
        allowedSystemStructureId?: string
        forUpdate?: boolean
    }
): Promise<void> => {
    const activeStructures = await selectActiveRows(executor, {
        schemaName: params.schemaName,
        contract: params.structureContract,
        workspaceId: params.workspaceId,
        forUpdate: params.forUpdate
    })
    const ordinaryStructures = activeStructures.filter((row) => {
        const systemKey = getString(row, params.systemKeyColumn)
        const id = String(row.id ?? '')
        return systemKey !== SYSTEM_STRUCTURE_KEY && id !== params.allowedSystemStructureId
    })
    if (ordinaryStructures.length > 0) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.nonSystemStructuresExist,
            'Single-system mode cannot be initialized while ordinary Structures exist in this workspace',
            { count: ordinaryStructures.length }
        )
    }
}

export const collectMaterialRefs = (rows: Array<Record<string, unknown>>, materialRefColumn?: string): string[] =>
    materialRefColumn ? rows.map((row) => getString(row, materialRefColumn)).filter(Boolean) : []

export const collectCellIds = (rows: Array<Record<string, unknown>>, cellIdColumn?: string): string[] =>
    cellIdColumn ? rows.map((row) => getString(row, cellIdColumn)).filter(Boolean) : []

export const assertValidMaterialRefs = (materialRefs: string[]) => {
    const invalidRef = materialRefs.find((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    if (invalidRef) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.invalidMatrix,
            'Source matrix contains an invalid material reference'
        )
    }
}

export const assertUniqueMaterialsByCellId = (materials: Array<Record<string, unknown>>, cellIdColumn?: string) => {
    if (!cellIdColumn) return
    const counts = new Map<string, number>()
    for (const material of materials) {
        const cellId = getString(material, cellIdColumn)
        if (!cellId) continue
        counts.set(cellId, (counts.get(cellId) ?? 0) + 1)
    }
    const duplicateCellId = [...counts.entries()].find(([, count]) => count > 1)?.[0]
    if (duplicateCellId) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.invalidMatrix,
            'More than one material is attached to the same matrix cell',
            { cellId: duplicateCellId }
        )
    }
}

export const assertMaterialOwnership = (params: {
    materials: Array<Record<string, unknown>>
    materialIds: string[]
    cellIds: string[]
    materialCellIdColumn?: string
    templateOwnerColumn?: string
    templateOwnerId?: string
}) => {
    const expectedMaterialIds = new Set(params.materialIds)
    const expectedCellIds = new Set(params.cellIds)
    const actualMaterialIds = new Set<string>()

    for (const material of params.materials) {
        const materialId = getString(material, 'id')
        const cellId = getString(material, params.materialCellIdColumn)
        if (!materialId || !cellId || !expectedCellIds.has(cellId)) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMaterial,
                'Matrix references a material that is not owned by one of its cells'
            )
        }
        if (params.templateOwnerId && getString(material, params.templateOwnerColumn) !== params.templateOwnerId) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMaterial,
                'Template references a material with invalid provenance'
            )
        }
        actualMaterialIds.add(materialId)
    }

    const missingMaterialId = [...expectedMaterialIds].find((materialId) => !actualMaterialIds.has(materialId))
    if (missingMaterialId) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.invalidMaterial,
            'Matrix references a material that is unavailable in the current workspace'
        )
    }
}

export const assertMaterialTemplateOwnerField = (materialContract: ObjectContract) =>
    assertColumn(getField(materialContract, 'TemplateOwnerId'), 'Material.TemplateOwnerId')
