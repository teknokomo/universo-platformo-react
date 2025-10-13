// Type declarations for @universo/template-mui
// Provides full type safety for workspace package imports

declare module '@universo/template-mui' {
    import type { FC, ReactNode } from 'react'
    import type { SxProps, Theme } from '@mui/material'

    // ============================================================================
    // EmptyListState Component - Fully Typed
    // ============================================================================

    /**
     * Props for EmptyListState component
     * Universal empty state component for lists and data views
     */
    export interface EmptyListStateProps {
        /** Image source (SVG or PNG URL) */
        image: string
        /** Alt text for accessibility (should be internationalized) */
        imageAlt?: string
        /** Primary message */
        title: string
        /** Optional secondary message */
        description?: string
        /** Optional action button configuration */
        action?: {
            /** Button label text */
            label: string
            /** Click handler */
            onClick: () => void
            /** Optional start icon for button */
            startIcon?: ReactNode
        }
        /** Image height (default: '25vh') */
        imageHeight?: string | number
        /** Custom styles for the root Stack component */
        sx?: SxProps<Theme>
    }

    /**
     * Universal empty state component for lists and data views
     *
     * @example Basic usage
     * <EmptyListState
     *     image={APIEmptySVG}
     *     imageAlt={t('common.emptyStateAlt')}
     *     title={t('metaverses.noMetaversesFound')}
     * />
     *
     * @example With description and action
     * <EmptyListState
     *     image={APIEmptySVG}
     *     imageAlt={t('common.emptyStateAlt')}
     *     title={t('entities.noEntitiesFound')}
     *     description={t('entities.createFirstEntity')}
     *     action={{
     *         label: t('entities.addEntity'),
     *         onClick: handleAddEntity,
     *         startIcon: <AddRoundedIcon />
     *     }}
     * />
     */
    export const EmptyListState: FC<EmptyListStateProps>

    // ============================================================================
    // SkeletonGrid Component - Fully Typed
    // ============================================================================

    /**
     * Props for SkeletonGrid component
     * Universal skeleton grid component for loading states
     */
    export interface SkeletonGridProps {
        /** Number of skeleton items to display (default: 3) */
        count?: number
        /** Height of each skeleton item in pixels (default: 160) */
        height?: number
        /** Variant of skeleton animation (default: 'rounded') */
        variant?: 'text' | 'rectangular' | 'rounded' | 'circular'
        /** Gap between skeleton items in spacing units (default: 3) */
        gap?: number
        /** Responsive grid column configuration */
        columns?: {
            xs?: string
            sm?: string
            md?: string
            lg?: string
        }
        /** Horizontal margin */
        mx?: number | string | { xs?: number; sm?: number; md?: number; lg?: number }
        /** Additional custom styles for the container Box */
        sx?: SxProps<Theme>
    }

    /**
     * Universal skeleton grid component for loading states
     *
     * @example Basic usage with defaults
     * <SkeletonGrid />
     *
     * @example Custom count and height
     * <SkeletonGrid count={6} height={200} />
     */
    export const SkeletonGrid: FC<SkeletonGridProps>

    // ============================================================================
    // SVG Assets - Empty State Illustrations
    // ============================================================================

    /** API empty state illustration */
    export const APIEmptySVG: string
    /** Agents empty state illustration */
    export const AgentsEmptySVG: string
    /** Assistant empty state illustration */
    export const AssistantEmptySVG: string
    /** Chunks empty state illustration */
    export const ChunksEmptySVG: string
    /** Credential empty state illustration */
    export const CredentialEmptySVG: string
    /** Document Store empty state illustration */
    export const DocStoreEmptySVG: string
    /** Document Store Details empty state illustration */
    export const DocStoreDetailsEmptySVG: string
    /** Leads empty state illustration */
    export const LeadsEmptySVG: string
    /** Message empty state illustration */
    export const MessageEmptySVG: string
    /** Prompt empty state illustration */
    export const PromptEmptySVG: string
    /** Tools empty state illustration */
    export const ToolsEmptySVG: string
    /** Upsert History empty state illustration */
    export const UpsertHistoryEmptySVG: string
    /** Variables empty state illustration */
    export const VariablesEmptySVG: string
    /** Workflow empty state illustration */
    export const WorkflowEmptySVG: string

    // ============================================================================
    // ItemCard Component - Fully Typed
    // ============================================================================

    /**
     * Props for ItemCard component
     * Universal card component for displaying list items in card/grid view
     */
    export interface ItemCardProps {
        /** Entity data to display (must have name/templateName property) */
        data: {
            name?: string
            templateName?: string
            description?: string
            iconSrc?: string
            color?: string
            [key: string]: any
        }
        /** Array of image URLs to display in footer */
        images?: string[]
        /** Click handler for card navigation */
        onClick?: () => void
        /** Allow card to stretch to 100% width (default: false, max 360px) */
        allowStretch?: boolean
        /** Optional ReactNode to display at the end of footer (e.g., Chip, Badge) */
        footerEndContent?: ReactNode
        /** Optional ReactNode to display in top-right corner (e.g., action menu) */
        headerAction?: ReactNode
        /** Custom styles for the card wrapper */
        sx?: SxProps<Theme>
    }

    /**
     * Universal card component for displaying list items in card/grid view
     *
     * @example Basic usage
     * <ItemCard
     *     data={metaverse}
     *     images={images[metaverse.id]}
     *     onClick={() => navigate(`/metaverses/${metaverse.id}`)}
     * />
     *
     * @example With header action menu
     * <ItemCard
     *     data={entity}
     *     headerAction={
     *         <Box onClick={(e) => e.stopPropagation()}>
     *             <BaseEntityMenu entity={entity} descriptors={actions} />
     *         </Box>
     *     }
     * />
     *
     * @example With footer content
     * <ItemCard
     *     data={unik}
     *     footerEndContent={<Chip label="Owner" variant="outlined" />}
     * />
     */
    export const ItemCard: FC<ItemCardProps>

    // ============================================================================
    // Other Components - TODO: Type fully in future iterations
    // ============================================================================

    /** ToolbarControls component - TODO: Add full type definition */
    export const ToolbarControls: any
    /** ViewHeaderMUI component - TODO: Add full type definition */
    export const ViewHeaderMUI: any
    /** TemplateMainCard component - TODO: Add full type definition */
    export const TemplateMainCard: any
    /** BaseEntityMenu component */
    export const BaseEntityMenu: any

    export interface TriggerProps {
        onClick: (e: React.MouseEvent<HTMLElement>) => void
        'aria-haspopup': 'true'
        disabled: boolean
    }
}

// ============================================================================
// Dialog Components (Fully Typed)
// ============================================================================

declare module '@universo/template-mui/components/dialogs' {
    import { FC, ReactNode } from 'react'

    /**
     * Props for EntityFormDialog component
     * Used for creating or editing entities with name and description
     */
    export interface EntityFormDialogProps {
        /** Controls whether the dialog is visible */
        open: boolean
        /** Dialog title */
        title: string
        /** Mode of the dialog: 'create' for new entities, 'edit' for existing ones (default: 'create') */
        mode?: 'create' | 'edit'
        /** Text for the save/submit button (default: "Save") */
        saveButtonText?: string
        /** Text for the save button while loading (default: "Saving...") */
        savingButtonText?: string
        /** Text for the cancel button (default: "Cancel") */
        cancelButtonText?: string
        /** Text for the delete button (only shown in 'edit' mode when showDeleteButton is true) */
        deleteButtonText?: string
        /** Label for the name field */
        nameLabel: string
        /** Label for the description field */
        descriptionLabel: string
        /** Placeholder text for name field */
        namePlaceholder?: string
        /** Placeholder text for description field */
        descriptionPlaceholder?: string
        /** Initial value for name field */
        initialName?: string
        /** Initial value for description field */
        initialDescription?: string
        /** Whether the form is in loading state */
        loading?: boolean
        /** Error message to display */
        error?: string
        /** Callback when dialog is closed/cancelled */
        onClose: () => void
        /** Callback when form is saved */
        onSave: (data: { name: string; description?: string } & Record<string, any>) => Promise<void> | void
        /** Show delete button in edit mode (default: false) */
        showDeleteButton?: boolean
        /** Callback when delete button is clicked (only in edit mode) */
        onDelete?: () => void | Promise<void>
        /** Function to render additional form fields */
        extraFields?: (helpers: {
            values: Record<string, any>
            setValue: (name: string, value: any) => void
            isLoading: boolean
        }) => ReactNode
        /** Initial values for extra fields */
        initialExtraValues?: Record<string, any>
        /** Custom validation function */
        validate?: (values: { name: string; description: string } & Record<string, any>) => Record<string, string> | null
    }

    /** EntityFormDialog component for creating/editing entities */
    export const EntityFormDialog: FC<EntityFormDialogProps>

    /**
     * Props for ConfirmDeleteDialog component
     * Used for confirming deletion of entities
     */
    export interface ConfirmDeleteDialogProps {
        /** Controls whether the dialog is visible */
        open: boolean
        /** Title of the dialog (e.g., "Delete Metaverse?") */
        title: string
        /** Detailed description or warning message */
        description: string
        /** Text for the confirm/delete button (default: "Delete") */
        confirmButtonText?: string
        /** Text shown on delete button while loading (e.g., "Deleting...") */
        deletingButtonText?: string
        /** Text for the cancel button (default: "Cancel") */
        cancelButtonText?: string
        /** Whether the delete operation is in progress */
        loading?: boolean
        /** Error message to display if deletion fails */
        error?: string
        /** Callback when the user cancels the dialog */
        onCancel: () => void
        /** Callback when the user confirms deletion */
        onConfirm: () => Promise<void> | void
        /** Name of the entity being deleted (for interpolation) */
        entityName?: string
        /** Type of entity being deleted (e.g., "metaverse", "cluster") - used for context */
        entityType?: string
    }

    /** ConfirmDeleteDialog component for confirming delete operations */
    export const ConfirmDeleteDialog: FC<ConfirmDeleteDialogProps>
}

declare module '@universo/template-mui/components/table/FlowListTable' {
    export const FlowListTable: any
}

declare module '@ui/ui-component/button/StyledButton' {
    export const StyledButton: any
}

declare module '@ui/store/actions' {
    export const enqueueSnackbar: any
}

declare module '@ui/utils/authProvider' {
    export const useAuth: any
}

declare module '@ui/hooks/useConfirm' {
    const useConfirm: any
    export default useConfirm
}
