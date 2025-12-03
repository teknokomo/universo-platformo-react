import { NextFunction, Request, Response } from 'express'
import exportImportService from '../../services/export-import'

const exportData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId
        if (!unikId) {
            throw new Error('unikId is required')
        }
        const apiResponse = await exportImportService.exportData(exportImportService.convertExportInput(req.body), unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const importData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const importData = req.body
        await exportImportService.importData(importData)
        return res.json({ message: 'success' })
    } catch (error) {
        next(error)
    }
}

export default {
    exportData,
    importData
}
