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
