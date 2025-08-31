import { Router } from 'express'
import { createCurrencyRoutes } from './routes/currencyRoutes'
import { createAccountRoutes } from './routes/accountRoutes'
import { Transaction } from './database/entities/Transaction'
export { financeMigrations } from './database/migrations/postgres'

export const financeEntities = [Transaction]

export function createFinanceRouter(): Router {
    const router = Router({ mergeParams: true })

    router.use('/currencies', createCurrencyRoutes())
    router.use('/accounts', createAccountRoutes())

    return router
}

export default createFinanceRouter
