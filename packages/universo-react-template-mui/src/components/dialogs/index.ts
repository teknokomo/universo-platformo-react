export { EntityFormDialog } from './EntityFormDialog'
export type { EntityFormDialogProps, TabConfig } from './EntityFormDialog'
export {
    DialogPresentationProvider,
    mergeDialogPaperProps,
    mergeDialogSx,
    resolveDialogMaxWidth,
    useDialogPresentation,
    useDialogPresentationContext
} from './dialogPresentation'
export type { DialogPresentationContextValue, DialogPresentationHookOptions, DialogPresentationHookResult } from './dialogPresentation'

export { DynamicEntityFormDialog } from './DynamicEntityFormDialog'
export type {
    DynamicEntityFormDialogProps,
    DynamicEntityFormFieldError,
    DynamicFieldConfig,
    DynamicFieldType,
    DynamicFieldValidationRules
} from './DynamicEntityFormDialog'

export { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
export type { ConfirmDeleteDialogProps } from './ConfirmDeleteDialog'

export { ConfirmDialog } from './ConfirmDialog'

export { StandardDialog } from './StandardDialog'
export type { StandardDialogProps } from './StandardDialog'

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

export { CookieConsentBanner } from '../cookies/CookieConsentBanner'
export { CookieRejectionDialog } from '../cookies/CookieRejectionDialog'
export { useCookieConsent } from '../../hooks/useCookieConsent'
export type { CookieConsentStatus } from '../../hooks/useCookieConsent'

// Re-export AssignableRole from @universo-react/types for convenience
export type { AssignableRole } from '@universo-react/types'
