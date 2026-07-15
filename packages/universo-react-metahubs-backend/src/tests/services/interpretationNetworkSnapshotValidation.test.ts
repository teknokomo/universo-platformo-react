import { validateInterpretationNetworkSnapshotMetadata } from '../../domains/publications/services/interpretationNetworkSnapshotValidation'

const matrixFields = () => [
    {
        codename: 'InterpretationMatrix',
        childFields: ['CellFillColor', 'TextColor', 'BorderTopColor', 'BorderRightColor', 'BorderBottomColor', 'BorderLeftColor'].map(
            (codename) => ({
                codename,
                dataType: 'STRING',
                validationRules: { format: 'hexColor', pattern: '^#[0-9A-F]{6}$' }
            })
        )
    }
]

const snapshot = () => ({
    entities: {
        interpretation: { id: 'interpretation-entity-id', codename: 'Interpretation', fields: matrixFields() },
        tableTemplate: {
            id: 'table-template-entity-id',
            codename: 'TableTemplate',
            fields: [{ ...matrixFields()[0], codename: 'TemplateMatrix' }]
        }
    },
    layoutZoneWidgets: [{ widgetKey: 'interpretationNetworkWorkspace' }]
})

describe('Interpretation Network snapshot metadata validation', () => {
    it('accepts the complete current six-field colour metadata contract', () => {
        expect(() => validateInterpretationNetworkSnapshotMetadata(snapshot())).not.toThrow()
    })

    it('rejects legacy REF metadata before an import can persist it', () => {
        const invalid = snapshot()
        const field = invalid.entities.interpretation.fields[0].childFields[0]
        field.dataType = 'REF'
        ;(field as Record<string, unknown>).targetEntityKind = 'enumeration'

        expect(() => validateInterpretationNetworkSnapshotMetadata(invalid)).toThrow('invalid colour field')
    })

    it('rejects a missing semantic format before an import can persist it', () => {
        const invalid = snapshot()
        delete invalid.entities.tableTemplate.fields[0].childFields[1].validationRules.format

        expect(() => validateInterpretationNetworkSnapshotMetadata(invalid)).toThrow('invalid colour field')
    })

    it('rejects residual reference ids on a semantic colour field', () => {
        const invalid = snapshot()
        const field = invalid.entities.interpretation.fields[0].childFields[0] as Record<string, unknown>
        field.targetEntityId = '018f8a78-7b8f-7c1d-a111-222233334560'
        field.targetConstantId = '018f8a78-7b8f-7c1d-a111-222233334561'

        expect(() => validateInterpretationNetworkSnapshotMetadata(invalid)).toThrow('invalid colour field')
    })

    it('ignores incomplete matrix metadata because user-defined codenames can partially collide', () => {
        const invalid = snapshot()
        delete invalid.entities.tableTemplate

        expect(() => validateInterpretationNetworkSnapshotMetadata(invalid)).not.toThrow()
    })

    it('ignores ordinary non-network snapshots that happen to use Interpretation codenames', () => {
        expect(() =>
            validateInterpretationNetworkSnapshotMetadata({
                entities: {
                    interpretation: { codename: 'Interpretation', fields: [] }
                }
            })
        ).not.toThrow()
    })

    it('ignores ordinary non-network snapshots that use only one matching matrix codename', () => {
        expect(() =>
            validateInterpretationNetworkSnapshotMetadata({
                entities: {
                    interpretation: { codename: 'Interpretation', fields: matrixFields() }
                }
            })
        ).not.toThrow()
    })

    it('ignores ordinary non-network snapshots even when all user codenames collide', () => {
        const ordinary = snapshot()
        delete ordinary.layoutZoneWidgets

        expect(() => validateInterpretationNetworkSnapshotMetadata(ordinary)).not.toThrow()
    })

    it('rejects the removed CellColor child field even alongside the semantic colour fields', () => {
        const invalid = snapshot()
        invalid.entities.interpretation.fields[0].childFields.push({ codename: 'CellColor', dataType: 'REF' })

        expect(() => validateInterpretationNetworkSnapshotMetadata(invalid)).toThrow('retains a legacy colour field')
    })

    it('rejects a globally retained CellColor enumeration in an asserted snapshot', () => {
        const invalid = snapshot()
        invalid.entities.cellColor = { codename: 'CellColor', fields: [] }

        expect(() => validateInterpretationNetworkSnapshotMetadata(invalid)).toThrow('retains a legacy colour entity')
    })

    it('rejects invalid colour values inside imported matrix element rows', () => {
        const invalid = {
            ...snapshot(),
            elements: {
                'interpretation-entity-id': [
                    {
                        id: 'element-1',
                        objectId: 'interpretation-entity-id',
                        sortOrder: 1,
                        data: {
                            InterpretationMatrix: [
                                {
                                    CellFillColor: '#1E88E5',
                                    TextColor: 'rgb(255, 255, 255)'
                                }
                            ]
                        }
                    }
                ]
            }
        }

        expect(() => validateInterpretationNetworkSnapshotMetadata(invalid)).toThrow('invalid colour value')
    })

    it('returns a normalized copy for valid imported matrix element colour values', () => {
        const imported = {
            ...snapshot(),
            elements: {
                'interpretation-entity-id': [
                    {
                        id: 'element-1',
                        objectId: 'interpretation-entity-id',
                        sortOrder: 1,
                        data: {
                            InterpretationMatrix: [
                                {
                                    CellFillColor: '#abc',
                                    TextColor: '#1e88e5'
                                }
                            ]
                        }
                    }
                ]
            }
        }

        const result = validateInterpretationNetworkSnapshotMetadata(imported)

        expect(result.hasNormalizedChanges).toBe(true)
        expect(result.normalizedSnapshot.elements['interpretation-entity-id'][0].data.InterpretationMatrix[0]).toMatchObject({
            CellFillColor: '#AABBCC',
            TextColor: '#1E88E5'
        })
        expect(imported.elements['interpretation-entity-id'][0].data.InterpretationMatrix[0]).toMatchObject({
            CellFillColor: '#abc',
            TextColor: '#1e88e5'
        })
    })

    it('keeps the original snapshot object when no normalization is needed', () => {
        const imported = snapshot()

        const result = validateInterpretationNetworkSnapshotMetadata(imported)

        expect(result.hasNormalizedChanges).toBe(false)
        expect(result.normalizedSnapshot).toBe(imported)
    })
})
