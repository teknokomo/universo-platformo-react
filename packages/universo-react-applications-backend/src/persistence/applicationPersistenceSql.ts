export const APPLICATION_RETURNING = `
    id,
    name,
    description,
    settings,
    is_public AS "isPublic",
    show_in_app_list AS "showInAppList",
    workspaces_enabled AS "workspacesEnabled",
    schema_name AS "schemaName",
    schema_status AS "schemaStatus",
    schema_synced_at AS "schemaSyncedAt",
    schema_error AS "schemaError",
    COALESCE(_upl_version, 1) AS "version",
    _upl_created_at AS "createdAt",
    _upl_updated_at AS "updatedAt",
    _upl_updated_by AS "updatedBy"
`
