import type { AttributeLocalizedPayload } from '../../../types'
import type { AttributeCopyInput } from '../api'

export type AttributeMutationError = Error & {
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

export interface CreateAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    data: AttributeLocalizedPayload & {
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
}

export interface UpdateAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    data: AttributeLocalizedPayload & {
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        isEnabled?: boolean
        sortOrder?: number
        expectedVersion?: number
    }
}

export interface DeleteAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
}

export interface MoveAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    direction: 'up' | 'down'
}

export interface CopyAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    data: AttributeCopyInput
}

export interface ChildAttributeMutationData extends AttributeLocalizedPayload {
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    isRequired?: boolean
    isDisplayAttribute?: boolean
    sortOrder?: number
    targetEntityId?: string | null
    targetEntityKind?: string | null
    targetConstantId?: string | null
}

export interface CreateChildAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    parentAttributeId: string
    data: ChildAttributeMutationData
}

export interface UpdateChildAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    parentAttributeId: string
    attributeId: string
    data: ChildAttributeMutationData & {
        expectedVersion?: number
    }
}

export interface DeleteChildAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    parentAttributeId: string
    attributeId: string
}

export interface CopyChildAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    parentAttributeId: string
    attributeId: string
    data: AttributeCopyInput
}

export interface ReorderAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    newSortOrder: number
    mergedOrderIds?: string[]
    newParentAttributeId?: string | null
    currentParentAttributeId?: string | null
    autoRenameCodename?: boolean
}

export interface ToggleRequiredParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    isRequired: boolean
}

export interface SetDisplayAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
}
