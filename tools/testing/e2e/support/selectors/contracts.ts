export const authSelectors = {
    emailInput: 'auth-email-input',
    passwordInput: 'auth-password-input',
    submitButton: 'auth-submit-button'
} as const

export const toolbarSelectors = {
    primaryAction: 'toolbar-primary-action'
} as const

export const viewHeaderSelectors = {
    titleRegion: 'view-header-title-region',
    controlsRegion: 'view-header-controls-region',
    searchInput: 'view-header-search-input'
} as const

export const entityDialogSelectors = {
    submitButton: 'entity-form-submit',
    cancelButton: 'entity-form-cancel',
    deleteButton: 'entity-form-delete'
} as const

export const confirmDeleteSelectors = {
    confirmButton: 'confirm-delete-confirm',
    cancelButton: 'confirm-delete-cancel'
} as const

export const entitySelectionSelectors = {
    addButton: 'entity-selection-add-button',
    confirmButton: 'entity-selection-confirm',
    searchInput: 'entity-selection-search'
} as const

export const profileSelectors = {
    nicknameInput: 'profile-nickname-input',
    firstNameInput: 'profile-first-name-input',
    lastNameInput: 'profile-last-name-input',
    submitButton: 'profile-update-submit'
} as const

export const applicationSelectors = {
    limitsSaveButton: 'application-settings-limits-save',
    runtimeCreateButton: 'application-runtime-create-row',
    runtimeWorkspaceLimitBanner: 'application-runtime-workspace-limit-banner',
    connectorBoardSchemaCard: 'application-connector-board-schema-card',
    connectorBoardDetailsCard: 'application-connector-board-details-card',
    connectorBoardSyncButton: 'application-connector-board-sync-button',
    connectorBoardViewMigrationsButton: 'application-connector-board-view-migrations',
    migrationsTable: 'application-migrations-table'
} as const

export const metahubMigrationsSelectors = {
    branchSelect: 'metahub-migrations-branch-select'
} as const

export const pageSpacingSelectors = {
    metahubSettingsTabs: 'metahub-settings-tabs',
    metahubSettingsContent: 'metahub-settings-content',
    adminSettingsTabs: 'admin-settings-tabs',
    adminSettingsContent: 'admin-settings-content',
    applicationSettingsTabs: 'application-settings-tabs',
    applicationSettingsContent: 'application-settings-content',
    metahubLayoutDetailsContent: 'metahub-layout-details-content',
    metahubLayoutsListContent: 'metahub-layouts-list-content'
} as const

export const buildStatCardSelector = (scope: string, metric: string) => `${scope}-stat-card-${metric}`

export const buildApplicationLimitCardSelector = (objectId: string) => `application-settings-limit-card-${objectId}`

export const buildApplicationLimitInputSelector = (objectId: string) => `application-settings-limit-input-${objectId}`

export const buildEntityMenuTriggerSelector = (entityKind: string, entityId: string) => `entity-menu-trigger-${entityKind}-${entityId}`

export const buildEntityMenuItemSelector = (entityKind: string, actionId: string, entityId: string) =>
    `entity-menu-item-${entityKind}-${actionId}-${entityId}`

export const buildEntitySelectionOptionSelector = (entityId: string) => `entity-selection-option-${entityId}`

export const buildGridRowActionsTriggerSelector = (rowId: string) => `grid-row-actions-trigger-${rowId}`

export const buildApplicationMigrationRowSelector = (migrationId: string) => `application-migration-row-${migrationId}`

export const buildApplicationMigrationExpandSelector = (migrationId: string) => `application-migration-expand-${migrationId}`

export const buildApplicationMigrationRollbackSelector = (migrationId: string) => `application-migration-rollback-${migrationId}`

export const buildApplicationMigrationSummarySelector = (migrationId: string) => `application-migration-summary-${migrationId}`

export const buildLayoutZoneSelector = (zone: string) => `layout-zone-${zone}`

export const buildLayoutWidgetSelector = (widgetId: string) => `layout-widget-${widgetId}`

export const buildLayoutWidgetToggleSelector = (widgetId: string) => `layout-widget-toggle-${widgetId}`
