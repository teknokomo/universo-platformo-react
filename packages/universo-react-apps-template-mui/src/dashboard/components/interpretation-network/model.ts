import { buildVLC, createLocalizedContent, generateUuidV7 } from '@universo-react/utils'
import type { AppDataResponse } from '../../../api/api'
import type { FieldConfig, FieldType } from '../../../components/dialogs/FormDialog'
import { formatRuntimeSafeValue } from '../../../utils/displayValue'

export type RuntimeRow = Record<string, unknown> & { id: string }

export type RuntimeColumnLike = {
    id?: string
    codename?: string
    field?: string
    dataType?: string
    headerName?: string
    isRequired?: boolean
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    refTargetEntityId?: string | null
    refTargetEntityKind?: string | null
    refTargetConstantId?: string | null
    refOptions?: Array<{ id: string; label: string; codename?: string; isDefault?: boolean }>
    enumOptions?: Array<{ id: string; label: string; codename?: string; isDefault?: boolean }>
    childColumns?: RuntimeColumnLike[]
}

type RuntimeDataset = Pick<AppDataResponse, 'section' | 'columns' | 'rows'>

export type InterpretationNetworkWorkspaceConfig = {
    conceptCodename?: string
    interpretationCodename?: string
    relationCodename?: string
    materialCodename?: string
    tableTemplateCodename?: string
    matrixField?: string
    materialTitleField?: string
    conceptNameField?: string
    conceptDescriptionField?: string
    interpretationTitleField?: string
    interpretationParentField?: string
    tableTemplateNameField?: string
    tableTemplateDescriptionField?: string
    tableTemplateMatrixField?: string
    matrixMode?: MatrixMode
    hierarchyLayout?: MatrixHierarchyLayout
    hierarchyRowMode?: MatrixHierarchyRowMode
    positionNumbering?: MatrixPositionNumberingConfig
}

export type MatrixCell = {
    id: string
    rawRowId: string
    sortOrder: number
    parentCellId: string | null
    depth: number
    rowKey: string
    rowLabel: string
    colKey: string
    colLabel: string
    title: string
    description: string
    materialRef: string | null
    style: {
        fill: string | null
        borderTop: string
        borderRight: string
        borderBottom: string
        borderLeft: string
    }
}

export const MATRIX_MODES = ['hierarchicalCells', 'independentRows'] as const
export type MatrixMode = (typeof MATRIX_MODES)[number]

export const MATRIX_HIERARCHY_LAYOUTS = ['horizontalRows', 'verticalTree'] as const
export type MatrixHierarchyLayout = (typeof MATRIX_HIERARCHY_LAYOUTS)[number]

export const MATRIX_HIERARCHY_ROW_MODES = ['focusedPath', 'allNodes'] as const
export type MatrixHierarchyRowMode = (typeof MATRIX_HIERARCHY_ROW_MODES)[number]

export type MatrixPositionNumberingConfig = {
    enabled: boolean
    includeRoot: boolean
    startIndex: number
}

export const parseMatrixMode = (value: unknown): MatrixMode =>
    value === 'independentRows' || value === 'hierarchicalCells' ? value : 'hierarchicalCells'

export const parseMatrixHierarchyLayout = (value: unknown): MatrixHierarchyLayout =>
    value === 'verticalTree' || value === 'horizontalRows' ? value : 'horizontalRows'

export const parseMatrixHierarchyRowMode = (value: unknown): MatrixHierarchyRowMode =>
    value === 'allNodes' || value === 'focusedPath' ? value : 'focusedPath'

export const parseMatrixPositionNumbering = (value: unknown): MatrixPositionNumberingConfig => {
    if (!isRecord(value)) {
        return { enabled: true, includeRoot: true, startIndex: 1 }
    }

    const rawStartIndex = value.startIndex
    return {
        enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
        includeRoot: typeof value.includeRoot === 'boolean' ? value.includeRoot : true,
        startIndex: typeof rawStartIndex === 'number' && Number.isInteger(rawStartIndex) && rawStartIndex >= 0 ? rawStartIndex : 1
    }
}

const DEFAULT_CONFIG: Required<InterpretationNetworkWorkspaceConfig> = {
    conceptCodename: 'Structure',
    interpretationCodename: 'Interpretation',
    relationCodename: 'Relation',
    materialCodename: 'Material',
    tableTemplateCodename: 'TableTemplate',
    matrixField: 'InterpretationMatrix',
    materialTitleField: 'Title',
    conceptNameField: 'Name',
    conceptDescriptionField: 'Description',
    interpretationTitleField: 'Title',
    interpretationParentField: 'ParentStructure',
    tableTemplateNameField: 'Name',
    tableTemplateDescriptionField: 'Description',
    tableTemplateMatrixField: 'TemplateMatrix',
    matrixMode: 'hierarchicalCells',
    hierarchyLayout: 'horizontalRows',
    hierarchyRowMode: 'focusedPath',
    positionNumbering: { enabled: true, includeRoot: true, startIndex: 1 }
}

const CELL_COLOR_HEX: Record<string, string | null> = {
    none: null,
    gray: '#9e9e9e',
    red: '#e53935',
    orange: '#fb8c00',
    yellow: '#fdd835',
    green: '#43a047',
    teal: '#00897b',
    blue: '#1e88e5',
    indigo: '#3949ab',
    purple: '#8e24aa',
    pink: '#d81b60',
    black: '#212121'
}

const BORDER_STYLE_DEFAULT = '1px solid rgba(0, 0, 0, 0.12)'
const BORDER_STYLE_NONE = '0 solid transparent'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const toConfig = (config: Record<string, unknown> | undefined): Required<InterpretationNetworkWorkspaceConfig> => ({
    ...DEFAULT_CONFIG,
    ...Object.fromEntries(
        Object.entries(config ?? {}).filter(
            ([key, value]) =>
                key !== 'matrixMode' &&
                key !== 'hierarchyLayout' &&
                key !== 'hierarchyRowMode' &&
                key !== 'positionNumbering' &&
                typeof value === 'string' &&
                value.trim().length > 0
        )
    ),
    matrixMode: parseMatrixMode(config?.matrixMode),
    hierarchyLayout: parseMatrixHierarchyLayout(config?.hierarchyLayout),
    hierarchyRowMode: parseMatrixHierarchyRowMode(config?.hierarchyRowMode),
    positionNumbering: parseMatrixPositionNumbering(config?.positionNumbering)
})

const readRowValue = (row: Record<string, unknown> | undefined, field: string): unknown => {
    if (!row) return undefined
    if (Object.prototype.hasOwnProperty.call(row, field)) return row[field]
    const data = row.data
    if (isRecord(data) && Object.prototype.hasOwnProperty.call(data, field)) return data[field]
    return undefined
}

const readText = (value: unknown, locale: string): string => formatRuntimeSafeValue(value, locale) || ''

export const findColumn = (columns: RuntimeColumnLike[] | undefined, codename: string): RuntimeColumnLike | undefined =>
    (columns ?? []).find((column) => column.codename === codename || column.field === codename)

const resolveField = (columns: RuntimeColumnLike[] | undefined, codename: string): string =>
    findColumn(columns, codename)?.field ?? codename

export const readColumnValue = (
    row: Record<string, unknown> | undefined,
    columns: RuntimeColumnLike[] | undefined,
    codename: string
): unknown => readRowValue(row, resolveField(columns, codename))

export const readColumnText = (
    row: RuntimeRow | undefined,
    columns: RuntimeColumnLike[] | undefined,
    codename: string,
    locale: string
): string => readText(readColumnValue(row, columns, codename), locale)

export const resolveMatrixCellId = (
    rawCell: Record<string, unknown>,
    childColumns: RuntimeColumnLike[] | undefined,
    index: number
): string => {
    const rawCellId = readColumnValue(rawCell, childColumns, 'CellId')
    return typeof rawCellId === 'string' && rawCellId.trim() ? rawCellId.trim() : `cell-${index}`
}

export const findOptionIdByCodename = (field: RuntimeColumnLike | undefined, codename: string): string | null =>
    [...(field?.refOptions ?? []), ...(field?.enumOptions ?? [])].find((option) => option.codename === codename || option.id === codename)
        ?.id ?? null

const getOptionCodename = (field: RuntimeColumnLike | undefined, value: unknown): string => {
    if (typeof value !== 'string' || !value.trim()) return 'none'
    const normalized = value.trim()
    const option = [...(field?.refOptions ?? []), ...(field?.enumOptions ?? [])].find(
        (candidate) => candidate.id === normalized || candidate.codename === normalized || candidate.label === normalized
    )
    return option?.codename ?? normalized
}

const toBorderCss = (colorValue: unknown, widthValue: unknown, styleValue: unknown, field: RuntimeColumnLike | undefined): string => {
    const colorCodename = getOptionCodename(field, colorValue)
    const hasWidth = typeof widthValue === 'string' && widthValue.trim().length > 0
    const hasLineStyle = typeof styleValue === 'string' && styleValue.trim().length > 0
    const width = hasWidth ? widthValue.trim() : '1px'
    const lineStyle = hasLineStyle ? styleValue.trim() : 'solid'
    const color = CELL_COLOR_HEX[colorCodename] ?? 'transparent'
    if ((hasWidth && width === '0') || (hasLineStyle && lineStyle === 'none')) return BORDER_STYLE_NONE
    if (!hasWidth && !hasLineStyle) return BORDER_STYLE_DEFAULT
    return `${width} ${lineStyle} ${color}`
}

export const toMatrixRows = (rawMatrixRows: unknown[], matrixColumn: RuntimeColumnLike | undefined, locale: string): MatrixCell[] => {
    const childColumns = matrixColumn?.childColumns ?? []
    const colorField = (field: string) => findColumn(childColumns, field)
    const readCellValue = (rawCell: Record<string, unknown>, codename: string): unknown => readColumnValue(rawCell, childColumns, codename)
    const readCellText = (rawCell: Record<string, unknown>, codename: string): string => readText(readCellValue(rawCell, codename), locale)

    return rawMatrixRows.flatMap((rawCell, index) => {
        if (!isRecord(rawCell)) return []
        const rawRowKey = readCellValue(rawCell, 'RowKey')
        const rawColKey = readCellValue(rawCell, 'ColKey')
        const rawMaterialRef = readCellValue(rawCell, 'MaterialRef')
        const rawParentCellId = readCellValue(rawCell, 'ParentCellId')
        const cellId = resolveMatrixCellId(rawCell, childColumns, index)
        const rawSortOrder = readCellValue(rawCell, '_tp_sort_order')
        const fillCodename = getOptionCodename(colorField('CellFillColor'), readCellValue(rawCell, 'CellFillColor'))
        return [
            {
                id: cellId,
                rawRowId: typeof rawCell.id === 'string' ? rawCell.id : cellId,
                sortOrder: typeof rawSortOrder === 'number' && Number.isFinite(rawSortOrder) ? rawSortOrder : index,
                parentCellId: typeof rawParentCellId === 'string' && rawParentCellId.trim() ? rawParentCellId.trim() : null,
                depth: 0,
                rowKey: typeof rawRowKey === 'string' && rawRowKey.trim() ? rawRowKey.trim() : `row-${index}`,
                rowLabel: readCellText(rawCell, 'RowLabel') || `Row ${index + 1}`,
                colKey: typeof rawColKey === 'string' && rawColKey.trim() ? rawColKey.trim() : `col-${index}`,
                colLabel: readCellText(rawCell, 'ColLabel') || `Column ${index + 1}`,
                title: readCellText(rawCell, 'CellValue'),
                description: readCellText(rawCell, 'CellDescription'),
                materialRef: typeof rawMaterialRef === 'string' && rawMaterialRef.trim() ? rawMaterialRef.trim() : null,
                style: {
                    fill: CELL_COLOR_HEX[fillCodename],
                    borderTop: toBorderCss(
                        readCellValue(rawCell, 'BorderTopColor'),
                        readCellValue(rawCell, 'BorderTopWidth'),
                        readCellValue(rawCell, 'BorderTopStyle'),
                        colorField('BorderTopColor')
                    ),
                    borderRight: toBorderCss(
                        readCellValue(rawCell, 'BorderRightColor'),
                        readCellValue(rawCell, 'BorderRightWidth'),
                        readCellValue(rawCell, 'BorderRightStyle'),
                        colorField('BorderRightColor')
                    ),
                    borderBottom: toBorderCss(
                        readCellValue(rawCell, 'BorderBottomColor'),
                        readCellValue(rawCell, 'BorderBottomWidth'),
                        readCellValue(rawCell, 'BorderBottomStyle'),
                        colorField('BorderBottomColor')
                    ),
                    borderLeft: toBorderCss(
                        readCellValue(rawCell, 'BorderLeftColor'),
                        readCellValue(rawCell, 'BorderLeftWidth'),
                        readCellValue(rawCell, 'BorderLeftStyle'),
                        colorField('BorderLeftColor')
                    )
                }
            }
        ]
    })
}

export const buildDefaultMatrixCellData = (
    childColumns: RuntimeColumnLike[] | undefined,
    locale: string,
    labels: {
        row: string
        column: string
        value?: string
        rowKey?: string
        colKey?: string
        localizedValue?: ReturnType<typeof buildVLC>
        parentCellId?: string | null
    }
): Record<string, unknown> => {
    const colorField = (field: string) => findColumn(childColumns, field)
    const noneColorId = findOptionIdByCodename(colorField('CellFillColor'), 'none') ?? null
    const data: Record<string, unknown> = {
        CellId: generateUuidV7(),
        ColKey: labels.colKey ?? `column-${generateUuidV7()}`,
        ColLabel: labels.localizedValue ?? createLocalizedContent(locale, labels.column),
        RowKey: labels.rowKey ?? `row-${generateUuidV7()}`,
        RowLabel: labels.localizedValue ?? createLocalizedContent(locale, labels.row),
        CellValue: labels.localizedValue ?? createLocalizedContent(locale, labels.value ?? labels.column),
        CellDescription: createLocalizedContent(locale, ''),
        CellFillColor: noneColorId,
        BorderTopColor: noneColorId,
        BorderRightColor: noneColorId,
        BorderBottomColor: noneColorId,
        BorderLeftColor: noneColorId,
        BorderTopWidth: '1px',
        BorderRightWidth: '1px',
        BorderBottomWidth: '1px',
        BorderLeftWidth: '1px',
        BorderTopStyle: 'solid',
        BorderRightStyle: 'solid',
        BorderBottomStyle: 'solid',
        BorderLeftStyle: 'solid',
        MaterialRef: null,
        ParentCellId: labels.parentCellId ?? null
    }
    return data
}

export const buildRootUniverseMatrixCellData = (childColumns: RuntimeColumnLike[] | undefined, locale: string): Record<string, unknown> =>
    buildDefaultMatrixCellData(childColumns, locale, {
        row: 'Universe',
        column: 'Universe',
        value: 'Universe',
        localizedValue: buildVLC('Universe', 'Вселенная')
    })

export type MatrixTreeNode = MatrixCell & { children: MatrixTreeNode[] }

export const buildMatrixTree = (cells: MatrixCell[]): MatrixTreeNode[] => {
    const nodesById = new Map<string, MatrixTreeNode>(cells.map((cell) => [cell.id, { ...cell, children: [] }]))
    const roots: MatrixTreeNode[] = []
    const hasParentCycle = (cell: MatrixCell): boolean => {
        const visited = new Set<string>([cell.id])
        let currentParentId = cell.parentCellId
        while (currentParentId) {
            if (visited.has(currentParentId)) return true
            visited.add(currentParentId)
            currentParentId = nodesById.get(currentParentId)?.parentCellId ?? null
        }
        return false
    }

    for (const cell of cells) {
        const node = nodesById.get(cell.id)
        if (!node) continue
        const parent = cell.parentCellId ? nodesById.get(cell.parentCellId) : undefined
        if (parent && parent.id !== node.id && !hasParentCycle(cell)) {
            parent.children.push(node)
        } else {
            roots.push(node)
        }
    }

    const sortNodes = (nodes: MatrixTreeNode[]) => {
        nodes.sort((left, right) => left.sortOrder - right.sortOrder)
        nodes.forEach((node) => sortNodes(node.children))
    }
    sortNodes(roots)
    return roots
}

export const flattenMatrixTree = (nodes: MatrixTreeNode[], depth = 0, visited = new Set<string>()): MatrixCell[] =>
    nodes.flatMap((node) => {
        if (visited.has(node.id)) return []
        visited.add(node.id)
        const { children, ...cell } = node
        return [{ ...cell, depth }, ...flattenMatrixTree(children, depth + 1, visited)]
    })

export const toMatrixHierarchyRows = (cells: MatrixCell[]): MatrixCell[][] => {
    const rows: MatrixCell[][] = []
    for (const cell of cells) {
        const depth = Math.max(0, cell.depth)
        rows[depth] = rows[depth] ?? []
        rows[depth].push(cell)
    }
    return rows.filter((row) => row.length > 0)
}

export const toFocusedMatrixHierarchyRows = (nodes: MatrixTreeNode[], selectedCellId: string | null | undefined): MatrixCell[][] => {
    if (nodes.length === 0) return []

    const rows: MatrixCell[][] = []
    const pathByDepth: string[] = []
    const findPath = (items: MatrixTreeNode[], targetId: string, path: string[] = []): boolean => {
        for (const node of items) {
            const nextPath = [...path, node.id]
            if (node.id === targetId) {
                pathByDepth.splice(0, pathByDepth.length, ...nextPath)
                return true
            }
            if (findPath(node.children, targetId, nextPath)) return true
        }
        return false
    }
    if (selectedCellId) findPath(nodes, selectedCellId)

    let currentRow = nodes
    let depth = 0
    while (currentRow.length > 0) {
        rows.push(currentRow.map(({ children: _children, ...cell }) => cell))
        const focusedCellId = pathByDepth[depth]
        if (!focusedCellId) break
        const selectedNode = currentRow.find((node) => node.id === focusedCellId)
        if (!selectedNode || selectedNode.children.length === 0) break
        currentRow = selectedNode.children
        depth += 1
    }

    return rows
}

export const buildMatrixPositionLabels = (nodes: MatrixTreeNode[], config: MatrixPositionNumberingConfig): Map<string, string> => {
    const labels = new Map<string, string>()
    if (!config.enabled) return labels

    const startIndex = Math.max(0, Math.trunc(config.startIndex))
    const visit = (items: MatrixTreeNode[], parentPath: number[], depth: number) => {
        items.forEach((node, index) => {
            const currentNumber = startIndex + index
            const effectivePath = !config.includeRoot && depth === 0 ? [] : [...parentPath, currentNumber]
            if (effectivePath.length > 0) {
                labels.set(node.id, effectivePath.join('/'))
            }
            visit(node.children, effectivePath, depth + 1)
        })
    }

    visit(nodes, [], 0)
    return labels
}

export const isDescendantCell = (cells: MatrixCell[], maybeDescendantId: string, ancestorId: string): boolean => {
    let current = cells.find((cell) => cell.id === maybeDescendantId)
    const visited = new Set<string>()
    while (current?.parentCellId) {
        if (current.parentCellId === ancestorId) return true
        if (visited.has(current.parentCellId)) return false
        visited.add(current.parentCellId)
        current = cells.find((cell) => cell.id === current?.parentCellId)
    }
    return false
}

export const uniqueByKey = (cells: MatrixCell[], key: 'rowKey' | 'colKey'): MatrixCell[] => {
    const seen = new Set<string>()
    return cells.filter((cell) => {
        const value = cell[key]
        if (seen.has(value)) return false
        seen.add(value)
        return true
    })
}

export const getSectionId = (dataset: RuntimeDataset | undefined): string | undefined =>
    typeof dataset?.section?.id === 'string' && dataset.section.id.trim() ? dataset.section.id : undefined

const toFieldType = (dataType: string | undefined): FieldType => {
    switch (dataType) {
        case 'NUMBER':
        case 'BOOLEAN':
        case 'DATE':
        case 'REF':
        case 'JSON':
        case 'TABLE':
            return dataType
        default:
            return 'STRING'
    }
}

export const toFieldConfig = (column: RuntimeColumnLike): FieldConfig => ({
    id: column.field ?? column.codename ?? column.id ?? '',
    codename: column.codename,
    label: column.headerName ?? column.codename ?? column.field ?? '',
    type: toFieldType(column.dataType),
    required: column.isRequired,
    validationRules: column.validationRules,
    uiConfig: column.uiConfig,
    refTargetEntityId: column.refTargetEntityId,
    refTargetEntityKind: column.refTargetEntityKind,
    refTargetConstantId: column.refTargetConstantId,
    refOptions: column.refOptions,
    enumOptions: column.enumOptions,
    componentId: column.id
})

export const isStyleColumn = (column: RuntimeColumnLike): boolean => {
    const codename = column.codename ?? column.field ?? ''
    return (
        codename === 'CellFillColor' ||
        codename.startsWith('BorderTop') ||
        codename.startsWith('BorderRight') ||
        codename.startsWith('BorderBottom') ||
        codename.startsWith('BorderLeft')
    )
}

export const findMaterialTitle = (
    materials: RuntimeRow[],
    materialColumns: RuntimeColumnLike[] | undefined,
    materialRef: string | null,
    titleField: string,
    locale: string
): string => {
    if (!materialRef) return ''
    const material = materials.find((row) => row.id === materialRef)
    return readColumnText(material, materialColumns, titleField, locale)
}

export const findMaterialsForCell = (
    materials: RuntimeRow[],
    materialColumns: RuntimeColumnLike[] | undefined,
    cellId: string | undefined,
    activeMaterialRef: string | null
): RuntimeRow[] => {
    const seen = new Set<string>()
    const result: RuntimeRow[] = []
    const push = (material: RuntimeRow | undefined) => {
        if (!material || seen.has(material.id)) return
        seen.add(material.id)
        result.push(material)
    }

    if (activeMaterialRef) {
        push(materials.find((material) => material.id === activeMaterialRef))
    }

    if (!cellId) return result
    for (const material of materials) {
        const materialCellId = readColumnValue(material, materialColumns, 'CellId')
        if (materialCellId === cellId) {
            push(material)
        }
    }
    return result
}

export const matchesRelationEndpoint = (
    relation: RuntimeRow,
    relationColumns: RuntimeColumnLike[] | undefined,
    endpoint: { kind: string; id: string } | null
): boolean => {
    if (!endpoint) return false
    const sourceKind = readColumnValue(relation, relationColumns, 'SourceKind')
    const sourceId = readColumnValue(relation, relationColumns, 'SourceId')
    const targetKind = readColumnValue(relation, relationColumns, 'TargetKind')
    const targetId = readColumnValue(relation, relationColumns, 'TargetId')
    return (sourceKind === endpoint.kind && sourceId === endpoint.id) || (targetKind === endpoint.kind && targetId === endpoint.id)
}

export const appendUniqueRelations = (target: RuntimeRow[], source: RuntimeRow[]): RuntimeRow[] => {
    const seen = new Set(target.map((relation) => relation.id))
    for (const relation of source) {
        if (seen.has(relation.id)) continue
        seen.add(relation.id)
        target.push(relation)
    }
    return target
}

export const summarizeEditorJsContent = (value: unknown, locale: string): string => {
    const content = isRecord(value)
        ? Array.isArray(value.blocks)
            ? value.blocks
            : isRecord(value.data) && Array.isArray(value.data.blocks)
            ? value.data.blocks
            : null
        : null
    if (!content) return readText(value, locale)
    return content
        .flatMap((block) => {
            if (!isRecord(block)) return []
            const data = block.data
            if (!isRecord(data)) return []
            return [data.text, data.caption, data.content]
                .map((entry) => readText(entry, locale))
                .filter((entry) => entry.trim().length > 0)
        })
        .join(' ')
        .replace(/<[^>]*>/g, '')
        .trim()
}
