import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RowActionsMenu } from '../RowActionsMenu'
import type { CrudDashboardState } from '../../hooks/useCrudDashboard'

vi.mock('@mui/material/Menu', () => ({
    default: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? <div role='menu'>{children}</div> : null)
}))

const recordBehavior = {
    mode: 'transactional' as const,
    numbering: { enabled: true, scope: 'workspace' as const, periodicity: 'none' as const, minLength: 6 },
    effectiveDate: { enabled: true, defaultToNow: true },
    lifecycle: { enabled: true, states: [] },
    posting: { mode: 'manual' as const, targetLedgers: [] },
    immutability: 'posted' as const
}

const createState = (overrides: Partial<CrudDashboardState> = {}): CrudDashboardState =>
    ({
        appData: {
            linkedCollection: {
                id: 'catalog-1',
                codename: 'documents',
                tableName: 'documents',
                name: 'Documents',
                recordBehavior
            },
            columns: [],
            rows: [{ id: 'row-1', _app_record_state: 'draft' }],
            pagination: { total: 1, limit: 20, offset: 0 },
            layoutConfig: {},
            zoneWidgets: { left: [], right: [], center: [] },
            menus: [],
            activeMenuId: null
        },
        rows: [{ id: 'row-1', _app_record_state: 'draft' }],
        menuAnchorEl: document.body,
        menuRowId: 'row-1',
        handleCloseMenu: vi.fn(),
        handleRecordCommand: vi.fn().mockResolvedValue(undefined),
        ...overrides
    } as unknown as CrudDashboardState)

const labels = {
    editText: 'Edit',
    copyText: 'Copy',
    deleteText: 'Delete',
    postText: 'Post',
    unpostText: 'Unpost',
    voidText: 'Void',
    stateDraftText: 'Draft',
    statePostedText: 'Posted',
    stateVoidedText: 'Voided',
    stateUnknownText: 'State'
}

describe('RowActionsMenu record commands', () => {
    it('shows post and void for draft transactional records', async () => {
        const handleRecordCommand = vi.fn().mockResolvedValue(undefined)
        const handleCloseMenu = vi.fn()
        const state = createState({ handleRecordCommand, handleCloseMenu })

        render(<RowActionsMenu state={state} labels={labels} permissions={{ canEdit: true, canCopy: true, canDelete: true }} />)

        expect(screen.getByText('Draft')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /^post$/i })).toBeEnabled()
        expect(screen.queryByRole('menuitem', { name: /^unpost$/i })).not.toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /^void$/i })).toBeEnabled()

        await userEvent.click(screen.getByRole('menuitem', { name: /^post$/i }))

        expect(handleRecordCommand).toHaveBeenCalledWith('row-1', 'post')
        expect(handleCloseMenu).toHaveBeenCalledTimes(1)
    })

    it('shows unpost and void for posted records', () => {
        const state = createState({
            rows: [{ id: 'row-1', _app_record_state: 'posted' }],
            appData: {
                ...createState().appData!,
                rows: [{ id: 'row-1', _app_record_state: 'posted' }]
            }
        })

        render(<RowActionsMenu state={state} labels={labels} permissions={{ canEdit: true, canCopy: true, canDelete: true }} />)

        expect(screen.getByText('Posted')).toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: /^post$/i })).not.toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /^unpost$/i })).toBeEnabled()
        expect(screen.getByRole('menuitem', { name: /^void$/i })).toBeEnabled()
    })

    it('does not show record commands when editing is denied', () => {
        render(<RowActionsMenu state={createState()} labels={labels} permissions={{ canEdit: false, canCopy: true, canDelete: true }} />)

        expect(screen.queryByRole('menuitem', { name: /^post$/i })).not.toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /^copy$/i })).toBeInTheDocument()
    })
})
