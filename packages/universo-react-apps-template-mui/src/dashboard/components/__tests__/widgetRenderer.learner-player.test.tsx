import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../PageBlocksView', async () => {
    const { MockPageBlocksView } = await import('./widgetRenderer.test-mocks')
    return { default: MockPageBlocksView }
})

import { placement, renderRuntimeWidget, resetRuntimeLanguage } from './widgetRenderer.test-support'
import type { ZoneWidgetItem } from './widgetRenderer.test-support'
import i18n from '@universo-react/i18n'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import { renderWidget } from '../widgetRenderer'

describe('Dashboard runtime widget ownership renderers', () => {
    afterEach(resetRuntimeLanguage)

    it('keeps learner progress identity action-only and never renders raw record ids', () => {
        const onProgressChange = vi.fn()
        const courseItemId = 'rh1.test-0190a9b53cde7abc8def0123456789b2'
        const lockedItemId = 'rh1.test-0190a9b53cde7abc8def0123456789b3'
        renderRuntimeWidget(
            placement('learnerPlayer', {
                status: 'ready',
                data: {
                    kind: 'learner-player',
                    items: [
                        {
                            key: 'lesson-intro',
                            title: 'Introduction',
                            blocks: [{ id: 'intro', type: 'paragraph', data: { text: 'Hello' } }],
                            progressTarget: { objectCodename: 'CourseItems', recordHandle: courseItemId },
                            availability: 'completed',
                            progressPercent: 100
                        },
                        {
                            key: 'lesson-next',
                            title: 'Next lesson',
                            blocks: [],
                            progressTarget: { objectCodename: 'CourseItems', recordHandle: lockedItemId },
                            availability: 'locked'
                        }
                    ]
                }
            }),
            { pagePlayer: { onProgressChange } }
        )
        expect(screen.getByTestId('runtime-learner-player')).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Introduction' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Next lesson' })).toBeDisabled()
        expect(screen.getByTestId('learner-page-blocks')).toHaveAttribute('data-count', '1')
        expect(screen.getByText('Completed')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('learner-page-complete'))
        expect(onProgressChange).toHaveBeenCalledWith({
            action: 'complete',
            target: { objectCodename: 'CourseItems', recordHandle: courseItemId }
        })
        expect(document.body).not.toHaveTextContent(courseItemId)
        expect(document.body).not.toHaveTextContent(lockedItemId)
    })

    it('allows previewing locked learner items in flexible mode without recording progress', async () => {
        const user = userEvent.setup()
        const onProgressChange = vi.fn()
        const lockedItemId = 'rh1.test-0190a9b53cde7abc8def0123456789b4'
        renderRuntimeWidget(
            placement(
                'learnerPlayer',
                {
                    status: 'ready',
                    data: {
                        kind: 'learner-player',
                        items: [
                            {
                                key: 'lesson-intro',
                                title: 'Introduction',
                                blocks: [
                                    { id: 'intro', type: 'paragraph', data: { text: 'Available lesson' } },
                                    { id: 'intro-more', type: 'paragraph', data: { text: 'More available lesson' } }
                                ],
                                progressTarget: {
                                    objectCodename: 'CourseItems',
                                    recordHandle: 'rh1.test-0190a9b53cde7abc8def0123456789b1'
                                },
                                availability: 'available'
                            },
                            {
                                key: 'lesson-locked',
                                title: 'Locked preview',
                                blocks: [{ id: 'locked', type: 'paragraph', data: { text: 'Preview content' } }],
                                progressTarget: { objectCodename: 'CourseItems', recordHandle: lockedItemId },
                                availability: 'locked'
                            }
                        ]
                    }
                },
                { variant: 'course', sequenceMode: 'flexible' }
            ),
            { pagePlayer: { completeButtonMode: 'manual', onProgressChange } }
        )

        const lockedTab = screen.getByRole('tab', { name: 'Locked preview' })
        expect(lockedTab).toBeEnabled()
        await user.click(lockedTab)
        expect(lockedTab).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByTestId('learner-page-blocks')).toHaveAttribute('data-count', '1')
        expect(screen.queryByTestId('learner-page-complete')).not.toBeInTheDocument()
        expect(onProgressChange).not.toHaveBeenCalled()
        expect(document.body).not.toHaveTextContent(lockedItemId)
    })

    it('selects learner parents accessibly, filters items, and resets on source changes', async () => {
        const user = userEvent.setup()
        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        const learnerRuntimeData = (data: Record<string, unknown>) =>
            ({ status: 'ready', data } as unknown as ZoneWidgetItem['runtimeData'])
        const makeLearnerData = (parents: Array<Record<string, unknown>>, items: Array<Record<string, unknown>>) =>
            learnerRuntimeData({ kind: 'learner-player', parents, items })
        const parents = [
            {
                key: 'course-one',
                label: 'Course One',
                target: { objectCodename: 'Courses', recordHandle: 'rh1.test-0190a9b53cde7abc8def0123456789c1' }
            },
            {
                key: 'course-two',
                label: 'Course Two',
                target: { objectCodename: 'Courses', recordHandle: 'rh1.test-0190a9b53cde7abc8def0123456789c2' }
            }
        ]
        const items = [
            {
                key: 'lesson-one',
                parentKey: 'course-one',
                title: 'Introduction',
                blocks: [{ id: 'intro', type: 'paragraph', data: { text: 'First course content' } }],
                progressTarget: { objectCodename: 'CourseItems', recordHandle: 'rh1.test-0190a9b53cde7abc8def0123456789d1' }
            },
            {
                key: 'lesson-two',
                parentKey: 'course-two',
                title: 'Advanced',
                blocks: [
                    { id: 'advanced-1', type: 'paragraph', data: { text: 'Second course content' } },
                    { id: 'advanced-2', type: 'paragraph', data: { text: 'More second course content' } }
                ],
                progressTarget: { objectCodename: 'CourseItems', recordHandle: 'rh1.test-0190a9b53cde7abc8def0123456789d2' }
            }
        ]
        const { rerender } = renderRuntimeWidget(placement('learnerPlayer', makeLearnerData(parents, items)), { locale: 'ru' })

        expect(screen.getByTestId('runtime-learner-player-parent-tabs')).toBeInTheDocument()
        expect(screen.getByRole('tablist', { name: 'Контент' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Introduction' })).toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Advanced' })).not.toBeInTheDocument()
        expect(screen.getByTestId('learner-page-blocks')).toHaveAttribute('data-count', '1')

        await user.click(screen.getByRole('tab', { name: 'Course Two' }))
        expect(screen.getByRole('tab', { name: 'Advanced' })).toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Introduction' })).not.toBeInTheDocument()
        expect(screen.getByTestId('learner-page-blocks')).toHaveAttribute('data-count', '2')

        const changedParents = [
            {
                key: 'course-three',
                label: 'Course Three',
                target: { objectCodename: 'Courses', recordHandle: 'rh1.test-0190a9b53cde7abc8def0123456789c3' }
            },
            parents[1]!
        ]
        const changedItems = [
            {
                key: 'lesson-three',
                parentKey: 'course-three',
                title: 'New introduction',
                blocks: [{ id: 'new-intro', type: 'paragraph', data: { text: 'New source content' } }],
                progressTarget: { objectCodename: 'CourseItems', recordHandle: 'rh1.test-0190a9b53cde7abc8def0123456789d3' }
            },
            items[1]!
        ]
        rerender(
            <DashboardDetailsProvider value={{ title: 'Runtime', locale: 'ru' }}>
                {renderWidget(placement('learnerPlayer', makeLearnerData(changedParents, changedItems)))}
            </DashboardDetailsProvider>
        )
        expect(screen.getByRole('tab', { name: 'Course Three' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tab', { name: 'New introduction' })).toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Advanced' })).not.toBeInTheDocument()
        expect(document.body).not.toHaveTextContent('rh1.test-0190a9b53cde7abc8def0123456789c3')
    })
})
