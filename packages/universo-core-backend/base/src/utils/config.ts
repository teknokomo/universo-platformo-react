// BEWARE: This file is an intereem solution until we have a proper config strategy

import path from 'path'
import { getBackendRootDir, loadBackendEnv } from './env'

loadBackendEnv()

const resolveLogLevel = () => process.env.LOG_LEVEL ?? 'info'
const backendRootDir = getBackendRootDir()

// default config
const loggingConfig = {
    dir: process.env.LOG_PATH ?? path.join(backendRootDir, 'logs'),
    server: {
        level: resolveLogLevel(),
        filename: 'server.log',
        errorFilename: 'server-error.log'
    },
    express: {
        level: resolveLogLevel(),
        format: 'jsonl', // can't be changed currently
        filename: 'server-requests.log.jsonl' // should end with .jsonl
    }
}

export default {
    logging: loggingConfig
}
