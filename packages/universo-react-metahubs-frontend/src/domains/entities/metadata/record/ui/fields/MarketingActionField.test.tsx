import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DynamicFieldConfig } from '@universo-react/template-mui/components/dialogs'
import type { MarketingActionSectionTarget } from '@universo-react/types'

vi.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({
        t: (key: string, options?: { defaultValue?: string }) => {
            const labels: Record<string, string> = {
                'layouts.marketing.heroAuthoring.actionKinds.internal': 'Application page',
                'layouts.marketing.heroAuthoring.actionKinds.external': 'Website',
                'layouts.marketing.heroAuthoring.actionKinds.anchor': 'Page section',
                'layouts.marketing.heroAuthoring.actionKinds.email': 'Email',
                'layouts.marketing.heroAuthoring.actionKinds.tel': 'Phone'
            }
            return labels[key] ?? options?.defaultValue ?? key
        }
    })
}))

import MarketingActionField from './MarketingActionField'

const makeField = (required: boolean): DynamicFieldConfig =>
    ({
        id: required ? 'PrimaryAction' : 'TermsAction',
        codename: required ? 'PrimaryAction' : 'TermsAction',
        label: required ? 'Primary action' : 'Terms action',
        type: 'JSON',
        required,
        localized: false,
        validationRules: {},
        uiConfig: {}
    } as DynamicFieldConfig)

describe('MarketingActionField', () => {
    it('labels required CTA controls as a group and exposes the validation message', () => {
        render(
            <MarketingActionField
                field={makeField(true)}
                value={{ kind: 'internal', path: '/auth', target: 'same-tab' }}
                onChange={vi.fn()}
                disabled={false}
                error='Invalid destination'
                helperText='Enter a valid application path.'
            />
        )

        expect(screen.getByRole('group', { name: /Primary action/ })).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: 'Action type' })).toBeInTheDocument()
        const destination = screen.getByRole('combobox', { name: 'Application page' })
        const helper = screen.getByText('Enter a valid application path.')
        expect(destination).toHaveAttribute('id', 'primaryaction-action-input')
        expect(helper).toHaveAttribute('id', 'primaryaction-action-helper')
        expect(destination).toHaveAttribute('aria-describedby', helper.id)
        expect(document.getElementById(helper.id)).toBe(helper)
    })

    it('blocks anchor editing when a generic Entity form has no layout context', () => {
        render(
            <MarketingActionField
                field={makeField(true)}
                value={{ kind: 'anchor', href: '#pricing' }}
                onChange={vi.fn()}
                disabled={false}
                error={null}
            />
        )

        expect(screen.getByRole('combobox', { name: 'Page section' })).toHaveAttribute('aria-disabled', 'true')
        expect(screen.getAllByText('Edit this content from its layout to choose an active page section.').length).toBeGreaterThan(0)
    })

    it('uses only active layout sections and labels repeated targets distinctly', () => {
        const targets: MarketingActionSectionTarget[] = [
            {
                href: '#pricing-pricing-campus',
                sectionId: 'pricing-pricing-campus',
                labelKey: 'layouts.marketing.heroAuthoring.sections.pricing',
                defaultLabel: 'Pricing',
                instanceNumber: 2
            }
        ]
        render(
            <MarketingActionField
                field={makeField(true)}
                value={{ kind: 'anchor', href: '#pricing-pricing-campus' }}
                onChange={vi.fn()}
                disabled={false}
                error={null}
                sectionTargets={targets}
            />
        )

        expect(screen.getByRole('combobox', { name: 'Page section' })).toHaveTextContent('Pricing — 2')
    })

    it('hides a saved target key and blocks save when its section is gone', () => {
        render(
            <MarketingActionField
                field={makeField(true)}
                value={{ kind: 'anchor', href: '#pricing-retired' }}
                onChange={vi.fn()}
                disabled={false}
                error={null}
                sectionTargets={[]}
            />
        )

        expect(screen.getByRole('combobox', { name: 'Page section' })).toHaveAttribute('aria-disabled', 'true')
        expect(screen.getAllByText('This section is no longer in the current layout')).toHaveLength(2)
        expect(screen.queryByText('#pricing-retired')).not.toBeInTheDocument()
    })

    it('labels an optional terms action before the user adds it', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        render(<MarketingActionField field={makeField(false)} value={undefined} onChange={onChange} disabled={false} error={null} />)

        expect(screen.getByRole('group', { name: 'Terms action' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Add link action' }))
        expect(onChange).toHaveBeenCalledWith({ kind: 'internal', path: '/terms', target: 'same-tab' })
    })

    it('edits a typed external action through localized controls without serializing JSON', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()

        const ControlledField = () => {
            const [value, setValue] = useState<unknown>({ kind: 'internal', path: '/auth', target: 'same-tab' })
            return (
                <MarketingActionField
                    field={makeField(true)}
                    value={value}
                    onChange={(nextValue) => {
                        onChange(nextValue)
                        setValue(nextValue)
                    }}
                    disabled={false}
                    error={null}
                />
            )
        }

        render(<ControlledField />)

        await user.click(screen.getByRole('combobox', { name: 'Action type' }))
        await user.click(await screen.findByRole('option', { name: 'Website' }))

        expect(onChange).toHaveBeenLastCalledWith({ kind: 'external', url: '', target: 'new-tab' })
        const destination = screen.getByRole('textbox', { name: 'Web address' })
        await user.type(destination, 'https://example.test/contact')

        expect(onChange).toHaveBeenLastCalledWith({ kind: 'external', url: 'https://example.test/contact', target: 'new-tab' })
        expect(screen.queryByText(/\{"kind"/)).not.toBeInTheDocument()
    })
})
