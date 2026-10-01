import { z } from 'zod'

export const LAYOUT_LOGICAL_PLACEMENTS = ['start', 'end'] as const
export type LayoutLogicalPlacement = (typeof LAYOUT_LOGICAL_PLACEMENTS)[number]
export const layoutLogicalPlacementSchema = z.enum(LAYOUT_LOGICAL_PLACEMENTS)
/** Alias used by callers that treat placement as a widget-specific contract. */
export const layoutWidgetPlacementSchema = layoutLogicalPlacementSchema

export const LAYOUT_WIDGET_MOBILE_PROJECTIONS = ['compact-header', 'drawer'] as const
export type LayoutWidgetMobileProjection = (typeof LAYOUT_WIDGET_MOBILE_PROJECTIONS)[number]
export const layoutWidgetMobileProjectionSchema = z.enum(LAYOUT_WIDGET_MOBILE_PROJECTIONS)
