// Chat components for Flowise
// Main exports for @flowise/chatmessage package

// i18n side-effect: register 'chatmessage' namespace
import './i18n'

// Main chat components
export { ChatMessage } from './components/ChatMessage'
export { ChatPopUp } from './components/ChatPopUp'
export { default as ChatExpandDialog } from './components/ChatExpandDialog'

// Utility components
export { ChatInputHistory } from './components/ChatInputHistory'

// Audio recording utilities (if needed externally)
export { startAudioRecording, stopAudioRecording, cancelAudioRecording } from './components/audio-recording'

// i18n exports for consumers
export { chatmessageNamespace, chatmessageResources, getChatmessageTranslations } from './i18n'

// CSS imports (users may need to import these)
import './components/ChatMessage.css'
import './components/audio-recording.css'

