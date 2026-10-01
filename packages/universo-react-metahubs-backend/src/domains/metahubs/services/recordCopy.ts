import { ComponentDefinitionDataType } from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils/database'
import { validation } from '@universo-react/utils'
import type { MetahubRecordsService } from './MetahubRecordsService'

const { normalizeRecordCopyOptions } = validation

export interface RecordCopyComponent {
    codename: string
    dataType: ComponentDefinitionDataType
    parentComponentId?: string | null
    isRequired: boolean
    validationRules?: Record<string, unknown>
}

export interface PreparedRecordCopy {
    data: Record<string, unknown>
    copyOptions: { copyChildTables: boolean }
    hasRequiredChildTables: boolean
}

/** Preserve the generic record-copy contract while allowing callers to supply their transaction executor. */
export const prepareRecordCopy = async (input: {
    metahubId: string
    objectCollectionId: string
    sourceData: Record<string, unknown>
    components: readonly RecordCopyComponent[]
    recordsService: MetahubRecordsService
    userId?: string
    copyChildTables?: boolean
    db?: SqlQueryable
}): Promise<PreparedRecordCopy> => {
    const rootTableComponents = input.components.filter(
        (component) => !component.parentComponentId && component.dataType === ComponentDefinitionDataType.TABLE
    )
    const hasRequiredChildTables = rootTableComponents.some((component) => {
        const minRows = typeof component.validationRules?.minRows === 'number' ? component.validationRules.minRows : 0
        return component.isRequired || minRows > 0
    })

    const requestedOptions = normalizeRecordCopyOptions({ copyChildTables: input.copyChildTables })
    const copyOptions = hasRequiredChildTables ? { ...requestedOptions, copyChildTables: true } : requestedOptions
    const copiedData: Record<string, unknown> = { ...input.sourceData }

    if (!copyOptions.copyChildTables) {
        for (const component of rootTableComponents) delete copiedData[component.codename]
    }

    const uniqueRootComponents = input.components.filter(
        (component) => !component.parentComponentId && component.validationRules?.unique === true
    )
    for (const component of uniqueRootComponents) {
        const value = copiedData[component.codename]
        if (typeof value !== 'string' || value.trim().length === 0) continue
        const maxLength = typeof component.validationRules?.maxLength === 'number' ? component.validationRules.maxLength : null
        const pattern = typeof component.validationRules?.pattern === 'string' ? component.validationRules.pattern : null
        copiedData[component.codename] = await input.recordsService.suggestUniqueComponentValue(
            input.metahubId,
            input.objectCollectionId,
            component.codename,
            value,
            input.userId,
            {
                maxLength,
                pattern,
                format: typeof component.validationRules?.format === 'string' ? component.validationRules.format : null
            },
            input.db
        )
    }

    return { data: copiedData, copyOptions, hasRequiredChildTables }
}
