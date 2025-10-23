import { useReducer, ReactNode } from 'react'
import confirmReducer, { initialState } from '../store/reducers/confirmReducer'
import ConfirmContext from './ConfirmContext'

interface ConfirmContextProviderProps {
    children: ReactNode
}

export const ConfirmContextProvider = ({ children }: ConfirmContextProviderProps) => {
    const [state, dispatch] = useReducer(confirmReducer, initialState)

    return <ConfirmContext.Provider value={[state, dispatch]}>{children}</ConfirmContext.Provider>
}

export default ConfirmContextProvider
