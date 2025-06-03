// Universo Platformo | AR Embed implementation
import { baseURL } from '@/store/constant'

// Project import
import BaseBotEmbed from './BaseBotEmbed'

// ==============================|| AR Embed ||============================== //

export const defaultThemeConfig = {
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

const getFullPageThemeConfig = () => {
    return {
        ...defaultThemeConfig,
        button: undefined,
        tooltip: undefined
    }
}

// Universo Platformo | Embed code generators
const popupHtmlCode = (chatflowid) => {
    return `<script type="module">
    import ARbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/ar.js"
    ARbot.init({
        chatflowid: "${chatflowid}",
        apiHost: "${baseURL}",
    })
</script>`
}

const popupReactCode = (chatflowid) => {
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

const fullpageHtmlCode = (chatflowid) => {
    return `<flowise-ar-experience></flowise-ar-experience>
<script type="module">
    import ARbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/ar.js"
    ARbot.initFull({
        chatflowid: "${chatflowid}",
        apiHost: "${baseURL}",
    })
</script>`
}

const fullpageReactCode = (chatflowid) => {
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

// Universo Platformo | Function to format JSON object into a string for code insertion
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

// Universo Platformo | Embed code generators with customization
const popupHtmlCodeCustomization = (chatflowid) => {
    return `<script type="module">
    import ARbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/ar.js"
    ARbot.init({
        chatflowid: "${chatflowid}",
        apiHost: "${baseURL}",
        theme: ${customStringify(defaultThemeConfig)}
    })
</script>`
}

const popupReactCodeCustomization = (chatflowid) => {
    return `import { ARPortal } from 'flowise-embed-react'

const App = () => {
    return (
        <ARPortal
            chatflowid="${chatflowid}"
            apiHost="${baseURL}"
            theme={{
${customStringify(defaultThemeConfig)}
            }}
        />
    );
};`
}

const fullpageHtmlCodeCustomization = (chatflowid) => {
    return `<flowise-ar-experience></flowise-ar-experience>
<script type="module">
    import ARbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/ar.js"
    ARbot.initFull({
        chatflowid: "${chatflowid}",
        apiHost: "${baseURL}",
        theme: ${customStringify(getFullPageThemeConfig())}
    })
</script>`
}

const fullpageReactCodeCustomization = (chatflowid) => {
    return `import { FullPageAR } from "flowise-embed-react"

const App = () => {
    return (
        <FullPageAR
            chatflowid="${chatflowid}"
            apiHost="${baseURL}"
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

const ARBotEmbed = ({ chatflowid }) => {
    return (
        <BaseBotEmbed
            chatflowid={chatflowid}
            title='AR Embed'
            codeGenerators={codeGenerators}
            defaultThemeConfig={defaultThemeConfig}
        />
    )
}

export default ARBotEmbed
