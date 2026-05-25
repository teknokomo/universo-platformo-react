import type { ComponentLocalizedPayload } from '../../../../../types'
import type { ComponentCopyInput } from '../api'

export type ComponentMutationError = Error & {
    response?: {
        status?: number
        data?: {
            code?: string
            message?: string
            error?: string
            limit?: number
            maxChildComponents?: number
            maxTableComponents?: number
        }
    }
}

export interface CreateComponentParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    data: ComponentLocalizedPayload & {
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
}

export interface UpdateComponentParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    componentId: string
    data: ComponentLocalizedPayload & {
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        isEnabled?: boolean
        sortOrder?: number
        expectedVersion?: number
    }
}

export interface DeleteComponentParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    componentId: string
}

export interface MoveComponentParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    componentId: string
    direction: 'up' | 'down'
}

export interface CopyComponentParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    componentId: string
    data: ComponentCopyInput
}

export interface ChildComponentMutationData extends ComponentLocalizedPayload {
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    isRequired?: boolean
    isDisplayComponent?: boolean
    sortOrder?: number
    targetEntityId?: string | null
    targetEntityKind?: string | null
    targetConstantId?: string | null
}

export interface CreateChildComponentParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    parentComponentId: string
    data: ChildComponentMutationData
}

export interface UpdateChildComponentParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    parentComponentId: string
    componentId: string
    data: ChildComponentMutationData & {
        expectedVersion?: number
    }
}

export interface DeleteChildComponentParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    parentComponentId: string
    componentId: string
}

export interface CopyChildComponentParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    parentComponentId: string
    componentId: string
    data: ComponentCopyInput
}

export interface ReorderComponentParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    componentId: string
    newSortOrder: number
    mergedOrderIds?: string[]
    newParentComponentId?: string | null
    currentParentComponentId?: string | null
    autoRenameCodename?: boolean
}

export interface ToggleRequiredParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    componentId: string
    isRequired: boolean
}

export interface SetDisplayComponentParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    componentId: string
}
