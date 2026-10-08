import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, render } from '@testing-library/react'
import i18n from '@universo-react/i18n'

vi.mock('../../../shared-theme/ColorModeIconDropdown', async () => {
    const { MockColorModeIconDropdown } = await import('./widgetRenderer.test-mocks')
    return { default: MockColorModeIconDropdown }
})

import { placement, renderRuntimeWidget, resetRuntimeLanguage } from './widgetRenderer.test-support'
import type { ZoneWidgetItem } from './widgetRenderer.test-support'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import { renderWidget } from '../widgetRenderer'

describe('Dashboard runtime widget ownership renderers', () => {
    afterEach(resetRuntimeLanguage)

    it('projects entity-backed menu and workspace routes into an ephemeral same-origin view', () => {
        window.history.replaceState(
            {},
            '',
            '/a/runtime-alias?targetKind=object&entityTypeCodename=Courses&locale=ru&workspaceId=workspace-alpha&themeVariant=dark'
        )
        const widget = placement('menuWidget', {
            status: 'ready',
            data: {
                kind: 'menu',
                title: 'Runtime navigation',
                showTitle: true,
                overflowLabel: 'More',
                items: [
                    {
                        key: 'nav.hub.LearningHub',
                        label: 'Learning',
                        icon: null,
                        kind: 'group',
                        target: { kind: 'hub', codename: 'LearningHub' }
                    },
                    {
                        key: 'nav.LearningHub.object.Courses',
                        label: 'Courses',
                        icon: 'school',
                        kind: 'section',
                        target: { kind: 'object', codename: 'Courses' }
                    },
                    {
                        key: 'manual.help',
                        label: 'Help',
                        icon: null,
                        kind: 'link',
                        href: '/help'
                    },
                    {
                        key: 'runtime-workspaces',
                        label: 'Legacy placeholder label is ignored',
                        icon: 'apps',
                        kind: 'workspaces'
                    }
                ],
                overflowItems: []
            }
        } as unknown as ZoneWidgetItem['runtimeData'])

        render(
            <DashboardDetailsProvider
                value={{
                    title: 'Runtime',
                    applicationId: '0190a9b5-3cde-7abc-8def-0123456789ac',
                    locale: 'ru',
                    settings: { sectionLinksEnabled: true },
                    currentWorkspaceId: 'workspace-alpha',
                    runtimeAccessMode: 'member',
                    workspacesEnabled: true
                }}
            >
                {renderWidget(widget)}
            </DashboardDetailsProvider>
        )

        expect(screen.getByRole('navigation', { name: 'Application navigation' })).toBeInTheDocument()
        expect(screen.queryByText('Legacy placeholder label is ignored')).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Learning' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Learning' })).not.toBeInTheDocument()

        const coursesHref = screen.getByRole('link', { name: 'Courses' }).getAttribute('href') ?? ''
        const coursesUrl = new URL(coursesHref, window.location.origin)
        expect(coursesUrl.pathname).toBe('/a/runtime-alias')
        expect(coursesUrl.searchParams.get('targetKind')).toBe('object')
        expect(coursesUrl.searchParams.get('entityTypeCodename')).toBe('Courses')
        expect(coursesUrl.searchParams.get('entityTypeId')).toBeNull()
        expect(coursesUrl.searchParams.get('workspaceId')).toBe('workspace-alpha')
        expect(coursesUrl.searchParams.get('locale')).toBe('ru')
        expect(coursesUrl.searchParams.get('themeVariant')).toBe('dark')
        expect(screen.getByRole('link', { name: 'Courses' })).toHaveAttribute('aria-current', 'page')
        expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help')
        const workspaceLinks = [
            ['Рабочие пространства', '/a/runtime-alias/workspaces', 'AppsRoundedIcon'],
            ['Дашборд', '/a/runtime-alias/workspaces/workspace-alpha', 'DashboardRoundedIcon'],
            ['Доступ', '/a/runtime-alias/workspaces/workspace-alpha/access', 'PeopleRoundedIcon'],
            ['Настройки', '/a/runtime-alias/workspaces/workspace-alpha/settings', 'SettingsRoundedIcon']
        ] as const
        for (const [label, pathname, icon] of workspaceLinks) {
            const link = screen.getByRole('link', { name: label })
            const url = new URL(link.getAttribute('href') ?? '', window.location.origin)
            expect(url.origin).toBe(window.location.origin)
            expect(url.pathname).toBe(pathname)
            expect(url.searchParams.get('workspaceId')).toBe('workspace-alpha')
            expect(url.searchParams.get('locale')).toBe('ru')
            expect(url.searchParams.get('themeVariant')).toBe('dark')
            expect(link.querySelector(`svg[data-testid="${icon}"]`)).toBeInTheDocument()
        }
    })

    it('delegates generated workspace navigation to the host SPA router', () => {
        window.history.replaceState({}, '', '/a/runtime-alias?locale=en&workspaceId=workspace-alpha')
        const navigate = vi.fn()
        const widget = placement('menuWidget', {
            status: 'ready',
            data: {
                kind: 'menu',
                title: 'Runtime navigation',
                showTitle: false,
                overflowLabel: 'More',
                items: [],
                overflowItems: []
            }
        } as unknown as ZoneWidgetItem['runtimeData'])

        render(
            <DashboardDetailsProvider
                value={{
                    title: 'Runtime',
                    applicationId: '0190a9b5-3cde-7abc-8def-0123456789ac',
                    locale: 'en',
                    currentWorkspaceId: 'workspace-alpha',
                    runtimeAccessMode: 'member',
                    workspacesEnabled: true,
                    navigate
                }}
            >
                {renderWidget(widget)}
            </DashboardDetailsProvider>
        )

        fireEvent.click(screen.getByRole('link', { name: 'Workspaces' }))

        expect(navigate).toHaveBeenCalledOnce()
        expect(navigate).toHaveBeenCalledWith('/a/runtime-alias/workspaces?locale=en&workspaceId=workspace-alpha')
        expect(window.location.pathname).toBe('/a/runtime-alias')
    })

    it('does not render a menu fallback when menuWidget runtimeData is absent', () => {
        const widget = placement('menuWidget')

        const view = render(
            <DashboardDetailsProvider value={{ title: 'Runtime', locale: 'en' }}>{renderWidget(widget)}</DashboardDetailsProvider>
        )

        expect(view.container).toBeEmptyDOMElement()
    })

    it('uses the application root when section-specific links are disabled and preserves safe runtime context', () => {
        window.history.replaceState(
            {},
            '',
            '/a/runtime-alias?targetKind=object&entityTypeCodename=Courses&locale=ru&workspaceId=workspace-alpha&themeVariant=dark'
        )
        const widget = placement('menuWidget', {
            status: 'ready',
            data: {
                kind: 'menu',
                title: 'Runtime navigation',
                showTitle: false,
                overflowLabel: 'More',
                items: [
                    {
                        key: 'nav.LearningHub.object.Courses',
                        label: 'Courses',
                        icon: 'school',
                        kind: 'section',
                        target: { kind: 'object', codename: 'Courses' }
                    }
                ],
                overflowItems: []
            }
        } as unknown as ZoneWidgetItem['runtimeData'])

        renderRuntimeWidget(widget, {
            applicationId: '0190a9b5-3cde-7abc-8def-0123456789ac',
            locale: 'ru',
            sectionCodename: 'Landing',
            objectCollectionCodename: 'Courses',
            settings: { sectionLinksEnabled: false },
            currentWorkspaceId: 'workspace-alpha',
            runtimeAccessMode: 'member',
            workspacesEnabled: false
        })

        const coursesLink = screen.getByRole('link', { name: 'Courses' })
        const href = coursesLink.getAttribute('href') ?? ''
        const url = new URL(href, window.location.origin)
        expect(url.origin).toBe(window.location.origin)
        expect(url.pathname).toBe('/a/runtime-alias')
        expect(url.searchParams.get('targetKind')).toBeNull()
        expect(url.searchParams.get('entityTypeCodename')).toBeNull()
        expect(url.searchParams.get('entityTypeId')).toBeNull()
        expect(url.searchParams.get('locale')).toBe('ru')
        expect(url.searchParams.get('workspaceId')).toBe('workspace-alpha')
        expect(url.searchParams.get('themeVariant')).toBe('dark')
        expect(coursesLink).toHaveAttribute('aria-current', 'page')
    })

    it('adds workspace links from host details without exposing physical workspace IDs in labels', () => {
        window.history.replaceState({}, '', '/a/runtime-alias/workspaces/workspace-alpha/access?locale=ru&themeVariant=dark')
        const widget = placement('menuWidget', {
            status: 'ready',
            data: {
                kind: 'menu',
                title: 'Runtime navigation',
                showTitle: false,
                overflowLabel: 'More',
                items: [],
                overflowItems: []
            }
        } as unknown as ZoneWidgetItem['runtimeData'])

        renderRuntimeWidget(widget, {
            applicationId: '0190a9b5-3cde-7abc-8def-0123456789ac',
            locale: 'ru',
            runtimeAccessMode: 'member',
            workspacesEnabled: true
        })

        const accessLink = screen.getByRole('link', { name: 'Доступ' })
        expect(accessLink).toHaveAttribute('aria-current', 'page')
        expect(accessLink.getAttribute('href')).toContain('/workspaces/workspace-alpha/access?')
        expect(screen.queryByText('workspace-alpha')).not.toBeInTheDocument()
    })

    it('does not derive workspace identity from an encoded path separator', () => {
        window.history.replaceState({}, '', '/a/runtime-alias/workspaces/%2F/access?locale=en')
        const widget = placement('menuWidget', {
            status: 'ready',
            data: {
                kind: 'menu',
                title: 'Runtime navigation',
                showTitle: false,
                overflowLabel: 'More',
                items: [],
                overflowItems: []
            }
        } as unknown as ZoneWidgetItem['runtimeData'])

        renderRuntimeWidget(widget, {
            applicationId: 'application-1',
            runtimeAccessMode: 'member',
            workspacesEnabled: true
        })

        expect(screen.queryByRole('link', { name: 'Access' })).not.toBeInTheDocument()
    })

    it('does not project workspace links when disabled or in public runtime mode', () => {
        const widget = placement('menuWidget', {
            status: 'ready',
            data: {
                kind: 'menu',
                title: 'Runtime navigation',
                showTitle: false,
                overflowLabel: 'More',
                items: [{ key: 'workspace-placeholder', label: 'Workspaces', icon: null, kind: 'workspaces' }],
                overflowItems: []
            }
        } as unknown as ZoneWidgetItem['runtimeData'])
        const { rerender } = renderRuntimeWidget(widget, {
            applicationId: '0190a9b5-3cde-7abc-8def-0123456789ac',
            workspacesEnabled: false,
            currentWorkspaceId: 'workspace-alpha'
        })
        expect(screen.queryByRole('link', { name: 'Workspaces' })).not.toBeInTheDocument()

        rerender(
            <DashboardDetailsProvider
                value={{
                    title: 'Runtime',
                    applicationId: '0190a9b5-3cde-7abc-8def-0123456789ac',
                    workspacesEnabled: true,
                    runtimeAccessMode: 'public',
                    currentWorkspaceId: 'workspace-alpha'
                }}
            >
                {renderWidget(widget)}
            </DashboardDetailsProvider>
        )
        expect(screen.queryByRole('link', { name: 'Workspaces' })).not.toBeInTheDocument()
    })

    it('renders host profile and only exposes configured, host-supported options', () => {
        const profileView = renderRuntimeWidget(placement('userProfile'), {
            currentUser: { displayName: 'member@example.com' }
        })
        expect(screen.getByText('member@example.com')).toBeInTheDocument()
        profileView.unmount()

        const noCapabilityView = renderRuntimeWidget(placement('optionsMenu', undefined, { visibleActions: ['preferences'] }))
        expect(noCapabilityView.container).toBeEmptyDOMElement()
        noCapabilityView.unmount()

        renderRuntimeWidget(placement('optionsMenu', undefined, { visibleActions: ['preferences'] }), {
            hostCapabilities: ['theme.safe']
        })
        expect(screen.getByRole('button', { name: 'Preferences' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument()
    })

    it('keeps Preferences available when the dedicated color-mode placement is inactive', () => {
        const options = placement('optionsMenu', undefined, { visibleActions: ['preferences'] })
        const inactiveColorMode = { ...placement('colorModeSwitcher'), isActive: false }

        render(
            <DashboardDetailsProvider value={{ title: 'Runtime', locale: 'en', hostCapabilities: ['theme.safe'] }}>
                {renderWidget(options, { placements: [options, inactiveColorMode] })}
            </DashboardDetailsProvider>
        )

        expect(screen.getByRole('button', { name: 'Preferences' })).toBeInTheDocument()
    })

    it('localizes both Dashboard theme-control paths from the shared common namespace', async () => {
        await act(async () => {
            await i18n.changeLanguage('ru')
        })

        const dedicatedView = renderRuntimeWidget(placement('colorModeSwitcher'), { locale: 'ru' })
        const dedicatedControl = dedicatedView.getByRole('button', { name: 'Цветовая схема' })
        expect(dedicatedControl).toHaveAttribute('data-system-label', 'Системная')
        expect(dedicatedControl).toHaveAttribute('data-light-label', 'Светлая')
        expect(dedicatedControl).toHaveAttribute('data-dark-label', 'Тёмная')
        dedicatedView.unmount()

        const preferencesView = renderRuntimeWidget(placement('optionsMenu', undefined, { visibleActions: ['preferences'] }), {
            locale: 'ru',
            hostCapabilities: ['theme.safe']
        })
        const preferencesControl = preferencesView.container.querySelector('button')
        expect(preferencesControl).not.toBeNull()
        expect(preferencesControl).toHaveAttribute('data-system-label', 'Системная')
        expect(preferencesControl).toHaveAttribute('data-light-label', 'Светлая')
        expect(preferencesControl).toHaveAttribute('data-dark-label', 'Тёмная')
    })
})
