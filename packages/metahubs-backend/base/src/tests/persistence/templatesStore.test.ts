import { createTemplate, createTemplateVersion, findTemplateById } from '../../persistence/templatesStore'

const createExec = () => ({
    query: jest.fn().mockResolvedValue([{ id: 'row-1' }])
})

const baseName = {
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content: 'Template',
            version: 1,
            isActive: true,
            createdAt: '2026-03-10T00:00:00.000Z',
            updatedAt: '2026-03-10T00:00:00.000Z'
        }
    }
} as const

describe('templatesStore audit user normalization', () => {
    it('stores null audit user ids when template creation receives an empty system user id', async () => {
        const exec = createExec()

        await createTemplate(exec as never, {
            codename: 'basic',
            name: baseName,
            description: null,
            icon: null,
            isSystem: true,
            isActive: true,
            sortOrder: 0,
            userId: ''
        })

        expect(exec.query).toHaveBeenCalledWith(expect.any(String), ['basic', JSON.stringify(baseName), null, null, true, true, 0, null])
    })

    it('stores null audit user ids when template version creation receives an empty system user id', async () => {
        const exec = createExec()
        const manifest = {
            codename: 'basic',
            version: '0.1.0',
            minStructureVersion: '0.1.0',
            name: baseName
        }

        await createTemplateVersion(exec as never, {
            templateId: 'template-1',
            versionNumber: 1,
            versionLabel: '0.1.0',
            minStructureVersion: '0.1.0',
            manifestJson: manifest as never,
            manifestHash: 'hash-1',
            isActive: true,
            changelog: null,
            userId: '   '
        })

        expect(exec.query).toHaveBeenCalledWith(expect.any(String), [
            'template-1',
            1,
            '0.1.0',
            '0.1.0',
            JSON.stringify(manifest),
            'hash-1',
            true,
            null,
            null
        ])
    })
})

describe('templatesStore dual-flag active-row predicates', () => {
    it('findTemplateById includes dual-flag predicate', async () => {
        const exec = createExec()

        await findTemplateById(exec as never, 'template-1')

        const sql = String(exec.query.mock.calls[0][0])
        expect(sql).toContain('_upl_deleted = false')
        expect(sql).toContain('_app_deleted = false')
    })
})
