import { CreateMetahubsSchema1766351182000 } from './1766351182000-CreateMetahubsSchema'
import { AddCatalogsToMetahubs1766400000000 } from './1766400000000-AddCatalogsToMetahubs'

// Export all metahubs migrations in order
export const metahubsMigrations = [
    CreateMetahubsSchema1766351182000,
    AddCatalogsToMetahubs1766400000000
]
