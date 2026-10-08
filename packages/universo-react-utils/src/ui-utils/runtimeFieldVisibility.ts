const TECHNICAL_RUNTIME_FIELD_KEYS = new Set([
    'uplversion',
    'createdby',
    'updatedby',
    'deletedby',
    'projectid',
    'owneruserid',
    'userid',
    'assigneduserid',
    'targetrecordid',
    'targetobjectcodename',
    'principalid',
    'sourcejson',
    'resourcejson',
    'storagejson',
    'namemanuallyedited'
])

const SENSITIVE_RUNTIME_FIELD_MARKERS = [
    'accesskey',
    'address',
    'apikey',
    'authorization',
    'bankaccount',
    'birth',
    'creditcard',
    'credential',
    'dob',
    'email',
    'mobile',
    'passport',
    'password',
    'passwd',
    'phone',
    'privatekey',
    'secret',
    'socialsecurity',
    'ssn',
    'token'
] as const

/** Identifies system-owned field names that must not be presented as user data. */
export const isRuntimeTechnicalFieldName = (value: string | undefined): boolean => {
    const raw = value?.trim() ?? ''
    const normalized = raw.replace(/[-_\s]+/g, '').toLowerCase()
    if (!normalized) return false
    if (TECHNICAL_RUNTIME_FIELD_KEYS.has(normalized)) return true
    if (normalized.startsWith('upl')) return true
    if (normalized === 'id') return true
    if (/[-_\s]id$/i.test(raw)) return true
    return /(?:Id|ID)$/.test(raw.replace(/[-_\s]+/g, ''))
}

/** Hides credentials and common personal data from generic runtime tables by default. */
export const isRuntimeSensitiveFieldName = (value: string | undefined): boolean => {
    const normalized = value?.replace(/[^a-z0-9]/gi, '').toLowerCase() ?? ''
    return Boolean(normalized) && SENSITIVE_RUNTIME_FIELD_MARKERS.some((marker) => normalized.includes(marker))
}
