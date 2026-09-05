import * as React from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { parseMarketingActionHref, toMarketingActionLinkAttributes } from '@universo-react/utils'

import type { MarketingFaqItem, MarketingSectionCopy } from '../types'
import { marketingSectionId, MarketingEmptyState, MarketingSectionHeader, sortVisibleMarketingItems } from './MarketingPrimitives'

export interface FAQProps {
    section: MarketingSectionCopy
    items: MarketingFaqItem[]
    instanceKey?: string
}

function renderAnswer(answer: string) {
    return answer.split(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi).map((part, index) => {
        const action = parseMarketingActionHref(`mailto:${part}`)
        if (!action || action.kind !== 'email') {
            return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
        }

        const attributes = toMarketingActionLinkAttributes(action)
        return (
            <Link key={`${part}-${index}`} {...attributes}>
                {part}
            </Link>
        )
    })
}

export default function FAQ({ section, items, instanceKey }: FAQProps) {
    const [expanded, setExpanded] = React.useState<string[]>([])
    const visibleItems = sortVisibleMarketingItems(items)
    const sectionId = marketingSectionId('faq', instanceKey)
    return (
        <Container
            id={sectionId}
            sx={{
                pt: { xs: 4, sm: 12 },
                pb: { xs: 8, sm: 16 },
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: { xs: 3, sm: 6 }
            }}
        >
            <MarketingSectionHeader section={section} id={sectionId} />
            {visibleItems.length === 0 ? (
                <MarketingEmptyState section={section.title} />
            ) : (
                <Box sx={{ width: '100%' }}>
                    {visibleItems.map((item) => {
                        const panelId = `${sectionId}-${item.semanticKey.replace(/[^A-Za-z0-9_-]/g, '-')}`
                        return (
                            <Accordion
                                key={item.semanticKey}
                                expanded={expanded.includes(panelId)}
                                onChange={(_, isExpanded) =>
                                    setExpanded((current) =>
                                        isExpanded
                                            ? current.includes(panelId)
                                                ? current
                                                : [...current, panelId]
                                            : current.filter((value) => value !== panelId)
                                    )
                                }
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    aria-controls={`${panelId}-content`}
                                    id={`${panelId}-header`}
                                >
                                    <Typography component='span' variant='subtitle2'>
                                        {item.question}
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Typography
                                        variant='body2'
                                        gutterBottom
                                        sx={{ whiteSpace: 'pre-wrap', maxWidth: { sm: '100%', md: '70%' } }}
                                    >
                                        {renderAnswer(item.answer)}
                                    </Typography>
                                </AccordionDetails>
                            </Accordion>
                        )
                    })}
                </Box>
            )}
        </Container>
    )
}
