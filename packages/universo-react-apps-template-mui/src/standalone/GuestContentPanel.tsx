import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import type { GuestRuntimeContent } from './guestRuntimeTypes'

type GuestContentPanelProps = {
    runtime: GuestRuntimeContent
    currentItemIndex: number
    contentCompleted: boolean
    setCurrentItemIndex: (value: number) => void
    setContentCompleted: (value: boolean) => void
    handleMoveContent: (nextIndex: number) => void
    handleCompleteContent: () => void
    handleOpenQuiz: (quizId: string) => void
}

export default function GuestContentPanel({
    runtime,
    currentItemIndex,
    contentCompleted,
    setCurrentItemIndex,
    setContentCompleted,
    handleMoveContent,
    handleCompleteContent,
    handleOpenQuiz
}: GuestContentPanelProps) {
    const { t } = useTranslation('apps')
    const currentItem = runtime.contentItems[currentItemIndex] ?? null
    const totalItems = runtime.contentItems.length

    const renderContentItem = () => {
        if (!currentItem) return null

        if (currentItem.itemType === 'text') {
            return <Typography sx={{ whiteSpace: 'pre-wrap' }}>{currentItem.itemContent}</Typography>
        }

        if (currentItem.itemType === 'image') {
            return (
                <Box
                    component='img'
                    src={currentItem.itemContent}
                    alt={currentItem.itemTitle || 'content item'}
                    sx={{ width: '100%', borderRadius: 2 }}
                />
            )
        }

        if (currentItem.itemType === 'video_url') {
            return (
                <Box sx={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                    <iframe
                        src={currentItem.itemContent}
                        title={currentItem.itemTitle || 'video'}
                        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                        allowFullScreen
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 12 }}
                    />
                </Box>
            )
        }

        const quizId = currentItem.quizId

        if (currentItem.itemType === 'quiz_ref' && quizId) {
            return (
                <Button variant='contained' onClick={() => handleOpenQuiz(quizId)}>
                    {t('guest.openQuiz', 'Open quiz')}
                </Button>
            )
        }

        return <Alert severity='info'>{t('guest.unsupportedContent', 'This content item type is not supported in guest mode yet.')}</Alert>
    }

    return (
        <>
            {runtime?.type === 'content' ? (
                contentCompleted ? (
                    <Stack spacing={2}>
                        <Alert severity='success'>
                            {t('guest.contentCompleted', 'Content complete. Progress has been recorded for this session.')}
                        </Alert>
                        <Stack direction='row' spacing={1} sx={{ justifyContent: 'flex-end' }}>
                            <Button
                                variant='outlined'
                                onClick={() => {
                                    setContentCompleted(false)
                                    setCurrentItemIndex(0)
                                }}
                            >
                                {t('guest.restartContent', 'Restart content')}
                            </Button>
                        </Stack>
                    </Stack>
                ) : (
                    <Stack spacing={2}>
                        <LinearProgress variant='determinate' value={totalItems > 0 ? ((currentItemIndex + 1) / totalItems) * 100 : 0} />
                        {currentItem?.itemTitle ? <Typography variant='h6'>{currentItem.itemTitle}</Typography> : null}
                        {renderContentItem()}
                        <Stack direction='row' spacing={1} sx={{ justifyContent: 'space-between' }}>
                            <Button
                                variant='outlined'
                                onClick={() => handleMoveContent(currentItemIndex - 1)}
                                disabled={currentItemIndex === 0}
                            >
                                {t('guest.previous', 'Previous')}
                            </Button>
                            {currentItemIndex >= totalItems - 1 ? (
                                <Button variant='contained' onClick={handleCompleteContent}>
                                    {t('guest.completeContent', 'Complete content')}
                                </Button>
                            ) : (
                                <Button variant='contained' onClick={() => handleMoveContent(currentItemIndex + 1)}>
                                    {t('guest.next', 'Next')}
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                )
            ) : null}
        </>
    )
}
