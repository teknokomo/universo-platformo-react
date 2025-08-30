export { createUniksRouter as createFinanceRouter } from './routes/uniksRoutes'
import { Transaction } from './database/entities/Transaction'
export { financeMigrations } from './database/migrations/postgres'

export const financeEntities = [Transaction]
