import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'

interface Currency {
    id: string
    unikId: string
    code: string
    name: string
    rate: number
}

export function createCurrencyRoutes(): Router {
    const router = Router({ mergeParams: true })
    const currencies: Currency[] = []

    router.get('/', (req: Request, res: Response) => {
        const { unikId } = req.params
        res.json(currencies.filter((c) => c.unikId === unikId))
    })

    router.post('/', (req: Request, res: Response) => {
        const { unikId } = req.params
        if (!unikId) {
            return res.status(400).json({ error: 'unikId required' })
        }
        const { code, name, rate } = req.body
        const newCurrency: Currency = {
            id: randomUUID(),
            unikId,
            code,
            name,
            rate
        }
        currencies.push(newCurrency)
        res.status(201).json(newCurrency)
    })

    router.put('/:id', (req: Request, res: Response) => {
        const { unikId, id } = req.params as { unikId?: string; id: string }
        const currency = currencies.find((c) => c.id === id && c.unikId === unikId)
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
        const { unikId, id } = req.params as { unikId?: string; id: string }
        const index = currencies.findIndex((c) => c.id === id && c.unikId === unikId)
        if (index === -1) {
            return res.status(404).json({ error: 'Currency not found' })
        }
        currencies.splice(index, 1)
        res.status(204).send()
    })

    return router
}

export default createCurrencyRoutes
