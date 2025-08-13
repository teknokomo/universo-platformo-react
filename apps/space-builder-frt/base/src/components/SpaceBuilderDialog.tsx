import React, { useEffect, useMemo, useState } from 'react'
import { useSpaceBuilder } from '../hooks/useSpaceBuilder'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, Checkbox, FormControlLabel, Button, Typography, Box, Alert, Tooltip } from '@mui/material'
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
  const { prepareQuiz, generateFlow, reviseQuiz } = useSpaceBuilder()
  const [step, setStep] = useState<'input' | 'preview' | 'settings'>('input')
  const [sourceText, setSourceText] = useState('')
  const [additionalConditions, setAdditionalConditions] = useState('')
  const [reviseText, setReviseText] = useState('')
  const [modelKey, setModelKey] = useState(models?.[0]?.key || '')
  const [creationMode, setCreationMode] = useState<'replace' | 'append' | 'newSpace'>('newSpace')
  const [busy, setBusy] = useState(false)
  const [questionsCount, setQuestionsCount] = useState(1)
  const [answersPerQuestion, setAnswersPerQuestion] = useState(2)
  const [quizPlan, setQuizPlan] = useState<any>(null)
  const [testMode, setTestMode] = useState(false)
  const [collectNames, setCollectNames] = useState(true)
  const [showFinal, setShowFinal] = useState(true)
  const [graphicsForAnswers] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tempModelKey, setTempModelKey] = useState('')

  useEffect(() => {
    if (!open) return
    fetch('/api/v1/space-builder/config', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { testMode: false }))
      .then((d) => setTestMode(!!d?.testMode))
      .catch(() => setTestMode(false))
  }, [open])

  const effectiveModels = useMemo(() => {
    if (models?.length) return models
    if (testMode) {
      return [
        {
          key: 'groq_test:llama-3-8b-8192',
          label: 'Groq Test: llama-3-8b-8192',
          provider: 'groq_test',
          modelName: 'llama-3-8b-8192',
          credentialId: ''
        }
      ]
    }
    return []
  }, [models, testMode])

  const model = useMemo(() => effectiveModels.find((m) => m.key === modelKey) || effectiveModels?.[0], [effectiveModels, modelKey])
  const tooLong = sourceText.length > 5000
  const acTooLong = additionalConditions.length > 500
  const canPrepare = Boolean(sourceText.trim() && model && !tooLong && !acTooLong)

  const previewText = useMemo(() => {
    const items = Array.isArray(quizPlan?.items) ? quizPlan.items : []
    const lines: string[] = []
    items.forEach((it: any, idx: number) => {
      lines.push(`${idx + 1}. ${String(it?.question || '')}`)
      ;(Array.isArray(it?.answers) ? it.answers : []).forEach((a: any) => {
        lines.push(`  - ${String(a?.text || '')}${a?.isCorrect ? ' ✅' : ''}`)
      })
      if (idx < items.length - 1) lines.push('')
    })
    return lines.join('\n')
  }, [quizPlan])

  useEffect(() => {
    if (!modelKey && effectiveModels?.length) {
      setModelKey(effectiveModels[0].key)
    }
  }, [effectiveModels, modelKey])

  useEffect(() => {
    if (settingsOpen) {
      setTempModelKey(modelKey || (effectiveModels?.[0]?.key || ''))
    }
  }, [settingsOpen, modelKey, effectiveModels])

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
  }

  if (!open) return null

  async function onPrepare() {
    if (!canPrepare) return
    setBusy(true)
    try {
      const plan = await prepareQuiz({
        sourceText: sourceText.trim(),
        selectedChatModel: model!,
        options: { questionsCount, answersPerQuestion },
        ...(additionalConditions.trim() ? { additionalConditions: additionalConditions.trim() } : {})
      })
      setReviseText('')
      setQuizPlan(plan)
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
    if (!quizPlan || !model || !text || text.length > 500) return
    setBusy(true)
    try {
      const revised = await reviseQuiz({ quizPlan, instructions: text, selectedChatModel: model! })
      setQuizPlan(revised)
      setReviseText('')
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
    if (!quizPlan || !model) return
    setBusy(true)
    try {
      const data = await generateFlow({ quizPlan, selectedChatModel: model!, options: { includeStartCollectName: collectNames, includeEndScore: showFinal, generateAnswerGraphics: false } })
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

  return (
    <>
      <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth='md' disableEnforceFocus={settingsOpen} disableRestoreFocus={settingsOpen}>
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
                  <Select label={t('spaceBuilder.questionsCount')} value={questionsCount} onChange={(e) => setQuestionsCount(Number(e.target.value))}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>{t('spaceBuilder.answersPerQuestion')}</InputLabel>
                  <Select label={t('spaceBuilder.answersPerQuestion')} value={answersPerQuestion} onChange={(e) => setAnswersPerQuestion(Number(e.target.value))}>
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
                  <Select label={t('spaceBuilder.creationModeLabel') || 'Creation mode'} value={creationMode} onChange={(e) => setCreationMode(String(e.target.value) as any)}>
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
              <TextField
                multiline
                rows={12}
                fullWidth
                variant='outlined'
                value={previewText}
                InputProps={{ readOnly: true }}
                sx={{ mt: 1 }}
              />
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
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <LoadingButton loading={busy} onClick={onRevise} disabled={!reviseText.trim() || busy} variant='outlined'>
                  {busy ? t('spaceBuilder.revising') || 'Applying…' : t('spaceBuilder.revise') || 'Change'}
                </LoadingButton>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', px: 3, pb: 3, pt: 2 }}>
          <Box>
            {step === 'input' && (
              <Tooltip title={t('spaceBuilder.modelSettings') || 'Model settings'} arrow>
                <Button onClick={() => setSettingsOpen(true)} disabled={busy} variant='contained' size='small' sx={{ minWidth: 36, width: 36, height: 36, p: 0, borderRadius: 1 }}>
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
              <LoadingButton loading={busy} loadingPosition='start' onClick={onPrepare} disabled={!canPrepare || busy} variant='contained'>
                {busy ? t('spaceBuilder.preparing') || 'Preparing…' : t('spaceBuilder.prepare') || 'Prepare'}
              </LoadingButton>
            </Box>
          ) : step === 'preview' ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={() => { setReviseText(''); setStep('input') }} disabled={busy}>
                {t('spaceBuilder.back') || 'Back'}
              </Button>
              <Button onClick={() => setStep('settings')} disabled={busy} variant='contained'>
                {t('spaceBuilder.configure') || 'Configure'}
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={() => setStep('preview')} disabled={busy}>
                {t('spaceBuilder.back') || 'Back'}
              </Button>
              <LoadingButton loading={busy} loadingPosition='start' onClick={onGenerate} disabled={!quizPlan || busy} variant='contained'>
                {busy ? t('spaceBuilder.generating') || 'Generating…' : t('spaceBuilder.generate') || 'Generate'}
              </LoadingButton>
            </Box>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={settingsOpen} onClose={busy ? undefined : () => setSettingsOpen(false)} maxWidth='sm' fullWidth keepMounted>
        <DialogTitle>{t('spaceBuilder.modelSettingsTitle') || 'Model settings'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {testMode && (
            <Alert severity='info'>
              {t('spaceBuilder.testModeInfo') || 'Test mode is active: server always uses Groq Test provider; chosen model may be ignored.'}
            </Alert>
          )}
          <FormControl fullWidth disabled={!effectiveModels?.length} sx={{ mt: 1 }}>
            <InputLabel>{t('spaceBuilder.model')}</InputLabel>
            <Select label={t('spaceBuilder.model')} value={tempModelKey} onChange={(e) => setTempModelKey(String(e.target.value))}>
              {(effectiveModels || []).map((m) => (
                <MenuItem key={m.key} value={m.key}>
                  {m.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {!effectiveModels?.length && (
            <Typography variant='body2' color='text.secondary'>
              {t('spaceBuilder.noModels') || 'No models available. Add credentials to proceed.'}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Button onClick={() => setSettingsOpen(false)} disabled={busy}>
            {t('spaceBuilder.cancel') || 'Cancel'}
          </Button>
          <Button
            onClick={() => {
              if (tempModelKey) setModelKey(tempModelKey)
              setSettingsOpen(false)
            }}
            disabled={busy || !effectiveModels?.length}
            variant='contained'
          >
            {t('spaceBuilder.save') || 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
