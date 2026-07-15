import { normalizeInterpretationNetworkHexColor } from '@universo-react/types'
import { MetahubValidationError } from '../../shared/domainErrors'
import { getCodenameText } from '../../shared/codename'

type SnapshotField = {
    codename?: unknown
    dataType?: unknown
    targetEntityId?: unknown
    targetEntityKind?: unknown
    targetConstantId?: unknown
    validationRules?: unknown
    childFields?: unknown
}

type SnapshotEntity = {
    id?: unknown
    codename?: unknown
    fields?: unknown
}

type SnapshotLike = {
    entities?: unknown
    elements?: unknown
    layoutZoneWidgets?: unknown
}

type InterpretationNetworkSnapshotMetadataValidationResult<TSnapshot extends SnapshotLike> = {
    snapshot: TSnapshot
    normalizedSnapshot: TSnapshot
    hasNormalizedChanges: boolean
}

const INTERPRETATION_NETWORK_COLOR_FIELD_CODENAMES = new Set([
    'CellFillColor',
    'TextColor',
    'BorderTopColor',
    'BorderRightColor',
    'BorderBottomColor',
    'BorderLeftColor'
])
const INTERPRETATION_NETWORK_MATRIX_CONTRACTS = [
    { entityCodename: 'Interpretation', tableField: 'InterpretationMatrix' },
    { entityCodename: 'TableTemplate', tableField: 'TemplateMatrix' }
] as const

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readFields = (value: unknown): SnapshotField[] => (Array.isArray(value) ? value.filter(isRecord) : [])

const hasCompleteMatrixContracts = (entitiesByCodename: Map<string, SnapshotEntity>): boolean =>
    INTERPRETATION_NETWORK_MATRIX_CONTRACTS.every(({ entityCodename, tableField }) => {
        const entity = entitiesByCodename.get(entityCodename)
        return readFields(entity?.fields).some((field) => getCodenameText(field.codename) === tableField)
    })

const hasInterpretationNetworkWorkspaceWidget = (snapshot: SnapshotLike): boolean =>
    Array.isArray(snapshot.layoutZoneWidgets) &&
    snapshot.layoutZoneWidgets.filter(isRecord).some((widget) => widget.widgetKey === 'interpretationNetworkWorkspace')

const cloneSnapshot = <TSnapshot extends SnapshotLike>(snapshot: TSnapshot): TSnapshot => JSON.parse(JSON.stringify(snapshot)) as TSnapshot

const unchangedValidationResult = <TSnapshot extends SnapshotLike>(
    snapshot: TSnapshot
): InterpretationNetworkSnapshotMetadataValidationResult<TSnapshot> => ({
    snapshot,
    normalizedSnapshot: snapshot,
    hasNormalizedChanges: false
})

export const validateInterpretationNetworkSnapshotMetadata = <TSnapshot extends SnapshotLike>(
    snapshot: TSnapshot
): InterpretationNetworkSnapshotMetadataValidationResult<TSnapshot> => {
    if (!isRecord(snapshot.entities)) return unchangedValidationResult(snapshot)

    const entitiesByCodename = new Map(
        Object.values(snapshot.entities)
            .filter(isRecord)
            .map((entity) => [getCodenameText((entity as SnapshotEntity).codename), entity as SnapshotEntity])
    )
    if (!hasInterpretationNetworkWorkspaceWidget(snapshot) || !hasCompleteMatrixContracts(entitiesByCodename)) {
        return unchangedValidationResult(snapshot)
    }

    if (entitiesByCodename.has('CellColor')) {
        throw new MetahubValidationError('Interpretation Network snapshot retains a legacy colour entity', {
            entityCodename: 'CellColor'
        })
    }

    for (const { entityCodename, tableField } of INTERPRETATION_NETWORK_MATRIX_CONTRACTS) {
        const entity = entitiesByCodename.get(entityCodename)
        const matrix = readFields(entity?.fields).find((field) => getCodenameText(field.codename) === tableField)
        if (!matrix) {
            throw new MetahubValidationError('Interpretation Network snapshot is missing a matrix contract', {
                entityCodename,
                tableField
            })
        }

        const childFields = readFields(matrix.childFields)
        const childrenByCodename = new Map(childFields.map((field) => [getCodenameText(field.codename), field]))
        if (childrenByCodename.has('CellColor')) {
            throw new MetahubValidationError('Interpretation Network snapshot retains a legacy colour field', {
                field: 'CellColor',
                entityCodename,
                tableField
            })
        }

        for (const colorCodename of INTERPRETATION_NETWORK_COLOR_FIELD_CODENAMES) {
            const colorField = childrenByCodename.get(colorCodename)
            if (!colorField) {
                throw new MetahubValidationError('Interpretation Network snapshot is missing a colour field', {
                    field: colorCodename,
                    entityCodename,
                    tableField
                })
            }

            const rules = isRecord(colorField.validationRules) ? colorField.validationRules : null
            if (
                colorField.dataType !== 'STRING' ||
                colorField.targetEntityId != null ||
                colorField.targetEntityKind != null ||
                colorField.targetConstantId != null ||
                rules?.format !== 'hexColor'
            ) {
                throw new MetahubValidationError('Interpretation Network snapshot has an invalid colour field', {
                    field: colorCodename,
                    entityCodename,
                    tableField
                })
            }
        }
    }

    const normalizedSnapshot = cloneSnapshot(snapshot)
    const normalizedEntitiesByCodename = new Map(
        Object.values(normalizedSnapshot.entities ?? {})
            .filter(isRecord)
            .map((entity) => [getCodenameText((entity as SnapshotEntity).codename), entity as SnapshotEntity])
    )

    const hasNormalizedChanges = normalizeMatrixElementColorValues(normalizedSnapshot, normalizedEntitiesByCodename)

    return {
        snapshot,
        normalizedSnapshot: hasNormalizedChanges ? normalizedSnapshot : snapshot,
        hasNormalizedChanges
    }
}

const findMatrixChildCodenames = (entity: SnapshotEntity | undefined, tableField: string): Set<string> => {
    const matrix = readFields(entity?.fields).find((field) => getCodenameText(field.codename) === tableField)
    return new Set(
        readFields(matrix?.childFields)
            .map((field) => getCodenameText(field.codename))
            .filter(Boolean)
    )
}

const normalizeMatrixRowColorValues = (
    row: Record<string, unknown>,
    childCodenames: Set<string>,
    context: Record<string, unknown>
): boolean => {
    let changed = false

    for (const colorCodename of INTERPRETATION_NETWORK_COLOR_FIELD_CODENAMES) {
        if (!childCodenames.has(colorCodename) || !Object.prototype.hasOwnProperty.call(row, colorCodename)) continue
        try {
            const value = row[colorCodename]
            const normalized = normalizeInterpretationNetworkHexColor(value)
            row[colorCodename] = normalized
            changed = changed || normalized !== value
        } catch {
            throw new MetahubValidationError('Interpretation Network snapshot has an invalid colour value', {
                ...context,
                field: colorCodename
            })
        }
    }

    return changed
}

const normalizeMatrixElementColorValues = (snapshot: SnapshotLike, entitiesByCodename: Map<string, SnapshotEntity>): boolean => {
    if (!isRecord(snapshot.elements)) return false

    let changed = false

    for (const { entityCodename, tableField } of INTERPRETATION_NETWORK_MATRIX_CONTRACTS) {
        const entity = entitiesByCodename.get(entityCodename)
        if (!entity || typeof entity.id !== 'string') continue
        const childCodenames = findMatrixChildCodenames(entity, tableField)
        const elements = snapshot.elements[entity.id]
        if (!Array.isArray(elements)) continue

        elements.filter(isRecord).forEach((element, elementIndex) => {
            const data = isRecord(element.data) ? element.data : {}
            const matrixRows = data[tableField]
            if (!Array.isArray(matrixRows)) return
            matrixRows.filter(isRecord).forEach((row, rowIndex) => {
                changed =
                    normalizeMatrixRowColorValues(row, childCodenames, {
                        entityCodename,
                        tableField,
                        elementIndex,
                        rowIndex
                    }) || changed
            })
        })
    }

    return changed
}
