import { z } from 'zod'
import { uuidV7Schema } from './applicationLayouts'

export const interpretationNetworkMaterialAssociationSchema = z
    .object({
        cellId: uuidV7Schema,
        materialId: uuidV7Schema
    })
    .strict()

export const interpretationNetworkMaterialAssociationPageSchema = z
    .object({
        items: z.array(interpretationNetworkMaterialAssociationSchema),
        page: z
            .object({
                offset: z.number().int().nonnegative(),
                limit: z.number().int().positive(),
                hasMore: z.boolean()
            })
            .strict()
    })
    .strict()

export type InterpretationNetworkMaterialAssociation = z.infer<typeof interpretationNetworkMaterialAssociationSchema>
export type InterpretationNetworkMaterialAssociationPage = z.infer<typeof interpretationNetworkMaterialAssociationPageSchema>
