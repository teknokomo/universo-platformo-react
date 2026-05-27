import { z } from 'zod'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import {
    attachMetahubPackage,
    changeMetahubPackageVersion,
    detachMetahubPackage,
    listMetahubPackages,
    listPackageCatalog
} from '../../../persistence'

const packageNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(214)
    .regex(/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/, 'Package name must be a scoped npm package name')
const versionSchema = z.string().trim().min(1).max(64)

const attachPackageSchema = z
    .object({
        packageName: packageNameSchema,
        version: versionSchema
    })
    .strict()

const changePackageVersionSchema = z
    .object({
        version: versionSchema
    })
    .strict()

export function createPackagesController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const listCatalog = createHandler(async ({ res, metahubId, exec }) => {
        const items = await listPackageCatalog(exec, metahubId)
        return res.json({ items, total: items.length })
    })

    const listAttached = createHandler(async ({ res, metahubId, exec }) => {
        const items = await listMetahubPackages(exec, metahubId)
        return res.json({ items, total: items.length })
    })

    const attach = createHandler(
        async ({ req, res, metahubId, userId, exec }) => {
            const parsed = attachPackageSchema.safeParse(req.body)
            if (!parsed.success) {
                throw new MetahubValidationError('Invalid package attach payload', { details: parsed.error.flatten() })
            }

            const item = await attachMetahubPackage(exec, {
                metahubId,
                packageName: parsed.data.packageName,
                version: parsed.data.version,
                userId
            })

            if (!item) {
                throw new MetahubNotFoundError('Package')
            }

            return res.status(201).json(item)
        },
        { permission: 'manageMetahub' }
    )

    const changeVersion = createHandler(
        async ({ req, res, metahubId, userId, exec }) => {
            const parsed = changePackageVersionSchema.safeParse(req.body)
            if (!parsed.success) {
                throw new MetahubValidationError('Invalid package version payload', { details: parsed.error.flatten() })
            }

            const item = await changeMetahubPackageVersion(exec, {
                metahubId,
                attachmentId: req.params.attachmentId,
                version: parsed.data.version,
                userId
            })

            if (!item) {
                throw new MetahubNotFoundError('Metahub package', req.params.attachmentId)
            }

            return res.json(item)
        },
        { permission: 'manageMetahub' }
    )

    const detach = createHandler(
        async ({ req, res, metahubId, userId, exec }) => {
            const result = await detachMetahubPackage(exec, {
                metahubId,
                attachmentId: req.params.attachmentId,
                userId
            })

            if (!result) {
                throw new MetahubNotFoundError('Metahub package', req.params.attachmentId)
            }

            return res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    return {
        listCatalog,
        listAttached,
        attach,
        changeVersion,
        detach
    }
}
