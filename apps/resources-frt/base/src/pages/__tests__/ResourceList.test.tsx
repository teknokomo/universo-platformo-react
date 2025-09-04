import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { vi, test, expect } from 'vitest'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigate
    }
})

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

vi.mock('../../api/resources', () => ({
    listCategories: vi.fn(),
    listResources: vi.fn()
}))

let callCount = 0
const category = { id: 'c1', titleEn: 'Category 1', titleRu: 'Категория 1', children: [] }
const resource = { id: '1', titleEn: 'Resource 1', titleRu: 'Ресурс 1', category }

vi.mock('flowise-ui/src/hooks/useApi', () => ({
    __esModule: true,
    default: () => {
        callCount++
        const base = { loading: false, error: null, request: vi.fn(), data: null as any }
        if (callCount === 1) return { ...base, data: [category] }
        if (callCount === 2) return { ...base, data: [resource] }
        return base
    }
}))

import ResourceList from '../ResourceList'

test('navigates to resource detail on row click', async () => {
    render(
        <MemoryRouter>
            <ResourceList />
        </MemoryRouter>
    )
    const row = await screen.findByText('Resource 1')
    await userEvent.click(row.closest('tr') as HTMLElement)
    expect(navigate).toHaveBeenCalledWith('/resources/1')
})
