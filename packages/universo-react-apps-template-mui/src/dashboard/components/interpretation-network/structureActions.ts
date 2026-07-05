import { createLocalizedContent, normalizeLocale } from '@universo-react/utils'
import { compensateCreatedAppRow, createAppRow, createTabularRow } from '../../../api/api'
import type { FieldConfig } from '../../../components/dialogs/FormDialog'
import type { InterpretationNetworkWorkspaceConfig, RuntimeColumnLike } from './model'
import { buildRootUniverseMatrixCellData } from './model'
import { readSubmittedTextByConfiguredField } from './workspace/workspaceRuntime'

export const createStructureWithRootMatrix = async ({
    data,
    canCreateContent,
    canEditContent,
    apiBaseUrl,
    applicationId,
    workspaceId,
    conceptSectionId,
    interpretationSectionId,
    locale,
    widgetConfig,
    structureFields,
    matrixColumn,
    defaultStructureName,
    matrixTitle
}: {
    data: Record<string, unknown>
    canCreateContent: boolean
    canEditContent: boolean
    apiBaseUrl: string | undefined
    applicationId: string | undefined
    workspaceId: string | null | undefined
    conceptSectionId: string | null | undefined
    interpretationSectionId: string | null | undefined
    locale: string
    widgetConfig: Required<InterpretationNetworkWorkspaceConfig>
    structureFields: FieldConfig[]
    matrixColumn: RuntimeColumnLike | undefined
    defaultStructureName: string
    matrixTitle: (name: string) => string
}) => {
    if (!canCreateContent || !canEditContent) throw new Error('permission-denied')
    if (!apiBaseUrl || !applicationId || !conceptSectionId || !interpretationSectionId) return null

    const normalizedLocale = normalizeLocale(locale)
    const structureName =
        readSubmittedTextByConfiguredField(data, normalizedLocale, widgetConfig.conceptNameField, structureFields, ['Name', 'Title']) ||
        defaultStructureName
    const concept = await createAppRow({
        apiBaseUrl,
        applicationId,
        workspaceId,
        objectCollectionId: conceptSectionId,
        data
    })
    if (typeof concept.id !== 'string') return { concept, interpretation: null }

    const conceptId = concept.id
    const interpretationData: Record<string, unknown> = {
        [widgetConfig.interpretationTitleField]: createLocalizedContent(normalizedLocale, matrixTitle(structureName)),
        [widgetConfig.interpretationParentField]: conceptId
    }
    const interpretation = await createAppRow({
        apiBaseUrl,
        applicationId,
        workspaceId,
        objectCollectionId: interpretationSectionId,
        data: interpretationData
    }).catch(async (error) => {
        await compensateCreatedAppRow({
            apiBaseUrl,
            applicationId,
            workspaceId,
            rowId: conceptId,
            objectCollectionId: conceptSectionId
        }).catch(() => undefined)
        throw error
    })
    if (matrixColumn?.id && typeof interpretation.id === 'string') {
        const rootCellData = buildRootUniverseMatrixCellData(matrixColumn.childColumns, normalizedLocale)
        for (const childColumn of matrixColumn.childColumns ?? []) {
            if (childColumn.codename !== 'CellId') continue
            delete rootCellData.CellId
            if (childColumn.field) delete rootCellData[childColumn.field]
            if (childColumn.id) delete rootCellData[childColumn.id]
        }
        await createTabularRow({
            apiBaseUrl,
            applicationId,
            workspaceId,
            parentRecordId: interpretation.id,
            componentId: matrixColumn.id,
            objectCollectionId: interpretationSectionId,
            data: rootCellData
        }).catch(async (error) => {
            await compensateCreatedAppRow({
                apiBaseUrl,
                applicationId,
                workspaceId,
                rowId: interpretation.id as string,
                objectCollectionId: interpretationSectionId
            }).catch(() => undefined)
            await compensateCreatedAppRow({
                apiBaseUrl,
                applicationId,
                workspaceId,
                rowId: conceptId,
                objectCollectionId: conceptSectionId
            }).catch(() => undefined)
            throw error
        })
    }
    return { concept, interpretation }
}
