import { getMarketingSectionAnchorEntries } from '@universo-react/types'
import type { MarketingHeroBindingTarget } from './marketingHeroBindingsStore'
import { MetahubValidationError } from '../shared/domainErrors'

type MarketingSectionWidget = Parameters<typeof getMarketingSectionAnchorEntries>[0][number]

/** Ensure persisted Hero anchor actions resolve to active sections in their layout. */
export const validateMarketingHeroActionTargets = (
    data: MarketingHeroBindingTarget['data'],
    widgets: readonly MarketingSectionWidget[]
): void => {
    const validTargets = new Set(getMarketingSectionAnchorEntries(widgets).map(([key]) => `#${key}`))
    for (const action of [data.primaryAction, data.termsAction]) {
        if (action?.kind === 'anchor' && !validTargets.has(action.href)) {
            throw new MetahubValidationError('Hero action targets an inactive section in this layout', {
                reason: 'HERO_ACTION_TARGET_UNAVAILABLE'
            })
        }
    }
}
