import type { GridColDef } from '@mui/x-data-grid'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import TableRowsIcon from '@mui/icons-material/TableRows'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import type { AppDataResponse } from '../api/api'
import type { FieldConfig, FieldValidationRules } from '../components/dialogs/FormDialog'
import type { CellRendererOverrides } from '../api/types'
import {
    formatRuntimeColumnValue,
    formatRuntimeSafeFieldLabel,
    formatRuntimeSafeValue,
    isRuntimeSensitiveFieldName,
    isRuntimeTechnicalFieldName
} from './displayValue'
import { isSemanticLongTextRuntimeField } from './fieldSemantics'

export interface ToGridColumnsOptions {
    /** Callback fired when the row-actions "⋮" button is clicked. */
    onMenuOpen?: (event: React.MouseEvent<HTMLElement>, rowId: string) => void
    /** Accessible label for the actions button. */
    actionsAriaLabel?: string
    /** Row-aware accessible label for the actions button. */
    getRowActionsAriaLabel?: (row: Record<string, unknown>) => string
    /**
     * Per-dataType cell renderer overrides.
     * When provided, the matching override takes priority over the default renderer.
     * Used e.g. by ApplicationRuntime for inline BOOLEAN editing.
     */
    cellRenderers?: CellRendererOverrides
    locale?: string
}

const buildGridRowActionsTriggerTestId = (rowId: string) => `grid-row-actions-trigger-${rowId}`

const isHiddenColumn = (column: AppDataResponse['columns'][number]): boolean =>
    column.uiConfig?.hidden === true || column.uiConfig?.gridHidden === true

const isSensitiveGridColumn = (column: AppDataResponse['columns'][number]): boolean => {
    if (column.uiConfig?.sensitive === true || column.uiConfig?.private === true) return true
    return [column.field, column.codename, column.headerName].some((name) => typeof name === 'string' && isRuntimeSensitiveFieldName(name))
}

const INTERNAL_REFERENCE_LABEL_PATTERN = /\b(?:rh1\.[a-z\d._-]+|usr_internal_[a-z\d_-]+)/i

const isStructuredReferenceLabel = (value: string): boolean => {
    const trimmed = value.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
    try {
        const parsed: unknown = JSON.parse(trimmed)
        return parsed !== null && typeof parsed === 'object'
    } catch {
        return false
    }
}

const formatSafeReferenceLabel = (value: unknown, locale = 'en'): string => {
    const label = formatRuntimeSafeValue(value, locale)
    if (!label || isRuntimeTechnicalFieldName(label) || INTERNAL_REFERENCE_LABEL_PATTERN.test(label) || isStructuredReferenceLabel(label)) {
        return ''
    }
    return label
}

const getSafeReferenceOptions = (
    options: AppDataResponse['columns'][number]['refOptions'] | AppDataResponse['columns'][number]['enumOptions'],
    locale = 'en'
) =>
    (options ?? []).flatMap((option) => {
        const label = formatSafeReferenceLabel(option.label, locale)
        return label ? [{ ...option, label }] : []
    })

type RuntimeReferenceOptions = {
    refOptions?: AppDataResponse['columns'][number]['refOptions']
    enumOptions?: AppDataResponse['columns'][number]['enumOptions']
}

const getColumnReferenceOptions = (column: RuntimeReferenceOptions, locale = 'en') => {
    const refOptions = getSafeReferenceOptions(column.refOptions, locale)
    return refOptions.length > 0 ? refOptions : getSafeReferenceOptions(column.enumOptions, locale)
}

const hasHumanReadableReferenceOptions = (column: AppDataResponse['columns'][number], locale = 'en'): boolean =>
    column.dataType === 'REF' && !isRuntimeTechnicalFieldName(column.headerName) && getColumnReferenceOptions(column, locale).length > 0

/**
 * Technical fields are useful to the persistence contract but are not user-facing
 * business data. Reference IDs remain visible only when the API can render a
 * human-readable label for them.
 */
const isTechnicalGridColumn = (column: AppDataResponse['columns'][number], locale = 'en'): boolean => {
    if (hasHumanReadableReferenceOptions(column, locale)) return false
    return isRuntimeTechnicalFieldName(column.field) || isRuntimeTechnicalFieldName(column.codename)
}

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

const hasExplicitUserFacingStringWidget = (column: AppDataResponse['columns'][number]): boolean => {
    if (column.dataType !== 'STRING') return false

    const uiConfig = column.uiConfig ?? {}
    const rawOptions = uiConfig.stringOptions ?? uiConfig.options
    const hasLabeledOptions =
        Array.isArray(rawOptions) &&
        rawOptions.some(
            (option) =>
                isRecordValue(option) &&
                typeof option.value === 'string' &&
                option.value.trim().length > 0 &&
                Boolean(formatSafeReferenceLabel(option.label))
        )

    if (hasLabeledOptions) return true

    const rawPicker = uiConfig.runtimeRecordPicker
    const pickerConfig = isRecordValue(rawPicker) ? rawPicker : {}
    const widget =
        typeof uiConfig.widget === 'string' ? uiConfig.widget : typeof pickerConfig.widget === 'string' ? pickerConfig.widget : null
    const isRecordPicker = rawPicker === true || widget === 'runtimeRecordPicker' || widget === 'recordPicker'
    const targetObjectCodenameField =
        typeof pickerConfig.targetObjectCodenameField === 'string'
            ? pickerConfig.targetObjectCodenameField
            : typeof uiConfig.targetObjectCodenameField === 'string'
            ? uiConfig.targetObjectCodenameField
            : ''

    return isRecordPicker && targetObjectCodenameField.trim().length > 0
}

/**
 * Convert API column definitions into MUI DataGrid `GridColDef[]`.
 *
 * Optionally appends an "actions" column with a row-level "⋮" icon button
 * if `options.onMenuOpen` is provided.
 */
export function toGridColumns(response: AppDataResponse, options?: ToGridColumnsOptions): GridColDef[] {
    const locale = options?.locale ?? 'en'
    const cols: GridColDef[] = response.columns
        .filter((c) => !isHiddenColumn(c) && !isTechnicalGridColumn(c, locale) && !isSensitiveGridColumn(c))
        .map((c) => {
            // TABLE columns are virtual — not sortable/filterable, show chip
            if (c.dataType === 'TABLE') {
                return {
                    field: c.field,
                    headerName: c.headerName,
                    width: 140,
                    sortable: false,
                    filterable: false,
                    renderCell: (params) => {
                        const count = typeof params.value === 'number' ? params.value : 0
                        return <Chip label={`${count}`} size='small' variant='outlined' icon={<TableRowsIcon fontSize='small' />} />
                    }
                }
            }

            const safeRefOptions = c.dataType === 'REF' ? getColumnReferenceOptions(c, locale) : []
            const refOptionLabels = safeRefOptions.length > 0 ? new Map(safeRefOptions.map((option) => [option.id, option.label])) : null

            return {
                field: c.field,
                headerName: c.headerName,
                width: typeof c.uiConfig?.gridWidth === 'number' ? c.uiConfig.gridWidth : undefined,
                flex:
                    typeof c.uiConfig?.gridWidth === 'number'
                        ? undefined
                        : typeof c.uiConfig?.gridFlex === 'number'
                        ? c.uiConfig.gridFlex
                        : 1,
                minWidth: 140,
                sortable: c.uiConfig?.sortable !== false && c.uiConfig?.gridSortable !== false,
                filterable: c.uiConfig?.filterable !== false && c.uiConfig?.gridFilterable !== false,
                renderHeader:
                    c.dataType === 'BOOLEAN' && c.uiConfig?.headerAsCheckbox
                        ? () => <Checkbox size='small' disabled checked={false} indeterminate={false} sx={{ p: 0 }} title={c.headerName} />
                        : undefined,
                renderCell: (params) => {
                    // Check for consumer-provided cell renderer override
                    if (options?.cellRenderers?.[c.dataType]) {
                        return options.cellRenderers[c.dataType]({
                            value: params.value,
                            rowId: String(params.id),
                            field: c.field,
                            column: c
                        })
                    }
                    // Default rendering
                    if (c.dataType === 'BOOLEAN') {
                        return <Checkbox size='small' disabled checked={params.value === true} indeterminate={false} />
                    }
                    if (c.dataType === 'STRING' && (c.uiConfig?.widget === 'textarea' || isSemanticLongTextRuntimeField(c))) {
                        if (params.value === null || params.value === undefined) return ''
                        return (
                            <Box sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.5 }}>
                                {formatRuntimeSafeValue(params.value, locale)}
                            </Box>
                        )
                    }
                    if (c.dataType === 'REF' && refOptionLabels) {
                        let value = ''
                        if (typeof params.value === 'string') {
                            value = params.value
                        } else if (params.value && typeof params.value === 'object') {
                            const refObject = params.value as Record<string, unknown>
                            let objectLabel = ''
                            objectLabel = formatSafeReferenceLabel(refObject.label ?? refObject.name, locale)
                            if (objectLabel) {
                                return objectLabel
                            }
                            value = String(refObject.id ?? '')
                        }
                        if (!value) return ''

                        return refOptionLabels.get(value) ?? ''
                    }
                    if (params.value === null || params.value === undefined) return ''
                    return formatRuntimeColumnValue(c, params.value, locale)
                }
            }
        })

    if (options?.onMenuOpen) {
        const onMenuOpen = options.onMenuOpen
        cols.push({
            field: 'actions',
            headerName: options.actionsAriaLabel ?? 'Actions',
            width: 48,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            hideable: false,
            align: 'center',
            headerAlign: 'center',
            renderHeader: () => <MoreVertRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', opacity: 0.6 }} />,
            renderCell: (params) => (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%'
                    }}
                >
                    <IconButton
                        size='small'
                        data-testid={buildGridRowActionsTriggerTestId(String(params.row.id))}
                        aria-label={options.getRowActionsAriaLabel?.(params.row) ?? options.actionsAriaLabel ?? 'Actions'}
                        onClick={(e) => {
                            e.stopPropagation()
                            onMenuOpen(e, params.row.id as string)
                        }}
                        sx={{ width: 28, height: 28, p: 0.25 }}
                    >
                        <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>
            )
        })
    }

    return cols
}

/**
 * Convert API column definitions into `FieldConfig[]` for `FormDialog`.
 */
export function toFieldConfigs(response: AppDataResponse): FieldConfig[] {
    const synchronizedFieldNames = new Set<string>()
    for (const source of response.columns) {
        const rawTargets = source.uiConfig?.syncTargets ?? source.uiConfig?.syncTo
        const targets = Array.isArray(rawTargets) ? rawTargets : rawTargets ? [rawTargets] : []
        for (const target of targets) {
            const targetNames =
                typeof target === 'string' ? [target] : isRecordValue(target) ? [target.fieldId, target.manualFlagFieldId] : []
            for (const name of targetNames) {
                if (typeof name === 'string' && name.trim().length > 0) synchronizedFieldNames.add(name.trim().toLowerCase())
            }
        }
    }

    return response.columns
        .filter((c) => {
            if (c.uiConfig?.serverOwned === true) return false
            const isFormHidden = c.uiConfig?.hidden === true || c.uiConfig?.formHidden === true
            if (isFormHidden) {
                const hasDefaultValue = Object.prototype.hasOwnProperty.call(c.uiConfig ?? {}, 'defaultValue')
                const isSynchronizedField = [c.field, c.codename].some(
                    (alias) => typeof alias === 'string' && synchronizedFieldNames.has(alias.trim().toLowerCase())
                )
                return hasDefaultValue || isSynchronizedField
            }
            return !isTechnicalGridColumn(c) || hasExplicitUserFacingStringWidget(c)
        })
        .map((c) => {
            const refOptions = getColumnReferenceOptions(c)
            const enumOptions = getSafeReferenceOptions(c.enumOptions)
            return {
                id: c.field,
                codename: c.codename,
                label: formatRuntimeSafeFieldLabel(c.headerName),
                type: c.dataType as FieldConfig['type'],
                widget:
                    c.uiConfig?.widget === 'textarea' || (c.dataType === 'STRING' && isSemanticLongTextRuntimeField(c))
                        ? 'textarea'
                        : c.uiConfig?.widget === 'text'
                        ? 'text'
                        : undefined,
                multilineRows:
                    c.uiConfig?.widget === 'textarea' && typeof c.uiConfig?.rows === 'number' && Number.isInteger(c.uiConfig.rows)
                        ? c.uiConfig.rows
                        : undefined,
                required: c.isRequired,
                validationRules: (c.validationRules ?? {}) as FieldValidationRules,
                uiConfig: c.uiConfig ?? {},
                refTargetEntityId: c.refTargetEntityId ?? null,
                refTargetEntityKind: c.refTargetEntityKind ?? null,
                refTargetConstantId: c.refTargetConstantId ?? null,
                refSetConstantLabel: c.refTargetEntityKind === 'set' ? refOptions[0]?.label ?? null : null,
                refSetConstantDataType:
                    c.refTargetEntityKind === 'set' && c.uiConfig && typeof c.uiConfig.setConstantDataType === 'string'
                        ? c.uiConfig.setConstantDataType
                        : null,
                refOptions,
                enumOptions,
                enumPresentationMode:
                    c.refTargetEntityKind === 'set'
                        ? 'label'
                        : c.uiConfig?.enumPresentationMode === 'radio' || c.uiConfig?.enumPresentationMode === 'label'
                        ? c.uiConfig.enumPresentationMode
                        : 'select',
                defaultEnumValueId:
                    c.refTargetEntityKind === 'set'
                        ? c.refTargetConstantId ?? null
                        : typeof c.uiConfig?.defaultEnumValueId === 'string'
                        ? c.uiConfig.defaultEnumValueId
                        : null,
                enumAllowEmpty: c.refTargetEntityKind === 'set' ? false : c.uiConfig?.enumAllowEmpty !== false,
                enumLabelEmptyDisplay: c.uiConfig?.enumLabelEmptyDisplay === 'empty' ? 'empty' : 'dash',
                // TABLE-specific: child components and component UUID
                ...(c.dataType === 'TABLE' && c.childColumns
                    ? {
                          componentId: c.id,
                          childFields: c.childColumns.map((child) => {
                              const childRefOptions = getColumnReferenceOptions(child)
                              const childEnumOptions = getSafeReferenceOptions(child.enumOptions)
                              return {
                                  id: child.field,
                                  codename: child.codename,
                                  label: formatRuntimeSafeFieldLabel(child.headerName),
                                  type: child.dataType as FieldConfig['type'],
                                  required: child.isRequired,
                                  validationRules: (child.validationRules ?? {}) as FieldValidationRules,
                                  uiConfig: child.uiConfig ?? {},
                                  refTargetEntityId: child.refTargetEntityId ?? null,
                                  refTargetEntityKind: child.refTargetEntityKind ?? null,
                                  refTargetConstantId: child.refTargetConstantId ?? null,
                                  refSetConstantLabel: child.refTargetEntityKind === 'set' ? childRefOptions[0]?.label ?? null : null,
                                  refSetConstantDataType:
                                      child.refTargetEntityKind === 'set' &&
                                      child.uiConfig &&
                                      typeof child.uiConfig.setConstantDataType === 'string'
                                          ? child.uiConfig.setConstantDataType
                                          : null,
                                  refOptions: childRefOptions,
                                  enumOptions: childEnumOptions,
                                  enumPresentationMode:
                                      child.refTargetEntityKind === 'set'
                                          ? 'label'
                                          : child.uiConfig?.enumPresentationMode === 'radio' ||
                                            child.uiConfig?.enumPresentationMode === 'label'
                                          ? child.uiConfig.enumPresentationMode
                                          : 'select',
                                  defaultEnumValueId:
                                      child.refTargetEntityKind === 'set'
                                          ? child.refTargetConstantId ?? null
                                          : typeof child.uiConfig?.defaultEnumValueId === 'string'
                                          ? child.uiConfig.defaultEnumValueId
                                          : null,
                                  enumAllowEmpty: child.refTargetEntityKind === 'set' ? false : child.uiConfig?.enumAllowEmpty !== false,
                                  enumLabelEmptyDisplay: child.uiConfig?.enumLabelEmptyDisplay === 'empty' ? 'empty' : 'dash'
                              }
                          }),
                          tableUiConfig: c.uiConfig
                      }
                    : {})
            }
        })
}
