import type { PageBlockContent, PublicInterpretationNetworkReadResponse } from '@universo-react/types'
import {
    readPublicInterpretationNetwork,
    PublicNetworkReadError,
    type PublicNetworkReadInput,
    type PublicNetworkView
} from './publicInterpretationNetworkApi'

type ReadResult<View extends PublicNetworkView> = Extract<PublicInterpretationNetworkReadResponse, { view: View }>

const MAX_PUBLIC_NETWORK_PAGES = 100

export async function readAllPublicPages<View extends PublicNetworkView>(
    input: Omit<PublicNetworkReadInput, 'offset'> & { view: View },
    signal: AbortSignal
): Promise<ReadResult<View>> {
    let offset = 0
    let firstPage: ReadResult<View> | undefined
    const items: unknown[] = []

    for (let pageNumber = 0; pageNumber < MAX_PUBLIC_NETWORK_PAGES; pageNumber += 1) {
        const response = await readPublicInterpretationNetwork({ ...input, offset }, signal)
        if (response.view !== input.view) throw new PublicNetworkReadError()
        const page = response as ReadResult<View>
        firstPage ??= page
        // The strict response parser and view equality check refine the heterogeneous union at runtime.
        items.push(...page.items)
        if (!page.page.hasMore) {
            return {
                ...firstPage,
                items: items as ReadResult<View>['items'],
                page: { ...firstPage.page, hasMore: false }
            } as ReadResult<View>
        }

        const nextOffset = page.page.offset + page.page.limit
        if (nextOffset <= offset || nextOffset > 10_000) throw new PublicNetworkReadError()
        offset = nextOffset
    }

    throw new PublicNetworkReadError()
}

const escapeEditorText = (value: string): string =>
    value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;')

export const toReadOnlyEditorContent = (value: string): PageBlockContent => {
    const characters = Array.from(value).filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0
        return !(
            codePoint <= 0x08 ||
            codePoint === 0x0b ||
            codePoint === 0x0c ||
            (codePoint >= 0x0e && codePoint <= 0x1f) ||
            codePoint === 0x7f
        )
    })
    const blocks = []
    for (let start = 0; start < characters.length; start += 1000) {
        blocks.push({ type: 'paragraph' as const, data: { text: escapeEditorText(characters.slice(start, start + 1000).join('')) } })
    }
    if (blocks.length === 0) blocks.push({ type: 'paragraph' as const, data: { text: '' } })
    return { format: 'editorjs', data: { blocks } }
}
