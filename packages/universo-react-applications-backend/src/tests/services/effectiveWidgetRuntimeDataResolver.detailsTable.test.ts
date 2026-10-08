import './effectiveWidgetRuntimeDataResolver.testMocks'
import { validateWidgetBindings } from '@universo-react/types'
import * as runtimeUnion from '../../services/runtimeRowSupport/union/execution'
import {
    createMockDbExecutor,
    resetEffectiveWidgetRuntimeDataResolverMocks,
    getLayoutWidgetDefinition,
    runtimeStore,
    resolveEffectiveWidgetRuntimeData,
    objectId,
    recordId,
    applicationId,
    workspaceId,
    childRecordId,
    resolveDetailsTable,
    metadataForSlot,
    metadataEnvelope,
    scope
} from './effectiveWidgetRuntimeDataResolver.testSupport'

describe('resolveEffectiveWidgetRuntimeData detailsTable projection', () => {
    beforeEach(resetEffectiveWidgetRuntimeDataResolverMocks)

    it('resolves every bounded LMS library tab when three Entity sources are bound', async () => {
        const { executor } = createMockDbExecutor()
        const sources = ['LearningResources', 'Courses', 'LearningTracks']
        const sourceIds = [objectId, childRecordId, workspaceId]
        const views = ['recent', 'starred', 'shared'] as const
        const candidates = views.map((libraryView) => {
            const config = { variant: 'library', libraryView, lifecycleState: 'active', maxRows: 24 }
            const definition = getLayoutWidgetDefinition('detailsTable', config)
            const rowsSlot = definition?.bindingSlots?.find(({ key }) => key === 'rows')
            if (!definition || !rowsSlot) throw new Error('Library detailsTable rows binding is missing')
            const targets = sources.map((entityCodename) => ({
                entityKind: 'object' as const,
                entityCodename,
                selector: { kind: 'record-set' as const },
                projection: rowsSlot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
            }))
            const bindings = validateWidgetBindings(definition, { version: 1, slots: [{ slot: 'rows', targets }] })
            return {
                id: `placement-library-${libraryView}`,
                widgetKey: 'detailsTable',
                config,
                isActive: true,
                bindings
            }
        })
        const firstDefinition = getLayoutWidgetDefinition('detailsTable', candidates[0].config)
        const rowsSlot = firstDefinition?.bindingSlots?.find(({ key }) => key === 'rows')
        if (!rowsSlot) throw new Error('Library detailsTable rows slot is missing')
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(
            metadataEnvelope(
                sources.map((source, index) => {
                    const entry = metadataForSlot(sourceIds[index], source, rowsSlot)
                    return {
                        ...entry,
                        config: {
                            ...entry.config,
                            runtimeLibrary: {
                                projection: {
                                    displayType: 'content',
                                    titleFieldCodename: 'Title',
                                    projectedFieldCodenames: []
                                }
                            }
                        }
                    }
                })
            )
        )
        const unionResult = {
            targetPayloads: [{ objectCollection: {}, columns: [{ field: 'title', headerName: 'Title' }] }],
            rows: [
                {
                    id: recordId,
                    __runtimeObjectCollectionCodename: 'LearningResources',
                    __runtimeSourceRowId: recordId,
                    __runtimeDisplayType: 'resource',
                    _upl_version: null,
                    title: 'Learning resource'
                }
            ],
            total: 1,
            limit: 24,
            offset: 0
        } as unknown as Awaited<ReturnType<typeof runtimeUnion.executeRuntimeRecordsUnionQuery>>
        const unionQuery = jest.spyOn(runtimeUnion, 'executeRuntimeRecordsUnionQuery').mockResolvedValue(unionResult)

        try {
            const resolved = await resolveEffectiveWidgetRuntimeData(
                executor,
                { ...scope, applicationId, currentUserId: recordId, role: 'owner' },
                candidates,
                'en'
            )

            for (const libraryView of views) {
                expect(resolved.get(`placement-library-${libraryView}`)).toMatchObject({
                    status: 'ready',
                    data: {
                        kind: 'table',
                        rows: [{ target: { version: 1 }, cells: [{ key: 'title', value: 'Learning resource' }] }]
                    }
                })
            }
            expect(unionQuery).toHaveBeenCalledTimes(views.length)
        } finally {
            unionQuery.mockRestore()
        }
    })

    it('preserves authorized table metadata when the bound source has no records', async () => {
        const result = await resolveDetailsTable({ variant: 'records', maxRows: 20 }, scope, [], { locale: 'ru' })

        expect(result).toEqual({
            status: 'ready',
            data: {
                kind: 'table',
                columns: [
                    { key: 'Title', label: 'RU Title', valueType: 'string' },
                    { key: 'SortOrder', label: 'RU SortOrder', valueType: 'number' }
                ],
                rows: [],
                pagination: { total: 0, limit: 20, offset: 0 }
            }
        })
        expect(JSON.stringify(result)).not.toContain(objectId)
    })

    it('projects localized Component presentation labels into the detailsTable DTO', async () => {
        const result = await resolveDetailsTable(
            { variant: 'records', maxRows: 20 },
            scope,
            [
                {
                    recordId,
                    data: {
                        // records.union already resolves localized Component storage into the requested locale.
                        title: 'Алгебра',
                        order: 1
                    }
                }
            ],
            { locale: 'ru' }
        )

        expect(result).toEqual({
            status: 'ready',
            data: {
                kind: 'table',
                columns: [
                    { key: 'Title', label: 'RU Title', valueType: 'string' },
                    { key: 'SortOrder', label: 'RU SortOrder', valueType: 'number' }
                ],
                rows: [
                    {
                        key: expect.any(String),
                        cells: [
                            { key: 'Title', value: 'Алгебра' },
                            { key: 'SortOrder', value: '1' }
                        ]
                    }
                ],
                pagination: { total: 1, limit: 20, offset: 0 }
            }
        })
        const serialized = JSON.stringify(result)
        for (const physicalId of [objectId, recordId, applicationId, workspaceId]) expect(serialized).not.toContain(physicalId)
        expect(serialized).not.toContain('column_name')
    })

    it('converts object-valued field payloads to safe table strings before they reach the client', async () => {
        const rawBlockValue = { blocks: [{ type: 'paragraph', data: { text: 'Private object-valued instructions' } }] }
        const result = await resolveDetailsTable(
            { variant: 'records', maxRows: 20 },
            scope,
            [{ recordId, data: { Instructions: rawBlockValue } }],
            {
                entityCodename: 'Lessons',
                components: [
                    {
                        id: '0190a9b5-3cde-7abc-8def-0123456789e1',
                        codename: 'Instructions',
                        column_name: 'cmp_instructions',
                        data_type: 'STRING',
                        is_required: false,
                        presentation: { name: { locales: { en: { content: 'Instructions' } } } },
                        validation_rules: {},
                        sort_order: 0,
                        ui_config: {}
                    }
                ]
            }
        )

        expect(result).toMatchObject({
            status: 'ready',
            data: {
                kind: 'table',
                columns: [{ key: 'Instructions', label: 'Instructions' }],
                rows: [{ cells: [{ key: 'Instructions', value: '' }] }]
            }
        })
        expect(JSON.stringify(result)).not.toContain('Private object-valued instructions')
        expect(JSON.stringify(result)).not.toContain('[object Object]')
    })

    it('derives an administrative table from the actual Entity schema without Title or SortOrder requirements', async () => {
        const components = [
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789d1',
                codename: 'TargetTitle',
                column_name: 'cmp_target_title',
                data_type: 'STRING' as const,
                is_required: true,
                presentation: { name: { locales: { en: { content: 'Target' } } } },
                validation_rules: {},
                sort_order: 0,
                ui_config: {}
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789d2',
                codename: 'EnrollmentStatus',
                column_name: 'cmp_status',
                data_type: 'REF' as const,
                is_required: true,
                target_object_id: '0190a9b5-3cde-7abc-8def-0123456789d3',
                target_object_kind: 'enumeration',
                validation_rules: {},
                sort_order: 1,
                ui_config: {}
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789d4',
                codename: 'AssignedUser',
                column_name: 'cmp_user',
                data_type: 'REF' as const,
                is_required: false,
                target_object_id: '0190a9b5-3cde-7abc-8def-0123456789d5',
                target_object_kind: 'object',
                validation_rules: {},
                sort_order: 2,
                ui_config: {}
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789d8',
                codename: 'ProjectId',
                column_name: 'cmp_project_id',
                data_type: 'STRING' as const,
                is_required: false,
                validation_rules: {},
                sort_order: 3,
                ui_config: {}
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789d9',
                codename: 'OwnerUserId',
                column_name: 'cmp_owner_id',
                data_type: 'STRING' as const,
                is_required: false,
                validation_rules: {},
                sort_order: 4,
                ui_config: {}
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789da',
                codename: 'PrivateNote',
                column_name: 'cmp_private_note',
                data_type: 'STRING' as const,
                is_required: false,
                validation_rules: {},
                sort_order: 5,
                ui_config: { serverOwned: true }
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789db',
                codename: 'FormHiddenField',
                column_name: 'cmp_form_hidden',
                data_type: 'STRING' as const,
                is_required: false,
                validation_rules: {},
                sort_order: 6,
                ui_config: { formHidden: true }
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789d6',
                codename: 'InternalJson',
                column_name: 'cmp_json',
                data_type: 'JSON' as const,
                is_required: false,
                validation_rules: {},
                sort_order: 7,
                ui_config: {}
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789d7',
                codename: 'HiddenField',
                column_name: 'cmp_hidden',
                data_type: 'STRING' as const,
                is_required: false,
                validation_rules: {},
                sort_order: 8,
                ui_config: { gridHidden: true }
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789dc',
                codename: 'ContactEmail',
                column_name: 'cmp_email',
                data_type: 'STRING' as const,
                is_required: false,
                validation_rules: {},
                sort_order: 9,
                ui_config: {}
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789dd',
                codename: 'PasswordHash',
                column_name: 'cmp_password_hash',
                data_type: 'STRING' as const,
                is_required: false,
                validation_rules: {},
                sort_order: 10,
                ui_config: {}
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789de',
                codename: 'PrivateKey',
                column_name: 'cmp_private_key',
                data_type: 'STRING' as const,
                is_required: false,
                validation_rules: {},
                sort_order: 11,
                ui_config: {}
            }
        ]
        const result = await resolveDetailsTable(
            { variant: 'records', maxRows: 20 },
            scope,
            [
                {
                    recordId,
                    data: {
                        TargetTitle: 'Course A',
                        EnrollmentStatus: { label: 'Active' },
                        AssignedUser: { label: 'Student One' },
                        ProjectId: 'private-project-sentinel',
                        OwnerUserId: 'private-owner-sentinel',
                        PrivateNote: 'private-server-owned-sentinel',
                        FormHiddenField: 'private-form-hidden-sentinel',
                        InternalJson: { secret: applicationId },
                        HiddenField: objectId,
                        ContactEmail: 'private-contact@example.test',
                        PasswordHash: 'private-password-hash-sentinel',
                        PrivateKey: 'private-key-sentinel'
                    }
                }
            ],
            { entityCodename: 'Enrollments', components }
        )

        expect(result).toMatchObject({
            status: 'ready',
            data: {
                kind: 'table',
                columns: [{ key: 'TargetTitle' }, { key: 'EnrollmentStatus' }, { key: 'AssignedUser' }],
                rows: [
                    {
                        cells: [
                            { key: 'TargetTitle', value: 'Course A' },
                            { key: 'EnrollmentStatus', value: 'Active' },
                            { key: 'AssignedUser', value: 'Student One' }
                        ]
                    }
                ]
            }
        })
        const serialized = JSON.stringify(result)
        expect(serialized).not.toContain('InternalJson')
        expect(serialized).not.toContain('HiddenField')
        expect(serialized).not.toContain('ProjectId')
        expect(serialized).not.toContain('OwnerUserId')
        expect(serialized).not.toContain('PrivateNote')
        expect(serialized).not.toContain('FormHiddenField')
        for (const sensitiveField of ['ContactEmail', 'PasswordHash', 'PrivateKey']) expect(serialized).not.toContain(sensitiveField)
        for (const sentinel of [
            'private-project-sentinel',
            'private-owner-sentinel',
            'private-server-owned-sentinel',
            'private-form-hidden-sentinel',
            'private-contact@example.test',
            'private-password-hash-sentinel',
            'private-key-sentinel'
        ]) {
            expect(serialized).not.toContain(sentinel)
        }
        expect(serialized).not.toContain(applicationId)
        expect(serialized).not.toContain(objectId)
        expect(runtimeUnion.executeRuntimeRecordsUnionQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({
                datasource: expect.objectContaining({
                    projectedFields: ['TargetTitle', 'EnrollmentStatus', 'AssignedUser']
                })
            })
        )
    })

    it('projects authenticated row-action targets separately from complete-set reorder targets', async () => {
        const editorScope = {
            ...scope,
            currentUserId: '550e8400-e29b-41d4-a716-446655440000',
            permissions: { ...scope.permissions, editContent: true }
        }
        const result = await resolveDetailsTable({ variant: 'records', enableRowReordering: true, maxRows: 20 }, editorScope, [
            { recordId, version: 4, data: { title: 'Introduction', order: 1 } }
        ])

        expect(result).toMatchObject({
            status: 'ready',
            data: {
                kind: 'table',
                sourceEntityCodename: 'DashboardRows',
                pagination: { total: 1, limit: 20, offset: 0, complete: true },
                rows: [
                    {
                        actionTarget: { recordHandle: expect.stringMatching(/^rh1\./u), entityCodename: 'DashboardRows' },
                        mutationTarget: {
                            recordHandle: expect.stringMatching(/^rh1\./u),
                            entityCodename: 'DashboardRows',
                            version: 4
                        },
                        cells: [
                            { key: 'Title', value: 'Introduction' },
                            { key: 'SortOrder', value: '1' }
                        ]
                    }
                ]
            }
        })
        const serialized = JSON.stringify(result)
        expect(serialized).not.toContain(recordId)
        const visibleCells = (result as { data?: { rows?: Array<{ cells?: unknown }> } })?.data?.rows?.[0]?.cells
        expect(JSON.stringify(visibleCells)).not.toContain(recordId)
        expect(serialized).not.toContain(objectId)
    })

    it('projects row-action targets for authenticated writers even when reorder is disabled', async () => {
        const writerScope = {
            ...scope,
            currentUserId: '550e8400-e29b-41d4-a716-446655440000',
            permissions: { ...scope.permissions, createContent: true }
        }
        const result = await resolveDetailsTable({ variant: 'records', maxRows: 20 }, writerScope, [
            { recordId, version: 4, data: { title: 'Introduction', order: 1 } }
        ])

        expect(result).toMatchObject({
            status: 'ready',
            data: {
                kind: 'table',
                rows: [
                    {
                        actionTarget: { recordHandle: expect.stringMatching(/^rh1\./u), entityCodename: 'DashboardRows' },
                        cells: expect.any(Array)
                    }
                ]
            }
        })
        expect(JSON.stringify(result)).not.toContain(recordId)
        expect(JSON.stringify(result)).not.toContain('mutationTarget')
        expect(JSON.stringify(result)).not.toContain('sourceEntityCodename')
        expect(JSON.stringify(result)).not.toContain('"complete"')
    })

    it('omits row mutation targets when the reorder flag or edit permission is absent', async () => {
        const editorScope = {
            ...scope,
            currentUserId: '0190a9b5-3cde-7abc-8def-0123456789c7',
            permissions: { ...scope.permissions, editContent: true }
        }
        const row = [{ recordId, version: 4, data: { title: 'Introduction', order: 1 } }]
        const flagDisabled = await resolveDetailsTable({ variant: 'records', maxRows: 20 }, editorScope, row)
        const editDenied = await resolveDetailsTable({ variant: 'records', enableRowReordering: true, maxRows: 20 }, scope, row)
        const actorMissing = await resolveDetailsTable(
            { variant: 'records', enableRowReordering: true, maxRows: 20 },
            { ...editorScope, currentUserId: 'unverified-actor' },
            row
        )

        for (const result of [flagDisabled, editDenied, actorMissing]) {
            expect(result).toMatchObject({ status: 'ready', data: { kind: 'table' } })
            expect(JSON.stringify(result)).not.toContain('mutationTarget')
            expect(JSON.stringify(result)).not.toContain('sourceEntityCodename')
            expect(JSON.stringify(result)).not.toContain('"complete"')
        }
        expect(JSON.stringify(flagDisabled)).toContain('actionTarget')
        for (const result of [editDenied, actorMissing]) expect(JSON.stringify(result)).not.toContain('actionTarget')
    })

    it('omits reorder mutation targets when the effective Entity layout grants no reorder authority', async () => {
        const editorScope = {
            ...scope,
            currentUserId: '0190a9b5-3cde-7abc-8def-0123456789c7',
            role: 'owner' as const,
            permissions: { ...scope.permissions, editContent: true }
        }
        const result = await resolveDetailsTable(
            { variant: 'records', enableRowReordering: true, maxRows: 20 },
            editorScope,
            [{ recordId, version: 4, data: { title: 'Introduction', order: 1 } }],
            { reorderFieldCodename: null }
        )

        expect(result).toMatchObject({
            status: 'ready',
            data: { kind: 'table', rows: [{ actionTarget: { recordHandle: expect.stringMatching(/^rh1\./u) } }] }
        })
        expect(JSON.stringify(result)).not.toContain(recordId)
        expect(JSON.stringify(result)).not.toContain('mutationTarget')
        expect(JSON.stringify(result)).not.toContain('sourceEntityCodename')
        expect(JSON.stringify(result)).not.toContain('"complete"')
    })

    it('marks an empty but fully loaded source as complete without fabricating row targets', async () => {
        const editorScope = {
            ...scope,
            currentUserId: '0190a9b5-3cde-7abc-8def-0123456789c7',
            permissions: { ...scope.permissions, editContent: true }
        }
        const result = await resolveDetailsTable({ variant: 'records', enableRowReordering: true, maxRows: 20 }, editorScope, [])

        expect(result).toMatchObject({
            status: 'ready',
            data: {
                kind: 'table',
                sourceEntityCodename: 'DashboardRows',
                pagination: { total: 0, limit: 20, offset: 0, complete: true },
                rows: []
            }
        })
    })

    it('does not expose reorder targets when the configured visible row limit truncates the source', async () => {
        const editorScope = {
            ...scope,
            currentUserId: '0190a9b5-3cde-7abc-8def-0123456789c7',
            permissions: { ...scope.permissions, editContent: true }
        }
        const result = await resolveDetailsTable({ variant: 'records', enableRowReordering: true, maxRows: 1 }, editorScope, [
            { recordId, version: 4, data: { title: 'Introduction', order: 1 } },
            { recordId: childRecordId, version: 2, data: { title: 'Advanced', order: 2 } }
        ])

        expect(result).toMatchObject({ status: 'ready', data: { kind: 'table', rows: [{ cells: expect.any(Array) }] } })
        expect(JSON.stringify(result)).not.toContain('mutationTarget')
        expect(JSON.stringify(result)).not.toContain('sourceEntityCodename')
        expect(JSON.stringify(result)).not.toContain('"complete"')
    })

    it('caps the visible page at the registered bound without exposing reorder authority for a truncated set', async () => {
        const definition = getLayoutWidgetDefinition('detailsTable', { variant: 'records' })
        const slot = definition?.bindingSlots?.find(({ key }) => key === 'rows')
        if (!slot?.maxResolvedRecords) throw new Error('detailsTable row bound is missing')
        const editorScope = {
            ...scope,
            currentUserId: '0190a9b5-3cde-7abc-8def-0123456789c7',
            permissions: { ...scope.permissions, editContent: true }
        }
        const overflow = Array.from({ length: slot.maxResolvedRecords + 1 }, (_, index) => ({
            recordId: `0190a9b5-3cde-7abc-8def-${String(index).padStart(12, '0')}`,
            version: 1,
            data: {}
        }))
        const result = await resolveDetailsTable(
            { variant: 'records', enableRowReordering: true, maxRows: slot.maxResolvedRecords },
            editorScope,
            overflow
        )

        expect(result).toMatchObject({
            status: 'ready',
            data: {
                kind: 'table',
                pagination: { total: slot.maxResolvedRecords + 1, limit: slot.maxResolvedRecords, offset: 0 }
            }
        })
        expect((result as { data?: { rows?: unknown[] } }).data?.rows).toHaveLength(slot.maxResolvedRecords)
        expect(JSON.stringify(result)).not.toContain('mutationTarget')
        expect(JSON.stringify(result)).not.toContain('sourceEntityCodename')
        expect(JSON.stringify(result)).not.toContain('"complete"')
    })
})
