import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnqueueSnackbar = vi.fn()
const mockListEntityActions = vi.fn()
const mockCreateEntityAction = vi.fn()
const mockUpdateEntityAction = vi.fn()
const mockDeleteEntityAction = vi.fn()
const mockListEntityEventBindings = vi.fn()
const mockCreateEntityEventBinding = vi.fn()
const mockUpdateEntityEventBinding = vi.fn()
const mockDeleteEntityEventBinding = vi.fn()
const mockListScripts = vi.fn()

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue ?? key
    })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({
        enqueueSnackbar: mockEnqueueSnackbar
    })
}))

vi.mock('../../../scripts/api/scriptsApi', () => ({
    scriptsApi: {
        list: (...args: unknown[]) => mockListScripts(...args)
    }
}))

vi.mock('../../api/entityAutomation', () => ({
    listEntityActions: (...args: unknown[]) => mockListEntityActions(...args),
    createEntityAction: (...args: unknown[]) => mockCreateEntityAction(...args),
    updateEntityAction: (...args: unknown[]) => mockUpdateEntityAction(...args),
    deleteEntityAction: (...args: unknown[]) => mockDeleteEntityAction(...args),
    listEntityEventBindings: (...args: unknown[]) => mockListEntityEventBindings(...args),
    createEntityEventBinding: (...args: unknown[]) => mockCreateEntityEventBinding(...args),
    updateEntityEventBinding: (...args: unknown[]) => mockUpdateEntityEventBinding(...args),
    deleteEntityEventBinding: (...args: unknown[]) => mockDeleteEntityEventBinding(...args)
}))

import { createEntityActionsTab, createEntityEventsTab } from '../EntityAutomationTab'

const createLocalizedContent = (value: string) => ({
    _schema: 'v1',
    _primary: 'en',
    locales: {
        en: {
            content: value
        }
    }
})

const renderWithQueryClient = (content: React.ReactNode) => {
    const client = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0
            },
            mutations: {
                retry: false
            }
        }
    })

    return render(<QueryClientProvider client={client}>{content}</QueryClientProvider>)
}

describe('EntityAutomationTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockUpdateEntityAction.mockResolvedValue(undefined)
        mockDeleteEntityAction.mockResolvedValue(undefined)
        mockUpdateEntityEventBinding.mockResolvedValue(undefined)
        mockDeleteEntityEventBinding.mockResolvedValue(undefined)
    })

    it('shows the save-first state for actions when the entity has not been persisted yet', () => {
        const tab = createEntityActionsTab({
            t: (_key, defaultValue) => defaultValue ?? '',
            metahubId: 'metahub-1',
            entityId: null,
            attachedToKind: 'custom.product'
        })

        renderWithQueryClient(tab.content)

        expect(screen.getByText('Save this entity first to manage actions.')).toBeInTheDocument()
        expect(mockListEntityActions).not.toHaveBeenCalled()
    })

    it('validates missing script selection before creating a script action', async () => {
        const user = userEvent.setup()
        let currentActions: unknown[] = []

        mockListEntityActions.mockImplementation(async () => currentActions)
        mockListScripts.mockResolvedValue([])

        const tab = createEntityActionsTab({
            t: (_key, defaultValue) => defaultValue ?? '',
            metahubId: 'metahub-1',
            entityId: 'entity-1',
            attachedToKind: 'custom.product'
        })

        renderWithQueryClient(tab.content)

        await screen.findByText('Configured actions')
        await waitFor(() => {
            expect(screen.queryByText('Loading actions...')).not.toBeInTheDocument()
        })
        const actionTextFields = screen.getAllByRole('textbox')
        await user.type(actionTextFields[1], 'action-one')
        await user.click(screen.getByRole('button', { name: 'Create action' }))

        expect(await screen.findByText('Select a script for script actions.')).toBeInTheDocument()
        expect(mockCreateEntityAction).not.toHaveBeenCalled()
    })

    it('creates a script action and refreshes the configured actions list', async () => {
        const user = userEvent.setup()
        const savedAction = {
            id: 'action-1',
            objectId: 'entity-1',
            codename: createLocalizedContent('action-one'),
            presentation: { name: 'Action One' },
            actionType: 'script',
            scriptId: 'script-1',
            config: { retries: 1 },
            sortOrder: 2,
            version: 1,
            updatedAt: null
        }
        let currentActions: unknown[] = []

        mockListEntityActions.mockImplementation(async () => currentActions)
        mockListScripts.mockResolvedValue([
            {
                id: 'script-1',
                presentation: { name: createLocalizedContent('Script One') }
            }
        ])
        mockCreateEntityAction.mockImplementation(async () => {
            currentActions = [savedAction]
            return savedAction
        })

        const tab = createEntityActionsTab({
            t: (_key, defaultValue) => defaultValue ?? '',
            metahubId: 'metahub-1',
            entityId: 'entity-1',
            attachedToKind: 'custom.product'
        })

        renderWithQueryClient(tab.content)

        await screen.findByText('Configured actions')
        await waitFor(() => {
            expect(screen.queryByText('Loading actions...')).not.toBeInTheDocument()
        })
        const actionTextFields = screen.getAllByRole('textbox')
        await user.type(actionTextFields[0], 'Action One')
        await user.type(actionTextFields[1], 'action-one')

        await user.click(screen.getAllByRole('combobox')[1])
        await user.click(await screen.findByRole('option', { name: 'Script One' }))
        fireEvent.change(actionTextFields[2], { target: { value: '{"retries":1}' } })
        const sortOrderField = screen.getByRole('spinbutton')
        await user.clear(sortOrderField)
        await user.type(sortOrderField, '2')
        await user.click(screen.getByRole('button', { name: 'Create action' }))

        await waitFor(() => {
            expect(mockCreateEntityAction).toHaveBeenCalledWith('metahub-1', 'entity-1', {
                codename: 'action-one',
                presentation: { name: 'Action One' },
                actionType: 'script',
                scriptId: 'script-1',
                sortOrder: 2,
                config: { retries: 1 }
            })
        })

        await waitFor(() => {
            expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Action created', { variant: 'success' })
        })

        expect(await screen.findByText('Action One')).toBeInTheDocument()
    })

    it('shows the no-actions warning for event bindings and keeps creation disabled', async () => {
        mockListEntityActions.mockResolvedValue([])
        mockListEntityEventBindings.mockResolvedValue([])
        mockListScripts.mockResolvedValue([])

        const tab = createEntityEventsTab({
            t: (_key, defaultValue) => defaultValue ?? '',
            metahubId: 'metahub-1',
            entityId: 'entity-1',
            attachedToKind: 'custom.product'
        })

        renderWithQueryClient(tab.content)

        await screen.findByText('Configured event bindings')
        expect(
            await screen.findByText('No actions are available yet. Create an action in the Actions tab before binding lifecycle events.')
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create binding' })).toBeDisabled()
    })

    it('creates an event binding and refreshes the configured bindings list', async () => {
        const user = userEvent.setup()
        const savedBinding = {
            id: 'binding-1',
            objectId: 'entity-1',
            eventName: 'afterUpdate',
            actionId: 'action-1',
            priority: 3,
            isActive: true,
            config: { once: true },
            version: 1,
            updatedAt: null
        }
        let currentBindings: unknown[] = []

        mockListEntityActions.mockResolvedValue([
            {
                id: 'action-1',
                objectId: 'entity-1',
                codename: createLocalizedContent('action-one'),
                presentation: { name: 'Action One' },
                actionType: 'script',
                scriptId: 'script-1',
                config: {},
                sortOrder: 1,
                version: 1,
                updatedAt: null
            }
        ])
        mockListEntityEventBindings.mockImplementation(async () => currentBindings)
        mockListScripts.mockResolvedValue([
            {
                id: 'script-1',
                presentation: { name: createLocalizedContent('Script One') }
            }
        ])
        mockCreateEntityEventBinding.mockImplementation(async () => {
            currentBindings = [savedBinding]
            return savedBinding
        })

        const tab = createEntityEventsTab({
            t: (_key, defaultValue) => defaultValue ?? '',
            metahubId: 'metahub-1',
            entityId: 'entity-1',
            attachedToKind: 'custom.product'
        })

        renderWithQueryClient(tab.content)

        await screen.findByText('Configured event bindings')
        await waitFor(() => {
            expect(screen.queryByText('Loading event bindings...')).not.toBeInTheDocument()
        })
        const bindingComboboxes = screen.getAllByRole('combobox')
        await user.click(bindingComboboxes[1])
        await user.click(await screen.findByRole('option', { name: 'Action One · Script One' }))
        const priorityField = screen.getByRole('spinbutton')
        await user.clear(priorityField)
        await user.type(priorityField, '3')
        const bindingTextFields = screen.getAllByRole('textbox')
        fireEvent.change(bindingTextFields[0], { target: { value: '{"once":true}' } })
        await user.click(screen.getByRole('button', { name: 'Create binding' }))

        await waitFor(() => {
            expect(mockCreateEntityEventBinding).toHaveBeenCalledWith('metahub-1', 'entity-1', {
                eventName: 'afterUpdate',
                actionId: 'action-1',
                priority: 3,
                isActive: true,
                config: { once: true }
            })
        })

        await waitFor(() => {
            expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Event binding created', { variant: 'success' })
        })

        expect(await screen.findByText('afterUpdate → Action One · Script One')).toBeInTheDocument()
    })
})
