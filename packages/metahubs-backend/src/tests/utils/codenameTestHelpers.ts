import { createCodenameVLC } from '@universo/utils/vlc'

/** Build a CodenameVLC object from a plain string for test payloads */
export const testCodenameVlc = (codename: string, locale = 'en') => createCodenameVLC(locale, codename)
