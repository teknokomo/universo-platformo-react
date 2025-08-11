import React, { useEffect, useMemo, useState } from 'react'
import { useSpaceBuilder } from '../hooks/useSpaceBuilder'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, Checkbox, FormControlLabel, Button, Typography, Box } from '@mui/material'
import { LoadingButton } from '@mui/lab'

export type SpaceBuilderDialogProps = {
  open: boolean
  onClose: () => void
  onApply: (graph: { nodes: unknown[]; edges: unknown[] }, mode: 'append' | 'replace') => void
  models: Array<{ key: string; label: string; provider: string; modelName: string; credentialId: string }>
  onError?: (message: string) => void
}

export const SpaceBuilderDialog: React.FC<SpaceBuilderDialogProps> = ({ open, onClose, onApply, models, onError }) => {
  const { t } = useTranslation()
  const { prepareQuiz, generateFlow } = useSpaceBuilder()
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [sourceText, setSourceText] = useState('')
  const [modelKey, setModelKey] = useState(models?.[0]?.key || '')
  const [append, setAppend] = useState(true)
  const [busy, setBusy] = useState(false)
  const [questionsCount, setQuestionsCount] = useState(1)
  const [answersPerQuestion, setAnswersPerQuestion] = useState(2)
  const [quizPlan, setQuizPlan] = useState<any>(null)
  const [testMode, setTestMode] = useState(false)

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
  const tooLong = sourceText.length > 2000
  const canPrepare = Boolean(sourceText.trim() && model && !tooLong)

  if (!open) return null

  async function onPrepare() {
    if (!canPrepare) return
    setBusy(true)
    try {
      const plan = await prepareQuiz({
        sourceText: sourceText.trim(),
        selectedChatModel: model!,
        options: { questionsCount, answersPerQuestion }
      })
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

  async function onGenerate() {
    if (!quizPlan || !model) return
    setBusy(true)
    try {
      const data = await generateFlow({ quizPlan, selectedChatModel: model! })
      onApply(data, append ? 'append' : 'replace')
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
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth='sm'>
      <DialogTitle>{t('spaceBuilder.title')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {step === 'input' && (
          <>
            <TextField
              multiline
              rows={8}
              fullWidth
              variant='outlined'
              placeholder={t('spaceBuilder.source') || ''}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              inputProps={{ maxLength: 2000 }}
              error={tooLong}
              helperText={`${sourceText.length}/2000`}
              autoFocus
            />
            <FormControl fullWidth disabled={!effectiveModels?.length}>
              <InputLabel>{t('spaceBuilder.model')}</InputLabel>
              <Select label={t('spaceBuilder.model')} value={modelKey} onChange={(e) => setModelKey(String(e.target.value))}>
                {(effectiveModels || []).map((m) => (
                  <MenuItem key={m.key} value={m.key}>
                    {m.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
            {!effectiveModels?.length && (
              <div style={{ opacity: 0.8 }}>
                {t('spaceBuilder.noModels') || 'No models available. Add credentials to proceed.'}
              </div>
            )}
            <FormControlLabel
              control={<Checkbox checked={append} onChange={(e) => setAppend(e.target.checked)} />}
              label={t('spaceBuilder.append') || 'Append to current flow'}
            />
          </>
        )}

        {step === 'preview' && (
          <>
            <Typography variant='h6'>{t('spaceBuilder.previewTitle')}</Typography>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(quizPlan?.items || []).map((it: any, idx: number) => (
                <div key={idx}>
                  <strong>
                    {idx + 1}. {it.question}
                  </strong>
                  <ul>
                    {it.answers.map((a: any, j: number) => (
                      <li key={j} style={{ color: a.isCorrect ? 'green' : undefined }}>
                        {a.text}
                        {a.isCorrect ? ' ✅' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
      <DialogActions>
        {step === 'input' ? (
          <>
            <Button onClick={onClose} disabled={busy}>
              {t('spaceBuilder.cancel') || 'Cancel'}
            </Button>
            <LoadingButton loading={busy} onClick={onPrepare} disabled={!canPrepare || busy}>
              {busy ? t('spaceBuilder.preparing') || 'Preparing…' : t('spaceBuilder.prepare') || 'Prepare'}
            </LoadingButton>
          </>
        ) : (
          <>
            <Button onClick={() => setStep('input')} disabled={busy}>
              {t('spaceBuilder.back') || 'Back'}
            </Button>
            <LoadingButton loading={busy} onClick={onGenerate} disabled={!quizPlan || busy}>
              {busy ? t('spaceBuilder.generating') || 'Generating…' : t('spaceBuilder.generate') || 'Generate'}
            </LoadingButton>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
