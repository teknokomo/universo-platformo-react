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
    listEntities: vi.fn(function listEntities() {}),
    listTemplates: vi.fn(function listTemplates() {}),
    listStatuses: vi.fn(function listStatuses() {})
}))

const entity = { id: '1', titleEn: 'Entity 1', titleRu: 'Сущность 1', templateId: 't1', statusId: 's1' }
const template = { id: 't1', name: 'Template 1' }
const status = { id: 's1', name: 'Status 1' }

vi.mock('../../hooks/useApi', () => ({
    __esModule: true,
    default: (apiFunc: (...args: any[]) => any) => {
        const base = { loading: false, error: null, request: vi.fn(), data: null as any }
        switch (apiFunc.name) {
            case 'listEntities':
                return { ...base, data: [entity] }
            case 'listTemplates':
                return { ...base, data: [template] }
            case 'listStatuses':
                return { ...base, data: [status] }
            default:
                return base
        }
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
    const row = cell.closest('tr')
    expect(row).toBeInTheDocument()
    await userEvent.click(row!)
    expect(navigate).toHaveBeenCalledWith('/entities/1')
})
