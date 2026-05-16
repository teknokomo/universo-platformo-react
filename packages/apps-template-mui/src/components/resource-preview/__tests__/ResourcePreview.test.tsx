import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ResourcePreview } from '../ResourcePreview'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback
    })
}))

describe('ResourcePreview', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('renders a safe video resource with native controls', () => {
        render(
            <ResourcePreview
                title='Lesson video'
                source={{
                    type: 'video',
                    url: 'https://cdn.example.test/lesson.mp4',
                    mimeType: 'video/mp4'
                }}
            />
        )

        expect(screen.getByTestId('resource-preview')).toBeInTheDocument()
        expect(screen.getByText('Lesson video')).toBeInTheDocument()
        const video = document.querySelector('video')
        expect(video).toHaveAttribute('src', 'https://cdn.example.test/lesson.mp4')
        expect(video).toHaveAttribute('controls')
    })

    it('renders allowed embeds in a sandboxed iframe', () => {
        render(
            <ResourcePreview
                title='Embedded video'
                source={{
                    type: 'embed',
                    url: 'https://www.youtube.com/embed/demo'
                }}
            />
        )

        const frame = screen.getByTitle('Embedded resource')
        expect(frame).toHaveAttribute('src', 'https://www.youtube.com/embed/demo')
        expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation')
    })

    it('fails closed for unsafe embed hosts', () => {
        render(
            <ResourcePreview
                source={{
                    type: 'embed',
                    url: 'https://example.test/embed'
                }}
            />
        )

        expect(screen.getByRole('alert')).toHaveTextContent('not allowed')
    })

    it('keeps SCORM explicit as a deferred resource instead of pretending it can launch', () => {
        render(
            <ResourcePreview
                source={{
                    type: 'scorm',
                    packageDescriptor: {
                        manifest: 'imsmanifest.xml'
                    }
                }}
            />
        )

        expect(screen.getByRole('status')).toHaveTextContent('runtime player is not available yet')
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('keeps xAPI and storage-backed office resources deferred until runtime players exist', () => {
        const { rerender } = render(
            <ResourcePreview
                source={{
                    type: 'xapi',
                    packageDescriptor: {
                        standard: 'xAPI',
                        launch: 'index.html'
                    }
                }}
            />
        )

        expect(screen.getByRole('status')).toHaveTextContent('runtime player is not available yet')
        expect(screen.queryByRole('link')).not.toBeInTheDocument()

        rerender(
            <ResourcePreview
                source={{
                    type: 'document',
                    storageKey: 'uploads/course-plan.docx',
                    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                }}
            />
        )

        expect(screen.getByRole('status')).toHaveTextContent('runtime player is not available yet')
        expect(screen.queryByTitle('Document preview')).not.toBeInTheDocument()
    })

    it('delegates page resources through the caller instead of inventing a route', async () => {
        const onOpenPage = vi.fn()

        render(
            <ResourcePreview
                source={{
                    type: 'page',
                    pageCodename: 'KnowledgeArticle'
                }}
                onOpenPage={onOpenPage}
            />
        )

        await userEvent.click(screen.getByRole('button', { name: 'Open page' }))

        expect(onOpenPage).toHaveBeenCalledWith('KnowledgeArticle')
    })
})
