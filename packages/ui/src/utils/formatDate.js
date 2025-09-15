// English comments per project guidelines.
// Minimal localized date formatting helper (Phase 0 skeleton).
import moment from 'moment'
import i18n from '@/i18n'

// Map of pattern keys to moment format tokens (fallback). Using localized tokens L/LLL when possible.
const FORMAT_MAP = {
  full: 'LLL', // e.g. localized "September 15, 2025 14:23"
  short: 'YYYY-MM-DD HH:mm',
  date: 'LL',
  time: 'HH:mm:ss',
  iso: undefined // special case -> ISO string
}

/**
 * formatDate - returns localized formatted date string.
 * @param {Date|string|number} dateInput - date source
 * @param {string} pattern - one of keys in FORMAT_MAP
 * @param {string} [langOverride] - optional language override
 */
export function formatDate(dateInput, pattern = 'full', langOverride) {
  if (!dateInput) return ''
  const lang = langOverride || i18n.language
  moment.locale(lang)
  const m = moment(dateInput)
  if (!m.isValid()) return ''
  if (pattern === 'relative') return m.fromNow()
  if (pattern === 'iso') return m.toISOString()
  const fmt = FORMAT_MAP[pattern] || FORMAT_MAP.full
  return m.format(fmt)
}

/**
 * formatRange - simple range formatting (no timezone normalization here).
 */
export function formatRange(start, end, pattern = 'short', langOverride) {
  if (!start || !end) return ''
  return `${formatDate(start, pattern, langOverride)} – ${formatDate(end, pattern, langOverride)}`
}

export default formatDate