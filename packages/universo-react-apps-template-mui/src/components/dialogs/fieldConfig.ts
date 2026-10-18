export type FieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'REF' | 'JSON' | 'TABLE'

/**
 * Validation rules for form fields.
 * Matches component validation rules from @universo-react/types.
 */
export interface FieldValidationRules extends Record<string, unknown> {
    // STRING settings
    minLength?: number | null
    maxLength?: number | null
    versioned?: boolean
    localized?: boolean

    // NUMBER settings
    precision?: number
    scale?: number
    min?: number | null
    max?: number | null
    nonNegative?: boolean

    // DATE settings
    dateComposition?: 'date' | 'time' | 'datetime'

    // TABLE settings
    minRows?: number | null
    maxRows?: number | null
    matrixUniqueCoordinates?: boolean
}

export interface FieldConfig {
    id: string
    codename?: string
    label: string
    type: FieldType
    widget?: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'datetime' | 'reference'
    multilineRows?: number
    required?: boolean
    /** @deprecated Use validationRules.localized instead */
    localized?: boolean
    placeholder?: string
    helperText?: string
    validationRules?: FieldValidationRules
    /** Optional target entity ID for REF fields */
    refTargetEntityId?: string | null
    /** Optional target entity kind for REF fields */
    refTargetEntityKind?: string | null
    /** Optional target constant ID for REF fields pointing to sets. */
    refTargetConstantId?: string | null
    /** Precomputed display label for REF fields pointing to sets. */
    refSetConstantLabel?: string | null
    /** Data type of selected set constant (for diagnostics/UI hints). */
    refSetConstantDataType?: string | null
    /** Runtime options for REF fields (object/enumeration). */
    refOptions?: Array<{
        id: string
        label: string
        codename?: string
        isDefault?: boolean
        sortOrder?: number
    }>
    /** Runtime options for REF->enumeration fields. */
    enumOptions?: Array<{
        id: string
        label: string
        codename?: string
        isDefault?: boolean
        sortOrder?: number
    }>
    /** REF->enumeration presentation mode. */
    enumPresentationMode?: 'select' | 'radio' | 'label'
    /** Optional default enumeration value id. */
    defaultEnumValueId?: string | null
    /** Controls whether empty value can be selected for enumeration references. */
    enumAllowEmpty?: boolean
    /** Defines how empty label-mode value should be rendered. */
    enumLabelEmptyDisplay?: 'empty' | 'dash'
    /** Child components for TABLE-type components. */
    childFields?: FieldConfig[]
    /** UI configuration for TABLE-type components. */
    tableUiConfig?: Record<string, unknown>
    /** Generic UI configuration copied from the metadata component definition. */
    uiConfig?: Record<string, unknown>
    /** Original component UUID — used for TABLE-type API calls (tabular part endpoint). */
    componentId?: string
}
