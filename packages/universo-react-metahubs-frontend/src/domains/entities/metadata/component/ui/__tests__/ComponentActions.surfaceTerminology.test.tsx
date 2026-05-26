import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

import componentActions from '../ComponentActions'

const surface = {
    editTitle: 'Edit requisite',
    copyTitle: 'Copy requisite',
    deleteTitle: 'Delete requisite',
    deleteDescription: 'Delete this requisite?',
    codenameLabel: 'Requisite code',
    codenameHelper: 'Unique requisite code',
    dataTypeLabel: 'Requisite type',
    displayLabel: 'Use as presentation requisite',
    displayHelper: 'Show this requisite in lists'
}

const buildContext = () =>
    ({
        entity: {
            id: 'component-1',
            codename: 'Description',
            name: { _primary: 'en', locales: { en: { content: 'Description' } } },
            dataType: 'STRING'
        },
        componentMap: new Map([
            [
                'component-1',
                {
                    id: 'component-1',
                    codename: 'Description',
                    name: { _primary: 'en', locales: { en: { content: 'Description' } } },
                    dataType: 'STRING',
                    validationRules: {},
                    uiConfig: {},
                    isRequired: false,
                    isDisplayComponent: false
                }
            ]
        ]),
        componentSurface: surface,
        uiLocale: 'en',
        t: (_key: string, fallback?: string) => fallback ?? _key,
        helpers: {},
        api: {}
    } as any)

describe('componentActions surface terminology', () => {
    it('uses active requisite terminology in edit and copy dialogs', () => {
        const edit = componentActions.find((action) => action.id === 'edit')
        const copy = componentActions.find((action) => action.id === 'copy')

        const editProps = edit?.dialog?.buildProps?.(buildContext())
        const copyProps = copy?.dialog?.buildProps?.(buildContext())

        expect(editProps?.title).toBe('Edit requisite')
        expect(copyProps?.title).toBe('Copy requisite')

        const editGeneralTab = editProps?.tabs?.({ values: {}, setValue: vi.fn(), isLoading: false, errors: {} })[0]
        const copyGeneralTab = copyProps?.tabs?.({ values: {}, setValue: vi.fn(), isLoading: false, errors: {} })[0]

        expect((editGeneralTab?.content as ReactElement).props.codenameLabel).toBe('Requisite code')
        expect((editGeneralTab?.content as ReactElement).props.dataTypeLabel).toBe('Requisite type')
        expect((copyGeneralTab?.content as ReactElement).props.codenameLabel).toBe('Requisite code')
        expect((copyGeneralTab?.content as ReactElement).props.dataTypeLabel).toBe('Requisite type')
    })

    it('uses active requisite terminology in delete dialog', () => {
        const deleteAction = componentActions.find((action) => action.id === 'delete')

        const deleteProps = deleteAction?.dialog?.buildProps?.(buildContext())

        expect(deleteProps?.title).toBe('Delete requisite')
        expect(deleteProps?.description).toBe('Delete this requisite?')
    })
})
