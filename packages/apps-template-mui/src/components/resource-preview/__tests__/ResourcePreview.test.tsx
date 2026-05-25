import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ResourcePreview } from '../ResourcePreview'

const i18nMockState = vi.hoisted(() => ({
    language: 'en',
    namespaces: [] as Array<string | undefined>
}))

vi.mock('react-i18next', () => ({
    useTranslation: (namespace?: string) => ({
        i18n: { language: i18nMockState.language },
        t: (key: string, fallback: string, values?: Record<string, unknown>) => {
            i18nMockState.namespaces.push(namespace)
            const translationsByLocale: Record<string, Record<string, string>> = {
                en: {
                    'resourceSource.types.page': 'Page',
                    'resourceSource.types.url': 'Link',
                    'resourceSource.types.video': 'Video',
                    'resourceSource.types.audio': 'Audio',
                    'resourceSource.types.document': 'Document',
                    'resourceSource.types.scorm': 'SCORM',
                    'resourceSource.types.xapi': 'xAPI',
                    'resourceSource.types.embed': 'Embed',
                    'resourceSource.types.file': 'File'
                },
                ru: {
                    'resourcePreview.openPage': 'Открыть страницу',
                    'resourceSource.types.page': 'Страница',
                    'resourceSource.types.url': 'Ссылка',
                    'resourceSource.types.video': 'Видео',
                    'resourceSource.types.audio': 'Аудио',
                    'resourceSource.types.document': 'Документ',
                    'resourceSource.types.scorm': 'SCORM',
                    'resourceSource.types.xapi': 'xAPI',
                    'resourceSource.types.embed': 'Встраивание',
                    'resourceSource.types.file': 'Файл'
                }
            }
            const translations = translationsByLocale[i18nMockState.language] ?? translationsByLocale.en
            const text = translations[key] ?? fallback
            return Object.entries(values ?? {}).reduce(
                (label, [valueKey, value]) => label.replace(new RegExp(`{{\\s*${valueKey}\\s*}}`, 'g'), String(value)),
                text
            )
        }
    })
}))

describe('ResourcePreview', () => {
    beforeEach(() => {
        i18nMockState.language = 'en'
        i18nMockState.namespaces = []
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
        expect(screen.getByText('Video')).toBeInTheDocument()
        expect(screen.getByTestId('resource-preview-domain')).toHaveTextContent('Domain: cdn.example.test')
        const video = document.querySelector('video')
        expect(video).toHaveAttribute('src', 'https://cdn.example.test/lesson.mp4')
        expect(video).toHaveAttribute('controls')
    })

    it('renders a safe link resource with a readable domain badge and external action', () => {
        render(
            <ResourcePreview
                title='Policy link'
                source={{
                    type: 'url',
                    url: 'https://docs.example.test/policies/security'
                }}
            />
        )

        expect(screen.getByText('Policy link')).toBeInTheDocument()
        expect(screen.getByText('Link')).toBeInTheDocument()
        expect(screen.queryByText('url')).not.toBeInTheDocument()
        expect(screen.getByTestId('resource-preview-domain')).toHaveTextContent('Domain: docs.example.test')
        expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', 'https://docs.example.test/policies/security')
    })

    it('keeps long resource titles readable instead of forcing a no-wrap caption', () => {
        const longTitle = 'Very long security policy link title that should wrap inside the resource preview surface'

        render(
            <ResourcePreview
                title={longTitle}
                source={{
                    type: 'url',
                    url: 'https://docs.example.test/policies/security'
                }}
            />
        )

        expect(screen.getByText(longTitle)).not.toHaveClass('MuiTypography-noWrap')
    })

    it('sanitizes unsafe preview title and description text', () => {
        const rawRecordId = '550e8400-e29b-41d4-a716-446655440000'

        render(
            <ResourcePreview
                title={`Resource ${rawRecordId}`}
                description='{"recordId":"550e8400-e29b-41d4-a716-446655440000","targetId":"550e8400-e29b-41d4-a716-446655440001"}'
                source={{
                    type: 'url',
                    url: 'https://docs.example.test/policies/security'
                }}
            />
        )

        expect(screen.getByText('Resource')).toBeInTheDocument()
        expect(screen.queryByText((content) => content.includes(rawRecordId))).not.toBeInTheDocument()
        expect(screen.queryByText(/recordId|targetId/)).not.toBeInTheDocument()
        expect(screen.getByText('Link')).toBeInTheDocument()
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

        expect(screen.getByText('Embed')).toBeInTheDocument()
        expect(screen.queryByText('embed')).not.toBeInTheDocument()
        const frame = screen.getByTitle('Embedded resource')
        expect(frame).toHaveAttribute('src', 'https://www.youtube.com/embed/demo')
        expect(frame).toHaveAttribute('sandbox', 'allow-modules allow-same-origin allow-presentation')
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

        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent('This resource source is not valid.')
        expect(alert).not.toHaveTextContent('not allowed')
        expect(screen.queryByTestId('resource-preview-domain')).not.toBeInTheDocument()
    })

    it('does not leak raw validator messages for invalid sources', () => {
        render(<ResourcePreview source={{ type: 'video', url: '' }} />)

        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent('This resource source is not valid.')
        expect(alert).not.toHaveTextContent('String must contain')
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

        expect(screen.getByText('SCORM')).toBeInTheDocument()
        expect(screen.queryByText('scorm')).not.toBeInTheDocument()
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

        expect(screen.getByText('Page')).toBeInTheDocument()
        expect(screen.queryByText('page')).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'Open page' }))

        expect(onOpenPage).toHaveBeenCalledWith('KnowledgeArticle')
    })

    it('uses apps namespace translations and localized values for Russian page resources', async () => {
        i18nMockState.language = 'ru'
        const onOpenPage = vi.fn()

        render(
            <ResourcePreview
                title={{ en: 'Certificate policy page', ru: 'Страница политики сертификатов' }}
                description={{
                    en: 'Use this page resource inside learning flows.',
                    ru: 'Используйте этот ресурс страницы в учебных потоках.'
                }}
                source={{
                    type: 'page',
                    pageCodename: 'CertificatePolicy'
                }}
                onOpenPage={onOpenPage}
            />
        )

        expect(i18nMockState.namespaces).toContain('apps')
        expect(screen.getByText('Страница политики сертификатов')).toBeInTheDocument()
        expect(screen.getByText('Используйте этот ресурс страницы в учебных потоках.')).toBeInTheDocument()
        expect(screen.getByText('Страница')).toBeInTheDocument()
        expect(screen.queryByText('Page')).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'Открыть страницу' }))

        expect(onOpenPage).toHaveBeenCalledWith('CertificatePolicy')
    })
})
