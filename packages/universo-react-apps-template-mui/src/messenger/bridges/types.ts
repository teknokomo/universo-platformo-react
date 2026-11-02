export interface MessengerBackButtonBridge {
    show: () => void
    hide: () => void
    onClick: (handler: () => void) => void
    offClick: (handler: () => void) => void
}

export interface MessengerViewportSize {
    width: string
    height: string
}
