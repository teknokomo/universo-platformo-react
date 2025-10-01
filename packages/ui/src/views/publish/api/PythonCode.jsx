// Universo Platformo | API Python Code component
import * as React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { Box, Typography } from '@mui/material'

// Const
import { baseURL } from '@/store/constant'

// Universo Platformo | Component to display Python code based on the mode
const PythonCode = ({ chatflowid, apiKey, mode = 'chat' }) => {
    const { t } = useTranslation('canvases')

    // Universo Platformo | Function to generate Python code for chat without authorization
    const getPythonChatCode = (chatflowid) => {
        return `import requests

API_URL = "${baseURL}/api/v1/prediction/${chatflowid}"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()

# Пример запроса
user_question = "Привет, как дела?"
payload = {
    "question": user_question
}

result = query(payload)
print(result)
`
    }

    // Universo Platformo | Function to generate Python code for AR without authorization
    const getPythonARCode = (chatflowid) => {
        return `import requests

API_URL = "${baseURL}/api/v1/ar/${chatflowid}"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()

# Пример запроса
marker_id = "marker_1"
payload = {
    "marker_id": marker_id
}

result = query(payload)
print(result)
`
    }

    // Universo Platformo | Function to generate Python code for chat with authorization
    const getPythonChatCodeWithAuth = (chatflowid, apiKey) => {
        return `import requests

API_URL = "${baseURL}/api/v1/prediction/${chatflowid}"
API_KEY = "${apiKey ? apiKey.apiKey : 'your-api-key-here'}"

def query(payload):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    response = requests.post(API_URL, json=payload, headers=headers)
    return response.json()

# Пример запроса
user_question = "Привет, как дела?"
payload = {
    "question": user_question
}

result = query(payload)
print(result)
`
    }

    // Universo Platformo | Function to generate Python code for AR with authorization
    const getPythonARCodeWithAuth = (chatflowid, apiKey) => {
        return `import requests

API_URL = "${baseURL}/api/v1/ar/${chatflowid}"
API_KEY = "${apiKey ? apiKey.apiKey : 'your-api-key-here'}"

def query(payload):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    response = requests.post(API_URL, json=payload, headers=headers)
    return response.json()

# Пример запроса
marker_id = "marker_1"
payload = {
    "marker_id": marker_id
}

result = query(payload)
print(result)
`
    }

    // Universo Platformo | Determine which code to show based on mode and apiKey presence
    const generateCode = () => {
        if (apiKey) {
            return mode === 'chat' ? getPythonChatCodeWithAuth(chatflowid, apiKey) : getPythonARCodeWithAuth(chatflowid, apiKey)
        } else {
            return mode === 'chat' ? getPythonChatCode(chatflowid) : getPythonARCode(chatflowid)
        }
    }

    return (
        <Box sx={{ mt: 2 }}>
            <Typography variant='h5' gutterBottom>
                {t('apiPython.title')}
            </Typography>
            <Typography variant='body2' sx={{ mb: 2 }}>
                {t('apiPython.description')}
            </Typography>
            <pre
                style={{
                    backgroundColor: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '4px',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word'
                }}
            >
                <code>{generateCode()}</code>
            </pre>
        </Box>
    )
}

PythonCode.propTypes = {
    chatflowid: PropTypes.string.isRequired,
    apiKey: PropTypes.object,
    mode: PropTypes.oneOf(['chat', 'ar'])
}

export default PythonCode
