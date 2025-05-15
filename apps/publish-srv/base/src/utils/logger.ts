// Universo Platformo | Basic logger for publish-srv

const getTimestamp = () => new Date().toISOString()

const logger = {
    info: (message: string, ...args: any[]) => {
        console.log(`[${getTimestamp()}] [INFO] [publish-srv] ${message}`, ...args)
    },
    warn: (message: string, ...args: any[]) => {
        console.warn(`[${getTimestamp()}] [WARN] [publish-srv] ${message}`, ...args)
    },
    error: (message: string, ...args: any[]) => {
        console.error(`[${getTimestamp()}] [ERROR] [publish-srv] ${message}`, ...args)
    },
    debug: (message: string, ...args: any[]) => {
        // В production режиме можно отключать debug логи
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`[${getTimestamp()}] [DEBUG] [publish-srv] ${message}`, ...args)
        }
    }
}

export default logger
