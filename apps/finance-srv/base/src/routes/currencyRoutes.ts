import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'

interface Currency {
    id: string
    code: string
    name: string
    rate: number
}

export function createCurrencyRoutes(): Router {
    const router = Router()
    const currencies: Currency[] = []

    router.get('/', (req: Request, res: Response) => {
        res.json(currencies)
    })

    router.post('/', (req: Request, res: Response) => {
        const { code, name, rate } = req.body
        const newCurrency: Currency = {
            id: randomUUID(),
            code,
            name,
            rate
        }
        currencies.push(newCurrency)
        res.status(201).json(newCurrency)
    })

    router.put('/:id', (req: Request, res: Response) => {
        const currency = currencies.find((c) => c.id === req.params.id)
        if (!currency) {
            return res.status(404).json({ error: 'Currency not found' })
        }

        const { code, name, rate } = req.body
        if (code !== undefined) currency.code = code
        if (name !== undefined) currency.name = name
        if (rate !== undefined) currency.rate = rate

        res.json(currency)
    })

    router.delete('/:id', (req: Request, res: Response) => {
        const index = currencies.findIndex((c) => c.id === req.params.id)
        if (index === -1) {
            return res.status(404).json({ error: 'Currency not found' })
        }
        currencies.splice(index, 1)
        res.status(204).send()
    })

    return router
}

export default createCurrencyRoutes
