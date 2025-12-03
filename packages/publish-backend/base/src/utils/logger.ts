// Universo Platformo | Basic logger for publish-backend

const getTimestamp = () => new Date().toISOString()

const logger = {
    info: (message: string, ...args: any[]) => {
        console.log(`[${getTimestamp()}] [INFO] [publish-backend] ${message}`, ...args)
    },
    warn: (message: string, ...args: any[]) => {
        console.warn(`[${getTimestamp()}] [WARN] [publish-backend] ${message}`, ...args)
    },
    error: (message: string, ...args: any[]) => {
        console.error(`[${getTimestamp()}] [ERROR] [publish-backend] ${message}`, ...args)
    },
    debug: (message: string, ...args: any[]) => {
        // Universo Platformo | Debug logs can be disabled in production
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`[${getTimestamp()}] [DEBUG] [publish-backend] ${message}`, ...args)
        }
    }
}

export default logger
