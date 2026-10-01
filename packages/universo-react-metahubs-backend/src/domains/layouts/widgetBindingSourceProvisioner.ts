import { ComponentDefinitionDataType, MARKETING_PAGE_HUB_CODENAME, type WidgetBindingSlotDefinition } from '@universo-react/types'
import { generateUuidV7, localizedContent } from '@universo-react/utils'
import type { DbExecutor } from '@universo-react/utils/database'
import { MetahubComponentsService } from '../metahubs/services/MetahubComponentsService'
import { MetahubObjectsService } from '../metahubs/services/MetahubObjectsService'
import type { MetahubSchemaService } from '../metahubs/services/MetahubSchemaService'
import { MetahubNotFoundError } from '../shared/domainErrors'
import type { WidgetBindingSourceProvisioner } from './widgetBindingService'

const componentDataTypes: Readonly<
    Record<WidgetBindingSlotDefinition['requirements']['components'][number]['valueType'], ComponentDefinitionDataType>
> = {
    string: ComponentDefinitionDataType.STRING,
    number: ComponentDefinitionDataType.NUMBER,
    boolean: ComponentDefinitionDataType.BOOLEAN,
    json: ComponentDefinitionDataType.JSON,
    ref: ComponentDefinitionDataType.REF
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const presentationName = (value: unknown): unknown => (isRecord(value) ? value : undefined)

/** Creates an empty, compatible Object model through the regular Entity services. */
export const createWidgetBindingSourceProvisioner = (
    executor: DbExecutor,
    schemaService: MetahubSchemaService
): WidgetBindingSourceProvisioner => {
    const objectsService = new MetahubObjectsService(executor, schemaService)
    const componentsService = new MetahubComponentsService(executor, schemaService)

    return async ({ db, metahubId, userId, templateSource, slot, name, locale, parentObject }) => {
        const marketingPageHub = await objectsService.findByCodenameAndKind(
            metahubId,
            MARKETING_PAGE_HUB_CODENAME,
            'hub',
            userId ?? undefined,
            {},
            db
        )
        if (!marketingPageHub) throw new MetahubNotFoundError('Marketing Page Hub')

        const sourceComponents = await componentsService.findAllFlat(metahubId, templateSource.id, userId ?? undefined, 'business', db)
        const sourceComponentsByCodename = new Map(sourceComponents.map((component) => [component.codename, component]))
        const requiredComponents = slot.requirements.components.map((requirement) => {
            const sourceComponent = sourceComponentsByCodename.get(requirement.componentCodename)
            if (!sourceComponent) throw new Error('MARKETING_WIDGET_SOURCE_COMPONENT_MISSING')
            return { requirement, sourceComponent }
        })
        if (requiredComponents.some(({ requirement }) => requirement.valueType === 'ref') && !parentObject) {
            throw new Error('MARKETING_WIDGET_SOURCE_RELATION_PARENT_REQUIRED')
        }
        const newObjectId = generateUuidV7()
        const sourceKey = `MarketingWidgetSource_${newObjectId.replace(/-/gu, '')}`
        const localizedName = localizedContent.buildLocalizedContent({ [locale]: name }, locale)
        if (!localizedName) throw new Error('MARKETING_WIDGET_SOURCE_NAME_REQUIRED')

        const recordPolicy = slot.requirements.recordPolicy
        const objectConfig: Record<string, unknown> = {
            hubs: [marketingPageHub.id],
            ...(recordPolicy ? { recordPolicy: { version: 1, ...recordPolicy } } : {})
        }

        const createdObject = await objectsService.createObject(
            metahubId,
            'object',
            {
                id: newObjectId,
                codename: sourceKey,
                name: localizedName,
                config: objectConfig,
                createdBy: userId ?? null
            },
            userId ?? undefined,
            db
        )

        for (const [index, { requirement, sourceComponent }] of requiredComponents.entries()) {
            const validationRules = {
                ...(requirement.localized ? { localized: true } : {}),
                ...(requirement.maxLength !== undefined ? { maxLength: requirement.maxLength } : {}),
                ...(requirement.semanticKey ? { unique: true } : {}),
                ...(requirement.pattern !== undefined ? { pattern: requirement.pattern } : {}),
                ...(requirement.format !== undefined ? { format: requirement.format } : {})
            }
            const uiConfig = isRecord(sourceComponent.uiConfig) ? { ...sourceComponent.uiConfig } : {}
            delete uiConfig.hidden
            delete uiConfig.isExcluded
            if (
                requirement.valueType === 'string' &&
                requirement.localized &&
                (requirement.maxLength ?? 0) >= 500 &&
                typeof uiConfig.rows !== 'number'
            ) {
                uiConfig.rows = 4
            }

            await componentsService.create(
                metahubId,
                {
                    objectCollectionId: createdObject.id,
                    codename: requirement.componentCodename,
                    dataType: componentDataTypes[requirement.valueType],
                    isRequired: requirement.required,
                    isDisplayComponent: sourceComponent.isDisplayComponent,
                    name: presentationName(sourceComponent.name),
                    validationRules,
                    uiConfig,
                    targetEntityId: requirement.valueType === 'ref' ? parentObject?.id ?? null : null,
                    targetEntityKind: requirement.valueType === 'ref' ? parentObject?.kind ?? null : null,
                    targetConstantId: null,
                    sortOrder: index,
                    createdBy: userId ?? null
                },
                userId ?? undefined,
                db
            )
        }

        return { sourceKey, label: name, recordsCount: 0 }
    }
}
