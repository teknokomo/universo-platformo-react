import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import enNetwork from '../../i18n/locales/en/interpretationNetwork.json'
import ruNetwork from '../../i18n/locales/ru/interpretationNetwork.json'
import enPublic from '../../i18n/locales/en/publicInterpretationNetwork.json'
import ruPublic from '../../i18n/locales/ru/publicInterpretationNetwork.json'
import { PublicInterpretationNetworkViewer } from '../PublicInterpretationNetworkViewer'
import { responses, scope } from './fixtures'

const i18n = createInstance()

beforeAll(async () => {
    await i18n.use(initReactI18next).init({
        lng: 'en',
        fallbackLng: 'en',
        resources: {
            en: { interpretationNetwork: enNetwork, publicInterpretationNetwork: enPublic },
            ru: { interpretationNetwork: ruNetwork, publicInterpretationNetwork: ruPublic }
        },
        interpolation: { escapeValue: false }
    })
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

function setup(
    locale = 'en',
    workspaceAvailable = true,
    options: { noPrimary?: boolean; initialResponse?: Response; config?: Record<string, unknown> } = {}
) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let initialResponse = options.initialResponse
    const fetcher = vi.fn(async (url: string) => {
        if (initialResponse) {
            const response = initialResponse
            initialResponse = undefined
            return response
        }
        const params = new URL(url, 'https://public.test').searchParams
        const view = params.get('view') as keyof typeof responses
        const data = responses[view]
        const response =
            options.noPrimary && view === 'materials'
                ? {
                      ...data,
                      items: (data as Extract<typeof data, { view: 'materials' }>).items.map((item) => ({ ...item, isPrimary: false }))
                  }
                : data
        return new Response(JSON.stringify({ ...response, locale: params.get('locale') }))
    })
    vi.stubGlobal('fetch', fetcher)
    const result = render(
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={client}>
                <PublicInterpretationNetworkViewer
                    {...scope}
                    locale={locale}
                    config={options.config}
                    workspaceAvailable={workspaceAvailable}
                />
            </QueryClientProvider>
        </I18nextProvider>
    )
    return { ...result, fetcher, client, user: userEvent.setup() }
}

const viewForRequest = (url: string): string => new URL(url, 'https://public.test').searchParams.get('view') ?? ''

describe('read-only public Interpretation Network composition', () => {
    it('uses the shared workspace panes, opens the primary material, and returns to the shared material list', async () => {
        const { user, fetcher, container } = setup()

        expect(await screen.findByTestId('interpretation-network-structure-pane')).toBeVisible()
        expect(screen.getByTestId('interpretation-network-workspace')).toBeVisible()
        expect(screen.getByTestId('interpretation-network-panes')).toBeVisible()
        expect(await screen.findByRole('button', { name: 'Cities' })).toBeVisible()

        await user.click(screen.getByRole('button', { name: 'Cities' }))

        expect(await screen.findByTestId('interpretation-network-matrix-workspace')).toBeVisible()
        expect(screen.getByTestId('interpretation-network-details-pane')).toBeVisible()
        expect(await screen.findByRole('heading', { name: 'City guide' })).toBeVisible()
        expect(screen.getByText('Primary Material')).toBeVisible()
        expect(screen.getByTestId('interpretation-network-material-editor')).toBeVisible()
        expect(container.querySelector('script')).toBeNull()

        await user.click(screen.getByRole('button', { name: 'Back to materials' }))
        expect(await screen.findByRole('heading', { name: 'Materials' })).toBeVisible()
        await user.click(screen.getByRole('button', { name: /Visitor notes/ }))
        expect(await screen.findByRole('heading', { name: 'Visitor notes' })).toBeVisible()

        expect(fetcher).toHaveBeenCalledTimes(4)
        expect(fetcher.mock.calls.map(([url]) => viewForRequest(url))).toEqual(['structures', 'interpretations', 'matrix', 'materials'])
        for (const [url, options] of fetcher.mock.calls as unknown as [string, RequestInit][]) {
            expect(url).toMatch(/^\/api\/v1\/public\/applications\//u)
            expect(url).not.toMatch(/\/api\/v1\/(?:applications|runtime|workspaces)\//u)
            expect(options).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store' })
        }
        expect(container.textContent).not.toMatch(/pn1\.|network-main|MaterialRef|ParentCellId|CellId|\[object Object\]/u)
        expect(container.innerHTML).not.toContain('pn1.public_')
        expect(screen.getByTestId('interpretation-network-matrix-toolbar')).toBeVisible()
        expect(screen.getByRole('button', { name: 'Table view' })).toBeVisible()
        expect(screen.getByRole('button', { name: 'Horizontal rows' })).toBeVisible()
        expect(screen.getByRole('button', { name: 'Vertical tree' })).toBeVisible()
        expect(
            screen.queryByRole('button', {
                name: /^(?:Create|Add|Save|Edit|Delete|Move|Copy|Settings|Access|Favorite|Favorites|Cell actions:|Material actions:|Language actions:)/u
            })
        ).not.toBeInTheDocument()
        expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Add language' })).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Drag cell')).not.toBeInTheDocument()
    }, 10_000)

    it('uses the normal material list when there is no primary material', async () => {
        const { user } = setup('en', true, { noPrimary: true })

        await user.click(await screen.findByRole('button', { name: 'Cities' }))

        expect(await screen.findByRole('heading', { name: 'Materials' })).toBeVisible()
        expect(screen.getByRole('button', { name: /City guide/ })).toBeVisible()
        expect(screen.getByRole('button', { name: /Visitor notes/ })).toBeVisible()
        expect(screen.queryByRole('heading', { name: 'City guide' })).not.toBeInTheDocument()
    })

    it('uses the configured single-system workspace and matrix presentation in read-only mode', async () => {
        const { user } = setup('en', true, {
            config: {
                structureMode: 'singleSystem',
                matrixMode: 'independentRows',
                allowedMatrixViews: ['horizontalRows', 'table'],
                defaultMatrixView: 'horizontalRows',
                splitPane: { enabled: false },
                positionNumbering: { enabled: false, includeRoot: true, startIndex: 1 }
            }
        })

        expect(await screen.findByTestId('interpretation-network-matrix-workspace')).toBeVisible()
        expect(await screen.findByText('Suzdal')).toBeVisible()
        expect(screen.queryByRole('button', { name: 'Cities' })).not.toBeInTheDocument()
        expect(screen.queryByRole('textbox', { name: 'Filter by title' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Horizontal rows' })).toHaveAttribute('aria-pressed', 'true')

        await user.click(screen.getByRole('button', { name: 'Table view' }))
        expect(await screen.findByRole('table', { name: 'Matrix table' })).toBeVisible()
        expect(screen.queryByRole('button', { name: /^(?:Create|Add|Save|Edit|Delete)/u })).not.toBeInTheDocument()
    })

    it('localizes and applies the read-only Structure filter in Russian', async () => {
        const { user } = setup('ru')
        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        const filter = within(structurePane).getByRole('textbox', { name: 'Фильтр по названию', exact: true })

        await user.type(filter, 'Нет такой структуры')
        expect(await within(structurePane).findByText('Нет структур по текущему фильтру.', { exact: true })).toBeVisible()
        await user.clear(filter)
        expect(await within(structurePane).findByRole('button', { name: 'Cities' })).toBeVisible()
    })

    it.each(['en', 'ru'])('localizes public errors in %s and can retry through the public endpoint', async (locale) => {
        const { fetcher, user } = setup(locale, true, {
            initialResponse: new Response(JSON.stringify({ message: 'SQL password internal' }), { status: 503 })
        })

        const text = locale === 'ru' ? ruPublic.publicViewer : enPublic.publicViewer
        expect(await screen.findByRole('alert')).toHaveTextContent(text.error)
        expect(screen.queryByText(/SQL password/u)).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: text.retry }))
        expect(await screen.findByRole('button', { name: 'Cities' })).toBeVisible()
        expect(fetcher.mock.calls.every(([url]) => url.startsWith('/api/v1/public/applications/'))).toBe(true)
    })

    it('renders a localized empty state without mounting any data request when no public workspace exists', () => {
        const { fetcher } = setup('ru', false)

        expect(screen.getByRole('alert')).toHaveTextContent(ruPublic.publicViewer.noWorkspaces)
        expect(fetcher).not.toHaveBeenCalled()
        expect(screen.queryByTestId('interpretation-network-workspace')).not.toBeInTheDocument()
    })
})
