import { slugifyCodename } from '@universo/utils/ui-utils/slugify'

const CODENAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const sanitizeCodename = (value: string) => slugifyCodename(value)

export const isValidCodename = (value: string) => CODENAME_PATTERN.test(value)
