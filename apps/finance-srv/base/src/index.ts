export { createUniksRouter as createFinanceRouter } from './routes/uniksRoutes'
import { Unik } from './database/entities/Unik'
import { UserUnik } from './database/entities/UserUnik'

export const financeEntities = [Unik, UserUnik]
