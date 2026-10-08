type TemplateSeedWidgetPlacementInput<TConfig extends object> = {
    id: string
    layoutId: string
    instanceKey: string
    parentWidgetId: string | null
    slotKey: string | null
    zone: string
    widgetKey: string
    sortOrder: number
    config: TConfig
    isActive: boolean
    now: Date
}

export const buildTemplateSeedWidgetPlacementRow = <TConfig extends object>({
    id,
    layoutId,
    instanceKey,
    parentWidgetId,
    slotKey,
    zone,
    widgetKey,
    sortOrder,
    config,
    isActive,
    now
}: TemplateSeedWidgetPlacementInput<TConfig>) => ({
    id,
    layout_id: layoutId,
    instance_key: instanceKey,
    parent_widget_id: parentWidgetId,
    slot_key: slotKey,
    zone,
    widget_key: widgetKey,
    sort_order: sortOrder,
    config,
    is_active: isActive,
    _upl_created_at: now,
    _upl_created_by: null,
    _upl_updated_at: now,
    _upl_updated_by: null,
    _upl_version: 1,
    _upl_archived: false,
    _upl_deleted: false,
    _upl_locked: false,
    _mhb_published: true,
    _mhb_archived: false,
    _mhb_deleted: false
})
