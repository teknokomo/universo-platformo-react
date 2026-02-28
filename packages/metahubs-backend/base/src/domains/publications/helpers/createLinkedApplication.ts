import type { EntityManager } from 'typeorm'
import { Application, ApplicationUser, Connector, ConnectorPublication } from '@universo/applications-backend'
import { localizedContent } from '@universo/utils'
import type { VersionedLocalizedContent } from '@universo/types'
import { generateSchemaName } from '../../ddl'

const { buildLocalizedContent } = localizedContent

/**
 * Options for creating a linked Application with Connector for a Publication
 */
export interface CreateLinkedApplicationOpts {
    manager: EntityManager
    publicationId: string
    publicationName: VersionedLocalizedContent<string> | null
    publicationDescription?: VersionedLocalizedContent<string> | null
    metahubName: VersionedLocalizedContent<string> | null
    metahubDescription?: VersionedLocalizedContent<string> | null
    userId: string
}

/**
 * Result of creating a linked Application
 */
export interface CreateLinkedApplicationResult {
    application: Application
    connector: Connector
    connectorPublication: ConnectorPublication
    appSchemaName: string
}

/**
 * Shared helper: creates Application + ApplicationUser (owner) + Connector + ConnectorPublication
 * within the given EntityManager (transaction context).
 *
 * Used by:
 * - Publication CREATE handler (auto-create application)
 * - POST .../publication/:publicationId/applications endpoint
 */
export async function createLinkedApplication(opts: CreateLinkedApplicationOpts): Promise<CreateLinkedApplicationResult> {
    const { manager, publicationId, publicationName, publicationDescription, metahubName, metahubDescription, userId } = opts

    const applicationRepo = manager.getRepository(Application)
    const appUserRepo = manager.getRepository(ApplicationUser)
    const connectorRepo = manager.getRepository(Connector)
    const connectorPublicationRepo = manager.getRepository(ConnectorPublication)

    // 1. Create Application (slug set via raw update below to guarantee uniqueness per application)
    const application = applicationRepo.create({
        name: publicationName ?? buildLocalizedContent({ en: 'Application' }, 'en')!,
        description: publicationDescription ?? undefined,
        _uplCreatedBy: userId,
        _uplUpdatedBy: userId
    })
    await applicationRepo.save(application)

    // 2. Set schemaName and slug using raw update to avoid version increment.
    //    slug uses application.id (unique per app) to prevent collision when
    //    multiple applications are linked to the same publication.
    const appSchemaName = generateSchemaName(application.id)
    const appSlug = `pub-${application.id.slice(0, 8)}`
    application.schemaName = appSchemaName
    application.slug = appSlug
    await applicationRepo
        .createQueryBuilder()
        .update(Application)
        .set({ schemaName: appSchemaName, slug: appSlug })
        .where('id = :id', { id: application.id })
        .execute()

    // 3. Create ApplicationUser (owner)
    const appUser = appUserRepo.create({
        applicationId: application.id,
        userId,
        role: 'owner',
        _uplCreatedBy: userId,
        _uplUpdatedBy: userId
    })
    await appUserRepo.save(appUser)

    // 4. Create Connector
    const connector = connectorRepo.create({
        applicationId: application.id,
        name: metahubName ?? buildLocalizedContent({ en: 'Connector' }, 'en')!,
        description: metahubDescription ?? undefined,
        sortOrder: 0,
        _uplCreatedBy: userId,
        _uplUpdatedBy: userId
    })
    await connectorRepo.save(connector)

    // 5. Create ConnectorPublication
    const connectorPublication = connectorPublicationRepo.create({
        connectorId: connector.id,
        publicationId,
        sortOrder: 0,
        _uplCreatedBy: userId,
        _uplUpdatedBy: userId
    })
    await connectorPublicationRepo.save(connectorPublication)

    return { application, connector, connectorPublication, appSchemaName }
}
