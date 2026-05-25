import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GridColDef, GridColumnVisibilityModel } from '@mui/x-data-grid'
import { isRuntimeTechnicalFieldName } from '../utils/displayValue'

export interface RuntimeColumnVisibilityOption {
    field: string
    label: string
    visible: boolean
    disabled?: boolean
}

const STORAGE_PREFIX = 'apps-template.columns'

export const isRuntimeControlColumn = (field: string): boolean => field === 'actions' || field.startsWith('__runtime')

export const isRuntimeTechnicalGridColumn = (column: GridColDef): boolean => {
    const field = String(column.field ?? '').trim()
    if (!field) return true
    if (isRuntimeControlColumn(field)) return false
    if (field.startsWith('__')) return true
    return isRuntimeTechnicalFieldName(field)
}

export const isRuntimeUserFacingGridColumn = (column: GridColDef): boolean => !isRuntimeTechnicalGridColumn(column)

const isUserConfigurableColumn = (column: GridColDef): boolean => {
    if (isRuntimeControlColumn(String(column.field ?? ''))) return false
    if (column.hideable === false) return false
    if (isRuntimeTechnicalGridColumn(column)) return false
    return Boolean(String(column.headerName ?? column.field ?? '').trim())
}

const sanitizeStoredModel = (value: unknown): GridColumnVisibilityModel => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

    return Object.entries(value as Record<string, unknown>).reduce<GridColumnVisibilityModel>((acc, [field, visible]) => {
        if (typeof visible === 'boolean') {
            acc[field] = visible
        }
        return acc
    }, {})
}

export const buildRuntimeColumnVisibilityOptions = (
    columns: GridColDef[],
    model: GridColumnVisibilityModel
): RuntimeColumnVisibilityOption[] =>
    columns.filter(isUserConfigurableColumn).map((column) => {
        const field = String(column.field)
        return {
            field,
            label: String(column.headerName ?? column.field),
            visible: model[field] !== false
        }
    })

export const createSafeRuntimeColumnVisibilityModel = (
    columns: GridColDef[],
    candidateModel: GridColumnVisibilityModel
): GridColumnVisibilityModel => {
    const nextModel: GridColumnVisibilityModel = {}
    const configurableFields = columns.filter(isUserConfigurableColumn).map((column) => String(column.field))

    for (const column of columns) {
        const field = String(column.field)
        if (isRuntimeTechnicalGridColumn(column)) {
            nextModel[field] = false
            continue
        }
        if (configurableFields.includes(field) && candidateModel[field] === false) {
            nextModel[field] = false
        }
    }

    if (configurableFields.length > 0 && configurableFields.every((field) => nextModel[field] === false)) {
        nextModel[configurableFields[0]] = true
    }

    return nextModel
}

export function useRuntimeColumnVisibilityPreference(key: string, columns: GridColDef[]) {
    const storageKey = `${STORAGE_PREFIX}.${key}`
    const [storedModel, setStoredModel] = useState<GridColumnVisibilityModel>({})

    useEffect(() => {
        if (typeof window === 'undefined') {
            setStoredModel({})
            return
        }

        try {
            setStoredModel(sanitizeStoredModel(JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')))
        } catch {
            setStoredModel({})
        }
    }, [storageKey])

    const columnVisibilityModel = useMemo(() => createSafeRuntimeColumnVisibilityModel(columns, storedModel), [columns, storedModel])

    const columnVisibilityOptions = useMemo(
        () => buildRuntimeColumnVisibilityOptions(columns, columnVisibilityModel),
        [columns, columnVisibilityModel]
    )

    const setColumnVisibilityModel = useCallback(
        (nextCandidateModel: GridColumnVisibilityModel) => {
            const safeModel = createSafeRuntimeColumnVisibilityModel(columns, nextCandidateModel)
            const configurableFields = new Set(buildRuntimeColumnVisibilityOptions(columns, safeModel).map((option) => option.field))
            const nextStoredModel = Object.entries(safeModel).reduce<GridColumnVisibilityModel>((acc, [field, visible]) => {
                if (configurableFields.has(field)) {
                    acc[field] = visible
                }
                return acc
            }, {})

            setStoredModel(nextStoredModel)
            if (typeof window !== 'undefined') {
                try {
                    window.localStorage.setItem(storageKey, JSON.stringify(nextStoredModel))
                } catch {
                    // Ignore storage failures; the current runtime state remains visible.
                }
            }
        },
        [columns, storageKey]
    )

    return useMemo(
        () => [columnVisibilityModel, setColumnVisibilityModel, columnVisibilityOptions] as const,
        [columnVisibilityModel, columnVisibilityOptions, setColumnVisibilityModel]
    )
}
