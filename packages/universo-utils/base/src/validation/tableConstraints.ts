/**
 * Shared utility for building TABLE attribute constraint text.
 * Used in DynamicEntityFormDialog, FormDialog, and InlineTableEditor
 * to display helper text about row count requirements.
 */

/**
 * A lightweight translate function signature compatible with react-i18next's t().
 * Uses a broad second parameter to support TFunction's multiple overloads.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TranslateFn = (key: string, defaultValueOrOptions?: any) => string

export interface TableConstraintParams {
    /** Whether the field is marked as required (defaults to false) */
    required?: boolean
    /** Minimum number of rows (from validationRules.minRows) */
    minRows?: number | null
    /** Maximum number of rows (from validationRules.maxRows) */
    maxRows?: number | null
    /** Translation function (i18next t() or equivalent) */
    t: TranslateFn
}

export interface TableConstraintResult {
    /** Comma-joined constraint text, or null if no constraints */
    helperText: string | null
    /** Effective minimum required rows for missing-check */
    minRequired: number | null | undefined
    /** Whether the field is considered missing given the current row count */
    isMissing: (rowCount: number) => boolean
}

/**
 * Builds TABLE constraint helper text from required/minRows/maxRows configuration.
 *
 * Output format:
 *   required + min + max → "Required: min. rows: 2, max. rows: 3"
 *   required + min      → "Required: min. rows: 2"
 *   required only       → "Required: min. rows: 1"
 *   min + max            → "Min. rows: 2, max. rows: 3"
 *   min only             → "Min. rows: 2"
 *   max only             → "Max. rows: 3"
 *
 * @example
 * const { helperText, isMissing } = buildTableConstraintText({
 *     required: true, minRows: 2, maxRows: 10, t
 * })
 */
export function buildTableConstraintText(params: TableConstraintParams): TableConstraintResult {
    const { required = false, minRows, maxRows, t } = params
    const minRequired = required ? Math.max(1, minRows ?? 1) : minRows

    const parts: string[] = []

    if (typeof minRequired === 'number' && minRequired > 0) {
        parts.push(
            t('validation.tableMinRows', { defaultValue: 'min. rows: {{count}}', count: minRequired })
        )
    }

    if (typeof maxRows === 'number' && maxRows > 0) {
        parts.push(
            t('validation.tableMaxRows', { defaultValue: 'max. rows: {{count}}', count: maxRows })
        )
    }

    let helperText: string | null = null

    if (parts.length > 0) {
        const constraintStr = parts.join(', ')
        if (required) {
            const prefix = t('validation.tableRequiredPrefix', 'Required')
            helperText = `${prefix}: ${constraintStr}`
        } else {
            // Capitalize the first letter when not prefixed with "Required:"
            helperText = constraintStr.charAt(0).toUpperCase() + constraintStr.slice(1)
        }
    }

    return {
        helperText,
        minRequired,
        isMissing: (rowCount: number) => required && rowCount < (minRequired ?? 1)
    }
}
