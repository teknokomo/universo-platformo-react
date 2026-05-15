import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_OBJECT_RECORD_BEHAVIOR, type ObjectRecordBehavior, type EntityTypeCapabilities } from '@universo/types'

import RecordBehaviorFields from '../RecordBehaviorFields'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallbackOrOptions?: string | { defaultValue?: string; index?: number }) => {
            if (typeof fallbackOrOptions === 'string') {
                return fallbackOrOptions
            }
            if (typeof fallbackOrOptions?.defaultValue === 'string') return fallbackOrOptions.defaultValue
            return key
        }
    })
}))

const capabilities: EntityTypeCapabilities = {
    records: { enabled: true },
    identityFields: { enabled: true, allowNumber: true, allowEffectiveDate: true },
    recordLifecycle: { enabled: true, allowCustomStates: true },
    posting: { enabled: true, allowManualPosting: true, allowAutomaticPosting: true },
    scripting: { enabled: true },
    dataSchema: { enabled: true },
    physicalTable: { enabled: true },
    treeAssignment: false,
    fixedValues: false,
    optionValues: false,
    blockContent: false,
    layoutConfig: false,
    hierarchy: false,
    relations: false,
    runtimeBehavior: false,
    nestedCollections: false,
    actions: false,
    events: false,
    ledgerSchema: false
}

const createValue = (overrides: Partial<ObjectRecordBehavior> = {}): ObjectRecordBehavior => ({
    ...DEFAULT_OBJECT_RECORD_BEHAVIOR,
    ...overrides
})

describe('RecordBehaviorFields', () => {
    it('renders entity-component driven behavior sections for transactional objects', () => {
        render(
            <RecordBehaviorFields
                value={createValue({
                    mode: 'transactional',
                    numbering: { ...DEFAULT_OBJECT_RECORD_BEHAVIOR.numbering, enabled: true, prefix: 'ENR-' },
                    effectiveDate: { ...DEFAULT_OBJECT_RECORD_BEHAVIOR.effectiveDate, enabled: true },
                    lifecycle: {
                        enabled: true,
                        states: [{ codename: 'Draft', title: 'Draft', isInitial: true }]
                    },
                    posting: { mode: 'manual', targetLedgers: ['ProgressLedger'], scriptCodename: 'EnrollmentPostingScript' }
                })}
                onChange={vi.fn()}
                capabilities={capabilities}
                fieldOptions={[{ codename: 'StartedAt', label: 'Started at' }]}
                ledgerOptions={[{ codename: 'ProgressLedger', label: 'Progress Ledger' }]}
                scriptOptions={[{ codename: 'EnrollmentPostingScript', label: 'Enrollment posting' }]}
            />
        )

        expect(screen.getAllByText('Record mode').length).toBeGreaterThan(0)
        expect(screen.getByText('Identity fields')).toBeInTheDocument()
        expect(screen.getByText('Lifecycle')).toBeInTheDocument()
        expect(screen.getAllByText('Posting').length).toBeGreaterThan(0)
        expect(screen.getAllByDisplayValue('ENR-').length).toBeGreaterThan(0)
        expect(screen.getAllByDisplayValue('Draft').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Progress Ledger').length).toBeGreaterThan(0)
    })

    it('updates nested behavior values without replacing unrelated settings', () => {
        const onChange = vi.fn()
        const value = createValue({
            numbering: { ...DEFAULT_OBJECT_RECORD_BEHAVIOR.numbering, enabled: true, prefix: 'OLD-' },
            lifecycle: {
                enabled: true,
                states: [{ codename: 'Draft', title: 'Draft', isInitial: true }]
            }
        })

        render(
            <RecordBehaviorFields
                value={value}
                onChange={onChange}
                capabilities={capabilities}
                fieldOptions={[]}
                ledgerOptions={[]}
                scriptOptions={[]}
            />
        )

        fireEvent.change(screen.getByLabelText('Prefix'), { target: { value: 'NEW-' } })

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({
                numbering: expect.objectContaining({ enabled: true, prefix: 'NEW-' }),
                lifecycle: value.lifecycle
            })
        )
    })

    it('keeps configured select values visible when option lists are still empty', () => {
        render(
            <RecordBehaviorFields
                value={createValue({
                    mode: 'transactional',
                    effectiveDate: {
                        ...DEFAULT_OBJECT_RECORD_BEHAVIOR.effectiveDate,
                        enabled: true,
                        fieldCodename: 'StartedAt'
                    },
                    lifecycle: {
                        enabled: true,
                        stateFieldCodename: 'Status',
                        states: [{ codename: 'Draft', title: 'Draft', isInitial: true }]
                    },
                    posting: {
                        mode: 'manual',
                        targetLedgers: ['ProgressLedger'],
                        scriptCodename: 'EnrollmentPostingScript'
                    }
                })}
                onChange={vi.fn()}
                capabilities={capabilities}
                fieldOptions={[]}
                ledgerOptions={[]}
                scriptOptions={[]}
            />
        )

        expect(screen.getAllByText('StartedAt (configured)').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Status (configured)').length).toBeGreaterThan(0)
        expect(screen.getAllByText('ProgressLedger (configured)').length).toBeGreaterThan(0)
        expect(screen.getAllByText('EnrollmentPostingScript (configured)').length).toBeGreaterThan(0)
    })
})
