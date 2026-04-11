import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import GeneralTabFields from '../GeneralTabFields'

const localizedInlineFieldMock = vi.fn(() => <div />)

vi.mock('@universo/template-mui', () => ({
    LocalizedInlineField: (props: Record<string, unknown>) => {
        localizedInlineFieldMock(props)
        return <div />
    },
    useCodenameAutoFillVlc: vi.fn()
}))

vi.mock('../../../../components', () => ({
    CodenameField: () => <div />
}))

vi.mock('../../../settings/hooks/useCodenameConfig', () => ({
    useCodenameConfig: () => ({
        style: 'pascal-case',
        alphabet: 'en-ru',
        allowMixed: false,
        autoConvertMixedAlphabets: true,
        autoReformat: true,
        requireReformat: true
    })
}))

describe('GeneralTabFields', () => {
    beforeEach(() => {
        localizedInlineFieldMock.mockClear()
    })

    it('disables localized auto-initialization while loading', () => {
        render(
            <GeneralTabFields
                values={{ nameVlc: null, descriptionVlc: null, codename: null, codenameTouched: false }}
                setValue={vi.fn()}
                isLoading
                nameLabel='Name'
                descriptionLabel='Description'
                codenameLabel='Codename'
                codenameHelper='Helper'
            />
        )

        const [nameProps, descriptionProps] = localizedInlineFieldMock.mock.calls.map(([props]) => props)
        expect(nameProps.autoInitialize).toBe(false)
        expect(descriptionProps.autoInitialize).toBe(false)
    })

    it('keeps localized auto-initialization enabled when not loading', () => {
        render(
            <GeneralTabFields
                values={{ nameVlc: null, descriptionVlc: null, codename: null, codenameTouched: false }}
                setValue={vi.fn()}
                isLoading={false}
                nameLabel='Name'
                descriptionLabel='Description'
                codenameLabel='Codename'
                codenameHelper='Helper'
            />
        )

        const [nameProps, descriptionProps] = localizedInlineFieldMock.mock.calls.map(([props]) => props)
        expect(nameProps.autoInitialize).toBe(true)
        expect(descriptionProps.autoInitialize).toBe(true)
    })
})
