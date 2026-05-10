import type { GridFilterModel, GridSortModel } from '@mui/x-data-grid'
import type { RuntimeDatasourceFilter, RuntimeDatasourceSort } from '@universo/types'

export const mapGridSortModel = (model: GridSortModel): RuntimeDatasourceSort[] =>
    model
        .filter((item) => typeof item.field === 'string' && (item.sort === 'asc' || item.sort === 'desc'))
        .map((item) => ({
            field: item.field,
            direction: item.sort as RuntimeDatasourceSort['direction']
        }))

const mapGridFilterOperator = (operator: string | undefined): RuntimeDatasourceFilter['operator'] | null => {
    switch (operator) {
        case 'contains':
            return 'contains'
        case 'equals':
        case 'is':
        case '=':
            return 'equals'
        case 'startsWith':
            return 'startsWith'
        case 'endsWith':
            return 'endsWith'
        case 'isEmpty':
            return 'isEmpty'
        case 'isNotEmpty':
            return 'isNotEmpty'
        case '>':
            return 'greaterThan'
        case '>=':
            return 'greaterThanOrEqual'
        case '<':
            return 'lessThan'
        case '<=':
            return 'lessThanOrEqual'
        default:
            return null
    }
}

export const mapGridFilterModel = (model: GridFilterModel): RuntimeDatasourceFilter[] =>
    (model.items ?? [])
        .map((item) => {
            if (!item.field) return null
            const operator = mapGridFilterOperator(item.operator)
            if (!operator) return null
            const filter: RuntimeDatasourceFilter = {
                field: item.field,
                operator
            }
            if (item.value !== undefined) {
                filter.value = item.value
            }
            return filter
        })
        .filter((item): item is RuntimeDatasourceFilter => item !== null)
