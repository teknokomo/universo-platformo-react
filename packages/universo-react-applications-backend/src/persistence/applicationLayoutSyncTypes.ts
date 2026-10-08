export interface ApplicationLayoutSyncWidgetRow {
    id: string
    layout_id: string
    zone: string
    widget_key: string
    instance_key: string
    parent_widget_id: string | null
    slot_key: string | null
    sort_order: number
    config: unknown
    source_config: unknown
    source_state: unknown
    is_active: boolean
    source_widget_id: string | null
    source_base_widget_id: string | null
    source_content_hash: string | null
    local_content_hash: string | null
    _upl_deleted: boolean
    _app_deleted: boolean
    _upl_created_at: unknown
    version: number
}
