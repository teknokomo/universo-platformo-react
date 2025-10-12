// Universo Platformo | GameModeSelector TypeScript Declarations
// Type declarations for JSX component

import React from 'react'

export type GameMode = 'singleplayer' | 'multiplayer'

export interface GameModeSelectorProps {
    value?: GameMode
    onChange: (mode: GameMode) => void
    disabled?: boolean
}

declare const GameModeSelector: React.FC<GameModeSelectorProps>

export default GameModeSelector
