import { LAYOUT_WIDGET_DEFINITIONS, type ApplicationLayoutWidget, type LayoutWidgetDefinition } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { getApplicationLayoutDetail } from './applicationLayoutStoreSupport'

export const listApplicationLayoutWidgetObject = (): LayoutWidgetDefinition[] => LAYOUT_WIDGET_DEFINITIONS.map((widget) => ({ ...widget }))

export async function listApplicationLayoutWidgets(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string
): Promise<ApplicationLayoutWidget[]> {
    const detail = await getApplicationLayoutDetail(executor, schemaName, layoutId)
    if (!detail) return []
    return detail.widgets
}
