import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({ state: null as Record<string, unknown> | null }))

vi.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({
        t: (_key: string, fallback?: string | { defaultValue?: string; count?: number }) =>
            typeof fallback === 'string'
                ? fallback
                : fallback?.defaultValue?.replace('{{count}}', String(fallback.count ?? '{{count}}')) ?? _key
    })
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, fallback?: string | { defaultValue?: string }) => fallback ?? key })
}))

vi.mock('../useMarketingHeroBindingDialog', () => ({
    useMarketingHeroBindingDialog: () => mocked.state
}))

import MarketingHeroBindingDialog from '../MarketingHeroBindingDialog'

const state = () => ({
    locale: 'en',
    treeEntityId: 'tree-1',
    formFields: [],
    actionFieldIds: new Set<string>(),
    actionSectionTargets: [],
    actionSectionTargetsState: 'ready',
    recordFormInitialData: undefined,
    recordFieldError: null,
    clearRecordFieldError: vi.fn(),
    selectedRecordId: null,
    recordSearch: '',
    recordPage: 0,
    recordPageCount: 1,
    setRecordPage: vi.fn(),
    isRecordSearchActive: false,
    recordOptions: [],
    sources: [
        { entityId: 'source-1', entityCodename: 'HeroContent', name: 'Hero content', recordsCount: 2, otherWidgetUsageCount: 0 },
        { entityId: 'source-2', entityCodename: 'CampaignHero', name: 'Campaign hero', recordsCount: 4, otherWidgetUsageCount: 0 }
    ],
    sourcesLoading: false,
    selectedSourceId: 'source-1',
    sharedSourceUsageCount: 0,
    sharedUsageCount: 0,
    selectedOption: null,
    currentBindingId: null,
    isBindingDirty: false,
    isLoading: false,
    queryError: null,
    treeEntityMissing: false,
    heroEntityMissing: false,
    selectedRecordError: null,
    hasSelectedRecord: false,
    isSelectedRecordFetching: false,
    isRecordsFetching: false,
    hasNoRecords: true,
    bindingError: null,
    recordFormMode: null,
    isDirectBoundEdit: false,
    recordFormError: null,
    isSavingRecord: false,
    isSavingBinding: false,
    selectedBindingReady: false,
    canConfigure: false,
    handleRecordInputChange: vi.fn(),
    handleRecordChange: vi.fn(),
    handleSourceChange: vi.fn(),
    handleProvisionSource: vi.fn().mockResolvedValue({}),
    openRecordForm: vi.fn(),
    closeRecordForm: vi.fn(),
    chooseAnotherRecord: vi.fn(),
    handleSaveBinding: vi.fn(),
    handleRecordSubmit: vi.fn(),
    handleRetry: vi.fn(),
    retrySelectedRecord: vi.fn()
})

describe('MarketingHeroBindingDialog shared runtime primitives', () => {
    beforeEach(() => {
        mocked.state = state()
    })

    it('renders the shared dialog and exposes the binding slot authoring metadata', () => {
        render(
            <MemoryRouter>
                <MarketingHeroBindingDialog
                    open
                    metahubId='metahub-1'
                    layoutId='layout-1'
                    widgetId='widget-1'
                    widgetVersion={1}
                    heroObjectId='hero-object-1'
                    locale='en'
                    canManageLayouts
                    canEditContent
                    initialConfig={{}}
                    onClose={vi.fn()}
                    onBindingSaved={vi.fn().mockResolvedValue(undefined)}
                    onConfigurePresentation={vi.fn()}
                />
            </MemoryRouter>
        )

        expect(screen.getByRole('dialog', { name: 'Hero content' })).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: 'Content record' })).toBeInTheDocument()
        expect(screen.getByText('Choose the Entity record displayed by this widget.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create record' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Edit record' })).toBeDisabled()
    })

    it('reveals advanced source controls and provisions a separate data model from the expanded settings', async () => {
        const user = userEvent.setup()
        const provision = vi.fn().mockResolvedValue({})
        mocked.state = { ...state(), handleProvisionSource: provision }
        render(
            <MemoryRouter>
                <MarketingHeroBindingDialog
                    open
                    metahubId='metahub-1'
                    layoutId='layout-1'
                    widgetId={null}
                    widgetVersion={null}
                    heroObjectId='source-1'
                    locale='en'
                    canManageLayouts
                    canEditContent
                    initialConfig={{}}
                    onClose={vi.fn()}
                    onBindingSaved={vi.fn().mockResolvedValue(undefined)}
                    onConfigurePresentation={vi.fn()}
                />
            </MemoryRouter>
        )

        await user.click(screen.getByText('Source settings'))
        expect(screen.getByRole('combobox', { name: 'Content source' })).toBeInTheDocument()
        await user.click(screen.getByRole('combobox', { name: 'Content source' }))
        await user.click(await screen.findByText('Campaign hero'))
        expect(mocked.state?.handleSourceChange).toHaveBeenCalledWith('source-2')
        await user.type(screen.getByRole('textbox', { name: 'Object name' }), 'Campaign hero')
        await user.type(screen.getByRole('textbox', { name: 'Object codename' }), 'campaign_hero')
        await user.click(screen.getByRole('button', { name: 'Create separate data model' }))
        await waitFor(() => expect(provision).toHaveBeenCalledWith({ codename: 'campaign_hero', name: 'Campaign hero' }))
    })

    it('explains the required codename format when a separate model cannot be created', async () => {
        const user = userEvent.setup()
        render(
            <MemoryRouter>
                <MarketingHeroBindingDialog
                    open
                    metahubId='metahub-1'
                    layoutId='layout-1'
                    widgetId={null}
                    widgetVersion={null}
                    heroObjectId='source-1'
                    locale='en'
                    canManageLayouts
                    canEditContent
                    initialConfig={{}}
                    onClose={vi.fn()}
                    onBindingSaved={vi.fn().mockResolvedValue(undefined)}
                    onConfigurePresentation={vi.fn()}
                />
            </MemoryRouter>
        )

        await user.click(screen.getByText('Source settings'))
        const codenameInput = screen.getByRole('textbox', { name: 'Object codename' })
        await user.type(codenameInput, '9-invalid')

        expect(screen.getByText('Use 2–64 lowercase letters, numbers, or underscores; start with a letter.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create separate data model' })).toBeDisabled()
    })

    it('shows the localized shared record warning and keeps management actions unavailable', () => {
        mocked.state = { ...state(), sharedUsageCount: 2 }
        render(
            <MemoryRouter>
                <MarketingHeroBindingDialog
                    open
                    metahubId='metahub-1'
                    layoutId='layout-1'
                    widgetId='widget-1'
                    widgetVersion={2}
                    heroObjectId='source-1'
                    locale='en'
                    canManageLayouts={false}
                    canEditContent
                    initialConfig={{}}
                    onClose={vi.fn()}
                    onBindingSaved={vi.fn().mockResolvedValue(undefined)}
                    onConfigurePresentation={vi.fn()}
                />
            </MemoryRouter>
        )

        expect(screen.getByText('This record is used by 2 other Hero placements. Changes will appear there too.')).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: 'Content record' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Edit record' })).toBeDisabled()
    })

    it('explains when the selected Object source is already used by other Hero placements', () => {
        mocked.state = {
            ...state(),
            sources: [{ ...state().sources[0]!, otherWidgetUsageCount: 2 }],
            sharedSourceUsageCount: 2
        }
        render(
            <MemoryRouter>
                <MarketingHeroBindingDialog
                    open
                    metahubId='metahub-1'
                    layoutId='layout-1'
                    widgetId='widget-1'
                    widgetVersion={1}
                    heroObjectId='source-1'
                    locale='en'
                    canManageLayouts
                    canEditContent
                    initialConfig={{}}
                    onClose={vi.fn()}
                    onBindingSaved={vi.fn().mockResolvedValue(undefined)}
                    onConfigurePresentation={vi.fn()}
                />
            </MemoryRouter>
        )

        expect(
            screen.getByText(
                'This Object source is used by 2 other Hero placements. Edits are shared when placements use the same content record.'
            )
        ).toBeInTheDocument()
    })

    it('does not offer record rebinding to a content editor who cannot manage layouts', () => {
        mocked.state = {
            ...state(),
            recordFormMode: 'edit',
            isDirectBoundEdit: true
        }
        render(
            <MemoryRouter>
                <MarketingHeroBindingDialog
                    open
                    metahubId='metahub-1'
                    layoutId='layout-1'
                    widgetId='widget-1'
                    widgetVersion={1}
                    heroObjectId='hero-object-1'
                    locale='en'
                    canManageLayouts={false}
                    canEditContent
                    initialConfig={{}}
                    onClose={vi.fn()}
                    onBindingSaved={vi.fn().mockResolvedValue(undefined)}
                    onConfigurePresentation={vi.fn()}
                />
            </MemoryRouter>
        )

        expect(screen.getByRole('dialog', { name: 'Edit Hero content' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Choose another record and discard unsaved changes' })).not.toBeInTheDocument()
    })
})
