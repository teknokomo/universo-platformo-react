import { Router } from 'express'
import { createCurrencyRoutes } from './routes/currencyRoutes'
import { createAccountRoutes } from './routes/accountRoutes'
import { Transaction } from './database/entities/Transaction'
export { financeMigrations } from './database/migrations/postgres'

export const financeEntities = [Transaction]

export function createFinanceRouter(): Router {
    const router = Router()

    router.use('/currencies', createCurrencyRoutes())
    router.use('/accounts', createAccountRoutes())

    const mainRouter = Router()
    mainRouter.use('/finance', router)

    return mainRouter
}

export default createFinanceRouter
