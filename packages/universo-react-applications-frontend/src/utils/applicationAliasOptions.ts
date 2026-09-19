import { getVLCString } from '@universo-react/utils'

import type { ApplicationAliasApplicationOption } from '../api/applicationAliasesApi'

export interface ApplicationAliasPickerOption {
    id: string
    label: string
    secondaryLabel?: string
}

/**
 * Builds the Slugs application picker options.
 *
 * The list label is always the localized application name; when several
 * applications share one display name, the localized description is attached
 * as a human-readable disambiguator instead of falling back to identifiers.
 */
export const buildApplicationAliasPickerOptions = (
    items: readonly ApplicationAliasApplicationOption[],
    locale: string
): ApplicationAliasPickerOption[] => {
    const labels = items.map((item) => getVLCString(item.name, locale))
    const duplicateLabels = new Set(labels.filter((label, index) => labels.indexOf(label) !== index))

    return items.map((item, index) => {
        const label = labels[index] ?? ''
        const context = item.context?.trim() || null
        return {
            id: item.id,
            label,
            ...(duplicateLabels.has(label) && context ? { secondaryLabel: context } : {})
        }
    })
}
