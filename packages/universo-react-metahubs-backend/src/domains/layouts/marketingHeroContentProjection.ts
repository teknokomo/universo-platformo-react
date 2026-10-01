import { LAYOUT_WIDGET_DEFINITIONS, marketingHeroEntityContentSchema } from '@universo-react/types'
import { toLocalizedStringMap } from '@universo-react/utils'
import { MetahubValidationError } from '../shared/domainErrors'

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const getHeroContentSlot = () => {
    const definition = LAYOUT_WIDGET_DEFINITIONS.find((entry) => entry.key === 'marketing.hero')
    const slot = definition?.bindingSlots?.find((entry) => entry.key === 'content')
    if (!definition || !slot) throw new MetahubValidationError('Hero content contract is not registered')
    return slot
}

export const projectMarketingHeroContentData = (rawData: unknown): ReturnType<typeof marketingHeroEntityContentSchema.parse> => {
    const data = asRecord(rawData)
    const contentProjection = getHeroContentSlot().requirements.components.reduce<Record<string, unknown>>((projected, requirement) => {
        if (requirement.semanticKey) return projected
        const value = requirement.localized
            ? toLocalizedStringMap(data[requirement.componentCodename])
            : data[requirement.componentCodename]
        if (value !== undefined && (requirement.required || value !== null)) projected[requirement.field] = value
        return projected
    }, {})
    return marketingHeroEntityContentSchema.parse(contentProjection)
}
