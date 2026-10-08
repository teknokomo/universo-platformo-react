import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import type { GridColDef } from '@mui/x-data-grid'
import { toFieldConfigs, toGridColumns } from '../columns'

const renderGridCell = (column: GridColDef, value: unknown) =>
    column.renderCell?.({
        id: 'row-1',
        field: column.field,
        row: { id: 'row-1' },
        value
    } as never)

const localizedText = (en: string, ru: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true },
        ru: { content: ru, version: 1, isActive: true }
    }
})

describe('toFieldConfigs', () => {
    it('preserves component uiConfig for metadata-driven runtime form widgets', () => {
        const [field] = toFieldConfigs({
            columns: [
                {
                    id: 'component-content',
                    codename: 'Content',
                    field: 'content',
                    dataType: 'JSON',
                    headerName: 'Content',
                    isRequired: true,
                    validationRules: {},
                    uiConfig: {
                        widget: 'editorjsBlockContent',
                        blockEditor: {
                            allowedBlockTypes: ['paragraph', 'header'],
                            maxBlocks: 5
                        }
                    }
                }
            ]
        } as never)

        expect(field).toMatchObject({
            id: 'content',
            type: 'JSON',
            uiConfig: {
                widget: 'editorjsBlockContent',
                blockEditor: {
                    allowedBlockTypes: ['paragraph', 'header'],
                    maxBlocks: 5
                }
            }
        })
    })

    it('clears UUID and technical metadata labels from explicitly configured runtime selectors', () => {
        const rawUuid = '019bbf00-0000-7000-8000-000000000005'
        const fields = toFieldConfigs({
            columns: [
                {
                    id: 'component-target-object',
                    codename: 'TargetObjectCodename',
                    field: 'TargetObjectCodename',
                    dataType: 'STRING',
                    headerName: 'TargetObjectCodename',
                    isRequired: true,
                    validationRules: {},
                    uiConfig: {
                        widget: 'select',
                        stringOptions: [{ value: 'Pages', label: 'Pages' }]
                    }
                },
                {
                    id: 'component-target-record',
                    codename: 'TargetRecordId',
                    field: 'TargetRecordId',
                    dataType: 'STRING',
                    headerName: rawUuid,
                    isRequired: true,
                    validationRules: {},
                    uiConfig: {
                        widget: 'runtimeRecordPicker',
                        runtimeRecordPicker: { targetObjectCodenameField: 'TargetObjectCodename' }
                    }
                }
            ]
        } as never)

        expect(fields.map(({ label }) => label)).toEqual(['', ''])
    })

    it('maps semantic long-text string columns to textarea fields without explicit widget metadata', () => {
        const fields = toFieldConfigs({
            columns: [
                {
                    id: 'component-description',
                    codename: 'Description',
                    field: 'Description',
                    dataType: 'STRING',
                    headerName: 'Description',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-instructions',
                    codename: 'AssignmentInstructions',
                    field: 'AssignmentInstructions',
                    dataType: 'STRING',
                    headerName: 'Instructions',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-title',
                    codename: 'Title',
                    field: 'Title',
                    dataType: 'STRING',
                    headerName: 'Title',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                }
            ]
        } as never)

        expect(fields.map((field) => [field.id, field.widget])).toEqual([
            ['Description', 'textarea'],
            ['AssignmentInstructions', 'textarea'],
            ['Title', undefined]
        ])
    })

    it('omits inert hidden and technical ID fields while retaining labeled references and synchronized hidden state', () => {
        const fields = toFieldConfigs({
            columns: [
                {
                    id: 'component-title',
                    codename: 'Title',
                    field: 'Title',
                    dataType: 'STRING',
                    headerName: 'Title',
                    isRequired: true,
                    validationRules: {},
                    uiConfig: { syncTargets: [{ fieldId: 'Name', manualFlagFieldId: 'NameManuallyEdited' }] }
                },
                {
                    id: 'component-project-id',
                    codename: 'ProjectId',
                    field: 'ProjectId',
                    dataType: 'STRING',
                    headerName: 'Project ID',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-owner-id',
                    codename: 'OwnerId',
                    field: 'OwnerId',
                    dataType: 'STRING',
                    headerName: 'Owner ID',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-project-reference',
                    codename: 'Project',
                    field: 'ProjectId',
                    dataType: 'REF',
                    headerName: 'Project',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {},
                    refOptions: [{ id: 'project-1', label: 'Project one' }]
                },
                {
                    id: 'component-secret',
                    codename: 'Secret',
                    field: 'Secret',
                    dataType: 'STRING',
                    headerName: 'Secret',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: { hidden: true }
                },
                {
                    id: 'component-name-manually-edited',
                    codename: 'NameManuallyEdited',
                    field: 'NameManuallyEdited',
                    dataType: 'BOOLEAN',
                    headerName: 'Name manually edited',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: { hidden: true }
                }
            ]
        } as never)

        expect(fields.map(({ id, label, type }) => ({ id, label, type }))).toEqual([
            { id: 'Title', label: 'Title', type: 'STRING' },
            { id: 'ProjectId', label: 'Project', type: 'REF' },
            { id: 'NameManuallyEdited', label: '', type: 'BOOLEAN' }
        ])
    })

    it('keeps explicitly configured string selectors and record pickers available without exposing technical grid columns', () => {
        const response = {
            columns: [
                {
                    id: 'component-target-object',
                    codename: 'TargetObjectCodename',
                    field: 'TargetObjectCodename',
                    dataType: 'STRING',
                    headerName: 'Target Object',
                    isRequired: true,
                    validationRules: {},
                    uiConfig: {
                        widget: 'select',
                        stringOptions: [
                            { value: 'LearningResources', label: localizedText('Learning Resources', 'Учебные ресурсы') },
                            { value: 'Quizzes', label: localizedText('Quizzes', 'Тесты') }
                        ]
                    }
                },
                {
                    id: 'component-target-record',
                    codename: 'TargetRecordId',
                    field: 'TargetRecordId',
                    dataType: 'STRING',
                    headerName: 'Target Record',
                    isRequired: true,
                    validationRules: {},
                    uiConfig: {
                        gridHidden: true,
                        widget: 'runtimeRecordPicker',
                        runtimeRecordPicker: {
                            targetObjectCodenameField: 'TargetObjectCodename',
                            allowedObjectCodenames: ['LearningResources', 'Quizzes'],
                            labelFields: ['Title', 'Name']
                        }
                    }
                },
                {
                    id: 'component-unconfigured-target-id',
                    codename: 'TargetRecordId',
                    field: 'UnconfiguredTargetRecordId',
                    dataType: 'STRING',
                    headerName: 'Target Record ID',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                }
            ]
        } as never

        const fields = toFieldConfigs(response)

        expect(fields.map(({ id, label, uiConfig }) => ({ id, label, widget: uiConfig?.widget }))).toEqual([
            { id: 'TargetObjectCodename', label: 'Target Object', widget: 'select' },
            { id: 'TargetRecordId', label: 'Target Record', widget: 'runtimeRecordPicker' }
        ])
        expect(toGridColumns(response).map(({ field }) => field)).toEqual([])
    })

    it('filters unsafe REF labels while retaining safe human labels and selectable option ids', () => {
        const rawUuid = '017f22e2-79b0-7cc3-98c4-dc0c0c073987'
        const fields = toFieldConfigs({
            columns: [
                {
                    id: 'component-project',
                    codename: 'Project',
                    field: 'ProjectId',
                    dataType: 'REF',
                    headerName: 'Project',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {},
                    refOptions: [
                        { id: rawUuid, label: rawUuid },
                        { id: 'owner-option', label: 'usr_internal_48392' },
                        { id: 'json-option', label: '{"internalRecord":"private"}' },
                        { id: 'technical-label', label: 'OwnerId' },
                        { id: 'project-one', label: 'Project one' }
                    ]
                }
            ]
        } as never)

        expect(fields).toHaveLength(1)
        expect(fields[0]?.refOptions).toEqual([{ id: 'project-one', label: 'Project one' }])
        expect(fields[0]?.refOptions?.[0]?.id).toBe('project-one')
    })

    it('omits technical REF fields with unsafe labels and retains hidden form defaults for submission', () => {
        const rawUuid = '017f22e2-79b0-7cc3-98c4-dc0c0c073988'
        const fields = toFieldConfigs({
            columns: [
                {
                    id: 'component-title',
                    codename: 'Title',
                    field: 'Title',
                    dataType: 'STRING',
                    headerName: 'Title',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-owner',
                    codename: 'OwnerId',
                    field: 'OwnerId',
                    dataType: 'REF',
                    headerName: 'Owner',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {},
                    refOptions: [{ id: rawUuid, label: rawUuid }]
                },
                {
                    id: 'component-internal-note',
                    codename: 'InternalNote',
                    field: 'InternalNote',
                    dataType: 'STRING',
                    headerName: 'Internal note',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: { defaultValue: 'Internal default', formHidden: true }
                },
                {
                    id: 'component-server-owned',
                    codename: 'CreationActor',
                    field: 'CreationActor',
                    dataType: 'STRING',
                    headerName: 'Creation actor',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: { formHidden: true, serverOwned: true }
                }
            ]
        } as never)

        expect(fields.map(({ id }) => id)).toEqual(['Title', 'InternalNote'])
        expect(fields.find(({ id }) => id === 'InternalNote')?.uiConfig).toMatchObject({ formHidden: true })
    })

    it('preserves nested TABLE child field configs while sanitizing child reference options', () => {
        const rawUuid = '017f22e2-79b0-7cc3-98c4-dc0c0c073989'
        const [tableField] = toFieldConfigs({
            columns: [
                {
                    id: 'component-lines',
                    codename: 'Lines',
                    field: 'Lines',
                    dataType: 'TABLE',
                    headerName: 'Lines',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {},
                    childColumns: [
                        {
                            id: 'child-title',
                            codename: 'Title',
                            field: 'Title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'child-owner',
                            codename: 'OwnerId',
                            field: 'OwnerId',
                            dataType: 'STRING',
                            headerName: 'Owner ID',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'child-resource',
                            codename: 'Resource',
                            field: 'Resource',
                            dataType: 'JSON',
                            headerName: 'Resource',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: { widget: 'resourceSource' }
                        },
                        {
                            id: 'child-private',
                            codename: 'PrivateNote',
                            field: 'PrivateNote',
                            dataType: 'STRING',
                            headerName: 'Private note',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: { formHidden: true }
                        },
                        {
                            id: 'child-project',
                            codename: 'Project',
                            field: 'ProjectId',
                            dataType: 'REF',
                            headerName: 'Project',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {},
                            refOptions: [
                                { id: rawUuid, label: rawUuid },
                                { id: 'project-one', label: 'Project one' }
                            ]
                        }
                    ]
                }
            ]
        } as never)

        expect(tableField?.childFields?.map(({ id }) => id)).toEqual(['Title', 'OwnerId', 'Resource', 'PrivateNote', 'ProjectId'])
        expect(tableField?.childFields?.find(({ id }) => id === 'ProjectId')?.refOptions).toEqual([
            { id: 'project-one', label: 'Project one' }
        ])
    })
})

describe('toGridColumns', () => {
    it('omits sensitive field names and private metadata from runtime grid columns', () => {
        const columns = toGridColumns({
            columns: [
                {
                    id: 'component-title',
                    codename: 'Title',
                    field: 'Title',
                    dataType: 'STRING',
                    headerName: 'Title',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-email',
                    codename: 'Email',
                    field: 'Email',
                    dataType: 'STRING',
                    headerName: 'Contact address',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-credential',
                    codename: 'Credential',
                    field: 'Credential',
                    dataType: 'STRING',
                    headerName: 'Credential',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: { sensitive: true }
                },
                {
                    id: 'component-private',
                    codename: 'InternalNote',
                    field: 'InternalNote',
                    dataType: 'STRING',
                    headerName: 'Internal note',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: { private: true }
                }
            ]
        } as never)

        expect(columns.map((column) => column.field)).toEqual(['Title'])
    })

    it('omits metadata-hidden columns from the runtime grid', () => {
        const columns = toGridColumns({
            columns: [
                {
                    id: 'component-title',
                    codename: 'Title',
                    field: 'Title',
                    dataType: 'STRING',
                    headerName: 'Title',
                    isRequired: true,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-manual-flag',
                    codename: 'NameManuallyEdited',
                    field: 'NameManuallyEdited',
                    dataType: 'BOOLEAN',
                    headerName: 'Name manually edited',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {
                        hidden: true
                    }
                }
            ]
        } as never)

        expect(columns.map((column) => column.field)).toEqual(['Title'])
    })

    it('omits technical identifiers and structured source fields from normal grids', () => {
        const columns = toGridColumns({
            columns: [
                {
                    id: 'component-title',
                    codename: 'Title',
                    field: 'Title',
                    dataType: 'STRING',
                    headerName: 'Title',
                    isRequired: true,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-id',
                    codename: 'RecordId',
                    field: 'RecordId',
                    dataType: 'STRING',
                    headerName: 'Record ID',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-owner',
                    codename: 'OwnerUserId',
                    field: 'OwnerUserId',
                    dataType: 'STRING',
                    headerName: 'Owner user',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-source',
                    codename: 'SourceJson',
                    field: 'SourceJson',
                    dataType: 'JSON',
                    headerName: 'Source',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                }
            ]
        } as never)

        expect(columns.map((column) => column.field)).toEqual(['Title'])
    })

    it('keeps reference fields only when human-readable options are available', () => {
        const columns = toGridColumns({
            columns: [
                {
                    id: 'component-project',
                    codename: 'Project',
                    field: 'ProjectId',
                    dataType: 'REF',
                    headerName: 'Project',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {},
                    refOptions: [{ id: 'project-1', label: 'Project one' }]
                },
                {
                    id: 'component-owner',
                    codename: 'OwnerUserId',
                    field: 'OwnerUserId',
                    dataType: 'REF',
                    headerName: 'Owner',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                }
            ]
        } as never)

        expect(columns.map((column) => column.field)).toEqual(['ProjectId'])
    })

    it('renders only sanitized REF labels and keeps safe labels available for selection', () => {
        const rawUuid = '017f22e2-79b0-7cc3-98c4-dc0c0c073991'
        const [column] = toGridColumns({
            columns: [
                {
                    id: 'component-project',
                    codename: 'Project',
                    field: 'ProjectId',
                    dataType: 'REF',
                    headerName: 'Project',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {},
                    refOptions: [
                        { id: rawUuid, label: rawUuid },
                        { id: 'opaque-option', label: 'usr_internal_48392' },
                        { id: 'json-option', label: '{"internalRecord":"private"}' },
                        { id: 'project-one', label: 'Project one' }
                    ]
                }
            ]
        } as never)

        expect(renderGridCell(column, 'project-one')).toBe('Project one')
        expect(renderGridCell(column, rawUuid)).toBe('')
        expect(renderGridCell(column, { label: 'usr_internal_48392', id: 'opaque-option' })).toBe('')
        expect(renderGridCell(column, { label: '{"internalRecord":"private"}', id: 'json-option' })).toBe('')
    })

    it('respects metadata sort and filter guards for runtime projection columns', () => {
        const [typeColumn] = toGridColumns({
            columns: [
                {
                    id: 'union-type',
                    codename: 'Type',
                    field: 'type',
                    dataType: 'STRING',
                    headerName: 'Type',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {
                        gridSortable: false,
                        gridFilterable: false
                    }
                }
            ]
        } as never)

        expect(typeColumn.sortable).toBe(false)
        expect(typeColumn.filterable).toBe(false)
    })

    it('applies metadata width and flex hints to runtime grid columns', () => {
        const [fixedColumn, flexibleColumn] = toGridColumns({
            columns: [
                {
                    id: 'fixed',
                    codename: 'Title',
                    field: 'title',
                    dataType: 'STRING',
                    headerName: 'Title',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: { gridWidth: 220 }
                },
                {
                    id: 'flexible',
                    codename: 'Status',
                    field: 'status',
                    dataType: 'STRING',
                    headerName: 'Status',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: { gridFlex: 0.5 }
                }
            ]
        } as never)

        expect(fixedColumn.width).toBe(220)
        expect(fixedColumn.flex).toBeUndefined()
        expect(flexibleColumn.flex).toBe(0.5)
    })

    it('formats default runtime grid cells without leaking raw IDs or runtime JSON', () => {
        const rawRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073987'
        const [column] = toGridColumns(
            {
                columns: [
                    {
                        id: 'component-title',
                        codename: 'Title',
                        field: 'Title',
                        dataType: 'STRING',
                        headerName: 'Title',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {}
                    }
                ]
            } as never,
            { locale: 'ru' }
        )

        expect(renderGridCell(column, localizedText('Readable title', 'Читаемый заголовок'))).toBe('Читаемый заголовок')
        expect(renderGridCell(column, rawRecordId)).toBe('')
        expect(renderGridCell(column, '{"blocks":[{"type":"paragraph"}]}')).toBe('')
        expect(renderGridCell(column, { blocks: [{ type: 'paragraph' }] })).toBe('')
        expect(renderGridCell(column, { codename: 'LearningResources' })).toBe('')
        expect(renderGridCell(column, { id: 'project-1' })).toBe('')
        expect(renderGridCell(column, { displayName: 'Readable display name', codename: 'LearningResources' })).toBe(
            'Readable display name'
        )
    })

    it('formats semantic long-text cells through safe runtime display text', () => {
        const rawRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073987'
        const [column] = toGridColumns({
            columns: [
                {
                    id: 'component-description',
                    codename: 'Description',
                    field: 'Description',
                    dataType: 'STRING',
                    headerName: 'Description',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                }
            ]
        } as never)

        const { container, rerender } = render(<>{renderGridCell(column, 'Linked record ' + rawRecordId)}</>)
        expect(container).not.toHaveTextContent('Linked record')
        expect(container).not.toHaveTextContent(rawRecordId)

        rerender(<>{renderGridCell(column, localizedText('Readable notes', 'Readable notes'))}</>)
        expect(container).toHaveTextContent('Readable notes')
    })

    it('uses safe REF object labels and falls back to human option labels', () => {
        const rawRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073987'
        const [column] = toGridColumns(
            {
                columns: [
                    {
                        id: 'component-project',
                        codename: 'Project',
                        field: 'ProjectId',
                        dataType: 'REF',
                        headerName: 'Project',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {},
                        refOptions: [{ id: rawRecordId, label: 'Readable project' }]
                    }
                ]
            } as never,
            { locale: 'en' }
        )

        expect(renderGridCell(column, { label: 'Readable object label', id: rawRecordId })).toBe('Readable object label')
        expect(renderGridCell(column, { label: rawRecordId, id: rawRecordId })).toBe('Readable project')
        expect(renderGridCell(column, { name: '{"recordId":"017f22e2-79b0-7cc3-98c4-dc0c0c073988"}', id: 'missing' })).toBe('')
    })

    it('supports row-aware accessible labels for runtime row action menus', () => {
        const [actionsColumn] = toGridColumns(
            {
                columns: []
            } as never,
            {
                actionsAriaLabel: 'Actions',
                getRowActionsAriaLabel: (row) => `Actions for ${String(row.Title)}`,
                onMenuOpen: () => undefined
            }
        )

        expect(actionsColumn.type).toBeUndefined()
        const rendered = render(
            <>
                {actionsColumn.renderCell?.({
                    id: 'row-1',
                    field: 'actions',
                    row: { id: 'row-1', Title: 'Onboarding course' },
                    value: undefined
                } as never)}
            </>
        )

        expect(rendered.getByRole('button', { name: 'Actions for Onboarding course' })).toBeVisible()
    })

    it('renders STRING option labels in runtime grid cells', () => {
        const [column] = toGridColumns(
            {
                columns: [
                    {
                        id: 'component-completion-condition',
                        codename: 'CompletionCondition',
                        field: 'CompletionCondition',
                        dataType: 'STRING',
                        headerName: 'Completion condition',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {
                            widget: 'select',
                            stringOptions: [
                                { value: 'allItems', label: localizedText('All items', 'Все элементы') },
                                { value: 'selectedItems', label: localizedText('Selected items', 'Выбранные элементы') }
                            ]
                        }
                    }
                ]
            } as never,
            { locale: 'ru' }
        )

        expect(renderGridCell(column, 'selectedItems')).toBe('Выбранные элементы')
    })
})
