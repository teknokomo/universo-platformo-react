import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'

interface Account {
    id: string
    name: string
    balance: number
    currency: string
}

export function createAccountRoutes(): Router {
    const router = Router()
    const accounts: Account[] = []

    router.get('/', (req: Request, res: Response) => {
        res.json(accounts)
    })

    router.post('/', (req: Request, res: Response) => {
        const { name, balance, currency } = req.body
        const newAccount: Account = {
            id: randomUUID(),
            name,
            balance,
            currency
        }
        accounts.push(newAccount)
        res.status(201).json(newAccount)
    })

    router.put('/:id', (req: Request, res: Response) => {
        const account = accounts.find((a) => a.id === req.params.id)
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
        const index = accounts.findIndex((a) => a.id === req.params.id)
        if (index === -1) {
            return res.status(404).json({ error: 'Account not found' })
        }
        accounts.splice(index, 1)
        res.status(204).send()
    })

    return router
}

export default createAccountRoutes
