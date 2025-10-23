// Universo Platformo | Chat Bot Embed implementation
import { baseURL } from '@flowise/store'

// Project import
import BaseBotEmbed from './BaseBotEmbed'

// ==============================|| Chat Bot Embed ||============================== //

export const defaultThemeConfig = {
    button: {
        backgroundColor: '#3B81F6',
        right: 20,
        bottom: 20,
        size: 48,
        dragAndDrop: true,
        iconColor: 'white',
        customIconSrc: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/google-messages.svg',
        autoWindowOpen: {
            autoOpen: true,
            openDelay: 2,
            autoOpenOnMobile: false
        }
    },
    tooltip: {
        showTooltip: true,
        tooltipMessage: 'Hi There 👋!',
        tooltipBackgroundColor: 'black',
        tooltipTextColor: 'white',
        tooltipFontSize: 16
    },
    disclaimer: {
        title: 'Disclaimer',
        message: 'By using this chatbot, you agree to the <a target="_blank" href="https://flowiseai.com/terms">Terms & Condition</a>',
        textColor: 'black',
        buttonColor: '#3b82f6',
        buttonText: 'Start Chatting',
        buttonTextColor: 'white',
        blurredBackgroundColor: 'rgba(0, 0, 0, 0.4)',
        backgroundColor: 'white'
    },
    customCSS: ``,
    chatWindow: {
        showTitle: true,
        showAgentMessages: true,
        title: 'Flowise Bot',
        titleAvatarSrc: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/google-messages.svg',
        welcomeMessage: 'Hello! This is custom welcome message',
        errorMessage: 'This is a custom error message',
        backgroundColor: '#ffffff',
        backgroundImage: 'enter image path or link',
        height: 700,
        width: 400,
        fontSize: 16,
        starterPrompts: ['What is a bot?', 'Who are you?'],
        starterPromptFontSize: 15,
        clearChatOnReload: false,
        sourceDocsTitle: 'Sources:',
        renderHTML: true,
        botMessage: {
            backgroundColor: '#f7f8ff',
            textColor: '#303235',
            showAvatar: true,
            avatarSrc: 'https://raw.githubusercontent.com/zahidkhawaja/langchain-chat-nextjs/main/public/parroticon.png'
        },
        userMessage: {
            backgroundColor: '#3B81F6',
            textColor: '#ffffff',
            showAvatar: true,
            avatarSrc: 'https://raw.githubusercontent.com/zahidkhawaja/langchain-chat-nextjs/main/public/usericon.png'
        },
        textInput: {
            placeholder: 'Type your question',
            backgroundColor: '#ffffff',
            textColor: '#303235',
            sendButtonColor: '#3B81F6',
            maxChars: 50,
            maxCharsWarningMessage: 'You exceeded the characters limit. Please input less than 50 characters.',
            autoFocus: true,
            sendMessageSound: true,
            sendSoundLocation: 'send_message.mp3',
            receiveMessageSound: true,
            receiveSoundLocation: 'receive_message.mp3'
        },
        feedback: {
            color: '#303235'
        },
        dateTimeToggle: {
            date: true,
            time: true
        },
        footer: {
            textColor: '#303235',
            text: 'Powered by',
            company: 'Flowise',
            companyLink: 'https://flowiseai.com'
        }
    }
}

const getFullPageThemeConfig = () => {
    return {
        ...defaultThemeConfig,
        button: undefined,
        tooltip: undefined,
        disclaimer: undefined
    }
}

// Universo Platformo | Embed code generators
const popupHtmlCode = (canvasId) => {
    return `<script type="module">
    import Chatbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js"
    Chatbot.init({
        canvasId: "${canvasId}",
        apiHost: "${baseURL}",
        mode: "chat"
    })
</script>`
}

const popupReactCode = (canvasId) => {
    return `import { BubbleChat } from 'flowise-embed-react'

const App = () => {
    return (
        <BubbleChat
            canvasId="${canvasId}"
            apiHost="${baseURL}"
            mode="chat"
        />
    );
};`
}

const fullpageHtmlCode = (canvasId) => {
    return `<flowise-fullchatbot></flowise-fullchatbot>
<script type="module">
    import Chatbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js"
    Chatbot.initFull({
        canvasId: "${canvasId}",
        apiHost: "${baseURL}",
        mode: "chat"
    })
</script>`
}

const fullpageReactCode = (canvasId) => {
    return `import { FullPageChat } from "flowise-embed-react"

const App = () => {
    return (
        <FullPageChat
            canvasId="${canvasId}"
            apiHost="${baseURL}"
            mode="chat"
        />
    );
};`
}

// Universo Platformo | Function to format JSON object into a string for code insertion
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

// Universo Platformo | Embed code generators with customization
const popupHtmlCodeCustomization = (canvasId) => {
    return `<script type="module">
    import Chatbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js"
    Chatbot.init({
        canvasId: "${canvasId}",
        apiHost: "${baseURL}",
        mode: "chat",
        theme: ${customStringify(defaultThemeConfig)}
    })
</script>`
}

const popupReactCodeCustomization = (canvasId) => {
    return `import { BubbleChat } from 'flowise-embed-react'

const App = () => {
    return (
        <BubbleChat
            canvasId="${canvasId}"
            apiHost="${baseURL}"
            mode="chat"
            theme={{
${customStringify(defaultThemeConfig)}
            }}
        />
    );
};`
}

const fullpageHtmlCodeCustomization = (canvasId) => {
    return `<flowise-fullchatbot></flowise-fullchatbot>
<script type="module">
    import Chatbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js"
    Chatbot.initFull({
        canvasId: "${canvasId}",
        apiHost: "${baseURL}",
        mode: "chat",
        theme: ${customStringify(getFullPageThemeConfig())}
    })
</script>`
}

const fullpageReactCodeCustomization = (canvasId) => {
    return `import { FullPageChat } from "flowise-embed-react"

const App = () => {
    return (
        <FullPageChat
            canvasId="${canvasId}"
            apiHost="${baseURL}"
            mode="chat"
            theme={{
${customStringify(getFullPageThemeConfig())}
            }}
        />
    );
};`
}

const codeGenerators = {
    popupHtml: popupHtmlCode,
    popupReact: popupReactCode,
    fullpageHtml: fullpageHtmlCode,
    fullpageReact: fullpageReactCode,
    popupHtmlCustomization: popupHtmlCodeCustomization,
    popupReactCustomization: popupReactCodeCustomization,
    fullpageHtmlCustomization: fullpageHtmlCodeCustomization,
    fullpageReactCustomization: fullpageReactCodeCustomization
}

const ChatBotEmbed = ({ canvasId }) => {
    return (
        <BaseBotEmbed
            canvasId={canvasId}
            title='Chat Bot Embed'
            codeGenerators={codeGenerators}
            defaultThemeConfig={defaultThemeConfig}
        />
    )
}

export default ChatBotEmbed
