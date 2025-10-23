// Universo Platformo | Component for API integration options
import { useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from '@universo/i18n/hooks'

import { Box, Tabs, Tab } from '@mui/material'
import { CopyBlock, atomOneDark } from 'react-code-blocks'

// Const
import { baseURL } from '@flowise/template-mui'

// Project import
import { CheckboxInput } from '@flowise/template-mui'

function TabPanel(props) {
    const { children, value, index, ...other } = props
    return (
        <div
            role='tabpanel'
            hidden={value !== index}
            id={`api-tabpanel-${index}`}
            aria-labelledby={`api-tab-${index}`}
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
        id: `api-tab-${index}`,
        'aria-controls': `api-tabpanel-${index}`
    }
}

const pythonCode = (canvasId) => {
    return `import requests

API_URL = "${baseURL}/api/v1/prediction/${canvasId}"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()
    
output = query({
    "question": "Hey, how are you?",
})
print(output)`
}

const javascriptCode = (canvasId) => {
    return `async function query(data) {
    const response = await fetch(
        "${baseURL}/api/v1/prediction/${canvasId}",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

query({
    "question": "Hey, how are you?"
}).then((response) => {
    console.log(response);
});`
}

const curlCode = (canvasId) => {
    return `curl ${baseURL}/api/v1/prediction/${canvasId} \\
     -X POST \\
     -H "Content-Type: application/json" \\
     -d '{"question":"Hey, how are you?"}'`
}

const APIShare = ({ canvasId, unikId }) => {
    const [value, setValue] = useState(0)
    const { t } = useTranslation('canvases')

    const handleChange = (event, newValue) => {
        setValue(newValue)
    }

    const getCode = (codeLang) => {
        switch (codeLang) {
            case 'Python':
                return pythonCode(canvasId)
            case 'JavaScript':
                return javascriptCode(canvasId)
            case 'cURL':
                return curlCode(canvasId)
            default:
                return pythonCode(canvasId)
        }
    }

    const getLang = (codeLang) => {
        switch (codeLang) {
            case 'Python':
                return 'python'
            case 'JavaScript':
                return 'javascript'
            case 'cURL':
                return 'bash'
            default:
                return 'python'
        }
    }

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={value} onChange={handleChange} aria-label="API code tabs">
                    <Tab label="Python" {...a11yProps(0)} />
                    <Tab label="JavaScript" {...a11yProps(1)} />
                    <Tab label="cURL" {...a11yProps(2)} />
                </Tabs>
            </Box>
            {['Python', 'JavaScript', 'cURL'].map((codeLang, index) => (
                <TabPanel key={index} value={value} index={index}>
                    <CopyBlock
                        theme={atomOneDark}
                        text={getCode(codeLang)}
                        language={getLang(codeLang)}
                        showLineNumbers={false}
                        wrapLines
                    />
                </TabPanel>
            ))}
        </Box>
    )
}

APIShare.propTypes = {
    canvasId: PropTypes.string,
    unikId: PropTypes.string
}

export default APIShare 
