import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppDataResponse } from '../../api/api'
import type { CrudDataAdapter } from '../../api/types'
import { useDashboardBoundRowActions, type PendingDashboardRowTarget } from '../useDashboardBoundRowActions'

const onSelectObjectCollection = vi.fn()
const onGuardFailure = vi.fn()
const onMutationSuccess = vi.fn()
const onMutationError = vi.fn()
const handleStateRowMenuOpen = vi.fn()

const relationScope = { fieldCodename: 'customer', parentRecordId: 'parent-row-1' }
const rowTarget = { entityCodename: 'orders', recordHandle: 'row-1', relationScope }

const createAppData = (permissions = { createContent: true, editContent: true, deleteContent: true }) =>
    ({
        objectCollection: { id: 'target-entity', codename: 'orders', tableName: 'orders', name: 'Orders' },
        permissions
    } as AppDataResponse)

const createAdapter = (overrides: Partial<CrudDataAdapter> = {}): CrudDataAdapter => ({
    queryKeyPrefix: ['dashboard-runtime', 'app-1'],
    fetchList: vi.fn(async () => createAppData()),
    fetchRow: vi.fn(async () => ({ version: 7, data: { title: 'Order 1' } })),
    createRow: vi.fn(async () => ({ id: 'created-row' })),
    updateRow: vi.fn(async () => ({ id: 'row-1' })),
    deleteRow: vi.fn(async () => undefined),
    copyRow: vi.fn(async () => ({ id: 'copied-row' })),
    recordCommand: vi.fn(async () => ({ id: 'row-1', version: 8 })),
    workflowAction: vi.fn(async () => ({ id: 'row-1', version: 8 })),
    ...overrides
})

function DashboardBoundRowActionsHarness({ adapter }: { adapter: CrudDataAdapter }) {
    const [pendingTarget, setPendingTarget] = useState<PendingDashboardRowTarget | null>(null)
    const actions = useDashboardBoundRowActions({
        applicationId: 'app-1',
        locale: 'en',
        adapter,
        currentWorkspaceId: 'workspace-1',
        currentSectionId: 'current-entity',
        resolveRowTargetSectionId: () => 'target-entity',
        onSelectObjectCollection,
        setPendingRowTarget: setPendingTarget,
        handleStateRowMenuOpen,
        onGuardFailure,
        onMutationSuccess,
        onMutationError
    })

    return (
        <>
            <button onClick={(event) => actions.handleOpenDashboardRowMenu(event, rowTarget.recordHandle, rowTarget)}>Open actions</button>
            <button onClick={() => actions.handleOpenBoundRowTargetAction('row-1', 'edit', 7)}>Edit current row</button>
            <button onClick={() => actions.handleOpenBoundRowTargetAction('row-1', 'edit', 6)}>Edit stale row</button>
            <button onClick={() => actions.handleBoundRecordCommand('row-1', 'post')}>Post row</button>
            <button onClick={() => actions.handleBoundWorkflowAction('row-1', 'ApproveOrder')}>Run workflow</button>
            <output data-testid='query-state'>{actions.rowActionLoadState.status}</output>
            <output data-testid='row-version'>{actions.rowActionLoadState.data?.version ?? ''}</output>
            <output data-testid='pending-target'>{pendingTarget ? JSON.stringify(pendingTarget) : ''}</output>
        </>
    )
}

const renderHarness = (adapter = createAdapter()) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })
    const result = render(
        <QueryClientProvider client={queryClient}>
            <DashboardBoundRowActionsHarness adapter={adapter} />
        </QueryClientProvider>
    )
    return { ...result, queryClient }
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useDashboardBoundRowActions', () => {
    it('loads the bound row in the resolved entity and workspace scope, preserves relation scope, and rejects stale versions', async () => {
        const adapter = createAdapter()
        renderHarness(adapter)

        fireEvent.click(screen.getByRole('button', { name: 'Open actions' }))

        await waitFor(() => {
            expect(adapter.fetchList).toHaveBeenCalledWith(
                expect.objectContaining({
                    objectCollectionId: 'target-entity',
                    sectionId: 'target-entity',
                    workspaceId: 'workspace-1',
                    locale: 'en'
                })
            )
            expect(adapter.fetchRow).toHaveBeenCalledWith(
                'row-1',
                expect.objectContaining({ objectCollectionId: 'target-entity', sectionId: 'target-entity', workspaceId: 'workspace-1' })
            )
            expect(screen.getByTestId('query-state')).toHaveTextContent('ready')
        })

        fireEvent.click(screen.getByRole('button', { name: 'Edit current row' }))

        await waitFor(() =>
            expect(screen.getByTestId('pending-target')).toHaveTextContent(
                JSON.stringify({ sectionId: 'target-entity', rowId: 'row-1', action: 'edit', expectedVersion: 7, relationScope })
            )
        )
        expect(onSelectObjectCollection).toHaveBeenCalledWith('target-entity')

        fireEvent.click(screen.getByRole('button', { name: 'Edit stale row' }))
        expect(onGuardFailure).toHaveBeenCalledWith('target')
    })

    it('dispatches record commands with the current row version and calls the success handler', async () => {
        let resolveRefetch: ((row: { version: number; data: Record<string, unknown> }) => void) | undefined
        const adapter = createAdapter({
            fetchRow: vi
                .fn()
                .mockResolvedValueOnce({ version: 7, data: { title: 'Order 1' } })
                .mockImplementationOnce(() => new Promise((resolve) => (resolveRefetch = resolve)))
        })
        renderHarness(adapter)
        fireEvent.click(screen.getByRole('button', { name: 'Open actions' }))
        await waitFor(() => expect(screen.getByTestId('query-state')).toHaveTextContent('ready'))

        fireEvent.click(screen.getByRole('button', { name: 'Post row' }))

        await waitFor(() =>
            expect(adapter.recordCommand).toHaveBeenCalledWith('row-1', 'post', {
                objectCollectionId: 'target-entity',
                sectionId: 'target-entity',
                workspaceId: 'workspace-1',
                expectedVersion: 7
            })
        )
        await waitFor(() => expect(adapter.fetchRow).toHaveBeenCalledTimes(2))
        expect(screen.getByTestId('query-state')).toHaveTextContent('loading')
        expect(screen.getByTestId('row-version')).toBeEmptyDOMElement()

        await act(async () => {
            resolveRefetch?.({ version: 8, data: { title: 'Order 1' } })
        })

        await waitFor(() => expect(onMutationSuccess).toHaveBeenCalledWith({ kind: 'record', command: 'post' }))
        await waitFor(() => {
            expect(adapter.fetchRow).toHaveBeenCalledTimes(2)
            expect(screen.getByTestId('query-state')).toHaveTextContent('ready')
            expect(screen.getByTestId('row-version')).toHaveTextContent('8')
        })
    })

    it('dispatches workflow actions with the current version and reports mutation failures', async () => {
        const error = new Error('Workflow transition was rejected.')
        const adapter = createAdapter({ workflowAction: vi.fn().mockRejectedValue(error) })
        renderHarness(adapter)
        fireEvent.click(screen.getByRole('button', { name: 'Open actions' }))
        await waitFor(() => expect(screen.getByTestId('query-state')).toHaveTextContent('ready'))

        fireEvent.click(screen.getByRole('button', { name: 'Run workflow' }))

        await waitFor(() =>
            expect(adapter.workflowAction).toHaveBeenCalledWith('row-1', 'ApproveOrder', {
                objectCollectionId: 'target-entity',
                sectionId: 'target-entity',
                workspaceId: 'workspace-1',
                expectedVersion: 7
            })
        )
        await waitFor(() => expect(onMutationError).toHaveBeenCalledWith(error, { kind: 'workflow', actionCodename: 'ApproveOrder' }))
    })

    it('does not open a row action when the resolved Entity denies the permission', async () => {
        const adapter = createAdapter({
            fetchList: vi.fn(async () => createAppData({ createContent: true, editContent: false, deleteContent: true }))
        })
        renderHarness(adapter)
        fireEvent.click(screen.getByRole('button', { name: 'Open actions' }))
        await waitFor(() => expect(screen.getByTestId('query-state')).toHaveTextContent('ready'))

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Edit current row' }))
        })

        expect(onSelectObjectCollection).not.toHaveBeenCalled()
        expect(screen.getByTestId('pending-target')).toBeEmptyDOMElement()
        expect(onGuardFailure).not.toHaveBeenCalled()
    })

    it('fails closed when the fetched Entity does not match the bound target', async () => {
        const appData = createAppData()
        const adapter = createAdapter({
            fetchList: vi.fn(async () => ({ ...appData, objectCollection: { ...appData.objectCollection, id: 'unexpected-entity' } }))
        })
        renderHarness(adapter)
        fireEvent.click(screen.getByRole('button', { name: 'Open actions' }))

        await waitFor(() => expect(screen.getByTestId('query-state')).toHaveTextContent('error'))
        expect(screen.getByTestId('row-version')).toBeEmptyDOMElement()
        expect(screen.getByTestId('pending-target')).toBeEmptyDOMElement()
    })

    it('fails closed when the fetched row has no positive safe version', async () => {
        const adapter = createAdapter({ fetchRow: vi.fn(async () => ({ version: Number.MAX_SAFE_INTEGER + 1, data: {} })) })
        renderHarness(adapter)
        fireEvent.click(screen.getByRole('button', { name: 'Open actions' }))

        await waitFor(() => expect(screen.getByTestId('query-state')).toHaveTextContent('error'))
        expect(screen.getByTestId('row-version')).toBeEmptyDOMElement()
        expect(screen.getByTestId('pending-target')).toBeEmptyDOMElement()
    })
})
