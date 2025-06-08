import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import PropTypes from 'prop-types'
import { useTranslation, Trans } from 'react-i18next'
import { useSnackbar } from 'notistack'

import {
    Tabs,
    Tab,
    Dialog,
    DialogContent,
    DialogTitle,
    Box,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Stack,
    Card,
    Button
} from '@mui/material'
import { CopyBlock, atomOneDark } from 'react-code-blocks'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTheme } from '@mui/material/styles'
import { useAuth } from '@/hooks/useAuth'

// Project import
import { Dropdown } from '@/ui-component/dropdown/Dropdown'
import Configuration from './Configuration'
import ChatBotSettings from '@/views/publish/bots/ChatBotSettings'
import ARJSPublisher from '@apps/publish-frt/base/src/features/arjs/ARJSPublisher.jsx'
import ARJSExporter from '@apps/publish-frt/base/src/features/arjs/ARJSExporter.jsx'
import ShareChatbot from './ShareChatbot'
import EmbedChat from './EmbedChat'
import { Available } from '@/ui-component/rbac/available'

// Const
import { baseURL } from '@/store/constant'
import { SET_CHATFLOW } from '@/store/actions'

// Images
import pythonSVG from '@/assets/images/python.svg'
import javascriptSVG from '@/assets/images/javascript.svg'
import cURLSVG from '@/assets/images/cURL.svg'
import EmbedSVG from '@/assets/images/embed.svg'
import ShareChatbotSVG from '@/assets/images/sharing.png'
import settingsSVG from '@/assets/images/settings.svg'
import exportSVG from '@apps/publish-frt/base/src/assets/icons/export.svg'
import { IconBulb, IconBox, IconVariable, IconExclamationCircle, IconX } from '@tabler/icons-react'

// API
import apiKeyApi from '@/api/apikey'
import chatflowsApi from '@/api/chatflows'
import configApi from '@/api/config'
import variablesApi from '@/api/variables'

// Hooks
import useApi from '@/hooks/useApi'
import { CheckboxInput } from '@/ui-component/checkbox/Checkbox'
import { TableViewOnly } from '@/ui-component/table/Table'

// Helpers
import { unshiftFiles, getConfigExamplesForJS, getConfigExamplesForPython, getConfigExamplesForCurl } from '@/utils/genericHelper'

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

const APICodeDialog = ({ show, dialogProps, onCancel }) => {
    const portalElement = document.getElementById('portal')
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const theme = useTheme()
    const { unikId } = useParams()
    const chatflow = useSelector((state) => state.canvas.chatflow)
    const apiConfig = chatflow?.apiConfig ? JSON.parse(chatflow.apiConfig) : {}
    const overrideConfigStatus = apiConfig?.overrideConfig?.status !== undefined ? apiConfig.overrideConfig.status : false
    const { t } = useTranslation('chatflows')
    const { t: tPub } = useTranslation('publish')
    const { enqueueSnackbar, closeSnackbar } = useSnackbar()

    const [value, setValue] = useState(0)
    const [codes, setCodes] = useState([])
    const [keyOptions, setKeyOptions] = useState([])
    const [apiKeys, setAPIKeys] = useState([])
    const [chatflowApiKeyId, setChatflowApiKeyId] = useState('')
    const [selectedApiKey, setSelectedApiKey] = useState({})
    const [checkboxVal, setCheckbox] = useState(false)
    const [nodeConfig, setNodeConfig] = useState({})
    const [nodeConfigExpanded, setNodeConfigExpanded] = useState({})
    const [nodeOverrides, setNodeOverrides] = useState(apiConfig?.overrideConfig?.nodes ?? null)
    const [variableOverrides, setVariableOverrides] = useState(apiConfig?.overrideConfig?.variables ?? [])
    const [displayMode, setDisplayMode] = useState('chat')

    const [tabVisibility, setTabVisibility] = useState({
        chat: { embed: true, python: true, javascript: true, curl: true, export: false },
        arjs: { embed: false, python: false, javascript: false, curl: false, export: true },
        playcanvas: { embed: false, python: false, javascript: false, curl: false, export: true },
        babylonjs: { embed: false, python: false, javascript: false, curl: false, export: true },
        aframevr: { embed: false, python: false, javascript: false, curl: false, export: true },
        threejs: { embed: false, python: false, javascript: false, curl: false, export: true }
    })

    const getAllAPIKeysApi = useApi(apiKeyApi.getAllAPIKeys)
    const updateChatflowApi = useApi(chatflowsApi.updateChatflow)
    const getIsChatflowStreamingApi = useApi(chatflowsApi.getIsChatflowStreaming)
    const getConfigApi = useApi(configApi.getConfig)
    const getAllVariablesApi = useApi(variablesApi.getAllVariables)
    const isGlobal = useSelector((state) => state.auth.isGlobal)
    const { hasPermission } = useAuth()

    // Memoize keyOptions to prevent recreation on hover
    const keyOptions = useMemo(() => {
        if (!getAllAPIKeysApi.data) return []

        const options = [
            {
                label: 'No Authorization',
                name: ''
            }
        ]

        for (const key of getAllAPIKeysApi.data) {
            options.push({
                label: key.keyName,
                name: key.id
            })
        }

        if (isGlobal || hasPermission('apikeys:create')) {
            options.push({
                label: '- Add New Key -',
                name: 'addnewkey'
            })
        }

        return options
    }, [getAllAPIKeysApi.data, isGlobal, hasPermission])

    const onCheckBoxChanged = (newVal) => {
        setCheckbox(newVal)
        if (newVal) {
            getConfigApi.request(unikId, dialogProps.chatflowid)
            getAllVariablesApi.request(unikId)
        }
    }

    const onApiKeySelected = (keyValue) => {
        if (keyValue === 'addnewkey') {
            navigate('/apikey')
            return
        }
        setChatflowApiKeyId(keyValue)
        setSelectedApiKey(apiKeys.find((key) => key.id === keyValue))
        const updateBody = {
            apikeyid: keyValue
        }
        updateChatflowApi.request(unikId, dialogProps.chatflowid, updateBody)
    }

    const groupByNodeLabel = (nodes) => {
        const result = {}
        const newNodeOverrides = {}
        const seenNodes = new Set()

        nodes.forEach((item) => {
            const { node, nodeId, label, name, type } = item
            seenNodes.add(node)

            if (!result[node]) {
                result[node] = {
                    nodeIds: [],
                    params: []
                }
            }

            if (!newNodeOverrides[node]) {
                // If overrideConfigStatus is true, copy existing config for this node
                newNodeOverrides[node] = overrideConfigStatus ? [...(nodeOverrides[node] || [])] : []
            }

            if (!result[node].nodeIds.includes(nodeId)) result[node].nodeIds.push(nodeId)

            const param = { label, name, type }

            if (!result[node].params.some((existingParam) => JSON.stringify(existingParam) === JSON.stringify(param))) {
                result[node].params.push(param)
                const paramExists = newNodeOverrides[node].some(
                    (existingParam) => existingParam.label === label && existingParam.name === name && existingParam.type === type
                )
                if (!paramExists) {
                    newNodeOverrides[node].push({ ...param, enabled: false })
                }
            }
        })

        // Sort the nodeIds array
        for (const node in result) {
            result[node].nodeIds.sort()
        }
        setNodeConfig(result)

        if (!overrideConfigStatus) {
            setNodeOverrides(newNodeOverrides)
        } else {
            const updatedNodeOverrides = { ...nodeOverrides }

            Object.keys(updatedNodeOverrides).forEach((node) => {
                if (!seenNodes.has(node)) {
                    delete updatedNodeOverrides[node]
                }
            })

            seenNodes.forEach((node) => {
                if (!updatedNodeOverrides[node]) {
                    updatedNodeOverrides[node] = newNodeOverrides[node]
                }
            })

            setNodeOverrides(updatedNodeOverrides)
        }
    }

    const groupByVariableLabel = (variables) => {
        const newVariables = []
        const seenVariables = new Set()

        variables.forEach((item) => {
            const { id, name, type } = item
            seenVariables.add(id)

            const param = { id, name, type }

            // If overrideConfigStatus is true, look for existing variable config
            // Otherwise, create new default config
            if (overrideConfigStatus) {
                const existingVariable = variableOverrides?.find((existingParam) => existingParam.id === id)
                if (existingVariable) {
                    if (!newVariables.some((variable) => variable.id === id)) {
                        newVariables.push({ ...existingVariable })
                    }
                } else {
                    if (!newVariables.some((variable) => variable.id === id)) {
                        newVariables.push({ ...param, enabled: false })
                    }
                }
            } else {
                // When no override config exists, create default values
                if (!newVariables.some((variable) => variable.id === id)) {
                    newVariables.push({ ...param, enabled: false })
                }
            }
        })

        // If overrideConfigStatus is true, clean up any variables that no longer exist
        if (overrideConfigStatus && variableOverrides) {
            variableOverrides.forEach((existingVariable) => {
                if (!seenVariables.has(existingVariable.id)) {
                    const index = newVariables.findIndex((newVariable) => newVariable.id === existingVariable.id)
                    if (index !== -1) {
                        newVariables.splice(index, 1)
                    }
                }
            })
        }

        setVariableOverrides(newVariables)
    }

    const handleAccordionChange = (nodeLabel) => (event, isExpanded) => {
        const accordianNodes = { ...nodeConfigExpanded }
        accordianNodes[nodeLabel] = isExpanded
        setNodeConfigExpanded(accordianNodes)
    }

    useEffect(() => {
        if (updateChatflowApi.data) {
            dispatch({ type: SET_CHATFLOW, chatflow: updateChatflowApi.data })
        }
    }, [updateChatflowApi.data, dispatch])

    useEffect(() => {
        if (getConfigApi.data) {
            groupByNodeLabel(getConfigApi.data)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getConfigApi.data])

    useEffect(() => {
        if (getAllVariablesApi.data) {
            groupByVariableLabel(getAllVariablesApi.data)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getAllVariablesApi.data])

    useEffect(() => {
        // Universo Platformo | Set the tabs based on initial display mode
        if (show && !displayMode) {
            // Default to 'chat' if no display mode is set
            setDisplayMode('chat')
        }
    }, [show, displayMode, setDisplayMode])

    useEffect(() => {
        if (getAllAPIKeysApi.data) {
            const options = [
                {
                    label: t('chatflows.apiCodeDialog.noAuthorization'),
                    name: ''
                }
            ]
            for (const key of getAllAPIKeysApi.data) {
                options.push({
                    label: key.keyName,
                    name: key.id
                })
            }
            options.push({
                label: t('chatflows.apiCodeDialog.addNewKey'),
                name: 'addnewkey'
            })
            setKeyOptions(options)
            setAPIKeys(getAllAPIKeysApi.data)

            if (dialogProps.chatflowApiKeyId) {
                setChatflowApiKeyId(dialogProps.chatflowApiKeyId)
                setSelectedApiKey(getAllAPIKeysApi.data.find((key) => key.id === dialogProps.chatflowApiKeyId))
            }
        }
    }, [dialogProps, getAllAPIKeysApi.data, t])

    useEffect(() => {
        if (show) {
            getAllAPIKeysApi.request(unikId)
            getIsChatflowStreamingApi.request(unikId, dialogProps.chatflowid)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show])

    const handleChange = (event, newValue) => {
        setValue(newValue)
    }

    const getCode = (codeLang) => {
        if (codeLang === 'Python') {
            return `import requests

API_URL = "${baseURL}/api/v1/prediction/${dialogProps.chatflowid}"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()
    
output = query({
    "question": "Hey, how are you?",
})
`
        } else if (codeLang === 'JavaScript') {
            return `async function query(data) {
    const response = await fetch(
        "${baseURL}/api/v1/prediction/${dialogProps.chatflowid}",
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

query({"question": "Hey, how are you?"}).then((response) => {
    console.log(response);
});
`
        } else if (codeLang === 'cURL') {
            return `curl ${baseURL}/api/v1/prediction/${dialogProps.chatflowid} \\
     -X POST \\
     -d '{"question": "Hey, how are you?"}' \\
     -H "Content-Type: application/json"`
        }
        return ''
    }

    const getCodeWithAuthorization = (codeLang) => {
        if (codeLang === 'Python') {
            return `import requests

API_URL = "${baseURL}/api/v1/prediction/${dialogProps.chatflowid}"
headers = {"Authorization": "Bearer ${selectedApiKey?.apiKey}"}

def query(payload):
    response = requests.post(API_URL, headers=headers, json=payload)
    return response.json()
    
output = query({
    "question": "Hey, how are you?",
})
`
        } else if (codeLang === 'JavaScript') {
            return `async function query(data) {
    const response = await fetch(
        "${baseURL}/api/v1/prediction/${dialogProps.chatflowid}",
        {
            headers: {
                Authorization: "Bearer ${selectedApiKey?.apiKey}",
                "Content-Type": "application/json"
            },
            method: "POST",
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

query({"question": "Hey, how are you?"}).then((response) => {
    console.log(response);
});
`
        } else if (codeLang === 'cURL') {
            return `curl ${baseURL}/api/v1/prediction/${dialogProps.chatflowid} \\
     -X POST \\
     -d '{"question": "Hey, how are you?"}' \\
     -H "Content-Type: application/json" \\
     -H "Authorization: Bearer ${selectedApiKey?.apiKey}"`
        }
        return ''
    }

    const getLang = (codeLang) => {
        if (codeLang === 'Python') {
            return 'python'
        } else if (codeLang === 'JavaScript') {
            return 'javascript'
        } else if (codeLang === 'cURL') {
            return 'bash'
        }
        return 'python'
    }

    const getSVG = (codeLang) => {
        if (codeLang === 'Python') {
            return pythonSVG
        } else if (codeLang === 'JavaScript') {
            return javascriptSVG
        } else if (codeLang === 'Embed') {
            return EmbedSVG
        } else if (codeLang === 'cURL') {
            return cURLSVG
        } else if (codeLang === 'Configuration') {
            return settingsSVG
        } else if (codeLang === tPub('tabs.publish')) {
            return ShareChatbotSVG
        } else if (codeLang === tPub('tabs.export')) {
            return exportSVG
        }
        return pythonSVG
    }

    // ----------------------------CONFIG FORM DATA --------------------------//

    const getConfigCodeWithFormData = (codeLang, configData) => {
        if (codeLang === 'Python') {
            configData = unshiftFiles(configData)
            let fileType = configData[0].type
            if (fileType.includes(',')) fileType = fileType.split(',')[0]
            return `import requests

API_URL = "${baseURL}/api/v1/prediction/${dialogProps.chatflowid}"

# use form data to upload files
form_data = {
    "files": ${`('example${fileType}', open('example${fileType}', 'rb'))`}
}
body_data = {${getConfigExamplesForPython(configData, 'formData')}}

def query(form_data):
    response = requests.post(API_URL, files=form_data, data=body_data)
    return response.json()

output = query(form_data)
`
        } else if (codeLang === 'JavaScript') {
            return `// use FormData to upload files
let formData = new FormData();
${getConfigExamplesForJS(configData, 'formData')}
async function query(formData) {
    const response = await fetch(
        "${baseURL}/api/v1/prediction/${dialogProps.chatflowid}",
        {
            method: "POST",
            body: formData
        }
    );
    const result = await response.json();
    return result;
}

query(formData).then((response) => {
    console.log(response);
});
`
        } else if (codeLang === 'cURL') {
            return `curl ${baseURL}/api/v1/prediction/${dialogProps.chatflowid} \\
     -X POST \\${getConfigExamplesForCurl(configData, 'formData')} \\
     -H "Content-Type: multipart/form-data"`
        }
        return ''
    }

    // ----------------------------CONFIG FORM DATA with AUTH--------------------------//

    const getConfigCodeWithFormDataWithAuth = (codeLang, configData) => {
        if (codeLang === 'Python') {
            configData = unshiftFiles(configData)
            let fileType = configData[0].type
            if (fileType.includes(',')) fileType = fileType.split(',')[0]
            return `import requests

API_URL = "${baseURL}/api/v1/prediction/${dialogProps.chatflowid}"
headers = {"Authorization": "Bearer ${selectedApiKey?.apiKey}"}

# use form data to upload files
form_data = {
    "files": ${`('example${fileType}', open('example${fileType}', 'rb'))`}
}
body_data = {${getConfigExamplesForPython(configData, 'formData')}}

def query(form_data):
    response = requests.post(API_URL, headers=headers, files=form_data, data=body_data)
    return response.json()

output = query(form_data)
`
        } else if (codeLang === 'JavaScript') {
            return `// use FormData to upload files
let formData = new FormData();
${getConfigExamplesForJS(configData, 'formData')}
async function query(formData) {
    const response = await fetch(
        "${baseURL}/api/v1/prediction/${dialogProps.chatflowid}",
        {
            headers: { Authorization: "Bearer ${selectedApiKey?.apiKey}" },
            method: "POST",
            body: formData
        }
    );
    const result = await response.json();
    return result;
}

query(formData).then((response) => {
    console.log(response);
});
`
        } else if (codeLang === 'cURL') {
            return `curl ${baseURL}/api/v1/prediction/${dialogProps.chatflowid} \\
     -X POST \\${getConfigExamplesForCurl(configData, 'formData')} \\
     -H "Content-Type: multipart/form-data" \\
     -H "Authorization: Bearer ${selectedApiKey?.apiKey}"`
        }
        return ''
    }

    // ----------------------------CONFIG JSON--------------------------//

    const getConfigCode = (codeLang, configData) => {
        if (codeLang === 'Python') {
            return `import requests

API_URL = "${baseURL}/api/v1/prediction/${dialogProps.chatflowid}"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()

output = query({
    "question": "Hey, how are you?",
    "overrideConfig": {${getConfigExamplesForPython(configData, 'json')}
    }
})
`
        } else if (codeLang === 'JavaScript') {
            return `async function query(data) {
    const response = await fetch(
        "${baseURL}/api/v1/prediction/${dialogProps.chatflowid}",
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
  "question": "Hey, how are you?",
  "overrideConfig": {${getConfigExamplesForJS(configData, 'json')}
  }
}).then((response) => {
    console.log(response);
});
`
        } else if (codeLang === 'cURL') {
            return `curl ${baseURL}/api/v1/prediction/${dialogProps.chatflowid} \\
     -X POST \\
     -d '{"question": "Hey, how are you?", "overrideConfig": {${getConfigExamplesForCurl(configData, 'json')}}' \\
     -H "Content-Type: application/json"`
        }
        return ''
    }

    // ----------------------------CONFIG JSON with AUTH--------------------------//

    const getConfigCodeWithAuthorization = (codeLang, configData) => {
        if (codeLang === 'Python') {
            return `import requests

API_URL = "${baseURL}/api/v1/prediction/${dialogProps.chatflowid}"
headers = {"Authorization": "Bearer ${selectedApiKey?.apiKey}"}

def query(payload):
    response = requests.post(API_URL, headers=headers, json=payload)
    return response.json()

output = query({
    "question": "Hey, how are you?",
    "overrideConfig": {${getConfigExamplesForPython(configData, 'json')}
    }
})
`
        } else if (codeLang === 'JavaScript') {
            return `async function query(data) {
    const response = await fetch(
        "${baseURL}/api/v1/prediction/${dialogProps.chatflowid}",
        {
            headers: {
                Authorization: "Bearer ${selectedApiKey?.apiKey}",
                "Content-Type": "application/json"
            },
            method: "POST",
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

query({
  "question": "Hey, how are you?",
  "overrideConfig": {${getConfigExamplesForJS(configData, 'json')}
  }
}).then((response) => {
    console.log(response);
});
`
        } else if (codeLang === 'cURL') {
            return `curl ${baseURL}/api/v1/prediction/${dialogProps.chatflowid} \\
     -X POST \\
     -d '{"question": "Hey, how are you?", "overrideConfig": {${getConfigExamplesForCurl(configData, 'json')}}' \\
     -H "Content-Type: application/json" \\
     -H "Authorization: Bearer ${selectedApiKey?.apiKey}"`
        }
        return ''
    }

    const getMultiConfigCodeWithFormData = (codeLang) => {
        if (codeLang === 'Python') {
            return `# Specify multiple values for a config parameter by specifying the node id
body_data = {
    "openAIApiKey": {
        "chatOpenAI_0": "sk-my-openai-1st-key",
        "openAIEmbeddings_0": "sk-my-openai-2nd-key"
    }
}`
        } else if (codeLang === 'JavaScript') {
            return `// Specify multiple values for a config parameter by specifying the node id
formData.append("openAIApiKey[chatOpenAI_0]", "sk-my-openai-1st-key")
formData.append("openAIApiKey[openAIEmbeddings_0]", "sk-my-openai-2nd-key")`
        } else if (codeLang === 'cURL') {
            return `-F "openAIApiKey[chatOpenAI_0]=sk-my-openai-1st-key" \\
-F "openAIApiKey[openAIEmbeddings_0]=sk-my-openai-2nd-key" \\`
        }
    }

    const getMultiConfigCode = () => {
        return `{
    "overrideConfig": {
        "openAIApiKey": {
            "chatOpenAI_0": "sk-my-openai-1st-key",
            "openAIEmbeddings_0": "sk-my-openai-2nd-key"
        }
    }
}`
    }

    useEffect(() => {
        // Update visible tabs when display mode changes
        if (displayMode && show) {
            const newTabs = ['Configuration']

            // Add conditional tabs based on selected technology
            if (tabVisibility[displayMode]?.embed) newTabs.push('Embed')
            if (tabVisibility[displayMode]?.python) newTabs.push('Python')
            if (tabVisibility[displayMode]?.javascript) newTabs.push('JavaScript')
            if (tabVisibility[displayMode]?.curl) newTabs.push('cURL')

            // Always add publish tab
            newTabs.push(tPub('tabs.publish'))

            // Add Export tab at the end if enabled for this mode
            if (tabVisibility[displayMode]?.export) newTabs.push(tPub('tabs.export'))

            setCodes(newTabs)
            // Reset to first tab when changing technologies
            setValue(0)
        }
    }, [displayMode, show, t, tPub])

    // Determine which tabs should show code blocks and override checkbox
    const shouldShowCodeBlock = (tabIndex) => {
        // Don't show on Configuration and Publish tabs regardless of mode
        if (tabIndex === 0 || tabIndex === codes.length - 1) return false

        // Don't show on Embed tab (it has its own code block)
        if (codes[tabIndex] === 'Embed') return false

        // Don't show on Export tab regardless of mode
        if (codes[tabIndex] === tPub('tabs.export')) return false

        // In chat mode, show on all remaining tabs
        // In AR.js mode, don't show code blocks
        return displayMode === 'chat'
    }

    const component = show ? (
        <Dialog
            open={show}
            fullWidth
            maxWidth='md'
            onClose={onCancel}
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                {tPub('title')}
            </DialogTitle>
            <DialogContent>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <div style={{ flex: 80 }}>
                        <Tabs value={value} onChange={handleChange} aria-label='tabs'>
                            {codes.map((codeLang, index) => (
                                <Tab
                                    icon={
                                        <img style={{ objectFit: 'cover', height: 15, width: 'auto' }} src={getSVG(codeLang)} alt='code' />
                                    }
                                    iconPosition='start'
                                    key={index}
                                    label={codeLang}
                                    {...a11yProps(index)}
                                ></Tab>
                            ))}
                        </Tabs>
                    </div>
                    <div style={{ flex: 20 }}>
                        <Available permission={'chatflows:update,agentflows:update'}>
                            <Dropdown
                                name='SelectKey'
                                disableClearable={true}
                                options={keyOptions}
                                onSelect={(newValue) => onApiKeySelected(newValue)}
                                value={dialogProps.chatflowApiKeyId ?? chatflowApiKeyId ?? t('chatflows.apiCodeDialog.chooseApiKey')}
                            />
                        </Available>
                    </div>
                </div>
                <div style={{ marginTop: 10 }}></div>
                {codes.map((codeLang, index) => (
                    <TabPanel key={index} value={value} index={index}>
                        {(codeLang === 'Embed' || codeLang === 'Configuration' || codeLang === 'Share Bot') && chatflowApiKeyId && (
                            <>
                                <p>{t('chatflows.apiCodeDialog.cannotUseApiKey')}</p>
                                <p dangerouslySetInnerHTML={{ __html: t('chatflows.apiCodeDialog.selectNoAuthorization') }} />
                            </>
                        )}
                        {codeLang === 'Embed' && !chatflowApiKeyId && <EmbedChat chatflowid={dialogProps.chatflowid} />}
                        {codeLang === 'Configuration' && !chatflowApiKeyId && (
                            <>
                                <Configuration
                                    isSessionMemory={dialogProps.isSessionMemory}
                                    isAgentCanvas={dialogProps.isAgentCanvas}
                                    chatflowid={dialogProps.chatflowid}
                                    unikId={unikId}
                                    displayMode={displayMode}
                                    setDisplayMode={setDisplayMode}
                                />
                            </>
                        )}
                        {codeLang === tPub('tabs.export') && !chatflowApiKeyId && displayMode === 'arjs' && (
                            <ARJSExporter flow={chatflow} unikId={unikId} />
                        )}
                        {codeLang === tPub('tabs.publish') && !chatflowApiKeyId && displayMode === 'arjs' && (
                            <ARJSPublisher flow={chatflow} unikId={unikId} />
                        )}
                        {codeLang === tPub('tabs.publish') && !chatflowApiKeyId && displayMode === 'chat' && (
                            <ChatBotSettings
                                isSessionMemory={dialogProps.isSessionMemory}
                                isAgentCanvas={dialogProps.isAgentCanvas}
                                chatflowid={dialogProps.chatflowid}
                                unikId={unikId}
                                chatflow={chatflow}
                            />
                        )}
                        {shouldShowCodeBlock(index) && (
                            <>
                                <CopyBlock
                                    theme={atomOneDark}
                                    text={chatflowApiKeyId ? getCodeWithAuthorization(codeLang) : getCode(codeLang)}
                                    language={getLang(codeLang)}
                                    showLineNumbers={false}
                                    wrapLines
                                />
                                <CheckboxInput
                                    label={t('chatflows.apiCodeDialog.showOverrideConfig')}
                                    value={checkboxVal}
                                    onChange={onCheckBoxChanged}
                                />
                                {checkboxVal && getConfigApi.data && getConfigApi.data.length > 0 && (
                                    <>
                                        <Typography sx={{ mt: 2 }}>{t('chatflows.apiCodeDialog.overrideConfigDescription')}</Typography>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                borderRadius: 10,
                                                background: 'rgb(254,252,191)',
                                                padding: 10,
                                                marginTop: 10,
                                                marginBottom: 10
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'row',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <IconExclamationCircle size={30} color='rgb(116,66,16)' />
                                                <span style={{ color: 'rgb(116,66,16)', marginLeft: 10, fontWeight: 500 }}>
                                                    {t('chatflows.apiCodeDialog.securityNote')}
                                                    &nbsp;{t('chatflows.apiCodeDialog.refer')}{' '}
                                                    <a
                                                        rel='noreferrer'
                                                        target='_blank'
                                                        href='https://docs.flowiseai.com/using-flowise/api#override-config'
                                                    >
                                                        {t('chatflows.apiCodeDialog.here')}
                                                    </a>{' '}
                                                    {t('chatflows.apiCodeDialog.forMoreDetails')}
                                                </span>
                                            </div>
                                        </div>
                                        <Stack direction='column' spacing={2} sx={{ width: '100%', my: 2 }}>
                                            <Card sx={{ borderColor: theme.palette.primary[200] + 75, p: 2 }} variant='outlined'>
                                                <Stack sx={{ mt: 1, mb: 2, ml: 1, alignItems: 'center' }} direction='row' spacing={2}>
                                                    <IconBox />
                                                    <Typography variant='h4'>{t('chatflows.apiCodeDialog.nodes')}</Typography>
                                                </Stack>
                                                {Object.keys(nodeConfig)
                                                    .sort()
                                                    .map((nodeLabel) => (
                                                        <Accordion
                                                            expanded={nodeConfigExpanded[nodeLabel] || false}
                                                            onChange={handleAccordionChange(nodeLabel)}
                                                            key={nodeLabel}
                                                            disableGutters
                                                        >
                                                            <AccordionSummary
                                                                expandIcon={<ExpandMoreIcon />}
                                                                aria-controls={`nodes-accordian-${nodeLabel}`}
                                                                id={`nodes-accordian-header-${nodeLabel}`}
                                                            >
                                                                <Stack
                                                                    flexDirection='row'
                                                                    sx={{ gap: 2, alignItems: 'center', flexWrap: 'wrap' }}
                                                                >
                                                                    <Typography variant='h5'>{nodeLabel}</Typography>
                                                                    {nodeConfig[nodeLabel].nodeIds.length > 0 &&
                                                                        nodeConfig[nodeLabel].nodeIds.map((nodeId, index) => (
                                                                            <div
                                                                                key={index}
                                                                                style={{
                                                                                    display: 'flex',
                                                                                    flexDirection: 'row',
                                                                                    width: 'max-content',
                                                                                    borderRadius: 15,
                                                                                    background: 'rgb(254,252,191)',
                                                                                    padding: 5,
                                                                                    paddingLeft: 10,
                                                                                    paddingRight: 10
                                                                                }}
                                                                            >
                                                                                <span
                                                                                    style={{
                                                                                        color: 'rgb(116,66,16)',
                                                                                        fontSize: '0.825rem'
                                                                                    }}
                                                                                >
                                                                                    {nodeId}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                </Stack>
                                                            </AccordionSummary>
                                                            <AccordionDetails>
                                                                <TableViewOnly
                                                                    rows={nodeOverrides[nodeLabel]}
                                                                    columns={
                                                                        nodeOverrides[nodeLabel].length > 0
                                                                            ? Object.keys(nodeOverrides[nodeLabel][0])
                                                                            : []
                                                                    }
                                                                />
                                                            </AccordionDetails>
                                                        </Accordion>
                                                    ))}
                                            </Card>
                                            <Card sx={{ borderColor: theme.palette.primary[200] + 75, p: 2 }} variant='outlined'>
                                                <Stack sx={{ mt: 1, mb: 2, ml: 1, alignItems: 'center' }} direction='row' spacing={2}>
                                                    <IconVariable />
                                                    <Typography variant='h4'>{t('chatflows.apiCodeDialog.variables')}</Typography>
                                                </Stack>
                                                <TableViewOnly rows={variableOverrides} columns={['name', 'type', 'enabled']} />
                                            </Card>
                                        </Stack>
                                        <CopyBlock
                                            theme={atomOneDark}
                                            text={
                                                chatflowApiKeyId
                                                    ? dialogProps.isFormDataRequired
                                                        ? getConfigCodeWithFormDataWithAuth(codeLang, getConfigApi.data)
                                                        : getConfigCodeWithAuthorization(codeLang, getConfigApi.data)
                                                    : dialogProps.isFormDataRequired
                                                    ? getConfigCodeWithFormData(codeLang, getConfigApi.data)
                                                    : getConfigCode(codeLang, getConfigApi.data)
                                            }
                                            language={getLang(codeLang)}
                                            showLineNumbers={false}
                                            wrapLines
                                        />
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                borderRadius: 10,
                                                background: '#d8f3dc',
                                                padding: 10,
                                                marginTop: 10,
                                                marginBottom: 10
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'row',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <IconBulb size={30} color='#2d6a4f' />
                                                <span style={{ color: '#2d6a4f', marginLeft: 10, fontWeight: 500 }}>
                                                    {t('chatflows.apiCodeDialog.multipleValuesNote')}
                                                </span>
                                            </div>
                                            <div style={{ padding: 10 }}>
                                                <CopyBlock
                                                    theme={atomOneDark}
                                                    text={
                                                        dialogProps.isFormDataRequired
                                                            ? getMultiConfigCodeWithFormData(codeLang)
                                                            : getMultiConfigCode()
                                                    }
                                                    language={getLang(codeLang)}
                                                    showLineNumbers={false}
                                                    wrapLines
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                                {getIsChatflowStreamingApi.data?.isStreaming && (
                                    <p>
                                        {t('chatflows.apiCodeDialog.readHere')}&nbsp;
                                        <a rel='noreferrer' target='_blank' href='https://docs.flowiseai.com/using-flowise/streaming'>
                                            {t('chatflows.apiCodeDialog.here')}
                                        </a>
                                        &nbsp;{t('chatflows.apiCodeDialog.streamingNote')}
                                    </p>
                                )}
                            </>
                        )}
                        {codeLang === 'Share Chatbot' && !chatflowApiKeyId && (
                            <ShareChatbot isSessionMemory={dialogProps.isSessionMemory} isAgentCanvas={dialogProps.isAgentCanvas} />
                        )}
                    </TabPanel>
                ))}
            </DialogContent>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

APICodeDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func
}

export default APICodeDialog
