import { UpdateFailure } from '../../shared/runtimeHelpers'
import {
    isRuntimeObjectTargetKind,
    isRuntimeServerOwnedAttr,
    type RuntimeObjectCollectionAttr
} from '../../services/runtimeRowSupport/contracts'

type RuntimeCopyField = {
    column_name: string
    ui_config?: Record<string, unknown> | null
}

/** Builds initial scalar values for a copied row, honoring explicit metadata resets. */
export function buildRuntimeCopyFieldValues(attrs: RuntimeCopyField[], sourceRow: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        attrs.map((attr) => [
            attr.column_name,
            attr.ui_config?.resetOnCopy === true ? attr.ui_config.defaultValue ?? null : sourceRow[attr.column_name] ?? null
        ])
    )
}

/** Prevent an unscoped copy from carrying a server-owned object relationship into a new row. */
export function assertRuntimeCopyReferenceFieldsAreScoped(params: {
    attrs: RuntimeObjectCollectionAttr[]
    sourceRow: Record<string, unknown>
    scopedParentFieldColumnName?: string
}): void {
    const unscopedReference = params.attrs.find((attr) => {
        if (
            attr.data_type !== 'REF' ||
            !isRuntimeObjectTargetKind(attr.target_object_kind) ||
            !isRuntimeServerOwnedAttr(attr) ||
            attr.ui_config?.resetOnCopy === true ||
            attr.column_name === params.scopedParentFieldColumnName
        ) {
            return false
        }
        const value = params.sourceRow[attr.column_name]
        return value !== null && value !== undefined && value !== ''
    })

    if (unscopedReference) {
        throw new UpdateFailure(409, {
            error: 'Copying a record with a server-owned relationship requires its relation scope',
            code: 'RUNTIME_RELATION_SCOPE_REQUIRED'
        })
    }
}
