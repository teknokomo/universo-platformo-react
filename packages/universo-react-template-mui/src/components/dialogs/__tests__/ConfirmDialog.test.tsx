import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ConfirmDialog } from '../ConfirmDialog'
import { ConfirmContextProvider } from '../../../contexts'
import { useConfirm } from '../../../hooks/useConfirm'

const ConfirmHarness = ({ onResult }: { onResult: (value: boolean) => void }) => {
    const { confirm } = useConfirm()

    return (
        <button
            type='button'
            onClick={() => {
                void confirm({
                    title: 'Release public address?',
                    description: '/a/example will stop routing.',
                    confirmButtonName: 'Release',
                    cancelButtonName: 'Keep'
                }).then(onResult)
            }}
        >
            Trigger confirm
        </button>
    )
}

describe('ConfirmDialog', () => {
    it('renders one accessible confirmation dialog without resize or fullscreen controls and resolves actions', async () => {
        const user = userEvent.setup()
        const results: boolean[] = []

        render(
            <ConfirmContextProvider>
                <ConfirmHarness onResult={(value) => results.push(value)} />
                <ConfirmDialog />
            </ConfirmContextProvider>
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Trigger confirm' }))

        const dialog = await screen.findByRole('dialog')
        expect(dialog).toHaveAccessibleName('Release public address?')
        expect(screen.getByText('/a/example will stop routing.')).toBeVisible()
        // Destructive confirmation dialogs must not expose resize or
        // fullscreen affordances.
        expect(screen.queryByRole('button', { name: /resize|fullscreen/i })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Release' }))
        await waitFor(() => expect(results).toEqual([true]))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

        await user.click(screen.getByRole('button', { name: 'Trigger confirm' }))
        await user.click(await screen.findByRole('button', { name: 'Keep' }))
        await waitFor(() => expect(results).toEqual([true, false]))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
})
