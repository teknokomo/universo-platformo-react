import { CreateMetahubsSchema1766351182000 } from './1766351182000-CreateMetahubsSchema'
import { AddPublicationsTable1768720000000 } from './1768720000000-AddPublicationsTable'
import { AddPublicationVersions1769200000000 } from './1769200000000-AddPublicationVersions'
import { AddMetahubSchemaName1769300000000 } from './1769300000000-AddMetahubSchemaName'

export const metahubsMigrations = [
    CreateMetahubsSchema1766351182000,
    AddPublicationsTable1768720000000,
    AddPublicationVersions1769200000000,
    AddMetahubSchemaName1769300000000
]
