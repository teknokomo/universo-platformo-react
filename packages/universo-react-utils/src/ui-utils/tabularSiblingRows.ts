export type TabularSiblingField = {
    id: string
    codename?: string | null
}

export type TabularSiblingSelectConfig = {
    tableCodename: string
    valueFieldCodename: string
    labelFieldCodename: string
    requiredWithRows: boolean
}

export type TabularRowOrderingConfig = {
    orderFieldCodename: string
    labelFieldCodename: string
}

export type TabularSiblingRowSource<TRow extends Record<string, unknown> = Record<string, unknown>> = {
    rows: TRow[]
    childFields: TabularSiblingField[]
    rowOrdering?: unknown
}

export type TabularSiblingRowOption = { id: string; label: string }

const readConfigString = (value: unknown, key: string): string | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const candidate = (value as Record<string, unknown>)[key]
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

export const readTabularSiblingSelectConfig = (field: { uiConfig?: Record<string, unknown> }): TabularSiblingSelectConfig | null => {
    const config = field.uiConfig?.siblingRowSelect
    const tableCodename = readConfigString(config, 'tableCodename')
    const valueFieldCodename = readConfigString(config, 'valueFieldCodename')
    const labelFieldCodename = readConfigString(config, 'labelFieldCodename')
    const requiredWithRows = Boolean(
        config && typeof config === 'object' && !Array.isArray(config) && (config as Record<string, unknown>).requiredWithRows === true
    )
    return tableCodename && valueFieldCodename && labelFieldCodename
        ? { tableCodename, valueFieldCodename, labelFieldCodename, requiredWithRows }
        : null
}

export const readTabularRowOrderingConfig = (value: unknown): TabularRowOrderingConfig | null => {
    const orderFieldCodename = readConfigString(value, 'orderFieldCodename')
    const labelFieldCodename = readConfigString(value, 'labelFieldCodename')
    return orderFieldCodename && labelFieldCodename ? { orderFieldCodename, labelFieldCodename } : null
}

export const resolveTabularSiblingFieldValue = (row: Record<string, unknown>, fields: TabularSiblingField[], codename: string): unknown => {
    const field = fields.find((candidate) => candidate.codename === codename || candidate.id === codename)
    for (const key of [field?.id, field?.codename, codename]) {
        if (key && Object.prototype.hasOwnProperty.call(row, key)) return row[key]
    }
    return undefined
}

const resolveOrderField = (fields: TabularSiblingField[], config: TabularRowOrderingConfig) =>
    fields.find((field) => field.codename === config.orderFieldCodename || field.id === config.orderFieldCodename)

export const hasTabularRowOrderingField = (fields: TabularSiblingField[], config: TabularRowOrderingConfig | null): boolean =>
    Boolean(config && resolveOrderField(fields, config))

export const sortTabularSiblingRows = <TRow extends Record<string, unknown>>(
    rows: TRow[],
    rawConfig: unknown,
    childFields: TabularSiblingField[]
): TRow[] => {
    const config = readTabularRowOrderingConfig(rawConfig)
    const orderField = config && resolveOrderField(childFields, config)
    if (!config || !orderField) return [...rows]

    return rows
        .map((row, index) => {
            const value = resolveTabularSiblingFieldValue(row, [orderField], config.orderFieldCodename)
            const order = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
            return { row, index, order }
        })
        .sort((left, right) => {
            const leftValid = Number.isFinite(left.order)
            const rightValid = Number.isFinite(right.order)
            if (leftValid && rightValid && left.order !== right.order) return left.order - right.order
            if (leftValid !== rightValid) return leftValid ? -1 : 1
            return left.index - right.index
        })
        .map(({ row }) => row)
}

export const normalizeTabularSiblingRowOrder = <TRow extends Record<string, unknown>>(
    rows: TRow[],
    rawConfig: unknown,
    childFields: TabularSiblingField[]
): TRow[] => {
    const config = readTabularRowOrderingConfig(rawConfig)
    const orderField = config && resolveOrderField(childFields, config)
    if (!config || !orderField) return rows
    return rows.map((row, index) => ({ ...row, [orderField.id]: index + 1 }))
}

export const isSafeTabularSiblingLabel = (value: string): boolean => {
    const label = value.trim()
    if (!label || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(label)) return false
    if (label.startsWith('{') || label.startsWith('[')) {
        try {
            const parsed: unknown = JSON.parse(label)
            if (parsed !== null && typeof parsed === 'object') return false
        } catch {
            // Plain titles may legitimately contain unmatched braces.
        }
    }
    return true
}

export const buildTabularSiblingRowOptions = <TRow extends Record<string, unknown>>(params: {
    field: { uiConfig?: Record<string, unknown> }
    siblingTables: Record<string, TabularSiblingRowSource<TRow>> | undefined
    formatLabel: (value: unknown) => string
}): TabularSiblingRowOption[] => {
    const config = readTabularSiblingSelectConfig(params.field)
    const source = config ? params.siblingTables?.[config.tableCodename] : undefined
    if (!config || !source) return []

    const seen = new Set<string>()
    const options = sortTabularSiblingRows(source.rows, source.rowOrdering, source.childFields).flatMap((row) => {
        const rawId = resolveTabularSiblingFieldValue(row, source.childFields, config.valueFieldCodename)
        if (typeof rawId !== 'string' || !rawId.trim()) return []
        const id = rawId.trim()
        const identity = id.toLowerCase()
        if (seen.has(identity)) return []
        const label = params.formatLabel(resolveTabularSiblingFieldValue(row, source.childFields, config.labelFieldCodename)).trim()
        if (!isSafeTabularSiblingLabel(label)) return []
        seen.add(identity)
        return [{ id, label }]
    })

    const labelCounts = new Map<string, number>()
    for (const option of options) {
        const normalizedLabel = option.label.toLowerCase()
        labelCounts.set(normalizedLabel, (labelCounts.get(normalizedLabel) ?? 0) + 1)
    }

    const labelIndices = new Map<string, number>()
    return options.map((option) => {
        const normalizedLabel = option.label.toLowerCase()
        if ((labelCounts.get(normalizedLabel) ?? 0) < 2) return option
        const labelIndex = (labelIndices.get(normalizedLabel) ?? 0) + 1
        labelIndices.set(normalizedLabel, labelIndex)
        return { ...option, label: `${option.label} (${labelIndex})` }
    })
}
