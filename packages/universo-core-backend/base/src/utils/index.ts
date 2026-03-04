import path from 'path'
import fs from 'fs'

/**
 * Get user home directory
 */
export const getUserHome = (): string => {
    return process.env.UNIVERSO_PATH ?? process.env.FLOWISE_PATH ?? (process.env.HOME || process.env.USERPROFILE || '')
}

/**
 * Returns the path of node modules package
 * @param {string} packageName
 * @returns {string}
 */
export const getNodeModulesPackagePath = (packageName: string): string => {
    const checkPaths = [
        path.join(__dirname, '..', 'node_modules', packageName),
        path.join(__dirname, '..', '..', 'node_modules', packageName),
        path.join(__dirname, '..', '..', '..', 'node_modules', packageName),
        path.join(__dirname, '..', '..', '..', '..', 'node_modules', packageName),
        path.join(__dirname, '..', '..', '..', '..', '..', 'node_modules', packageName)
    ]
    for (const checkPath of checkPaths) {
        if (fs.existsSync(checkPath)) {
            return checkPath
        }
    }
    return ''
}

/**
 * Get app current version from package.json
 */
export const getAppVersion = async (): Promise<string> => {
    const getPackageJsonPath = (): string => {
        const checkPaths = [
            path.join(__dirname, '..', 'package.json'),
            path.join(__dirname, '..', '..', 'package.json'),
            path.join(__dirname, '..', '..', '..', 'package.json'),
            path.join(__dirname, '..', '..', '..', '..', 'package.json'),
            path.join(__dirname, '..', '..', '..', '..', '..', 'package.json')
        ]
        for (const checkPath of checkPaths) {
            if (fs.existsSync(checkPath)) {
                return checkPath
            }
        }
        return ''
    }

    const packagejsonPath = getPackageJsonPath()
    if (!packagejsonPath) return ''
    try {
        const content = await fs.promises.readFile(packagejsonPath, 'utf8')
        const parsedContent = JSON.parse(content)
        return parsedContent.version ?? ''
    } catch {
        return ''
    }
}
