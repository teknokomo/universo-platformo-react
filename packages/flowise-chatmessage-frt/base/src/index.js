// Chat components for Flowise
// Main exports for @flowise/chatmessage package

// Main chat components
export { ChatMessage } from './components/ChatMessage'
export { ChatPopUp } from './components/ChatPopUp'
export { default as ChatExpandDialog } from './components/ChatExpandDialog'

// Utility components
export { ChatInputHistory } from './components/ChatInputHistory'

// Audio recording utilities (if needed externally)
export { startAudioRecording, stopAudioRecording, cancelAudioRecording } from './components/audio-recording'

// CSS imports (users may need to import these)
import './components/ChatMessage.css'
import './components/audio-recording.css'
