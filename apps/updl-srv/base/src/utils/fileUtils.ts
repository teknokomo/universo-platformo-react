// Universo Platformo | File utilities for UPDL server
import fs from 'fs'
import path from 'path'

/**
 * Ensures that a directory exists, creating it if necessary
 * @param dirPath Directory path to ensure
 */
export const ensureDirectoryExists = (dirPath: string): void => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
    }
}

/**
 * Writes content to a file, ensuring the directory exists
 * @param filePath File path to write to
 * @param content Content to write
 */
export const writeFileWithDirectory = (filePath: string, content: string): void => {
    const dir = path.dirname(filePath)
    ensureDirectoryExists(dir)
    fs.writeFileSync(filePath, content)
}

/**
 * Reads a file as a string
 * @param filePath File path to read
 * @returns File content as string or null if file doesn't exist
 */
export const readFile = (filePath: string): string | null => {
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8')
    }
    return null
}

/**
 * Deletes a file if it exists
 * @param filePath File path to delete
 */
export const deleteFile = (filePath: string): void => {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
    }
}

export default {
    ensureDirectoryExists,
    writeFileWithDirectory,
    readFile,
    deleteFile
}
