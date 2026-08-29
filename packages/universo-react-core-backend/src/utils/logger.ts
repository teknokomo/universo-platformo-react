import * as path from 'path'
import * as fs from 'fs'
import { hostname } from 'node:os'
import config from './config' // should be replaced by node-config or similar
import { createLogger, transports, format } from 'winston'
import { NextFunction, Request, Response } from 'express'
import { S3ClientConfig } from '@aws-sdk/client-s3'
import { LoggingWinston } from '@google-cloud/logging-winston'

const { S3StreamLogger } = require('s3-streamlogger')

const { combine, timestamp, printf, errors } = format

const REDACTED_LOG_VALUE = '[REDACTED]'
const TRUNCATED_LOG_VALUE = '[TRUNCATED]'
const MAX_REQUEST_LOG_STRING_LENGTH = 256
const MAX_REQUEST_LOG_KEY_LENGTH = 128
const MAX_REQUEST_LOG_KEYS = 40
const MAX_REQUEST_LOG_ARRAY_ITEMS = 20
const MAX_REQUEST_LOG_DEPTH = 4

const SAFE_REQUEST_HEADER_NAMES = new Set([
    'accept',
    'accept-encoding',
    'accept-language',
    'cache-control',
    'content-length',
    'content-type',
    'host',
    'origin',
    'referer',
    'traceparent',
    'user-agent',
    'x-request-id'
])

const SENSITIVE_HEADER_NAME_PATTERN =
    /(?:^|[-_])(?:authorization|proxy[-_]?authorization|cookie|set[-_]?cookie|csrf[-_]?token|xsrf[-_]?token|access[-_]?token|refresh[-_]?token|id[-_]?token|session[-_]?token|auth[-_]?token|playcanvas[-_]?editor[-_]?token|api[-_]?key|secret|password|credential|signature)(?:$|[-_])/i

const SENSITIVE_FIELD_NAME_PATTERN =
    /(?:authorization|cookie|set[-_]?cookie|csrf|xsrf|access[-_]?token|refresh[-_]?token|id[-_]?token|session[-_]?token|auth[-_]?token|playcanvas[-_]?editor[-_]?token|token|api[-_]?key|secret|password|credential|private[-_]?key|signature|source|file|files|content|contents|payload|raw(?:[-_]?data)?|script|code|text|document|snapshot|manifest|binary|buffer|body|value|email|e[-_]?mail|phone|mobile|username|display[-_]?name|full[-_]?name|first[-_]?name|last[-_]?name|address|ip(?:[-_]?address)?)/i

const SENSITIVE_VALUE_PATTERN =
    /(?:^|\s)bearer\s+\S+|eyJ[a-z\d_-]{8,}\.[a-z\d_-]{8,}\.[a-z\d_-]{8,}|(?:access|refresh|id|session|auth|csrf|xsrf)?[-_]?token\s*[:=]\s*\S+/i

type RequestLogInput = Pick<Request, 'method' | 'url' | 'body' | 'query' | 'params' | 'headers'> & {
    originalUrl?: string
}

type RequestLogSanitizationOptions = {
    redactStrings?: boolean
}

function truncateRequestLogString(value: string): string {
    if (value.length <= MAX_REQUEST_LOG_STRING_LENGTH) return value
    return `${value.slice(0, MAX_REQUEST_LOG_STRING_LENGTH)} ${TRUNCATED_LOG_VALUE}`
}

function sanitizeRequestLogString(value: string, redact = false): string {
    if (redact || SENSITIVE_VALUE_PATTERN.test(value)) return REDACTED_LOG_VALUE
    return truncateRequestLogString(value)
}

function isSensitiveHeaderName(name: string): boolean {
    return SENSITIVE_HEADER_NAME_PATTERN.test(name)
}

function isSensitiveFieldName(name: string): boolean {
    return SENSITIVE_FIELD_NAME_PATTERN.test(name)
}

function isBinaryRequestLogValue(value: object): boolean {
    return Buffer.isBuffer(value) || ArrayBuffer.isView(value)
}

function normalizeHeaderValue(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value.join(', ')
    return value ?? ''
}

export function sanitizeRequestLogUrl(value: unknown): string {
    const rawValue = typeof value === 'string' ? value : String(value ?? '')
    if (!rawValue) return ''

    try {
        const isAbsoluteUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(rawValue)
        const parsedUrl = new URL(rawValue, 'http://request-log.invalid')

        parsedUrl.username = ''
        parsedUrl.password = ''
        parsedUrl.hash = ''

        for (const queryKey of Array.from(parsedUrl.searchParams.keys())) {
            const queryValue = parsedUrl.searchParams.get(queryKey) ?? ''
            parsedUrl.searchParams.set(queryKey, isSensitiveFieldName(queryKey) ? REDACTED_LOG_VALUE : sanitizeRequestLogString(queryValue))
        }

        const serializedUrl = isAbsoluteUrl ? parsedUrl.toString() : `${parsedUrl.pathname}${parsedUrl.search}`
        return truncateRequestLogString(serializedUrl.replace(/(\/editor-artifact-token\/)[^/?#]+(?=\/|$)/gi, `$1${REDACTED_LOG_VALUE}`))
    } catch {
        return sanitizeRequestLogString(rawValue)
    }
}

export function sanitizeRequestLogHeaders(headers: Request['headers']): Record<string, string> {
    const sanitizedHeaders: Record<string, string> = {}

    for (const [rawHeaderName, rawHeaderValue] of Object.entries(headers ?? {})) {
        const headerName = rawHeaderName.toLowerCase()

        if (isSensitiveHeaderName(headerName)) {
            sanitizedHeaders[headerName] = REDACTED_LOG_VALUE
            continue
        }

        if (!SAFE_REQUEST_HEADER_NAMES.has(headerName)) continue

        const headerValue = normalizeHeaderValue(rawHeaderValue)
        sanitizedHeaders[headerName] = headerName === 'referer' ? sanitizeRequestLogUrl(headerValue) : sanitizeRequestLogString(headerValue)
    }

    return sanitizedHeaders
}

function sanitizeRequestLogValue(value: unknown, options: RequestLogSanitizationOptions, depth = 0, seen = new WeakSet<object>()): unknown {
    if (value === null || value === undefined) return value
    if (depth > MAX_REQUEST_LOG_DEPTH) return TRUNCATED_LOG_VALUE

    if (typeof value === 'string') return sanitizeRequestLogString(value, options.redactStrings)
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (typeof value === 'bigint') return String(value)
    if (typeof value !== 'object') return `[${typeof value}]`
    if (isBinaryRequestLogValue(value)) return REDACTED_LOG_VALUE
    if (seen.has(value)) return '[Circular]'

    seen.add(value)

    try {
        if (Array.isArray(value)) {
            const sanitizedItems = value
                .slice(0, MAX_REQUEST_LOG_ARRAY_ITEMS)
                .map((item) => sanitizeRequestLogValue(item, options, depth + 1, seen))

            if (value.length > MAX_REQUEST_LOG_ARRAY_ITEMS) sanitizedItems.push(TRUNCATED_LOG_VALUE)
            return sanitizedItems
        }

        let entries: Array<[string, unknown]>
        try {
            entries = Object.entries(value)
        } catch {
            return '[UNREADABLE]'
        }

        const sanitizedObject: Record<string, unknown> = {}
        for (const [key, nestedValue] of entries.slice(0, MAX_REQUEST_LOG_KEYS)) {
            const safeKey = truncateRequestLogString(key).slice(0, MAX_REQUEST_LOG_KEY_LENGTH)
            sanitizedObject[safeKey] = isSensitiveFieldName(key)
                ? REDACTED_LOG_VALUE
                : sanitizeRequestLogValue(nestedValue, options, depth + 1, seen)
        }

        if (entries.length > MAX_REQUEST_LOG_KEYS) sanitizedObject.__truncated = true
        return sanitizedObject
    } finally {
        seen.delete(value)
    }
}

export function sanitizeRequestLogBody(body: unknown): unknown {
    return sanitizeRequestLogValue(body, { redactStrings: true })
}

export function createSafeRequestLogMetadata(req: RequestLogInput): {
    method: string
    url: string
    body: unknown
    query: unknown
    params: unknown
    headers: Record<string, string>
} {
    return {
        method: truncateRequestLogString(String(req.method ?? '')),
        url: sanitizeRequestLogUrl(req.originalUrl || req.url),
        body: sanitizeRequestLogBody(req.body),
        query: sanitizeRequestLogValue(req.query, {}),
        params: sanitizeRequestLogValue(req.params, {}),
        headers: sanitizeRequestLogHeaders(req.headers)
    }
}

let s3ServerStream!: NodeJS.WritableStream
let s3ErrorStream!: NodeJS.WritableStream
let s3ServerReqStream!: NodeJS.WritableStream

let gcsServerStream!: LoggingWinston
let gcsErrorStream!: LoggingWinston
let gcsServerReqStream!: LoggingWinston

if (process.env.STORAGE_TYPE === 's3') {
    const accessKeyId = process.env.S3_STORAGE_ACCESS_KEY_ID
    const secretAccessKey = process.env.S3_STORAGE_SECRET_ACCESS_KEY
    const region = process.env.S3_STORAGE_REGION
    const s3Bucket = process.env.S3_STORAGE_BUCKET_NAME
    const customURL = process.env.S3_ENDPOINT_URL
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true'

    if (!region || !s3Bucket) {
        throw new Error('S3 storage configuration is missing')
    }

    const s3Config: S3ClientConfig = {
        region: region,
        endpoint: customURL,
        forcePathStyle: forcePathStyle
    }

    if (accessKeyId && secretAccessKey) {
        s3Config.credentials = {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        }
    }

    s3ServerStream = new S3StreamLogger({
        bucket: s3Bucket,
        folder: 'logs/server',
        name_format: `server-%Y-%m-%d-%H-%M-%S-%L-${hostname()}.log`,
        config: s3Config
    })

    s3ErrorStream = new S3StreamLogger({
        bucket: s3Bucket,
        folder: 'logs/error',
        name_format: `server-error-%Y-%m-%d-%H-%M-%S-%L-${hostname()}.log`,
        config: s3Config
    })

    s3ServerReqStream = new S3StreamLogger({
        bucket: s3Bucket,
        folder: 'logs/requests',
        name_format: `server-requests-%Y-%m-%d-%H-%M-%S-%L-${hostname()}.log.jsonl`,
        config: s3Config
    })
}

if (process.env.STORAGE_TYPE === 'gcs') {
    const config = {
        projectId: process.env.GOOGLE_CLOUD_STORAGE_PROJ_ID,
        keyFilename: process.env.GOOGLE_CLOUD_STORAGE_CREDENTIAL,
        defaultCallback: (err: unknown) => {
            if (err) {
                console.error('Error logging to GCS: ' + err)
            }
        }
    }
    gcsServerStream = new LoggingWinston({
        ...config,
        logName: 'server'
    })
    gcsErrorStream = new LoggingWinston({
        ...config,
        logName: 'error'
    })
    gcsServerReqStream = new LoggingWinston({
        ...config,
        logName: 'requests'
    })
}

// expect the log dir be relative to the projects root
const logDir = config.logging.dir

// Create the log directory if it doesn't exist
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir)
}

const logger = createLogger({
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.json(),
        printf(({ level, message, timestamp, stack }) => {
            const text = `${timestamp} [${level.toUpperCase()}]: ${message}`
            return stack ? text + '\n' + stack : text
        }),
        errors({ stack: true })
    ),
    defaultMeta: {
        package: 'server'
    },
    transports: [
        new transports.Console(),
        ...(!process.env.STORAGE_TYPE || process.env.STORAGE_TYPE === 'local'
            ? [
                  new transports.File({
                      filename: path.join(logDir, config.logging.server.filename ?? 'server.log'),
                      level: config.logging.server.level ?? 'info'
                  }),
                  new transports.File({
                      filename: path.join(logDir, config.logging.server.errorFilename ?? 'server-error.log'),
                      level: 'error' // Log only errors to this file
                  })
              ]
            : []),
        ...(process.env.STORAGE_TYPE === 's3'
            ? [
                  new transports.Stream({
                      stream: s3ServerStream
                  })
              ]
            : []),
        ...(process.env.STORAGE_TYPE === 'gcs' ? [gcsServerStream] : [])
    ],
    exceptionHandlers: [
        ...(!process.env.STORAGE_TYPE || process.env.STORAGE_TYPE === 'local'
            ? [
                  new transports.File({
                      filename: path.join(logDir, config.logging.server.errorFilename ?? 'server-error.log')
                  })
              ]
            : []),
        ...(process.env.STORAGE_TYPE === 's3'
            ? [
                  new transports.Stream({
                      stream: s3ErrorStream
                  })
              ]
            : []),
        ...(process.env.STORAGE_TYPE === 'gcs' ? [gcsErrorStream] : [])
    ],
    rejectionHandlers: [
        ...(!process.env.STORAGE_TYPE || process.env.STORAGE_TYPE === 'local'
            ? [
                  new transports.File({
                      filename: path.join(logDir, config.logging.server.errorFilename ?? 'server-error.log')
                  })
              ]
            : []),
        ...(process.env.STORAGE_TYPE === 's3'
            ? [
                  new transports.Stream({
                      stream: s3ErrorStream
                  })
              ]
            : []),
        ...(process.env.STORAGE_TYPE === 'gcs' ? [gcsErrorStream] : [])
    ]
})

export function expressRequestLogger(req: Request, res: Response, next: NextFunction): void {
    const unwantedLogURLs = ['/api/v1/node-icon/', '/api/v1/components-credentials-icon/', '/api/v1/ping']
    if (/\/api\/v1\//i.test(req.url) && !unwantedLogURLs.some((url) => new RegExp(url, 'i').test(req.url))) {
        const requestLogMetadata = createSafeRequestLogMetadata(req)
        const fileLogger = createLogger({
            format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), format.json(), errors({ stack: true })),
            defaultMeta: {
                package: 'server',
                request: requestLogMetadata
            },
            transports: [
                ...(!process.env.STORAGE_TYPE || process.env.STORAGE_TYPE === 'local'
                    ? [
                          new transports.File({
                              filename: path.join(logDir, config.logging.express.filename ?? 'server-requests.log.jsonl'),
                              level: config.logging.express.level ?? 'debug'
                          })
                      ]
                    : []),
                ...(process.env.STORAGE_TYPE === 's3'
                    ? [
                          new transports.Stream({
                              stream: s3ServerReqStream
                          })
                      ]
                    : []),
                ...(process.env.STORAGE_TYPE === 'gcs' ? [gcsServerReqStream] : [])
            ]
        })

        const getRequestEmoji = (method: string) => {
            const requetsEmojis: Record<string, string> = {
                GET: '⬇️',
                POST: '⬆️',
                PUT: '🖊',
                DELETE: '❌',
                OPTION: '🔗'
            }

            return requetsEmojis[method] || '?'
        }

        if (req.method !== 'GET') {
            fileLogger.info(`${getRequestEmoji(req.method)} ${req.method} ${requestLogMetadata.url}`)
            logger.info(`${getRequestEmoji(req.method)} ${req.method} ${requestLogMetadata.url}`)
        } else {
            fileLogger.http(`${getRequestEmoji(req.method)} ${req.method} ${requestLogMetadata.url}`)
        }
    }

    next()
}

export default logger
