import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'

interface Account {
    id: string
    unikId: string
    name: string
    balance: number
    currency: string
}

export function createAccountRoutes(): Router {
    const router = Router({ mergeParams: true })
    const accounts: Account[] = []

    router.get('/', (req: Request, res: Response) => {
        const { unikId } = req.params
        res.json(accounts.filter((a) => a.unikId === unikId))
    })

    router.post('/', (req: Request, res: Response) => {
        const { unikId } = req.params
        if (!unikId) {
            return res.status(400).json({ error: 'unikId required' })
        }
        const { name, balance, currency } = req.body
        const newAccount: Account = {
            id: randomUUID(),
            unikId,
            name,
            balance,
            currency
        }
        accounts.push(newAccount)
        res.status(201).json(newAccount)
    })

    router.put('/:id', (req: Request, res: Response) => {
        const { unikId, id } = req.params as { unikId?: string; id: string }
        const account = accounts.find((a) => a.id === id && a.unikId === unikId)
        if (!account) {
            return res.status(404).json({ error: 'Account not found' })
        }

        const { name, balance, currency } = req.body
        if (name !== undefined) account.name = name
        if (balance !== undefined) account.balance = balance
        if (currency !== undefined) account.currency = currency

        res.json(account)
    })

    router.delete('/:id', (req: Request, res: Response) => {
        const { unikId, id } = req.params as { unikId?: string; id: string }
        const index = accounts.findIndex((a) => a.id === id && a.unikId === unikId)
        if (index === -1) {
            return res.status(404).json({ error: 'Account not found' })
        }
        accounts.splice(index, 1)
        res.status(204).send()
    })

    return router
}

export default createAccountRoutes
