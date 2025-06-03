// Universo Platformo | Base Bot Embed component for all bot types
import { useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import { Tabs, Tab, Box, Typography } from '@mui/material'
import { CopyBlock, atomOneDark } from 'react-code-blocks'

// Project import
import { CheckboxInput } from '@/ui-component/checkbox/Checkbox'

// ==============================|| Base Bot Embed ||============================== //

function TabPanel(props) {
    const { children, value, index, ...other } = props
    return (
        <div
            role='tabpanel'
            hidden={value !== index}
            id={`attachment-tabpanel-${index}`}
            aria-labelledby={`attachment-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ p: 1 }}>{children}</Box>}
        </div>
    )
}

TabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired
}

function a11yProps(index) {
    return {
        id: `attachment-tab-${index}`,
        'aria-controls': `attachment-tabpanel-${index}`
    }
}

const customStringify = (obj) => {
    let stringified = JSON.stringify(obj, null, 4)
        .replace(/"([^"]+)":/g, '$1:')
        .replace(/: "([^"]+)"/g, (match, value) => (value.includes('<') ? `: "${value}"` : `: '${value}'`))
        .replace(/: "(true|false|\d+)"/g, ': $1')
        .replace(/customCSS: ""/g, 'customCSS: ``')
    return stringified
        .split('\n')
        .map((line, index) => {
            if (index === 0) return line
            return ' '.repeat(8) + line
        })
        .join('\n')
}

const BaseBotEmbed = ({
    chatflowid,
    title,
    codeGenerators,
    defaultThemeConfig
}) => {
    const codes = ['Popup Html', 'Fullpage Html', 'Popup React', 'Fullpage React']
    const [value, setValue] = useState(0)
    const [embedCheckboxVal, setEmbedCheckbox] = useState(false)
    const { t } = useTranslation('chatflows')

    const onCheckBoxEmbedChanged = (newVal) => {
        setEmbedCheckbox(newVal)
    }

    const handleChange = (event, newValue) => {
        setValue(newValue)
    }

    const getCode = (codeLang) => {
        if (!codeGenerators) return ''
        
        switch (codeLang) {
            case 'Popup Html':
                return codeGenerators.popupHtml(chatflowid)
            case 'Popup React':
                return codeGenerators.popupReact(chatflowid)
            case 'Fullpage Html':
                return codeGenerators.fullpageHtml(chatflowid)
            case 'Fullpage React':
                return codeGenerators.fullpageReact(chatflowid)
            default:
                return ''
        }
    }

    const getCodeCustomization = (codeLang) => {
        if (!codeGenerators) return ''
        
        switch (codeLang) {
            case 'Popup Html':
                return codeGenerators.popupHtmlCustomization(chatflowid)
            case 'Popup React':
                return codeGenerators.popupReactCustomization(chatflowid)
            case 'Fullpage Html':
                return codeGenerators.fullpageHtmlCustomization(chatflowid)
            case 'Fullpage React':
                return codeGenerators.fullpageReactCustomization(chatflowid)
            default:
                return ''
        }
    }

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={value} onChange={handleChange} aria-label='tabs'>
                    {codes.map((code, index) => (
                        <Tab key={index} label={code} {...a11yProps(index)} />
                    ))}
                </Tabs>
            </Box>
            <Box sx={{ marginTop: '10px', display: 'flex', alignItems: 'center' }}>
                <Typography sx={{ fontSize: '0.875rem' }}>{t('chatflows.embedBot.customization')}</Typography>
                <CheckboxInput
                    label={''}
                    defaultValue={embedCheckboxVal}
                    onChange={onCheckBoxEmbedChanged}
                    style={{ paddingLeft: '10px' }}
                />
            </Box>
            {codes.map((code, index) => (
                <TabPanel key={index} value={value} index={index}>
                    <CopyBlock
                        text={!embedCheckboxVal ? getCode(code) : getCodeCustomization(code)}
                        language={'jsx'}
                        showLineNumbers={true}
                        wrapLines={true}
                        codeBlock
                        theme={atomOneDark}
                    />
                </TabPanel>
            ))}
        </Box>
    )
}

BaseBotEmbed.propTypes = {
    chatflowid: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    codeGenerators: PropTypes.shape({
        popupHtml: PropTypes.func.isRequired,
        popupReact: PropTypes.func.isRequired,
        fullpageHtml: PropTypes.func.isRequired,
        fullpageReact: PropTypes.func.isRequired,
        popupHtmlCustomization: PropTypes.func.isRequired,
        popupReactCustomization: PropTypes.func.isRequired,
        fullpageHtmlCustomization: PropTypes.func.isRequired,
        fullpageReactCustomization: PropTypes.func.isRequired
    }).isRequired,
    defaultThemeConfig: PropTypes.object
}

export default BaseBotEmbed
