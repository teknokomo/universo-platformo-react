import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

/**
 * Generate a new API key
 */
export function generateAPIKey(): string {
    const buffer = randomBytes(32)
    return buffer.toString('base64url')
}

/**
 * Generate a secret hash from API key
 */
export function generateSecretHash(apiKey: string): string {
    const salt = randomBytes(8).toString('hex')
    const buffer = scryptSync(apiKey, salt, 64) as Buffer
    return `${buffer.toString('hex')}.${salt}`
}

/**
 * Compare stored key hash with supplied key
 */
export function compareKeys(storedKey: string, suppliedKey: string): boolean {
    const [hashedPassword, salt] = storedKey.split('.')
    if (!hashedPassword || !salt) return false
    const buffer = scryptSync(suppliedKey, salt, 64) as Buffer
    return timingSafeEqual(new Uint8Array(Buffer.from(hashedPassword, 'hex')), new Uint8Array(buffer))
}
