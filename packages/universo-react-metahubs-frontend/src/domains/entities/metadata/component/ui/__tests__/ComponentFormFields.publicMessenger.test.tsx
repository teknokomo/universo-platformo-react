import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { createInstance } from 'i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import enMetahubs from '../../../../../../i18n/locales/en/metahubs.json'
import ruMetahubs from '../../../../../../i18n/locales/ru/metahubs.json'

import { PresentationTabFields } from '../ComponentFormFields'
import { sanitizeComponentUiConfig } from '../componentListUtils'

const i18n = createInstance()

beforeAll(async () => {
    await i18n.init({
        lng: 'en',
        fallbackLng: false,
        defaultNS: 'metahubs',
        ns: ['metahubs'],
        resources: {
            en: { metahubs: enMetahubs },
            ru: { metahubs: ruMetahubs }
        },
        interpolation: { escapeValue: false }
    })
})

beforeEach(async () => {
    await i18n.changeLanguage('en')
})

const renderPresentationFields = (uiConfig: Record<string, unknown>, setValue: ReturnType<typeof vi.fn>, showPublicMessengerSafe = true) =>
    render(
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={new QueryClient()}>
                <PresentationTabFields
                    values={{ isDisplayComponent: false, uiConfig }}
                    setValue={setValue}
                    isLoading={false}
                    displayComponentLabel='Display component'
                    displayComponentHelper=''
                    displayComponentLocked={false}
                    headerAsCheckboxLabel='Header as checkbox'
                    headerAsCheckboxHelper=''
                    dataType='STRING'
                    showPublicMessengerSafe={showPublicMessengerSafe}
                />
            </QueryClientProvider>
        </I18nextProvider>
    )

describe('Component presentation settings for anonymous Messenger data', () => {
    it('shows localized explicit opt-in in English and Russian and updates uiConfig', async () => {
        const user = userEvent.setup()
        const setValue = vi.fn()
        const enLabel = enMetahubs.components.presentation.publicMessengerSafe
        const enHelper = enMetahubs.components.presentation.publicMessengerSafeHelper

        const englishView = renderPresentationFields({}, setValue)
        const enSwitch = screen.getByRole('switch', { name: enLabel })
        expect(enSwitch).not.toBeChecked()
        expect(screen.getByText(enHelper)).toBeInTheDocument()
        await user.click(enSwitch)
        expect(setValue).toHaveBeenLastCalledWith('uiConfig', { publicMessengerSafe: true })
        englishView.unmount()

        await i18n.changeLanguage('ru')
        renderPresentationFields({ publicMessengerSafe: true }, setValue)
        const ruSwitch = screen.getByRole('switch', { name: ruMetahubs.components.presentation.publicMessengerSafe })
        expect(ruSwitch).toBeChecked()
        expect(screen.getByText(ruMetahubs.components.presentation.publicMessengerSafeHelper)).toBeInTheDocument()
        await user.click(ruSwitch)
        expect(setValue).toHaveBeenLastCalledWith('uiConfig', { publicMessengerSafe: false })
    })

    it('keeps the opt-in hidden from nested component forms by default', () => {
        renderPresentationFields({}, vi.fn(), false)
        expect(screen.queryByText(enMetahubs.components.presentation.publicMessengerSafe)).not.toBeInTheDocument()
    })

    it('preserves the explicit opt-in through component UI config normalization', () => {
        expect(sanitizeComponentUiConfig('STRING', null, { publicMessengerSafe: true, widget: 'textarea', rows: 4 })).toEqual({
            publicMessengerSafe: true,
            widget: 'textarea',
            rows: 4
        })
    })
})
