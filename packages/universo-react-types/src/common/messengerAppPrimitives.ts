import { z } from 'zod'

import { MESSENGER_APP_LAYOUT_ZONES, type ApplicationLayoutWidgetKey, type MessengerAppLayoutZone } from './applicationLayoutPrimitives'
import type { LayoutSemanticRegion } from './applicationTemplates'

export { MESSENGER_APP_LAYOUT_ZONES }
export type { MessengerAppLayoutZone }

export const messengerAppLayoutZoneSchema = z.enum(MESSENGER_APP_LAYOUT_ZONES)

/** Stable semantic mapping for Messenger App's physical layout zones. */
export const MESSENGER_APP_LAYOUT_ZONE_SEMANTICS = {
    top: 'header',
    center: 'main',
    bottom: 'footer'
} as const satisfies Readonly<Record<MessengerAppLayoutZone, LayoutSemanticRegion>>

/** Messenger App has no independent renderer options yet. */
export const messengerAppConfigSchema = z.object({}).strict()
export type MessengerAppConfig = z.infer<typeof messengerAppConfigSchema>

export interface MessengerAppDefaultPlacement {
    zone: MessengerAppLayoutZone
    widgetKey: ApplicationLayoutWidgetKey
    /** Stable seed identity used only to resolve parent-child placement. */
    instanceKey: string
    parentInstanceKey: string | null
    slotKey: string | null
    sortOrder: number
    config?: Record<string, unknown>
    isActive?: boolean
}

const MESSENGER_OVERVIEW_TAB = {
    slotKey: 'tab:overview',
    label: { en: 'Overview', ru: 'Обзор' },
    isDefault: true
} as const

const createMessengerAppShellPlacements = (): MessengerAppDefaultPlacement[] => [
    {
        zone: 'top',
        widgetKey: 'header',
        instanceKey: 'messenger-header',
        parentInstanceKey: null,
        slotKey: null,
        sortOrder: 1
    },
    {
        zone: 'center',
        widgetKey: 'detailsTabs',
        instanceKey: 'messenger-overview-tabs',
        parentInstanceKey: null,
        slotKey: null,
        sortOrder: 1,
        config: { tabs: [MESSENGER_OVERVIEW_TAB] }
    }
]

/** Seed the shared header and a generated navigation list inside the localized Overview tab. */
export const DEFAULT_MESSENGER_APP_ZONE_WIDGETS: readonly MessengerAppDefaultPlacement[] = [
    ...createMessengerAppShellPlacements(),
    {
        zone: 'center',
        widgetKey: 'menuWidget',
        instanceKey: 'messenger-overview-navigation',
        parentInstanceKey: 'messenger-overview-tabs',
        slotKey: MESSENGER_OVERVIEW_TAB.slotKey,
        sortOrder: 1,
        config: { variant: 'generated' }
    }
]
