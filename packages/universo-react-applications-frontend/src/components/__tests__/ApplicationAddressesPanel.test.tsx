import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import ApplicationAddressesPanel from '../ApplicationAddressesPanel'
import { getApplicationAliasPolicy, listAliasesByApplication } from '../../api/applicationAliasesApi'

const enqueueSnackbar = vi.hoisted(() => vi.fn())

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: () => {} },
    useTranslation: () => ({
        t: (key: string) =>
            ({
                'aliases.technicalAddress': 'Technical address',
                'aliases.technicalAddressHelp': 'The application keeps this stable link when public addresses change.',
                'aliases.actions.copy': 'Copy',
                'aliases.actions.copyStableAddress': 'Copy stable application link',
                'aliases.actions.copyStableSuccess': 'Stable application link copied',
                'aliases.actions.copyStableError': 'Could not copy the stable application link',
                'aliases.actions.copySuccess': 'Public address copied',
                'aliases.dialog.copySuccess': 'Public address copied',
                'aliases.actions.copyError': 'Could not copy the public address',
                'aliases.dialog.copyError': 'Could not copy the public address',
                'aliases.routing.title': 'Routing policy',
                'aliases.routing.loading': 'Loading routing policy',
                'aliases.routing.retry': 'Retry routing policy',
                'aliases.routing.loadError': 'Routing policy could not be loaded.',
                'aliases.routing.direct': 'Open the selected alias directly',
                'aliases.routing.canonical': 'Redirect secondary aliases to the primary alias',
                'aliases.routing.help': 'Choose how secondary aliases behave.',
                'aliases.listTitle': 'Application aliases',
                addNew: 'Add address',
                'aliases.errors.retry': 'Retry aliases',
                'aliases.errors.load': 'Aliases could not be loaded.',
                'aliases.empty': 'No aliases yet.',
                'aliases.tableAriaLabel': 'Application aliases table',
                'aliases.columns.address': 'Address',
                'aliases.columns.primary': 'Primary',
                'aliases.columns.status': 'Status',
                'aliases.columns.actions': 'Actions',
                'aliases.states.primary': 'Primary',
                'aliases.states.active': 'Active',
                'aliases.states.inactive': 'Inactive',
                'aliases.states.released': 'Released',
                'aliases.actions.copyAddress': 'Copy {{address}}',
                'aliases.actions.rename': 'Rename',
                'aliases.actions.renameAddress': 'Rename {{address}}',
                'aliases.actions.setPrimary': 'Set primary',
                'aliases.actions.setPrimaryAddress': 'Set primary {{address}}',
                'aliases.actions.release': 'Release',
                'aliases.primary.confirmTitle': 'Change primary alias',
                'aliases.primary.confirmDescription': 'Change from {{oldAddress}} to {{newAddress}}.',
                'aliases.primary.none': 'No current primary alias',
                'aliases.release.confirmTitle': 'Release alias',
                'aliases.release.confirmDescription': 'Release {{address}}.',
                'aliases.noPermission': 'You do not have permission to manage aliases.',
                'aliases.errors.save': 'The alias operation failed.',
                'aliases.errors.conflict': 'This alias is already in use.',
                'aliases.errors.reserved': 'This alias is reserved.',
                'aliases.errors.uuid': 'Use a readable alias instead of a UUID.',
                'aliases.errors.format': 'Use a valid lowercase alias.'
            }[key] ?? key)
    })
}))

vi.mock('@universo-react/store', () => ({
    useHasGlobalAccess: () => ({ loading: false, isSuperuser: true, ability: null })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar })
}))

vi.mock('@universo-react/template-mui', () => ({
    FlowListTable: ({ data, isLoading, emptyStateMessage }: { data: unknown[]; isLoading: boolean; emptyStateMessage: string }) => (
        <div data-testid='alias-table'>{isLoading ? 'loading' : data.length ? 'rows' : emptyStateMessage}</div>
    ),
    useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) })
}))

vi.mock('../../api/applicationAliasesApi', () => ({
    createApplicationAlias: vi.fn(),
    getApplicationAliasErrorCode: vi.fn(),
    getApplicationAliasPolicy: vi.fn(),
    listAliasesByApplication: vi.fn(),
    releaseApplicationAlias: vi.fn(),
    renameApplicationAlias: vi.fn(),
    setApplicationAliasPolicy: vi.fn(),
    setPrimaryApplicationAlias: vi.fn()
}))

vi.mock('../ApplicationAliasDialog', () => ({
    default: () => null
}))

const mockedGetApplicationAliasPolicy = vi.mocked(getApplicationAliasPolicy)
const mockedListAliasesByApplication = vi.mocked(listAliasesByApplication)

const renderPanel = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })

    render(
        <QueryClientProvider client={queryClient}>
            <ApplicationAddressesPanel applicationId='app-1' />
        </QueryClientProvider>
    )

    return queryClient
}

describe('ApplicationAddressesPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reports successful and failed technical-address copy operations', async () => {
        const user = userEvent.setup()
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
        mockedListAliasesByApplication.mockResolvedValue([])
        mockedGetApplicationAliasPolicy.mockResolvedValue({ routingMode: 'direct' })

        renderPanel()
        await user.click(await screen.findByRole('button', { name: 'Copy stable application link' }))

        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/a/app-1'))
        expect(enqueueSnackbar).toHaveBeenCalledWith('Stable application link copied', { variant: 'success' })

        writeText.mockRejectedValueOnce(new Error('clipboard denied'))
        await user.click(screen.getByRole('button', { name: 'Copy stable application link' }))

        expect(enqueueSnackbar).toHaveBeenCalledWith('Could not copy the stable application link', { variant: 'error' })
    })

    it('shows the labeled technical address as the single intentional raw identifier', async () => {
        mockedListAliasesByApplication.mockResolvedValue([])
        mockedGetApplicationAliasPolicy.mockResolvedValue({ routingMode: 'direct' })

        renderPanel()

        expect(await screen.findByRole('button', { name: 'Copy stable application link' })).toBeInTheDocument()
        expect(screen.getByText('Technical address')).toBeVisible()
        expect(screen.getByTestId('application-technical-address')).toHaveTextContent('/a/app-1')
    })

    it('uses the stable-link wording when copying the technical address', async () => {
        const user = userEvent.setup()
        mockedListAliasesByApplication.mockResolvedValue([])
        mockedGetApplicationAliasPolicy.mockResolvedValue({ routingMode: 'direct' })

        renderPanel()

        await user.click(await screen.findByRole('button', { name: 'Copy stable application link' }))

        expect(enqueueSnackbar).toHaveBeenCalledWith('Stable application link copied', { variant: 'success' })
    })

    it('exposes a retry action when the routing policy cannot be loaded', async () => {
        const user = userEvent.setup()
        mockedListAliasesByApplication.mockResolvedValue([])
        mockedGetApplicationAliasPolicy.mockRejectedValueOnce(new Error('temporary policy failure'))

        renderPanel()

        expect(await screen.findByText('Routing policy could not be loaded.')).toBeInTheDocument()
        mockedGetApplicationAliasPolicy.mockResolvedValue({ routingMode: 'direct' })
        await user.click(screen.getByRole('button', { name: 'Retry routing policy' }))

        expect(await screen.findByText('Open the selected alias directly')).toBeInTheDocument()
        expect(mockedGetApplicationAliasPolicy).toHaveBeenCalledTimes(2)
    })

    it('exposes a retry action when aliases cannot be loaded', async () => {
        const user = userEvent.setup()
        mockedGetApplicationAliasPolicy.mockResolvedValue({ routingMode: 'direct' })
        mockedListAliasesByApplication.mockRejectedValueOnce(new Error('temporary list failure'))

        renderPanel()

        expect(await screen.findByText('Aliases could not be loaded.')).toBeInTheDocument()
        mockedListAliasesByApplication.mockResolvedValue([])
        await user.click(screen.getByRole('button', { name: 'Retry aliases' }))

        expect(await screen.findByText('No aliases yet.')).toBeInTheDocument()
        expect(mockedListAliasesByApplication).toHaveBeenCalledTimes(2)
    })
})
