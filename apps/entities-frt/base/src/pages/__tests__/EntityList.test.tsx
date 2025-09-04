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
    useTranslation: () => ({ t: (k: string) => k })
}))

vi.mock('../../api/entities', () => ({
    listEntities: vi.fn(),
    listTemplates: vi.fn(),
    listStatuses: vi.fn()
}))

let callCount = 0
const entity = { id: '1', titleEn: 'Entity 1', titleRu: 'Сущность 1', templateId: 't1', statusId: 's1' }
const template = { id: 't1', name: 'Template 1' }
const status = { id: 's1', name: 'Status 1' }

vi.mock('flowise-ui/src/hooks/useApi', () => ({
    __esModule: true,
    default: () => {
        callCount++
        const base = { loading: false, error: null, request: vi.fn(), data: null as any }
        if (callCount === 1) return { ...base, data: [entity] }
        if (callCount === 2) return { ...base, data: [template] }
        if (callCount === 3) return { ...base, data: [status] }
        return base
    }
}))

import EntityList from '../EntityList'

test('navigates to entity detail on row click', async () => {
    render(
        <MemoryRouter>
            <EntityList />
        </MemoryRouter>
    )
    const cell = await screen.findByText('Entity 1')
    await userEvent.click(cell.closest('tr') as HTMLElement)
    expect(navigate).toHaveBeenCalledWith('/entities/1')
})
