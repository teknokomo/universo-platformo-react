export { EntityFormDialog } from './EntityFormDialog'
export type { EntityFormDialogProps, TabConfig } from './EntityFormDialog'

export { DynamicEntityFormDialog } from './DynamicEntityFormDialog'
export type { DynamicEntityFormDialogProps, DynamicFieldConfig, DynamicFieldType } from './DynamicEntityFormDialog'

export { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
export type { ConfirmDeleteDialogProps } from './ConfirmDeleteDialog'

export { ConfirmDialog } from './ConfirmDialog'

export { BlockingEntitiesDeleteDialog } from './BlockingEntitiesDeleteDialog'
export type {
    BlockingEntitiesDeleteDialogProps,
    BlockingEntitiesDeleteDialogLabels,
    DeletableEntity,
    BlockingEntity
} from './BlockingEntitiesDeleteDialog'

export { MemberFormDialog } from './MemberFormDialog'
export type { MemberFormDialogProps } from './MemberFormDialog'

export { SettingsDialog } from './SettingsDialog'
export type { SettingsDialogProps } from './SettingsDialog'

export { ConflictResolutionDialog } from './ConflictResolutionDialog'
export type { ConflictResolutionDialogProps } from './ConflictResolutionDialog'

// Re-export AssignableRole from @universo/types for convenience
export type { AssignableRole } from '@universo/types'
