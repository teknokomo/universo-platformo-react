import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '../../../i18n'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import RuntimeMenuWidget from '../RuntimeMenuWidget'
import type { ZoneWidgetItem } from '../../contracts'

describe('RuntimeMenuWidget workspace navigation', () => {
    it('shows only the first configured link in anonymous application navigation', () => {
        window.history.replaceState({}, '', '/a/public-lms?locale=en')
        const widget = {
            id: 'public-widget',
            instanceKey: 'public-menu',
            widgetKey: 'menuWidget',
            zone: 'left',
            sortOrder: 0,
            config: {},
            isActive: true,
            parentInstanceKey: null,
            slotKey: null,
            runtimeData: {
                status: 'ready',
                data: {
                    kind: 'menu',
                    title: 'Navigation',
                    showTitle: false,
                    overflowLabel: 'More',
                    items: [
                        {
                            key: 'start',
                            label: 'Start',
                            icon: null,
                            kind: 'section',
                            target: { kind: 'page', codename: 'Start' }
                        },
                        {
                            key: 'structures',
                            label: 'Structures',
                            icon: null,
                            kind: 'section',
                            target: { kind: 'object', codename: 'Structure' }
                        }
                    ],
                    overflowItems: [{ key: 'settings', label: 'Settings', icon: null, kind: 'link', href: 'https://example.test/settings' }]
                }
            }
        } as unknown as ZoneWidgetItem

        render(
            <DashboardDetailsProvider
                value={{
                    title: '',
                    applicationId: 'public-lms',
                    locale: 'en',
                    runtimeAccessMode: 'public',
                    workspacesEnabled: true,
                    navigate: vi.fn()
                }}
            >
                <RuntimeMenuWidget widget={widget} variant='wide' />
            </DashboardDetailsProvider>
        )

        expect(screen.getByRole('link', { name: 'Start' })).toBeVisible()
        expect(screen.getAllByRole('link')).toHaveLength(1)
        expect(screen.queryByRole('link', { name: 'Structures' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
    })

    it('shows the complete generated entity navigation in public Messenger without workspace or freeform links', () => {
        window.history.replaceState({}, '', '/a/public-messenger?locale=en')
        const navigate = vi.fn()
        const widget = {
            id: 'messenger-widget',
            instanceKey: 'messenger-menu',
            widgetKey: 'menuWidget',
            zone: 'center',
            sortOrder: 1,
            config: { variant: 'generated' },
            isActive: true,
            parentInstanceKey: 'messenger-tabs',
            slotKey: 'tab:overview',
            runtimeData: {
                status: 'ready',
                data: {
                    kind: 'menu',
                    title: 'Navigation',
                    showTitle: false,
                    overflowLabel: 'More',
                    items: [
                        { key: 'start', label: 'Start', icon: null, kind: 'section', target: { kind: 'page', codename: 'Start' } },
                        { key: 'library', label: 'Library', icon: null, kind: 'section', target: { kind: 'object', codename: 'Library' } },
                        { key: 'workspaces', label: 'Workspaces', icon: null, kind: 'workspaces' },
                        { key: 'admin', label: 'Manage members', icon: null, kind: 'link', href: '/a/public-messenger/workspaces' }
                    ],
                    overflowItems: [{ key: 'overflow-admin', label: 'Settings', icon: null, kind: 'link', href: '/settings' }]
                }
            }
        } as unknown as ZoneWidgetItem

        render(
            <DashboardDetailsProvider
                value={{
                    title: 'Public Messenger',
                    applicationId: 'public-messenger',
                    locale: 'en',
                    runtimeAccessMode: 'public',
                    runtimeTemplateKey: 'messenger-app',
                    currentWorkspaceId: 'workspace-alpha',
                    workspacesEnabled: true,
                    navigate
                }}
            >
                <RuntimeMenuWidget widget={widget} variant='wide' />
            </DashboardDetailsProvider>
        )

        expect(screen.getByRole('link', { name: 'Start' })).toBeVisible()
        expect(screen.getByRole('link', { name: 'Library' })).toBeVisible()
        expect(screen.getAllByRole('link')).toHaveLength(2)
        expect(screen.queryByRole('link', { name: 'Workspaces' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Manage members' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('link', { name: 'Library' }))
        expect(navigate).toHaveBeenCalledTimes(1)
        expect(navigate.mock.calls[0]?.[0]).toContain('entityTypeCodename=Library')
    })

    it('shows the localized empty state when Messenger has no published navigation items', () => {
        const widget = {
            id: 'messenger-widget',
            instanceKey: 'messenger-menu',
            widgetKey: 'menuWidget',
            zone: 'center',
            sortOrder: 1,
            config: { variant: 'generated' },
            isActive: true,
            parentInstanceKey: 'messenger-tabs',
            slotKey: 'tab:overview',
            runtimeData: {
                status: 'ready',
                data: { kind: 'menu', title: 'Navigation', showTitle: false, overflowLabel: 'More', items: [], overflowItems: [] }
            }
        } as unknown as ZoneWidgetItem

        render(
            <DashboardDetailsProvider value={{ title: 'Messenger', locale: 'en', runtimeTemplateKey: 'messenger-app' }}>
                <RuntimeMenuWidget widget={widget} variant='wide' />
            </DashboardDetailsProvider>
        )

        expect(screen.getByRole('status')).toHaveTextContent('No matching content was found.')
    })

    it('omits duplicate workspace-list items while retaining active workspace routes', () => {
        window.history.replaceState({}, '', '/a/runtime-alias?locale=en&workspaceId=workspace-alpha')
        const navigate = vi.fn()
        const widget = {
            id: 'widget-1',
            instanceKey: 'menu-main',
            widgetKey: 'menuWidget',
            zone: 'center',
            sortOrder: 0,
            config: {},
            isActive: true,
            parentInstanceKey: null,
            slotKey: null,
            runtimeData: {
                status: 'ready',
                data: {
                    kind: 'menu',
                    title: 'Runtime navigation',
                    showTitle: false,
                    overflowLabel: 'More',
                    items: [
                        { key: 'workspaces-placeholder', label: 'Workspaces', icon: null, kind: 'workspaces' },
                        { key: 'workspaces-list', label: 'Workspace list', icon: null, kind: 'link', href: '/a/runtime-alias/workspaces' }
                    ],
                    overflowItems: []
                }
            }
        } as unknown as ZoneWidgetItem

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
                <RuntimeMenuWidget widget={widget} variant='wide' />
            </DashboardDetailsProvider>
        )

        expect(screen.queryByRole('link', { name: 'Workspaces' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Workspace list' })).not.toBeInTheDocument()
        const dashboard = screen.getByRole('link', { name: 'Dashboard' })
        expect(dashboard).toHaveAttribute('href', '/a/runtime-alias/workspaces/workspace-alpha?locale=en&workspaceId=workspace-alpha')
        fireEvent.click(dashboard)
        expect(navigate).toHaveBeenCalledWith('/a/runtime-alias/workspaces/workspace-alpha?locale=en&workspaceId=workspace-alpha')
    })
})
