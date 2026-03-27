import 'express-session'
import 'express'

declare module 'express-session' {
    interface SessionData {
        csrfSecret?: string
    }
}

declare global {
    namespace Express {
        interface Request {
            csrfToken: () => string
        }
    }
}
