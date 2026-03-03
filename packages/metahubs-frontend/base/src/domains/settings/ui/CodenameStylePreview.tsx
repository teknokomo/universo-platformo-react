/**
 * Universo Platformo | Codename Style Preview
 *
 * Shows a live preview of what a codename looks like in the selected style and alphabet.
 */

import { Box, Typography, Chip } from '@mui/material'
import { useTranslation } from 'react-i18next'

interface CodenameStylePreviewProps {
    /** Currently selected codename style */
    style: string
    /** Currently selected codename alphabet */
    alphabet?: string
    /** Whether mixed Latin+Cyrillic is currently allowed */
    allowMixed?: boolean
    /** Show mixed example only when allowMixed=true */
    showMixedPreviewOnly?: boolean
}

const CodenameStylePreview = ({
    style,
    alphabet = 'en-ru',
    allowMixed = false,
    showMixedPreviewOnly = false
}: CodenameStylePreviewProps) => {
    const { t } = useTranslation('metahubs')

    const resolvedStyle = style === 'kebab-case' || style === 'pascal-case' ? style : 'pascal-case'
    const resolvedAlphabet = alphabet === 'en' || alphabet === 'ru' || alphabet === 'en-ru' ? alphabet : 'en-ru'

    const exampleVariants =
        resolvedAlphabet === 'en-ru' ? (showMixedPreviewOnly && allowMixed ? ['mixed'] : ['en', 'ru']) : [resolvedAlphabet]

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant='caption' color='text.secondary'>
                {t('settings.codenamePreview.title')}:
            </Typography>
            {exampleVariants.map((variant) => (
                <Chip
                    key={variant}
                    label={t(`settings.codenamePreview.${resolvedStyle}.${variant}`)}
                    size='small'
                    variant='outlined'
                    sx={{ fontFamily: 'monospace', fontWeight: 500 }}
                />
            ))}
        </Box>
    )
}

export default CodenameStylePreview
