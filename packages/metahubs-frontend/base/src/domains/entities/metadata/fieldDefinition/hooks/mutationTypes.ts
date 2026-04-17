import type { FieldDefinitionLocalizedPayload } from '../../../../../types'
import type { FieldDefinitionCopyInput } from '../api'

export type FieldDefinitionMutationError = Error & {
    response?: {
        status?: number
        data?: {
            code?: string
            message?: string
            error?: string
            limit?: number
            maxChildAttributes?: number
            maxTableAttributes?: number
        }
    }
}

export interface CreateFieldDefinitionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    data: FieldDefinitionLocalizedPayload & {
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
}

export interface UpdateFieldDefinitionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    fieldDefinitionId: string
    data: FieldDefinitionLocalizedPayload & {
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        isEnabled?: boolean
        sortOrder?: number
        expectedVersion?: number
    }
}

export interface DeleteFieldDefinitionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    fieldDefinitionId: string
}

export interface MoveFieldDefinitionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    fieldDefinitionId: string
    direction: 'up' | 'down'
}

export interface CopyFieldDefinitionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    fieldDefinitionId: string
    data: FieldDefinitionCopyInput
}

export interface ChildAttributeMutationData extends FieldDefinitionLocalizedPayload {
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    isRequired?: boolean
    isDisplayAttribute?: boolean
    sortOrder?: number
    targetEntityId?: string | null
    targetEntityKind?: string | null
    targetConstantId?: string | null
}

export interface CreateChildFieldDefinitionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    parentAttributeId: string
    data: ChildAttributeMutationData
}

export interface UpdateChildFieldDefinitionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    parentAttributeId: string
    fieldDefinitionId: string
    data: ChildAttributeMutationData & {
        expectedVersion?: number
    }
}

export interface DeleteChildFieldDefinitionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    parentAttributeId: string
    fieldDefinitionId: string
}

export interface CopyChildFieldDefinitionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    parentAttributeId: string
    fieldDefinitionId: string
    data: FieldDefinitionCopyInput
}

export interface ReorderFieldDefinitionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    fieldDefinitionId: string
    newSortOrder: number
    mergedOrderIds?: string[]
    newParentAttributeId?: string | null
    currentParentAttributeId?: string | null
    autoRenameCodename?: boolean
}

export interface ToggleRequiredParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    fieldDefinitionId: string
    isRequired: boolean
}

export interface SetDisplayFieldDefinitionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    fieldDefinitionId: string
}
