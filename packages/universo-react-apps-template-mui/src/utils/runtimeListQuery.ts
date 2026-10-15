import type { GridFilterModel, GridSortModel } from '@mui/x-data-grid'
import type { RuntimeDatasourceFilter, RuntimeDatasourceSort } from '@universo-react/types'

type DateComposition = 'date' | 'time' | 'datetime'

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
        case 'after':
            return 'greaterThan'
        case '>=':
        case 'onOrAfter':
            return 'greaterThanOrEqual'
        case '<':
        case 'before':
            return 'lessThan'
        case '<=':
        case 'onOrBefore':
            return 'lessThanOrEqual'
        default:
            return null
    }
}

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/u

// Report cells render timestamps in UTC; parse datetime-local wall-clock fields as UTC regardless of browser timezone.
const serializeUtcDateTimeFilterValue = (value: string): string | undefined => {
    const match = LOCAL_DATE_TIME_PATTERN.exec(value)
    if (!match) return undefined

    const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue = '0', millisecondValue = '0'] = match
    const year = Number(yearValue)
    const month = Number(monthValue)
    const day = Number(dayValue)
    const hour = Number(hourValue)
    const minute = Number(minuteValue)
    const second = Number(secondValue)
    const millisecond = Number(millisecondValue.padEnd(3, '0'))
    const date = new Date(0)
    date.setUTCFullYear(year, month - 1, day)
    date.setUTCHours(hour, minute, second, millisecond)

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day ||
        date.getUTCHours() !== hour ||
        date.getUTCMinutes() !== minute ||
        date.getUTCSeconds() !== second ||
        date.getUTCMilliseconds() !== millisecond
    ) {
        return undefined
    }

    return date.toISOString()
}

const serializeDateTimeFilterValue = (value: unknown, dateComposition?: DateComposition): unknown => {
    if (value instanceof Date) {
        if (!Number.isFinite(value.getTime())) return undefined
        if (dateComposition === 'date') {
            // MUI parses its date input as UTC midnight, so use UTC calendar fields to avoid UTC− day shifts.
            const year = String(value.getUTCFullYear()).padStart(4, '0')
            const month = String(value.getUTCMonth() + 1).padStart(2, '0')
            const day = String(value.getUTCDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
        }
        if (dateComposition === 'datetime') {
            const year = String(value.getFullYear()).padStart(4, '0')
            const month = String(value.getMonth() + 1).padStart(2, '0')
            const day = String(value.getDate()).padStart(2, '0')
            const hours = String(value.getHours()).padStart(2, '0')
            const minutes = String(value.getMinutes()).padStart(2, '0')
            const seconds = String(value.getSeconds()).padStart(2, '0')
            const milliseconds = String(value.getMilliseconds()).padStart(3, '0')
            return serializeUtcDateTimeFilterValue(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`)
        }
        return value.toISOString()
    }
    if (dateComposition && typeof value === 'string' && LOCAL_DATE_TIME_PATTERN.test(value)) {
        return dateComposition === 'date' ? undefined : serializeUtcDateTimeFilterValue(value)
    }
    return value
}

export const mapGridFilterModel = (
    model: GridFilterModel,
    dateCompositions?: ReadonlyMap<string, DateComposition>
): RuntimeDatasourceFilter[] =>
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
                const value = serializeDateTimeFilterValue(item.value, dateCompositions?.get(item.field))
                if (value === undefined) return null
                filter.value = value
            }
            return filter
        })
        .filter((item): item is RuntimeDatasourceFilter => item !== null)
