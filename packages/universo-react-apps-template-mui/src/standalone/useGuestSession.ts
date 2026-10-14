import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { DEFAULT_GUEST_INTAKE_POLICY, guestIntakePolicySchema } from '@universo-react/types'
import { extractRuntimeErrorMessage } from '../utils/runtimeErrors'
import {
    GUEST_PARTICIPANT_ID_HEADER,
    GUEST_SESSION_TOKEN_HEADER,
    getGuestIdempotencyKey,
    guestIntakeIdempotencyStorageKey,
    isRecord,
    normalizeGuestSession,
    readGuestSessionStorage,
    removeGuestIdempotencyKey,
    removeGuestSessionStorage,
    writeGuestSessionStorage
} from './guestRuntimeUtils'
import type {
    GuestAccessLink,
    GuestCaptchaConfig,
    GuestErrorFormatter,
    GuestFetchWithPublicCsrf,
    GuestIntakePolicy,
    GuestSession,
    GuestTranslate
} from './guestRuntimeTypes'

const PUBLIC_CSRF_STORAGE_KEY_PREFIX = 'apps-template-mui:public-csrf'

const getPublicCsrfStorageKey = (applicationId?: string) =>
    applicationId ? `${PUBLIC_CSRF_STORAGE_KEY_PREFIX}:${applicationId}` : PUBLIC_CSRF_STORAGE_KEY_PREFIX

export const isValidGuestEmail = (value: string) => value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

type GuestSessionMutationResult = { session: GuestSession; idempotencyStorageKey: string }

export type GuestSessionController = {
    session: GuestSession | null
    linkQuery: UseQueryResult<GuestAccessLink, Error>
    intakePolicy: GuestIntakePolicy
    requiresCaptcha: boolean
    guestCaptchaConfigQuery: UseQueryResult<GuestCaptchaConfig, Error>
    firstName: string
    setFirstName: (value: string) => void
    lastName: string
    setLastName: (value: string) => void
    email: string
    setEmail: (value: string) => void
    phone: string
    setPhone: (value: string) => void
    captchaToken: string
    setCaptchaToken: (value: string) => void
    captchaMessage: string
    setCaptchaMessage: (value: string) => void
    intakeSubmitted: boolean
    termsAccepted: boolean
    setTermsAccepted: (value: boolean) => void
    privacyAccepted: boolean
    setPrivacyAccepted: (value: boolean) => void
    captchaFieldRef: { current: HTMLDivElement | null }
    sessionMutation: UseMutationResult<GuestSessionMutationResult, Error, void>
    handleStartGuestSession: (event: FormEvent<HTMLFormElement>) => void
    fetchWithPublicCsrf: GuestFetchWithPublicCsrf
    formatGuestError: GuestErrorFormatter
}

type UseGuestSessionOptions = {
    applicationId: string
    slug: string
    accessLinkId: string | null
    workspaceId: string | null
    apiBaseUrl: string
    locale: string
    translate: GuestTranslate
}

export function useGuestSession({
    applicationId,
    slug,
    accessLinkId,
    workspaceId,
    apiBaseUrl,
    locale,
    translate
}: UseGuestSessionOptions): GuestSessionController {
    const storageKey = `apps-template-mui:guest-session:${applicationId}:${slug}${workspaceId ? `:${workspaceId}` : ''}`
    const publicCsrfStorageKey = getPublicCsrfStorageKey(applicationId)
    const captchaFieldRef = useRef<HTMLDivElement | null>(null)
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [captchaToken, setCaptchaToken] = useState('')
    const [captchaMessage, setCaptchaMessage] = useState('')
    const [termsAccepted, setTermsAccepted] = useState(false)
    const [privacyAccepted, setPrivacyAccepted] = useState(false)
    const [intakeSubmitted, setIntakeSubmitted] = useState(false)
    const [storedSession, setStoredSession] = useState<GuestSession | null>(null)
    const [sessionScope, setSessionScope] = useState('')
    const [sessionRestoreScope, setSessionRestoreScope] = useState('')
    const session = sessionScope === storageKey ? storedSession : null

    const formatGuestError = useCallback<GuestErrorFormatter>(
        (error, key, fallback) => extractRuntimeErrorMessage(error, translate(key, fallback), locale),
        [locale, translate]
    )

    const fetchWithPublicCsrf = useCallback<GuestFetchWithPublicCsrf>(
        async (input, init) => {
            const execute = async (forceRefresh = false) => {
                let csrfToken = !forceRefresh ? readGuestSessionStorage(publicCsrfStorageKey) : null
                if (!csrfToken) {
                    const csrfResponse = await fetch(`${apiBaseUrl}/auth/csrf`, {
                        method: 'GET',
                        credentials: 'same-origin'
                    })
                    if (!csrfResponse.ok) {
                        throw new Error(translate('guest.errors.sessionCreate', 'Failed to create guest session.'))
                    }

                    const csrfPayload: unknown = await csrfResponse.json()
                    if (!isRecord(csrfPayload) || typeof csrfPayload.csrfToken !== 'string' || csrfPayload.csrfToken.length === 0) {
                        throw new Error(translate('guest.errors.sessionCreate', 'Failed to create guest session.'))
                    }
                    csrfToken = csrfPayload.csrfToken
                    writeGuestSessionStorage(publicCsrfStorageKey, csrfToken)
                }

                const headers = new Headers(init.headers ?? {})
                headers.set('X-CSRF-Token', csrfToken)
                return fetch(input, { ...init, headers })
            }

            const response = await execute()
            return response.status === 419 ? execute(true) : response
        },
        [apiBaseUrl, publicCsrfStorageKey, translate]
    )

    useEffect(() => {
        setSessionRestoreScope('')
        setStoredSession(null)
        setSessionScope(storageKey)
        setFirstName('')
        setLastName('')
        setEmail('')
        setPhone('')
        setCaptchaToken('')
        setCaptchaMessage('')
        setTermsAccepted(false)
        setPrivacyAccepted(false)
        setIntakeSubmitted(false)

        if (typeof window === 'undefined' || !applicationId || !slug) {
            setSessionRestoreScope(storageKey)
            return
        }

        try {
            const stored = window.sessionStorage.getItem(storageKey)
            if (stored) {
                const parsed = normalizeGuestSession(JSON.parse(stored))
                if (parsed) {
                    setStoredSession(parsed)
                }
            }
        } catch {
            removeGuestSessionStorage(storageKey)
        } finally {
            setSessionRestoreScope(storageKey)
        }
    }, [applicationId, slug, storageKey])

    const linkQuery = useQuery<GuestAccessLink>({
        queryKey: ['guest-link', applicationId, slug, accessLinkId, workspaceId, locale, session?.participantId ?? null],
        enabled: Boolean(applicationId && slug && sessionRestoreScope === storageKey),
        queryFn: async () => {
            const params = new URLSearchParams({ locale })
            if (workspaceId) params.set('workspaceId', workspaceId)
            if (accessLinkId) params.set('accessLinkId', accessLinkId)
            const headers = new Headers()
            if (session) {
                headers.set(GUEST_PARTICIPANT_ID_HEADER, session.participantId)
                headers.set(GUEST_SESSION_TOKEN_HEADER, session.sessionToken)
            }
            const response = await fetch(`${apiBaseUrl}/public/a/${applicationId}/links/${encodeURIComponent(slug)}?${params.toString()}`, {
                headers
            })
            if (!response.ok) {
                throw new Error(translate('guest.errors.linkNotFound', 'Access link was not found or is no longer active.'))
            }
            const payload: unknown = await response.json()
            if (!isRecord(payload) || typeof payload.id !== 'string') {
                throw new Error(translate('guest.errors.linkNotFound', 'Access link was not found or is no longer active.'))
            }
            if (payload.intake === undefined) return payload as GuestAccessLink

            const intake = guestIntakePolicySchema.safeParse(payload.intake)
            if (!intake.success) {
                throw new Error(translate('guest.errors.linkNotFound', 'Access link was not found or is no longer active.'))
            }
            return { ...payload, intake: intake.data } as GuestAccessLink
        }
    })

    const requiresCaptcha = linkQuery.data?.intake?.captchaEnabled === true
    const guestCaptchaConfigQuery = useQuery<GuestCaptchaConfig>({
        queryKey: ['guest-captcha-config'],
        enabled: requiresCaptcha,
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const response = await fetch(`${apiBaseUrl}/auth/captcha-config`)
            if (!response.ok) throw new Error(translate('guest.errors.captchaUnavailable', 'CAPTCHA is not available.'))
            const payload: unknown = await response.json()
            if (!isRecord(payload) || !isRecord(payload.guest)) {
                throw new Error(translate('guest.errors.captchaUnavailable', 'CAPTCHA is not available.'))
            }
            const config = payload.guest
            return {
                enabled: config.enabled === true,
                siteKey: typeof config.siteKey === 'string' && config.siteKey.trim() ? config.siteKey : null,
                testMode: config.testMode === true
            }
        }
    })

    const intakePolicy = linkQuery.data?.intake ?? DEFAULT_GUEST_INTAKE_POLICY
    const sessionMutation = useMutation<GuestSessionMutationResult, Error, void>({
        mutationFn: async () => {
            const accessLinkId = linkQuery.data?.id
            if (!accessLinkId) {
                throw new Error(translate('guest.errors.linkNotFound', 'Access link was not found or is no longer active.'))
            }

            const idempotencyStorageKey = guestIntakeIdempotencyStorageKey(applicationId, accessLinkId, workspaceId)
            const idempotencyKey = getGuestIdempotencyKey(idempotencyStorageKey)
            const response = await fetchWithPublicCsrf(`${apiBaseUrl}/public/a/${applicationId}/guest-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
                body: JSON.stringify({
                    accessLinkId,
                    ...(workspaceId ? { workspaceId } : {}),
                    ...(intakePolicy.showFirstName ? { firstName: firstName.trim() } : {}),
                    ...(intakePolicy.showLastName ? { lastName: lastName.trim() } : {}),
                    ...(intakePolicy.showEmail && email.trim() ? { email: email.trim() } : {}),
                    ...(intakePolicy.showPhone && phone.trim() ? { phone: phone.trim() } : {}),
                    termsAccepted: true,
                    privacyAccepted: true,
                    ...(requiresCaptcha ? { captchaToken } : {})
                })
            })
            if (!response.ok) {
                if (![408, 425, 429].includes(response.status) && response.status < 500) {
                    removeGuestIdempotencyKey(idempotencyStorageKey)
                }
                throw new Error(translate('guest.errors.sessionCreate', 'Failed to create guest session.'))
            }

            const nextSession = normalizeGuestSession(await response.json())
            if (!nextSession) {
                throw new Error(translate('guest.errors.sessionCreate', 'Failed to create guest session.'))
            }
            return { session: nextSession, idempotencyStorageKey }
        },
        onSuccess: ({ session: nextSession, idempotencyStorageKey }) => {
            setCaptchaToken('')
            setCaptchaMessage('')
            setStoredSession(nextSession)
            setSessionScope(storageKey)
            writeGuestSessionStorage(storageKey, JSON.stringify(nextSession))
            removeGuestIdempotencyKey(idempotencyStorageKey)
        },
        onError: () => {
            if (requiresCaptcha) {
                setCaptchaToken('')
                setCaptchaMessage(translate('guest.errors.captchaRetry', 'Complete the CAPTCHA again and retry.'))
            }
        }
    })

    const handleStartGuestSession = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIntakeSubmitted(true)
        const missingFirstName = intakePolicy.requireFirstName && !firstName.trim()
        const missingLastName = intakePolicy.requireLastName && !lastName.trim()
        const missingEmail = intakePolicy.requireEmail && !email.trim()
        const invalidEmail = intakePolicy.showEmail && Boolean(email.trim()) && !isValidGuestEmail(email.trim())
        const missingPhone = intakePolicy.requirePhone && !phone.trim()
        if (missingFirstName || missingLastName || missingEmail || invalidEmail || missingPhone || !termsAccepted || !privacyAccepted) {
            const form = event.currentTarget
            const firstInvalidField = missingFirstName
                ? form.querySelector<HTMLInputElement>('input[autocomplete="given-name"]')
                : missingLastName
                ? form.querySelector<HTMLInputElement>('input[autocomplete="family-name"]')
                : missingEmail || invalidEmail
                ? form.querySelector<HTMLInputElement>('input[autocomplete="email"]')
                : missingPhone
                ? form.querySelector<HTMLInputElement>('input[autocomplete="tel"]')
                : !termsAccepted
                ? form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[0]
                : form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1]
            firstInvalidField?.focus()
            return
        }

        if (requiresCaptcha && (!guestCaptchaConfigQuery.data?.enabled || !guestCaptchaConfigQuery.data.siteKey)) {
            setCaptchaMessage(translate('guest.errors.captchaUnavailable', 'CAPTCHA is not available.'))
            captchaFieldRef.current?.focus()
            return
        }
        if (requiresCaptcha && !captchaToken) {
            setCaptchaMessage(translate('guest.errors.captchaRequired', 'Complete the CAPTCHA to continue.'))
            captchaFieldRef.current?.focus()
            return
        }
        sessionMutation.mutate()
    }

    return {
        session,
        linkQuery,
        intakePolicy,
        requiresCaptcha,
        guestCaptchaConfigQuery,
        firstName,
        setFirstName,
        lastName,
        setLastName,
        email,
        setEmail,
        phone,
        setPhone,
        captchaToken,
        setCaptchaToken,
        captchaMessage,
        setCaptchaMessage,
        intakeSubmitted,
        termsAccepted,
        setTermsAccepted,
        privacyAccepted,
        setPrivacyAccepted,
        captchaFieldRef,
        sessionMutation,
        handleStartGuestSession,
        fetchWithPublicCsrf,
        formatGuestError
    }
}
