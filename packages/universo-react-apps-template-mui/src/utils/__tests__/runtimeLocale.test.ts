import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    getRuntimeLocationSnapshot,
    readRuntimeLocale,
    restoreRuntimeLocation,
    subscribeRuntimeLocation,
    updateRuntimeLocale
} from '../runtimeLocale'

describe('runtimeLocale', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/')
    })

    afterEach(() => {
        window.history.replaceState({}, '', '/')
    })

    it('updates the hosted query without dropping runtime target parameters', () => {
        window.history.replaceState(
            {},
            '',
            '/a/application?targetKind=page&entityTypeId=018f8a78-7b8f-7c1d-a111-222233334444&workspaceId=018f8a78-7b8f-7c1d-a111-222233334445&locale=en'
        )

        expect(readRuntimeLocale()).toBe('en')
        expect(updateRuntimeLocale('ru')).toBe(
            '/a/application?targetKind=page&entityTypeId=018f8a78-7b8f-7c1d-a111-222233334444&workspaceId=018f8a78-7b8f-7c1d-a111-222233334445&locale=en'
        )
        expect(window.location.pathname).toBe('/a/application')
        expect(new URLSearchParams(window.location.search).get('locale')).toBe('ru')
        expect(new URLSearchParams(window.location.search).get('entityTypeId')).toBe('018f8a78-7b8f-7c1d-a111-222233334444')
    })

    it('updates the locale inside a standalone hash route', () => {
        window.history.replaceState(
            {},
            '',
            '/#/a/application?targetKind=object&entityTypeId=018f8a78-7b8f-7c1d-a111-222233334444&locale=en'
        )

        expect(readRuntimeLocale()).toBe('en')
        updateRuntimeLocale('ru', 'replace')

        expect(window.location.hash).toBe('#/a/application?targetKind=object&entityTypeId=018f8a78-7b8f-7c1d-a111-222233334444&locale=ru')
        expect(window.location.search).toBe('')
    })

    it('notifies subscribers for browser history changes', () => {
        const listener = vi.fn()
        const unsubscribe = subscribeRuntimeLocation(listener)

        updateRuntimeLocale('ru')

        expect(listener).toHaveBeenCalledTimes(1)
        expect(getRuntimeLocationSnapshot()).toContain('locale=ru')
        unsubscribe()
        restoreRuntimeLocation('/')
        expect(listener).toHaveBeenCalledTimes(1)
    })
})
