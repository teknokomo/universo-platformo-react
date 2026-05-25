import type { MigrationLogger } from './types'

export const consoleMigrationLogger: MigrationLogger = {
    info(message, meta) {
        if (meta) {
            console.info(message, meta)
            return
        }
        console.info(message)
    },
    warn(message, meta) {
        if (meta) {
            console.warn(message, meta)
            return
        }
        console.warn(message)
    },
    error(message, meta) {
        if (meta) {
            console.error(message, meta)
            return
        }
        console.error(message)
    }
}
