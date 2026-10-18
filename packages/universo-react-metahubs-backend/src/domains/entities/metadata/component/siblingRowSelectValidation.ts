import { ComponentDefinitionDataType } from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils'
import { z } from 'zod'
import { getCodenamePayloadText } from '../../../shared/codenamePayload'
import type { MetahubComponentsService } from '../../../metahubs/services/MetahubComponentsService'

export const siblingRowSelectSchema = z
    .object({
        tableCodename: z.string().trim().min(1).max(128),
        valueFieldCodename: z.string().trim().min(1).max(128),
        labelFieldCodename: z.string().trim().min(1).max(128),
        requiredWithRows: z.boolean().optional(),
        requireEachTargetReferenced: z.boolean().optional()
    })
    .strict()

export type ComponentMetadata = Awaited<ReturnType<MetahubComponentsService['findAllFlat']>>[number]

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

export const getSiblingRowSelectConfig = (component: ComponentMetadata): Record<string, unknown> | null => {
    const uiConfig = asRecord(component.uiConfig)
    return asRecord(uiConfig?.siblingRowSelect)
}

export const validateSiblingRowSelectReference = async ({
    componentsService,
    metahubId,
    objectCollectionId,
    userId,
    parentComponentId,
    fieldDataType,
    config
}: {
    componentsService: MetahubComponentsService
    metahubId: string
    objectCollectionId: string
    userId: string
    parentComponentId: string | null | undefined
    fieldDataType: ComponentDefinitionDataType
    config: z.infer<typeof siblingRowSelectSchema>
}): Promise<string | null> => {
    if (fieldDataType !== ComponentDefinitionDataType.STRING) {
        return 'siblingRowSelect is only supported on STRING child fields'
    }

    if (!parentComponentId) {
        return 'siblingRowSelect is only supported on child fields inside a TABLE component'
    }

    const components = await componentsService.findAllFlat(metahubId, objectCollectionId, userId)
    const parentTable = components.find((component) => component.id === parentComponentId)
    if (!parentTable || parentTable.dataType !== ComponentDefinitionDataType.TABLE) {
        return 'siblingRowSelect requires the current field to belong to an existing TABLE component'
    }

    const siblingTables = components.filter(
        (component) =>
            component.id !== parentTable.id &&
            component.dataType === ComponentDefinitionDataType.TABLE &&
            component.codename === config.tableCodename &&
            (component.parentComponentId ?? null) === (parentTable.parentComponentId ?? null)
    )
    if (siblingTables.length !== 1) {
        return 'siblingRowSelect.tableCodename must identify exactly one sibling TABLE component'
    }

    const siblingTable = siblingTables[0]
    if ((parentTable.parentComponentId ?? null) !== null || (siblingTable.parentComponentId ?? null) !== null) {
        return 'siblingRowSelect is only supported between root-level sibling TABLE components'
    }
    const siblingFields = components.filter((component) => component.parentComponentId === siblingTable.id)
    const valueFields = siblingFields.filter((field) => field.codename === config.valueFieldCodename)
    if (valueFields.length !== 1 || valueFields[0]?.dataType !== ComponentDefinitionDataType.STRING) {
        return 'siblingRowSelect.valueFieldCodename must identify one STRING child field in the sibling TABLE'
    }
    const valueFieldUiConfig = valueFields[0]?.uiConfig as Record<string, unknown> | undefined
    if (valueFieldUiConfig?.siblingRowSelectKey !== true || valueFieldUiConfig.generateUuidV7 !== true) {
        return 'siblingRowSelect.valueFieldCodename must identify a server-generated UUID v7 sibling key'
    }
    const valueFieldValidationRules = valueFields[0]?.validationRules
    if (valueFieldValidationRules?.localized === true || valueFieldValidationRules?.versioned === true) {
        return 'siblingRowSelect.valueFieldCodename must identify a non-localized, non-versioned STRING child field'
    }

    const labelFields = siblingFields.filter((field) => field.codename === config.labelFieldCodename)
    if (labelFields.length !== 1 || labelFields[0]?.dataType !== ComponentDefinitionDataType.STRING) {
        return 'siblingRowSelect.labelFieldCodename must identify one STRING child field in the sibling TABLE'
    }
    const labelFieldUiConfig = labelFields[0]?.uiConfig as Record<string, unknown> | undefined
    if (
        labelFields[0]?.id === valueFields[0]?.id ||
        labelFieldUiConfig?.siblingRowSelectKey === true ||
        labelFieldUiConfig?.generateUuidV7 === true
    ) {
        return 'siblingRowSelect.labelFieldCodename must identify a human-readable STRING child field, not a generated UUID v7 key'
    }

    return null
}

export const hasDependentSiblingRowSelectReferences = async ({
    componentsService,
    metahubId,
    objectCollectionId,
    userId,
    component,
    nextCodename,
    nextUiConfig,
    nextParentComponentId,
    operation = 'update',
    db
}: {
    componentsService: MetahubComponentsService
    metahubId: string
    objectCollectionId: string
    userId: string
    component: ComponentMetadata
    nextCodename: ComponentMetadata['codename'] | string | null | undefined
    nextUiConfig: unknown
    nextParentComponentId?: string | null
    operation?: 'update' | 'delete' | 'move'
    db?: SqlQueryable
}): Promise<boolean> => {
    const previousCodename = getCodenamePayloadText(component.codename)
    const updatedCodename = getCodenamePayloadText(nextCodename)
    const rootTableRename =
        component.dataType === ComponentDefinitionDataType.TABLE &&
        (component.parentComponentId ?? null) === null &&
        previousCodename !== updatedCodename
    const rootTableReferenceInvalidated =
        component.dataType === ComponentDefinitionDataType.TABLE &&
        (component.parentComponentId ?? null) === null &&
        (rootTableRename ||
            operation === 'delete' ||
            (operation === 'move' && nextParentComponentId !== undefined && nextParentComponentId !== null))
    const previousUiConfig = asRecord(component.uiConfig)
    const updatedUiConfig = asRecord(nextUiConfig)
    const wasGeneratedSiblingKey =
        component.dataType === ComponentDefinitionDataType.STRING &&
        previousUiConfig?.siblingRowSelectKey === true &&
        previousUiConfig.generateUuidV7 === true
    const generatedKeyContractChanged =
        wasGeneratedSiblingKey &&
        (previousCodename !== updatedCodename ||
            updatedUiConfig?.siblingRowSelectKey !== true ||
            updatedUiConfig.generateUuidV7 !== true ||
            operation === 'delete' ||
            (operation === 'move' && nextParentComponentId !== undefined && nextParentComponentId !== component.parentComponentId))
    const siblingLabelReferenceInvalidated =
        component.dataType === ComponentDefinitionDataType.STRING &&
        (component.parentComponentId ?? null) !== null &&
        (previousCodename !== updatedCodename ||
            operation === 'delete' ||
            (operation === 'move' && nextParentComponentId !== undefined && nextParentComponentId !== component.parentComponentId))

    if (!rootTableReferenceInvalidated && !generatedKeyContractChanged && !siblingLabelReferenceInvalidated) return false

    const components = db
        ? await componentsService.findAllFlat(metahubId, objectCollectionId, userId, 'business', db)
        : await componentsService.findAllFlat(metahubId, objectCollectionId, userId, 'business')
    const parentTable = component.parentComponentId
        ? components.find((candidate) => candidate.id === component.parentComponentId)
        : undefined
    const parentTableCodename = parentTable ? getCodenamePayloadText(parentTable.codename) : ''

    return components.some((candidate) => {
        const selection = getSiblingRowSelectConfig(candidate)
        if (!selection || typeof selection.tableCodename !== 'string' || typeof selection.valueFieldCodename !== 'string') {
            return false
        }
        const selectorTable = components.find((item) => item.id === candidate.parentComponentId)
        if (
            candidate.dataType !== ComponentDefinitionDataType.STRING ||
            !selectorTable ||
            selectorTable.dataType !== ComponentDefinitionDataType.TABLE ||
            (selectorTable.parentComponentId ?? null) !== null
        ) {
            return false
        }

        if (rootTableReferenceInvalidated) return selection.tableCodename === previousCodename
        if (
            siblingLabelReferenceInvalidated &&
            parentTable?.dataType === ComponentDefinitionDataType.TABLE &&
            (parentTable.parentComponentId ?? null) === null &&
            selection.tableCodename === parentTableCodename &&
            selection.labelFieldCodename === previousCodename
        ) {
            return true
        }
        return (
            generatedKeyContractChanged &&
            parentTable?.dataType === ComponentDefinitionDataType.TABLE &&
            (parentTable.parentComponentId ?? null) === null &&
            selection.tableCodename === parentTableCodename &&
            selection.valueFieldCodename === previousCodename
        )
    })
}
