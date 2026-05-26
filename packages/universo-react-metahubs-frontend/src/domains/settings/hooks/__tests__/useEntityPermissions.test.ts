import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useEntityPermissions } from '../useEntityPermissions'

const mockUseSettings = vi.fn()

vi.mock('../useSettings', () => ({
    useSettings: () => mockUseSettings()
}))

describe('useEntityPermissions', () => {
    it('applies the object policy fallback for template-managed custom object-like kinds', () => {
        mockUseSettings.mockReturnValue({
            data: {
                settings: [
                    { key: 'entity.catalog.allowCopy', value: { _value: true } },
                    { key: 'entity.object.allowCopy', value: { _value: false } },
                    { key: 'entity.catalog.allowDelete', value: { _value: true } },
                    { key: 'entity.object.allowDelete', value: { _value: false } }
                ]
            },
            isLoading: false
        })

        const { result } = renderHook(() => useEntityPermissions('catalog'))

        expect(result.current.allowCopy).toBe(false)
        expect(result.current.allowDelete).toBe(false)
        expect(result.current.isLoading).toBe(false)
    })
})
