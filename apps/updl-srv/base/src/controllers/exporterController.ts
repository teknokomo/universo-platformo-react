// Universo Platformo | Exporter controller
import { Request, Response, NextFunction } from 'express'
import { ExporterManager } from '../services/exporters/ExporterManager'

/**
 * Get all available exporters
 */
export const getExporters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Use the existing ExporterManager from services
        const exporterManager = new ExporterManager()
        const exporters = exporterManager.getAvailableExporters()

        res.json(exporters)
    } catch (error) {
        next(error)
    }
}

/**
 * Export UPDL scene to specified format
 */
export const exportScene = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { flowData, exporterId, options } = req.body

        if (!flowData) {
            const error: any = new Error('Missing flowData parameter')
            error.status = 400
            throw error
        }

        if (!exporterId) {
            const error: any = new Error('Missing exporterId parameter')
            error.status = 400
            throw error
        }

        const exporterManager = new ExporterManager()

        //  Use the exportFlow method instead of the non-existent getExporter
        try {
            const result = await exporterManager.exportFlow(flowData, exporterId, options)

            res.json({
                success: true,
                exporterId,
                result
            })
        } catch (error) {
            // Ifhtherexportersisonot found oroan export errorooccurs
            const apiError: any = new Error(error instanceof Error ? error.message : String(error))
            apiError.status = 404
            throw apiError
        }
    } catch (error) {
        next(error)
    }
}
