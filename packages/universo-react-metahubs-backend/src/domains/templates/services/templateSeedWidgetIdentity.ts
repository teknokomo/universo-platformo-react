import { layoutInstanceKeySchema } from '@universo-react/types'
import type { TemplateSeedZoneWidget } from '@universo-react/types'

/** Validate the placement-owned key used by every seeded template widget row. */
export const resolveTemplateSeedWidgetInstanceKey = (widget: Pick<TemplateSeedZoneWidget, 'instanceKey'>): string =>
    layoutInstanceKeySchema.parse(widget.instanceKey)
