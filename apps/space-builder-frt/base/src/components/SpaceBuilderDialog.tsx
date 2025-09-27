import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QuizPlan, SpaceBuilderHttpError, useSpaceBuilder } from '../hooks/useSpaceBuilder'
import { useTranslation } from 'react-i18next'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    FormControlLabel,
    Button,
    Typography,
    Box,
    Alert,
    Tooltip
} from '@mui/material'
import { LoadingButton } from '@mui/lab'
import SettingsIcon from '@mui/icons-material/Settings'

export type SpaceBuilderDialogProps = {
    open: boolean
    onClose: () => void
    onApply: (graph: { nodes: unknown[]; edges: unknown[] }, mode: 'append' | 'replace' | 'newSpace') => void
    models: Array<{ key: string; label: string; provider: string; modelName: string; credentialId: string }>
    onError?: (message: string) => void
}

export const SpaceBuilderDialog: React.FC<SpaceBuilderDialogProps> = ({ open, onClose, onApply, models, onError }) => {
    const { t } = useTranslation()
    const { prepareQuiz, generateFlow, reviseQuiz, normalizeManualQuiz } = useSpaceBuilder()
    const [step, setStep] = useState<'input' | 'preview' | 'settings'>('input')
    const [sourceText, setSourceText] = useState('')
    const [additionalConditions, setAdditionalConditions] = useState('')
    const [reviseText, setReviseText] = useState('')
    const [modelKey, setModelKey] = useState(models?.[0]?.key || '')
    const [creationMode, setCreationMode] = useState<'replace' | 'append' | 'newSpace'>('newSpace')
    const [busy, setBusy] = useState(false)
    const [questionsCount, setQuestionsCount] = useState(1)
    const [answersPerQuestion, setAnswersPerQuestion] = useState(2)
    const [quizPlan, setQuizPlan] = useState<QuizPlan | null>(null)
    const [testMode, setTestMode] = useState(false)
    const [collectNames, setCollectNames] = useState(true)
    const [showFinal, setShowFinal] = useState(true)
    const [graphicsForAnswers] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [tempModelKey, setTempModelKey] = useState('')
    // new: control of credentials availability and test items from server config
    const [disableUserCreds, setDisableUserCreds] = useState(false)
    const [testItems, setTestItems] = useState<Array<{ id: string; label: string; provider: string; model: string }>>([])
    // Provider cascade (Flowise 3.x-like)
    type ProviderMeta = {
        id: string
        label: string
        iconUrl: string
        credentialNames: string[]
        credentials: Array<{ id: string; label: string; credentialName: string }>
        supportsAsyncModels: boolean
        inputsSchema: Array<{ name: string; label: string; type: string; default?: any; options?: Array<{ label: string; name: string }> }>
    }
    type CredentialInput = {
        name: string
        label?: string
        type?: string
    }
    const [providers, setProviders] = useState<ProviderMeta[]>([])
    const [providerId, setProviderId] = useState('')
    const [credentialId, setCredentialId] = useState('')
    const [modelName, setModelName] = useState('')
    const [advParams, setAdvParams] = useState<{ temperature?: number; streaming?: boolean; maxTokens?: number; topP?: number }>({})
    // Cache async model options per provider id to avoid losing them after re-open
    const [modelOptionsMap, setModelOptionsMap] = useState<Record<string, string[]>>({})
    const [manualMode, setManualMode] = useState(false)
    const [manualText, setManualText] = useState('')
    const [manualTouched, setManualTouched] = useState(false)
    const [manualParseError, setManualParseError] = useState<string | null>(null)
    const [manualApplyBusy, setManualApplyBusy] = useState(false)
    const [manualApplySuccess, setManualApplySuccess] = useState<string | null>(null)
    const manualTextAreaRef = useRef<HTMLTextAreaElement | null>(null)
    const isMountedRef = useRef(true)
    const testKey = useMemo(() => (Array.isArray(testItems) ? testItems.map((i) => `${i.id}:${i.model}`).join('|') : ''), [testItems])
    // Create Credential dialog state
    const [createOpen, setCreateOpen] = useState(false)
    const [createLoading, setCreateLoading] = useState(false)
    const [createSchema, setCreateSchema] = useState<any | null>(null)
    const [createName, setCreateName] = useState('')
    const [createValues, setCreateValues] = useState<Record<string, string>>({})
    // Derived: currently selected provider meta (used by effects below)
    const selectedProvider = useMemo(() => providers.find((p) => p.id === providerId), [providers, providerId])

    useEffect(() => {
        if (!open) return
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || ''
        const load = async () => {
            const call = async (bearer?: string) =>
                fetch('/api/v1/space-builder/config', {
                    method: 'GET',
                    headers: {
                        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {})
                    },
                    credentials: 'include'
                })
            let res = await call(token)
            if (res.status === 401) {
                try {
                    await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
                } catch (_) {
                    /* ignore refresh failures */
                }
                const newToken = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || token
                res = await call(newToken)
            }
            if (!res.ok) throw new Error(`Config request failed: ${res.status}`)
            const data = await res.json().catch(() => ({ testMode: false, disableUserCredentials: false, items: [] }))
            setTestMode(!!data?.testMode)
            setDisableUserCreds(!!data?.disableUserCredentials)
            setTestItems(Array.isArray(data?.items) ? data.items : [])
        }
        load().catch(() => {
            setTestMode(false)
            setDisableUserCreds(false)
            setTestItems([])
        })
    }, [open])

    // Load available providers when dialog opens (merge test providers if test mode)
    useEffect(() => {
        if (!open) return
        const unikId = (typeof localStorage !== 'undefined' && localStorage.getItem('parentUnikId')) || ''
        const url = `/api/v1/space-builder/providers${unikId ? `?unikId=${encodeURIComponent(unikId)}` : ''}`
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || ''
        const call = async (bearer?: string) =>
            fetch(url, { method: 'GET', credentials: 'include', headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) } })
        ;(async () => {
            try {
                let res = await call(token)
                if (res.status === 401) {
                    try {
                        await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
                    } catch (_) {
                        /* ignore refresh failures */
                    }
                    const newToken = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || token
                    res = await call(newToken)
                }
                if (!res.ok) throw new Error(String(res.status))
                const d = await res.json().catch(() => ({ providers: [] }))
                const baseList: ProviderMeta[] = Array.isArray(d?.providers) ? d.providers : []
                // Build test providers (at the front) preserving order from /config (env order)
                const testList: ProviderMeta[] = (testMode ? testItems : []).map((it) => ({
                    id: `test:${it.id}`,
                    label: `${it.label}`,
                    iconUrl: '',
                    credentialNames: [],
                    credentials: [],
                    supportsAsyncModels: false,
                    inputsSchema: [{ name: 'modelName', label: 'Model Name', type: 'string', default: it.model }]
                }))
                const finalList = [...testList, ...baseList]
                setProviders(finalList)
                // Default selection: first test provider if present, else first base
                if (!providerId && finalList.length) {
                    setProviderId(finalList[0].id)
                    if (finalList[0].id.startsWith('test:')) setModelName(testItems[0]?.model || '')
                }
            } catch {
                setProviders([])
            }
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, testMode, testKey])

    // Ensure async model list is available whenever settings are open and provider supports it
    useEffect(() => {
        if (!settingsOpen) return
        if (!selectedProvider) return
        if (!selectedProvider.supportsAsyncModels) return
        const pid = selectedProvider.id
        if (modelOptionsMap[pid]?.length) return
        ;(async () => {
            try {
                const res = await fetch(`/api/v1/node-load-method/${pid}`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: pid, loadMethod: 'listModels', inputParams: [] })
                })
                const data = await res.json()
                const list = (Array.isArray(data) ? data : []).map((m: any) => m.name)
                setModelOptionsMap((s) => ({ ...s, [pid]: list }))
                if (!modelName && list.length) setModelName(list[0])
            } catch (e) {
                console.error(`[SpaceBuilder] Failed to load models for provider ${pid}:`, e)
            }
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settingsOpen, selectedProvider?.id])

    // Keep modelName in sync for test providers
    useEffect(() => {
        if (String(providerId).startsWith('test:')) {
            const m = testItems.find((x) => `test:${x.id}` === providerId)?.model || ''
            setModelName(m)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [providerId])

    // Build test model options from server config
    const testModelOptions = useMemo(
        () =>
            (testItems || []).map((it) => ({
                key: `test:${it.id}`,
                label: it.label,
                provider: `test:${it.id}`,
                modelName: it.model,
                credentialId: ''
            })),
        [testItems]
    )

    const effectiveModels = useMemo(() => {
        const base = Array.isArray(models) ? models : []
        const merged = testModelOptions.length ? [...testModelOptions, ...base] : base
        // Deduplicate by label to avoid duplicated "(Test mode)" entries coming from different sources
        const seen = new Set<string>()
        const unique: typeof merged = []
        for (const m of merged) {
            const label = String((m as any).label || '')
            if (seen.has(label)) continue
            seen.add(label)
            unique.push(m)
        }
        return unique
    }, [models, testModelOptions])

    // Ensure active model is test when credentials are disabled
    useEffect(() => {
        if (testMode && disableUserCreds && (!modelKey || !String(modelKey).startsWith('test:')) && testModelOptions.length) {
            setModelKey(testModelOptions[0].key)
        }
    }, [testMode, disableUserCreds, modelKey, testModelOptions])

    const model = useMemo(() => effectiveModels.find((m) => m.key === modelKey) || effectiveModels?.[0], [effectiveModels, modelKey])
    const tooLong = sourceText.length > 5000
    const acTooLong = additionalConditions.length > 500
    const canPrepare = useMemo(() => {
        if (testMode)
            return Boolean(sourceText.trim() && (disableUserCreds ? true : model || (providerId && modelName)) && !tooLong && !acTooLong)
        return Boolean(sourceText.trim() && ((providerId && modelName) || model) && !tooLong && !acTooLong)
    }, [testMode, disableUserCreds, sourceText, tooLong, acTooLong, model, providerId, modelName])

    const formatQuizPlan = useCallback((plan: QuizPlan | null | undefined) => {
        const items = Array.isArray(plan?.items) ? plan?.items : []
        const lines: string[] = []
        items.forEach((it, idx) => {
            lines.push(`${idx + 1}. ${String(it?.question || '')}`)
            ;(Array.isArray(it?.answers) ? it.answers : []).forEach((a) => {
                lines.push(`  - ${String(a?.text || '')}${a?.isCorrect ? ' ✅' : ''}`)
            })
            if (idx < items.length - 1) lines.push('')
        })
        return lines.join('\n')
    }, [])

    const previewText = useMemo(() => formatQuizPlan(quizPlan), [quizPlan, formatQuizPlan])

    useEffect(() => {
        if (!modelKey && effectiveModels?.length) {
            setModelKey(effectiveModels[0].key)
        }
    }, [effectiveModels, modelKey])

    // Auto-select the first test model when test mode is active
    useEffect(() => {
        if (testMode && testModelOptions.length) {
            setModelKey(testModelOptions[0].key)
        }
    }, [testMode, testModelOptions])

    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
        }
    }, [])

    useEffect(() => {
        if (!manualMode) return
        setManualText(formatQuizPlan(quizPlan))
        setManualTouched(false)
        setManualParseError(null)
        setTimeout(() => {
            manualTextAreaRef.current?.focus()
        }, 0)
    }, [manualMode, quizPlan, formatQuizPlan])

    useEffect(() => {
        if (!manualMode) {
            setManualText(formatQuizPlan(quizPlan))
            setManualTouched(false)
            setManualParseError(null)
            setManualApplySuccess(null)
        }
    }, [manualMode, quizPlan, formatQuizPlan])

    useEffect(() => {
        if (!manualMode) return
        const baseline = formatQuizPlan(quizPlan)
        if (manualText === baseline && manualTouched) {
            setManualTouched(false)
        }
    }, [manualText, manualMode, quizPlan, manualTouched, formatQuizPlan])

    useEffect(() => {
        if (settingsOpen) {
            let initial = modelKey || effectiveModels?.[0]?.key || ''
            if (testMode && disableUserCreds && testModelOptions.length) initial = testModelOptions[0].key
            setTempModelKey(initial)
        }
    }, [settingsOpen, modelKey, effectiveModels, testMode, disableUserCreds, testModelOptions])

    function resetState() {
        setStep('input')
        setSourceText('')
        setAdditionalConditions('')
        setReviseText('')
        setModelKey('')
        setCreationMode('newSpace')
        setQuestionsCount(1)
        setAnswersPerQuestion(2)
        setQuizPlan(null)
        setCollectNames(true)
        setShowFinal(true)
        setSettingsOpen(false)
        setTempModelKey('')
        setManualMode(false)
        setManualText('')
        setManualTouched(false)
        setManualParseError(null)
        setManualApplyBusy(false)
        setManualApplySuccess(null)
    }

    const hasPendingManual = manualMode && manualTouched

    if (!open) return null
    const manualPreviewValue = manualMode ? manualText : previewText
    const disableConfigure = busy || manualApplyBusy || hasPendingManual
    const disableGenerate = busy || manualApplyBusy || !quizPlan || hasPendingManual

    const handleDialogClose = useCallback(
        (event: React.SyntheticEvent | Event, _reason: 'backdropClick' | 'escapeKeyDown') => {
            if (busy || manualApplyBusy) {
                if ('preventDefault' in event && typeof event.preventDefault === 'function') {
                    event.preventDefault()
                }
                return
            }
            onClose()
        },
        [busy, manualApplyBusy, onClose]
    )

    function handleManualToggle() {
        if (!quizPlan) return
        setManualMode((prev) => !prev)
    }

    function handleManualChange(value: string) {
        setManualText(value)
        setManualTouched(true)
        setManualParseError(null)
        setManualApplySuccess(null)
    }

    function insertCheckmark() {
        const node = manualTextAreaRef.current
        const insertValue = '✅'
        if (!node) {
            handleManualChange(manualText + insertValue)
            return
        }
        const start = node.selectionStart ?? manualText.length
        const end = node.selectionEnd ?? start
        const next = manualText.slice(0, start) + insertValue + manualText.slice(end)
        handleManualChange(next)
        setTimeout(() => {
            const pos = start + insertValue.length
            node.selectionStart = pos
            node.selectionEnd = pos
            node.focus()
        }, 0)
    }

    function cancelManualEdits() {
        handleManualChange(formatQuizPlan(quizPlan))
        setManualTouched(false)
        setManualParseError(null)
        setManualApplySuccess(null)
    }

    async function applyManualEdits() {
        const text = manualText.trim()
        if (!text) {
            setManualParseError(t('spaceBuilder.manualEmptyError'))
            return
        }
        setManualApplyBusy(true)
        setManualParseError(null)
        setManualApplySuccess(null)
        try {
            const normalized = await normalizeManualQuiz({
                rawText: text,
                selectedChatModel: buildSelectedChatModel(),
                fallbackToLLM: true
            })
            if (!isMountedRef.current) return
            setQuizPlan(normalized)
            setManualTouched(false)
            setManualApplySuccess(t('spaceBuilder.manualApplySuccess'))
        } catch (err) {
            if (!isMountedRef.current) return
            if (err instanceof SpaceBuilderHttpError) {
                const data = err.data as { message?: string; issues?: string[] } | undefined
                if (Array.isArray(data?.issues) && data?.issues.length) {
                    setManualParseError(data.issues.join('\n'))
                } else {
                    setManualParseError(err.message || t('spaceBuilder.manualApplyError'))
                }
            } else {
                setManualParseError(t('spaceBuilder.manualApplyError'))
            }
        } finally {
            if (isMountedRef.current) {
                setManualApplyBusy(false)
            }
        }
    }

    async function onPrepare() {
        if (!canPrepare) return
        setBusy(true)
        try {
            const plan = await prepareQuiz({
                sourceText: sourceText.trim(),
                selectedChatModel: buildSelectedChatModel(),
                options: { questionsCount, answersPerQuestion },
                ...(additionalConditions.trim() ? { additionalConditions: additionalConditions.trim() } : {})
            })
            setReviseText('')
            setQuizPlan(plan)
            setManualMode(false)
            setManualText(formatQuizPlan(plan))
            setManualTouched(false)
            setManualParseError(null)
            setManualApplySuccess(null)
            setStep('preview')
        } catch (err: any) {
            // eslint-disable-next-line no-console
            console.error('[SpaceBuilderDialog] prepare failed', err)
            const base = t('spaceBuilder.error') || 'Generation failed'
            onError?.(err?.message ? `${base}: ${err.message}` : base)
        } finally {
            setBusy(false)
        }
    }

    async function onRevise() {
        const text = reviseText.trim()
        if (!quizPlan || !text || text.length > 500 || hasPendingManual || manualApplyBusy) return
        setBusy(true)
        try {
            const revised = await reviseQuiz({ quizPlan, instructions: text, selectedChatModel: buildSelectedChatModel() })
            setQuizPlan(revised)
            setReviseText('')
            setManualMode(false)
            setManualText(formatQuizPlan(revised))
            setManualTouched(false)
            setManualParseError(null)
            setManualApplySuccess(null)
        } catch (err: any) {
            // eslint-disable-next-line no-console
            console.error('[SpaceBuilderDialog] revise failed', err)
            const base = t('spaceBuilder.error') || 'Generation failed'
            onError?.(err?.message ? `${base}: ${err.message}` : base)
        } finally {
            setBusy(false)
        }
    }

    async function onGenerate() {
        if (!quizPlan) return
        setBusy(true)
        try {
            const data = await generateFlow({
                quizPlan,
                selectedChatModel: buildSelectedChatModel(),
                options: { includeStartCollectName: collectNames, includeEndScore: showFinal, generateAnswerGraphics: false }
            })
            onApply(data, creationMode)
            resetState()
            onClose()
        } catch (err: any) {
            // eslint-disable-next-line no-console
            console.error('[SpaceBuilderDialog] generate failed', err)
            const base = t('spaceBuilder.error') || 'Generation failed'
            onError?.(err?.message ? `${base}: ${err.message}` : base)
        } finally {
            setBusy(false)
        }
    }

    // Build SelectedChatModel from provider cascade or legacy models
    function buildSelectedChatModel(): { provider: string; modelName: string; credentialId?: string } {
        if (testMode && disableUserCreds) {
            const tm = testModelOptions?.[0]
            if (tm) return { provider: tm.provider, modelName: tm.modelName }
        }
        if (providerId && modelName) return { provider: providerId, modelName, credentialId: credentialId || undefined }
        if (model) return { provider: model.provider, modelName: model.modelName, credentialId: model.credentialId }
        throw new Error('No model selected')
    }

    // Obsolete: rely on MUI focus restore; keeping helper if needed in future
    function handleCloseSettings() {
        setSettingsOpen(false)
    }

    // Inline Create Credential
    async function openCreateCredential() {
        if (!selectedProvider) return
        const credName = selectedProvider.credentialNames?.[0]
        if (!credName) return
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || ''
        const call = async (bearer?: string) =>
            fetch(`/api/v1/components-credentials/${encodeURIComponent(credName)}`, {
                method: 'GET',
                credentials: 'include',
                headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }
            })
        try {
            let res = await call(token)
            if (res.status === 401) {
                try {
                    await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
                } catch (_) {
                    /* ignore refresh failures */
                }
                const newToken = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || token
                res = await call(newToken)
            }
            if (!res.ok) throw new Error('Failed to load credential schema')
            const schema = await res.json()
            setCreateSchema(schema)
            setCreateValues({})
            setCreateName(schema?.label || schema?.name || 'Credential')
            setCreateOpen(true)
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[SpaceBuilder] load credential schema failed', e)
        }
    }

    async function submitCreateCredential() {
        if (!createSchema) return
        const unikId = (typeof localStorage !== 'undefined' && localStorage.getItem('parentUnikId')) || ''
        if (!unikId) return
        setCreateLoading(true)
        try {
            const body = {
                name: createName || createSchema.label || createSchema.name || 'Credential',
                credentialName: createSchema.name,
                plainDataObj: createValues,
                unikId
            }
            const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || ''
            const res = await fetch(`/api/v1/unik/${encodeURIComponent(unikId)}/credentials`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(body)
            })
            if (!res.ok) throw new Error('Failed to create credential')
            const createdResp = await res.json().catch(() => ({} as any))
            const createdId = createdResp?.id || createdResp?.data?.id
            // Refresh providers to include new credential
            setCreateOpen(false)
            const list = await refreshProviders()
            if (createdId) {
                setCredentialId(String(createdId))
            } else {
                const p = (list || []).find((x) => x.id === providerId)
                const fallback = (p?.credentials || []).find((c) => c.label === createName) || (p?.credentials || []).slice(-1)[0]
                if (fallback?.id) setCredentialId(fallback.id)
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[SpaceBuilder] create credential failed', e)
        } finally {
            setCreateLoading(false)
        }
    }

    async function refreshProviders(): Promise<ProviderMeta[]> {
        const unikId = (typeof localStorage !== 'undefined' && localStorage.getItem('parentUnikId')) || ''
        const url = `/api/v1/space-builder/providers${unikId ? `?unikId=${encodeURIComponent(unikId)}` : ''}`
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || ''
        const call = async (bearer?: string) =>
            fetch(url, { method: 'GET', credentials: 'include', headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) } })
        try {
            let res = await call(token)
            if (res.status === 401) {
                try {
                    await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
                } catch (_) {
                    /* ignore refresh failures */
                }
                const newToken = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || token
                res = await call(newToken)
            }
            if (!res.ok) return providers
            const d = await res.json().catch(() => ({ providers: [] }))
            const list: ProviderMeta[] = Array.isArray(d?.providers) ? d.providers : []
            setProviders(list)
            return list
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[SpaceBuilder] Failed to refresh providers:', e)
        }
        return providers
    }

    return (
        <>
            <Dialog
                open={open}
                onClose={handleDialogClose}
                fullWidth
                maxWidth='md'
                disableEnforceFocus={settingsOpen}
                disableRestoreFocus={settingsOpen}
            >
                <DialogTitle>{t('spaceBuilder.title')}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {step === 'input' && (
                        <>
                            <TextField
                                multiline
                                rows={16}
                                fullWidth
                                variant='outlined'
                                label={t('spaceBuilder.source')}
                                value={sourceText}
                                onChange={(e) => setSourceText(e.target.value)}
                                inputProps={{ maxLength: 5000 }}
                                error={tooLong}
                                helperText={`${sourceText.length}/5000`}
                                autoFocus
                                sx={{ mt: 1 }}
                            />
                            <TextField
                                multiline
                                rows={3}
                                fullWidth
                                variant='outlined'
                                label={t('spaceBuilder.additionalConstraints') || 'Additional conditions'}
                                value={additionalConditions}
                                onChange={(e) => setAdditionalConditions(e.target.value)}
                                inputProps={{ maxLength: 500 }}
                                error={acTooLong}
                                helperText={`${additionalConditions.length}/500`}
                            />
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <FormControl fullWidth>
                                    <InputLabel>{t('spaceBuilder.questionsCount')}</InputLabel>
                                    <Select
                                        label={t('spaceBuilder.questionsCount')}
                                        value={questionsCount}
                                        onChange={(e) => setQuestionsCount(Number(e.target.value))}
                                    >
                                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                            <MenuItem key={n} value={n}>
                                                {n}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControl fullWidth>
                                    <InputLabel>{t('spaceBuilder.answersPerQuestion')}</InputLabel>
                                    <Select
                                        label={t('spaceBuilder.answersPerQuestion')}
                                        value={answersPerQuestion}
                                        onChange={(e) => setAnswersPerQuestion(Number(e.target.value))}
                                    >
                                        {[2, 3, 4, 5].map((n) => (
                                            <MenuItem key={n} value={n}>
                                                {n}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>
                        </>
                    )}

                    {step === 'settings' && (
                        <>
                            <Typography variant='h6'>{t('spaceBuilder.settingsTitle') || 'Generation settings'}</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <FormControl fullWidth>
                                    <InputLabel>{t('spaceBuilder.creationModeLabel') || 'Creation mode'}</InputLabel>
                                    <Select
                                        label={t('spaceBuilder.creationModeLabel') || 'Creation mode'}
                                        value={creationMode}
                                        onChange={(e) => setCreationMode(String(e.target.value) as any)}
                                    >
                                        <MenuItem value='newSpace'>{t('spaceBuilder.creationMode.newSpace')}</MenuItem>
                                        <MenuItem value='replace'>{t('spaceBuilder.creationMode.replace')}</MenuItem>
                                        <MenuItem value='append'>{t('spaceBuilder.creationMode.append')}</MenuItem>
                                    </Select>
                                </FormControl>
                                <FormControlLabel
                                    control={<Checkbox checked={collectNames} onChange={(e) => setCollectNames(e.target.checked)} />}
                                    label={t('spaceBuilder.collectNames')}
                                />
                                <FormControlLabel
                                    control={<Checkbox checked={showFinal} onChange={(e) => setShowFinal(e.target.checked)} />}
                                    label={t('spaceBuilder.showFinal')}
                                />
                                <FormControlLabel
                                    control={<Checkbox checked={graphicsForAnswers} disabled />}
                                    label={t('spaceBuilder.graphicsForAnswers')}
                                />
                            </Box>
                        </>
                    )}

                    {step === 'preview' && (
                        <>
                            <Typography variant='h6'>{t('spaceBuilder.previewTitle')}</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                                <Button
                                    size='small'
                                    variant={manualMode ? 'contained' : 'outlined'}
                                    onClick={handleManualToggle}
                                    disabled={!quizPlan || busy || manualApplyBusy}
                                >
                                    {manualMode ? t('spaceBuilder.manualEditDisable') : t('spaceBuilder.manualEditEnable')}
                                </Button>
                            </Box>
                            <TextField
                                multiline
                                rows={manualMode ? 14 : 12}
                                fullWidth
                                variant='outlined'
                                value={manualPreviewValue}
                                onChange={manualMode ? (e) => handleManualChange(e.target.value) : undefined}
                                inputRef={manualMode ? manualTextAreaRef : undefined}
                                InputProps={{ readOnly: !manualMode }}
                                sx={{ mt: 1 }}
                                disabled={manualApplyBusy}
                            />
                            {manualMode && (
                                <>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('spaceBuilder.manualInstructions')}
                                        </Typography>
                                        <Button size='small' onClick={insertCheckmark} disabled={manualApplyBusy}>
                                            {t('spaceBuilder.manualInsertCheck')}
                                        </Button>
                                    </Box>
                                    {manualParseError && (
                                        <Alert severity='error' sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                                            {manualParseError}
                                        </Alert>
                                    )}
                                    {manualApplySuccess && (
                                        <Alert severity='success' sx={{ mt: 1 }}>
                                            {manualApplySuccess}
                                        </Alert>
                                    )}
                                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                        <LoadingButton
                                            loading={manualApplyBusy}
                                            onClick={applyManualEdits}
                                            disabled={manualApplyBusy || !manualText.trim()}
                                            variant='contained'
                                        >
                                            {manualApplyBusy ? t('spaceBuilder.manualApplying') : t('spaceBuilder.manualApply')}
                                        </LoadingButton>
                                        <Button onClick={cancelManualEdits} disabled={manualApplyBusy}>
                                            {t('spaceBuilder.manualCancel')}
                                        </Button>
                                    </Box>
                                </>
                            )}
                            <Typography variant='h6' sx={{ mt: 2 }}>
                                {t('spaceBuilder.reviseTitle') || 'Revise quiz'}
                            </Typography>
                            <TextField
                                multiline
                                rows={3}
                                fullWidth
                                variant='outlined'
                                label={t('spaceBuilder.reviseInstructions') || 'What to change?'}
                                value={reviseText}
                                onChange={(e) => setReviseText(e.target.value)}
                                inputProps={{ maxLength: 500 }}
                                helperText={`${reviseText.length}/500`}
                                disabled={manualApplyBusy}
                            />
                            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                <LoadingButton
                                    loading={busy}
                                    onClick={onRevise}
                                    disabled={!reviseText.trim() || busy || manualApplyBusy || hasPendingManual}
                                    variant='outlined'
                                >
                                    {busy ? t('spaceBuilder.revising') || 'Applying…' : t('spaceBuilder.revise') || 'Change'}
                                </LoadingButton>
                            </Box>
                            {/* Friendly warning about revise constraints */}
                            <FriendlyReviseHint />
                            {hasPendingManual && (
                                <Alert severity='info' sx={{ mt: 2 }}>
                                    {t('spaceBuilder.manualPendingHint')}
                                </Alert>
                            )}
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', px: 3, pb: 3, pt: 2 }}>
                    <Box>
                        {step === 'input' && (
                            <Tooltip title={t('spaceBuilder.modelSettings') || 'Model settings'} arrow>
                                <Button
                                    id='sb-model-settings-btn'
                                    onClick={() => setSettingsOpen(true)}
                                    disabled={busy}
                                    variant='contained'
                                    size='small'
                                    sx={{ minWidth: 36, width: 36, height: 36, p: 0, borderRadius: 1 }}
                                >
                                    <SettingsIcon fontSize='small' />
                                </Button>
                            </Tooltip>
                        )}
                    </Box>
                    {step === 'input' ? (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button onClick={onClose} disabled={busy}>
                                {t('spaceBuilder.cancel') || 'Cancel'}
                            </Button>
                            <LoadingButton
                                loading={busy}
                                loadingPosition='start'
                                onClick={onPrepare}
                                disabled={!canPrepare || busy}
                                variant='contained'
                            >
                                {busy ? t('spaceBuilder.preparing') || 'Preparing…' : t('spaceBuilder.prepare') || 'Prepare'}
                            </LoadingButton>
                        </Box>
                    ) : step === 'preview' ? (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                onClick={() => {
                                    setReviseText('')
                                    setStep('input')
                                }}
                                disabled={busy || manualApplyBusy}
                            >
                                {t('spaceBuilder.back') || 'Back'}
                            </Button>
                            <Button
                                onClick={() => {
                                    if (disableConfigure) return
                                    setManualMode(false)
                                    setStep('settings')
                                }}
                                disabled={disableConfigure}
                                variant='contained'
                            >
                                {t('spaceBuilder.configure') || 'Configure'}
                            </Button>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button onClick={() => setStep('preview')} disabled={busy || manualApplyBusy}>
                                {t('spaceBuilder.back') || 'Back'}
                            </Button>
                            <LoadingButton
                                loading={busy}
                                loadingPosition='start'
                                onClick={onGenerate}
                                disabled={disableGenerate}
                                variant='contained'
                            >
                                {busy ? t('spaceBuilder.generating') || 'Generating…' : t('spaceBuilder.generate') || 'Generate'}
                            </LoadingButton>
                        </Box>
                    )}
                </DialogActions>
            </Dialog>

            {/* Create Credential dialog */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth='sm' fullWidth closeAfterTransition={false}>
                <DialogTitle>{t('spaceBuilder.createCredential.title')}</DialogTitle>
                <DialogContent
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        pt: 3,
                        // Ensure first field does not stick to the title
                        '& > :first-of-type': { mt: 1.5 }
                    }}
                >
                    <TextField
                        fullWidth
                        label={t('spaceBuilder.createCredential.nameLabel')}
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                    />
                    {(Array.isArray(createSchema?.inputs) ? (createSchema.inputs as CredentialInput[]) : [])
                        .filter((inp) => inp?.type === 'password' || inp?.type === 'string')
                        .map((inp) => (
                            <TextField
                                key={inp.name}
                                fullWidth
                                type={inp.type === 'password' ? 'password' : 'text'}
                                label={inp.label || inp.name}
                                value={createValues[inp.name] || ''}
                                onChange={(e) => setCreateValues((s) => ({ ...s, [inp.name]: e.target.value }))}
                            />
                        ))}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
                    <Button onClick={() => setCreateOpen(false)} disabled={createLoading}>
                        {t('spaceBuilder.cancel') || 'Cancel'}
                    </Button>
                    <LoadingButton loading={createLoading} variant='contained' onClick={submitCreateCredential}>
                        {t('spaceBuilder.createCredential.add')}
                    </LoadingButton>
                </DialogActions>
            </Dialog>

            <Dialog
                open={settingsOpen}
                onClose={busy ? undefined : handleCloseSettings}
                maxWidth='sm'
                fullWidth
                closeAfterTransition={false}
            >
                <DialogTitle>{t('spaceBuilder.modelSettingsTitle') || 'Model settings'}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    {testMode && (
                        <Alert severity='info'>
                            {t('spaceBuilder.testModeInfo') ||
                                'Test mode is active: server always uses test providers; chosen credential models may be disabled.'}
                        </Alert>
                    )}

                    {testMode && disableUserCreds ? (
                        <>
                            <FormControl fullWidth disabled={!testModelOptions.length} sx={{ mt: 1 }}>
                                <InputLabel>{t('spaceBuilder.model')}</InputLabel>
                                <Select
                                    label={t('spaceBuilder.model')}
                                    value={tempModelKey}
                                    onChange={(e) => setTempModelKey(String(e.target.value))}
                                >
                                    {testModelOptions.map((m) => (
                                        <MenuItem key={m.key} value={m.key}>
                                            {m.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {!testModelOptions.length && (
                                <Typography variant='body2' color='text.secondary'>
                                    {t('spaceBuilder.noModels') || 'No models available. Add credentials to proceed.'}
                                </Typography>
                            )}
                        </>
                    ) : (
                        <>
                            <FormControl fullWidth sx={{ mt: 1 }}>
                                <InputLabel>{t('spaceBuilder.provider') || 'Provider'}</InputLabel>
                                <Select
                                    label={t('spaceBuilder.provider') || 'Provider'}
                                    value={providerId}
                                    onChange={(e) => {
                                        setProviderId(String(e.target.value))
                                        setCredentialId('')
                                        setModelName('')
                                    }}
                                >
                                    {providers.map((p) => (
                                        <MenuItem key={p.id} value={p.id}>
                                            {p.iconUrl ? (
                                                <img src={p.iconUrl} alt='' width={18} height={18} style={{ marginRight: 8 }} />
                                            ) : null}
                                            {p.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {String(providerId).startsWith('test:') ? (
                                <TextField
                                    fullWidth
                                    disabled
                                    label={t('spaceBuilder.connectCredential') || 'Connect Credential'}
                                    value={t('spaceBuilder.testCredentialsPlaceholder')}
                                />
                            ) : (
                                <FormControl fullWidth disabled={!selectedProvider}>
                                    <InputLabel>{t('spaceBuilder.connectCredential') || 'Connect Credential'}</InputLabel>
                                    <Select
                                        label={t('spaceBuilder.connectCredential') || 'Connect Credential'}
                                        value={credentialId}
                                        onChange={(e) => {
                                            const val = String(e.target.value)
                                            if (val === '__create__') {
                                                // reset selection then open creation dialog
                                                setCredentialId('')
                                                openCreateCredential()
                                                return
                                            }
                                            setCredentialId(val)
                                        }}
                                    >
                                        <MenuItem value='__create__'>{t('spaceBuilder.createNew') || '- Create New -'}</MenuItem>
                                        {(selectedProvider?.credentials || []).map((c) => (
                                            <MenuItem key={c.id} value={c.id}>
                                                {c.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}
                            <FormControl fullWidth disabled={!selectedProvider}>
                                {String(providerId).startsWith('test:') ? (
                                    <TextField
                                        label={t('spaceBuilder.model')}
                                        value={modelName || testItems.find((x) => `test:${x.id}` === providerId)?.model || ''}
                                        disabled
                                    />
                                ) : selectedProvider?.supportsAsyncModels ? (
                                    <>
                                        <InputLabel>{t('spaceBuilder.model')}</InputLabel>
                                        <Select
                                            label={t('spaceBuilder.model')}
                                            value={modelName}
                                            onChange={(e) => setModelName(String(e.target.value))}
                                        >
                                            {(modelOptionsMap[selectedProvider.id] || []).map((m: string) => (
                                                <MenuItem key={m} value={m}>
                                                    {m}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </>
                                ) : (
                                    <TextField
                                        label={t('spaceBuilder.model')}
                                        value={modelName}
                                        onChange={(e) => setModelName(e.target.value)}
                                    />
                                )}
                            </FormControl>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                {!!selectedProvider?.inputsSchema?.find((p) => p.name === 'temperature') && (
                                    <TextField
                                        type='number'
                                        inputProps={{ step: 0.1 }}
                                        label='Temperature'
                                        value={advParams.temperature ?? ''}
                                        onChange={(e) => setAdvParams((s) => ({ ...s, temperature: Number(e.target.value) }))}
                                    />
                                )}
                                {!!selectedProvider?.inputsSchema?.find((p) => p.name === 'topP') && (
                                    <TextField
                                        type='number'
                                        inputProps={{ step: 0.1 }}
                                        label='TopP'
                                        value={advParams.topP ?? ''}
                                        onChange={(e) => setAdvParams((s) => ({ ...s, topP: Number(e.target.value) }))}
                                    />
                                )}
                            </Box>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={!!advParams.streaming}
                                        onChange={(e) => setAdvParams((s) => ({ ...s, streaming: e.target.checked }))}
                                    />
                                }
                                label='Streaming'
                            />
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
                    <Button onClick={handleCloseSettings} disabled={busy}>
                        {t('spaceBuilder.cancel') || 'Cancel'}
                    </Button>
                    <Button
                        onClick={() => {
                            if (testMode && disableUserCreds) {
                                const next = tempModelKey || testModelOptions[0]?.key || ''
                                if (next) setModelKey(next)
                            }
                            handleCloseSettings()
                        }}
                        disabled={busy}
                        variant='contained'
                    >
                        {t('spaceBuilder.save') || 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

// Dismissible hint explaining revise rules
const FriendlyReviseHint: React.FC = () => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(true)
    if (!open) return null
    return (
        <Alert
            severity='warning'
            variant='standard'
            onClose={() => setOpen(false)}
            sx={(theme) => {
                const bg = theme.palette.warning.light
                const fg = theme.palette.getContrastText(bg)
                return {
                    mt: 2,
                    backgroundColor: bg,
                    border: `1px solid ${theme.palette.warning.main}`,
                    '& .MuiAlert-message': { color: fg },
                    '& .MuiAlert-icon': { color: theme.palette.warning.main },
                    '& .MuiAlert-action': { color: fg }
                }
            }}
        >
            {t('spaceBuilder.reviseHint')}
        </Alert>
    )
}
