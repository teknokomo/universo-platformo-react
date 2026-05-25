import { describe, expect, it } from 'vitest'
import type { GridColDef } from '@mui/x-data-grid'
import {
    buildRuntimeColumnVisibilityOptions,
    createSafeRuntimeColumnVisibilityModel,
    isRuntimeUserFacingGridColumn
} from '../useRuntimeColumnVisibility'

describe('runtime column visibility helpers', () => {
    it('keeps technical columns out of user options and forces them hidden', () => {
        const columns: GridColDef[] = [
            { field: 'title', headerName: 'Title' },
            { field: 'status', headerName: 'Status' },
            { field: 'ProjectId', headerName: 'Project' },
            { field: 'TargetRecordId', headerName: 'Target Record ID' },
            { field: 'principal_id', headerName: 'Principal' },
            { field: '_upl_version', headerName: 'Version' },
            { field: 'sourceJson', headerName: 'Source' },
            { field: '__internalPayload', headerName: 'Internal payload' },
            { field: '__runtimeRestore', headerName: 'Actions' },
            { field: 'actions', headerName: 'Actions', hideable: false }
        ]

        const model = createSafeRuntimeColumnVisibilityModel(columns, {
            status: false,
            ProjectId: true,
            principal_id: true,
            _upl_version: true,
            sourceJson: true,
            __internalPayload: true,
            __runtimeRestore: true
        })

        expect(model).toMatchObject({
            status: false,
            ProjectId: false,
            principal_id: false,
            _upl_version: false,
            TargetRecordId: false,
            sourceJson: false,
            __internalPayload: false
        })
        expect(buildRuntimeColumnVisibilityOptions(columns, model).map((option) => option.field)).toEqual(['title', 'status'])
    })

    it('identifies user-facing columns for callers that must filter metadata presets before rendering', () => {
        const columns: GridColDef[] = [
            { field: 'title', headerName: 'Title' },
            { field: 'ProjectId', headerName: 'Project' },
            { field: 'target_record_id', headerName: 'Target row' },
            { field: '__internalPayload', headerName: 'Payload' },
            { field: '__runtimeRestore', headerName: 'Actions' },
            { field: 'actions', headerName: 'Actions' }
        ]

        expect(columns.filter(isRuntimeUserFacingGridColumn).map((column) => column.field)).toEqual([
            'title',
            '__runtimeRestore',
            'actions'
        ])
    })

    it('prevents users from hiding every configurable business column', () => {
        const columns: GridColDef[] = [
            { field: 'title', headerName: 'Title' },
            { field: 'status', headerName: 'Status' }
        ]

        const model = createSafeRuntimeColumnVisibilityModel(columns, { title: false, status: false })

        expect(model.title).toBe(true)
        expect(model.status).toBe(false)
    })
})
