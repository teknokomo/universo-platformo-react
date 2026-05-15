import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import BuiltinEntityCollectionPage, { StandardEntityChildCollectionPage } from '../BuiltinEntityCollectionPage'

vi.mock('../EntityInstanceListContent', () => ({
    default: () => <div data-testid='generic-entity-instances'>Generic entity instances</div>
}))

vi.mock('../../presets/ui/TreeEntityList', () => ({
    TreeEntityListContent: () => <div data-testid='hub-entity-list'>Hub entity list</div>
}))

vi.mock('../../presets/ui/ObjectCollectionList', () => ({
    ObjectCollectionListContent: () => <div data-testid='legacy-object-list'>Object list</div>
}))

vi.mock('../../presets/ui/ValueGroupList', () => ({
    ValueGroupListContent: () => <div data-testid='legacy-set-list'>Set list</div>
}))

vi.mock('../../presets/ui/OptionListList', () => ({
    OptionListContent: () => <div data-testid='legacy-enumeration-list'>Enumeration list</div>
}))

const renderRoute = (route: string) =>
    render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route
                    path='/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instances'
                    element={<StandardEntityChildCollectionPage />}
                />
            </Routes>
        </MemoryRouter>
    )

const renderCollectionRoute = (route: string) =>
    render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<BuiltinEntityCollectionPage />} />
            </Routes>
        </MemoryRouter>
    )

describe('StandardEntityChildCollectionPage', () => {
    it('uses the generic entity instance list for the standard ledger collection route', () => {
        renderCollectionRoute('/metahub/metahub-1/entities/ledger/instances')

        expect(screen.getByTestId('generic-entity-instances')).toBeInTheDocument()
        expect(screen.queryByTestId('legacy-object-list')).not.toBeInTheDocument()
    })

    it('uses the generic entity instance list for hub-scoped hub-assignable kinds', () => {
        renderRoute('/metahub/metahub-1/entities/page/instance/hub-1/instances')

        expect(screen.getByTestId('generic-entity-instances')).toBeInTheDocument()
        expect(screen.queryByTestId('legacy-object-list')).not.toBeInTheDocument()
    })

    it('uses the generic entity instance list for hub-scoped ledgers', () => {
        renderRoute('/metahub/metahub-1/entities/ledger/instance/hub-1/instances')

        expect(screen.getByTestId('generic-entity-instances')).toBeInTheDocument()
        expect(screen.queryByTestId('legacy-object-list')).not.toBeInTheDocument()
    })

    it('keeps the hub authoring view for hub child routes', () => {
        renderRoute('/metahub/metahub-1/entities/hub/instance/hub-1/instances')

        expect(screen.getByTestId('hub-entity-list')).toBeInTheDocument()
        expect(screen.queryByTestId('generic-entity-instances')).not.toBeInTheDocument()
    })
})
