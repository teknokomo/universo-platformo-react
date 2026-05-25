import type { BranchCopyOptionKey, BranchCopyOptions } from '@universo/types'
import { BRANCH_COPY_OPTION_KEYS } from '@universo/types'
import { normalizeBranchCopyOptions } from '@universo/utils'

export type BranchCopyCompatibilityCode = 'BRANCH_COPY_OPTION_LIST_REFERENCES' | 'BRANCH_COPY_DANGLING_ENTITY_REFERENCES'

export const getBranchCopyOptions = (values: Record<string, unknown>): BranchCopyOptions => {
    return normalizeBranchCopyOptions({
        fullCopy: values.fullCopy as boolean | undefined,
        copyLayouts: values.copyLayouts as boolean | undefined,
        copyTreeEntities: values.copyTreeEntities as boolean | undefined,
        copyObjectCollections: values.copyObjectCollections as boolean | undefined,
        copyValueGroups: values.copyValueGroups as boolean | undefined,
        copyOptionLists: values.copyOptionLists as boolean | undefined
    })
}

export const setAllBranchCopyChildren = (setValue: (name: string, value: unknown) => void, checked: boolean): void => {
    for (const key of BRANCH_COPY_OPTION_KEYS) {
        setValue(key, checked)
    }
    setValue('fullCopy', checked)
}

export const toggleBranchCopyChild = (
    setValue: (name: string, value: unknown) => void,
    key: BranchCopyOptionKey,
    checked: boolean,
    values: Record<string, unknown>
): void => {
    setValue(key, checked)
    const nextOptions = getBranchCopyOptions({
        ...values,
        [key]: checked,
        fullCopy: false
    })
    setValue('fullCopy', nextOptions.fullCopy)
}

export const resolveBranchCopyCompatibilityCode = (errorCode?: string, backendMessage?: string): BranchCopyCompatibilityCode | null => {
    if (errorCode === 'BRANCH_COPY_OPTION_LIST_REFERENCES') {
        return errorCode
    }
    if (errorCode === 'BRANCH_COPY_DANGLING_ENTITY_REFERENCES') {
        return errorCode
    }
    if (errorCode === 'BRANCH_COPY_ENUM_REFERENCES') {
        return 'BRANCH_COPY_OPTION_LIST_REFERENCES'
    }
    if (errorCode === 'BRANCH_COPY_DANGLING_REFERENCES') {
        return 'BRANCH_COPY_DANGLING_ENTITY_REFERENCES'
    }

    const normalizedMessage = (backendMessage ?? '').toUpperCase()
    if (
        normalizedMessage.includes('BRANCH_COPY_OPTION_LIST_REFERENCES') ||
        normalizedMessage.includes('BRANCH_COPY_ENUM_REFERENCES') ||
        normalizedMessage.includes('OPTION LIST COPY') ||
        normalizedMessage.includes('ENUMERATIONS COPY')
    ) {
        return 'BRANCH_COPY_OPTION_LIST_REFERENCES'
    }
    if (
        normalizedMessage.includes('BRANCH_COPY_DANGLING_ENTITY_REFERENCES') ||
        normalizedMessage.includes('BRANCH_COPY_DANGLING_REFERENCES') ||
        normalizedMessage.includes('DANGLING ENTITY REFERENCES') ||
        normalizedMessage.includes('DANGLING OBJECT REFERENCES')
    ) {
        return 'BRANCH_COPY_DANGLING_ENTITY_REFERENCES'
    }

    return null
}
