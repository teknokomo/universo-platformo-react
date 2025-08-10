import React, { useMemo, useState } from 'react'
import { useSpaceBuilder } from '../hooks/useSpaceBuilder'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, Checkbox, FormControlLabel, Button } from '@mui/material'
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
  const { generateFlow } = useSpaceBuilder()
  const [question, setQuestion] = useState('')
  const [modelKey, setModelKey] = useState(models?.[0]?.key || '')
  const [append, setAppend] = useState(true)
  const [busy, setBusy] = useState(false)

  const model = useMemo(() => models.find((m) => m.key === modelKey) || models?.[0], [models, modelKey])
  const canGenerate = Boolean(question.trim() && model)

  if (!open) return null

  async function onGenerate() {
    if (!canGenerate) return
    setBusy(true)
    try {
      const data = await generateFlow({ question, selectedChatModel: model! })
      onApply(data, append ? 'append' : 'replace')
      onClose()
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[SpaceBuilderDialog] generation failed', err)
      let details = ''
      const raw = typeof err?.message === 'string' ? err.message : ''
      try {
        const parsed = JSON.parse(raw)
        details = parsed?.details || parsed?.error || ''
      } catch (_) {
        details = raw
      }
      const base = t('spaceBuilder.error') || 'Generation failed'
      onError?.(details ? `${base}: ${details}` : base)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth='sm'>
      <DialogTitle>{t('spaceBuilder.title')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          multiline
          rows={5}
          fullWidth
          variant='outlined'
          placeholder={t('spaceBuilder.prompt') || ''}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          autoFocus
          sx={{ mt: 1 }}
        />
        <FormControl fullWidth disabled={!models?.length}>
          <InputLabel>{t('spaceBuilder.model')}</InputLabel>
          <Select label={t('spaceBuilder.model')} value={modelKey} onChange={(e) => setModelKey(String(e.target.value))}>
            {(models || []).map((m) => (
              <MenuItem key={m.key} value={m.key}>
                {m.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {!models?.length && (
          <div style={{ opacity: 0.8 }}>{t('spaceBuilder.noModels') || 'No models available. Add credentials to proceed.'}</div>
        )}
        <FormControlLabel
          control={<Checkbox checked={append} onChange={(e) => setAppend(e.target.checked)} />}
          label={t('spaceBuilder.append') || 'Append to current flow'}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('spaceBuilder.cancel') || 'Cancel'}
        </Button>
        <LoadingButton loading={busy} onClick={onGenerate} disabled={!canGenerate || busy}>
          {busy ? t('spaceBuilder.generating') || 'Generating…' : t('spaceBuilder.generate') || 'Generate'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  )
}
