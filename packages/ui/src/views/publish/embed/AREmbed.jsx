// Universo Platformo | AR embedding component
import { useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import { Tabs, Tab, Box, Typography } from '@mui/material'
import { CopyBlock, atomOneDark } from 'react-code-blocks'

// Project import
import { CheckboxInput } from '@/ui-component/checkbox/Checkbox'

// Const
import { baseURL } from '@/store/constant'

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

const embedPopupHtmlCode = (chatflowid) => {
    return `<script type="module">
    import ARbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/ar.js"
    ARbot.init({
        chatflowid: "${chatflowid}",
        apiHost: "${baseURL}",
    })
</script>`
}

const embedPopupReactCode = (chatflowid) => {
    return `import { ARPortal } from 'flowise-embed-react'

const App = () => {
    return (
        <ARPortal
            chatflowid="${chatflowid}"
            apiHost="${baseURL}"
        />
    );
};`
}

const embedFullpageHtmlCode = (chatflowid) => {
    return `<flowise-ar-experience></flowise-ar-experience>
<script type="module">
    import ARbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/ar.js"
    ARbot.initFull({
        chatflowid: "${chatflowid}",
        apiHost: "${baseURL}",
    })
</script>`
}

const embedFullpageReactCode = (chatflowid) => {
    return `import { FullPageAR } from "flowise-embed-react"

const App = () => {
    return (
        <FullPageAR
            chatflowid="${chatflowid}"
            apiHost="${baseURL}"
        />
    );
};`
}

export const defaultARConfig = {
    button: {
        backgroundColor: '#3B81F6',
        right: 20,
        bottom: 20,
        size: 48,
        iconColor: 'white',
        customIconSrc: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/argocd.svg'
    },
    tooltip: {
        showTooltip: true,
        tooltipMessage: 'Try AR Experience 👀',
        tooltipBackgroundColor: 'black',
        tooltipTextColor: 'white'
    },
    ar: {
        title: 'AR Experience',
        markerPatternURL: '',
        modelURL: '',
        modelScale: 1.0,
        backgroundColor: '#ffffff',
        textColor: '#303235',
        debug: false
    }
}

const customStringify = (obj) => {
    let stringified = JSON.stringify(obj, null, 4)
        .replace(/"([^"]+)":/g, '$1:')
        .replace(/: "([^"]+)"/g, (match, value) => (value.includes('<') ? `: "${value}"` : `: '${value}'`))
        .replace(/: "(true|false|\d+)"/g, ': $1')
    return stringified
        .split('\n')
        .map((line, index) => {
            if (index === 0) return line
            return ' '.repeat(8) + line
        })
        .join('\n')
}

const embedPopupHtmlCodeCustomization = (chatflowid) => {
    return `<script type="module">
    import ARbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/ar.js"
    ARbot.init({
        chatflowid: "${chatflowid}",
        apiHost: "${baseURL}",
        theme: ${customStringify(defaultARConfig)}
    })
</script>`
}

const embedPopupReactCodeCustomization = (chatflowid) => {
    return `import { ARPortal } from 'flowise-embed-react'

const App = () => {
    return (
        <ARPortal
            chatflowid="${chatflowid}"
            apiHost="${baseURL}"
            theme={{
${customStringify(defaultARConfig)}
            }}
        />
    );
};`
}

const getFullPageARConfig = () => {
    return {
        ...defaultARConfig,
        button: undefined,
        tooltip: undefined
    }
}

const embedFullpageHtmlCodeCustomization = (chatflowid) => {
    return `<flowise-ar-experience></flowise-ar-experience>
<script type="module">
    import ARbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/ar.js"
    ARbot.initFull({
        chatflowid: "${chatflowid}",
        apiHost: "${baseURL}",
        theme: ${customStringify(getFullPageARConfig())}
    })
</script>`
}

const embedFullpageReactCodeCustomization = (chatflowid) => {
    return `import { FullPageAR } from "flowise-embed-react"

const App = () => {
    return (
        <FullPageAR
            chatflowid="${chatflowid}"
            apiHost="${baseURL}"
            theme={{
${customStringify(getFullPageARConfig())}
            }}
        />
    );
};`
}

const AREmbed = ({ chatflowid }) => {
    const codes = ['Popup Html', 'Fullpage Html', 'Popup React', 'Fullpage React']
    const [value, setValue] = useState(0)
    const [embedARCheckboxVal, setEmbedARCheckbox] = useState(false)
    const { t } = useTranslation('chatflows')

    const onCheckBoxEmbedARChanged = (newVal) => {
        setEmbedARCheckbox(newVal)
    }

    const handleChange = (event, newValue) => {
        setValue(newValue)
    }

    const getCode = (codeLang) => {
        switch (codeLang) {
            case 'Popup Html':
                return embedPopupHtmlCode(chatflowid)
            case 'Fullpage Html':
                return embedFullpageHtmlCode(chatflowid)
            case 'Popup React':
                return embedPopupReactCode(chatflowid)
            case 'Fullpage React':
                return embedFullpageReactCode(chatflowid)
            default:
                return ''
        }
    }

    const getCodeCustomization = (codeLang) => {
        switch (codeLang) {
            case 'Popup Html':
                return embedPopupHtmlCodeCustomization(chatflowid)
            case 'Fullpage Html':
                return embedFullpageHtmlCodeCustomization(chatflowid)
            case 'Popup React':
                return embedPopupReactCodeCustomization(chatflowid)
            case 'Fullpage React':
                return embedFullpageReactCodeCustomization(chatflowid)
            default:
                return embedPopupHtmlCodeCustomization(chatflowid)
        }
    }

    return (
        <>
            <Typography variant="h5" gutterBottom>
                {t('chatflows.embeddingChatbot')}
            </Typography>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <div style={{ flex: 80 }}>
                    <Tabs value={value} onChange={handleChange} aria-label='tabs'>
                        {codes.map((codeLang, index) => (
                            <Tab key={index} label={codeLang} {...a11yProps(index)}></Tab>
                        ))}
                    </Tabs>
                </div>
            </div>
            <div style={{ marginTop: 10 }}></div>
            {codes.map((codeLang, index) => (
                <TabPanel key={index} value={value} index={index}>
                    {(value === 0 || value === 1) && (
                        <>
                            <span>
                                {t('chatflows.embedChat.pasteHtmlBody')}
                                <p>
                                    {t('chatflows.embedChat.specifyVersion')}&nbsp;
                                    <a
                                        rel='noreferrer'
                                        target='_blank'
                                        href='https://www.npmjs.com/package/flowise-embed?activeTab=versions'
                                    >
                                        {t('chatflows.common.version')}
                                    </a>
                                    :&nbsp;<code>{`https://cdn.jsdelivr.net/npm/flowise-embed@<version>/dist/ar.js`}</code>
                                </p>
                            </span>
                            <div style={{ height: 10 }}></div>
                        </>
                    )}
                    <CopyBlock theme={atomOneDark} text={getCode(codeLang)} language='javascript' showLineNumbers={false} wrapLines />

                    <CheckboxInput label={t('chatflows.embedChat.showConfig')} value={embedARCheckboxVal} onChange={onCheckBoxEmbedARChanged} />

                    {embedARCheckboxVal && (
                        <CopyBlock
                            theme={atomOneDark}
                            text={getCodeCustomization(codeLang)}
                            language='javascript'
                            showLineNumbers={false}
                            wrapLines
                        />
                    )}
                </TabPanel>
            ))}
        </>
    )
}

AREmbed.propTypes = {
    chatflowid: PropTypes.string
}

export default AREmbed
