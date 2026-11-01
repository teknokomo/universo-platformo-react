import type { DashboardLayoutWidgetKeyFromRegistry } from './dashboardWidgetRegistry'
import type { DashboardLayoutZone } from './dashboardWidgetOwnership'
import type { MarketingLayoutZone } from './marketingPagePrimitives'
import type { MarketingWidgetKey } from './marketingWidgetPrimitives'

/** Physical zones available to the Messenger App application layout. */
export const MESSENGER_APP_LAYOUT_ZONES = ['top', 'center', 'bottom'] as const
export type MessengerAppLayoutZone = (typeof MESSENGER_APP_LAYOUT_ZONES)[number]

/** Widget keys shared by the application layout authoring and runtime contracts. */
export type ApplicationLayoutWidgetKey = DashboardLayoutWidgetKeyFromRegistry | MarketingWidgetKey

/** Physical zones shared by built-in application layout templates. */
export type ApplicationLayoutZone = DashboardLayoutZone | MarketingLayoutZone | MessengerAppLayoutZone
