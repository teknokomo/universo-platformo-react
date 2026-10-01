import { semanticEntitySelectorSchema, type WidgetBindingComponentRequirement } from '@universo-react/types'
import { isUnsafeValidationPattern, isUsableValidationPattern, isUsableValidationPatternValue } from '@universo-react/utils'

/** Validate a semantic selector against the neutral contract and its registered Component pattern. */
export const isWidgetBindingSemanticKeyValid = (value: unknown, requirement: WidgetBindingComponentRequirement): value is string => {
    if (requirement.semanticKey !== true || typeof requirement.pattern !== 'string') return false

    const parsedSelector = semanticEntitySelectorSchema.safeParse({ kind: 'semantic-key', field: requirement.field, value })
    if (!parsedSelector.success) return false

    const pattern = requirement.pattern
    const semanticKey = parsedSelector.data.value
    if (semanticKey !== value) return false
    if (isUnsafeValidationPattern(pattern) || !isUsableValidationPattern(pattern) || !isUsableValidationPatternValue(semanticKey)) {
        return false
    }

    try {
        return new RegExp(pattern).test(semanticKey)
    } catch {
        return false
    }
}
