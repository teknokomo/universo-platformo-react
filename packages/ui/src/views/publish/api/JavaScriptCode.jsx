// Universo Platformo | JavaScript API code component for AR and Chat
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { CopyBlock, atomOneDark } from 'react-code-blocks'

// Const
import { baseURL } from '@/store/constant'

// Universo Platformo | Plain JavaScript code for chat
const getJavaScriptChatCode = (chatflowid) => {
    return `async function query(data) {
    const response = await fetch(
        "${baseURL}/api/v1/prediction/${chatflowid}",
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

// Universo Platformo | Plain JavaScript code for AR
const getJavaScriptARCode = (chatflowid) => {
    return `async function query(data) {
    const response = await fetch(
        "${baseURL}/api/v1/ar/${chatflowid}",
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
    "mode": "ar",
    "modelConfig": {
        "modelURL": "https://example.com/your-3d-model.gltf",
        "scale": 1.0
    }
}).then((response) => {
    console.log(response);
});`
}

// Universo Platformo | JavaScript code with authorization for chat
const getJavaScriptChatCodeWithAuth = (chatflowid, apiKey) => {
    return `async function query(data) {
    const response = await fetch(
        "${baseURL}/api/v1/prediction/${chatflowid}",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer ${apiKey.apiKey}"
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

// Universo Platformo | JavaScript code with authorization for AR
const getJavaScriptARCodeWithAuth = (chatflowid, apiKey) => {
    return `async function query(data) {
    const response = await fetch(
        "${baseURL}/api/v1/ar/${chatflowid}",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer ${apiKey.apiKey}"
            },
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

query({
    "mode": "ar",
    "modelConfig": {
        "modelURL": "https://example.com/your-3d-model.gltf",
        "scale": 1.0
    }
}).then((response) => {
    console.log(response);
});`
}

// Universo Platformo | Component to display JavaScript code
const JavaScriptCode = ({ chatflowid, apiKey, mode = 'chat' }) => {
    const { t } = useTranslation()

    const getCode = () => {
        if (mode === 'chat') {
            return apiKey ? getJavaScriptChatCodeWithAuth(chatflowid, apiKey) : getJavaScriptChatCode(chatflowid)
        } else {
            return apiKey ? getJavaScriptARCodeWithAuth(chatflowid, apiKey) : getJavaScriptARCode(chatflowid)
        }
    }

    return <CopyBlock theme={atomOneDark} text={getCode()} language={'javascript'} showLineNumbers={false} wrapLines />
}

JavaScriptCode.propTypes = {
    chatflowid: PropTypes.string.isRequired,
    apiKey: PropTypes.object,
    mode: PropTypes.oneOf(['chat', 'ar'])
}

export default JavaScriptCode
