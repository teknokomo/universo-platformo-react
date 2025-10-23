import { createContext, Dispatch } from 'react'
import { ConfirmState, initialState } from '../store/reducers/confirmReducer'
import { ConfirmAction } from '../store/actions'

type ConfirmContextType = [ConfirmState, Dispatch<ConfirmAction>]

const ConfirmContext = createContext<ConfirmContextType>([
    initialState,
    () => {} // Default dispatch (will be overridden by Provider)
])

export default ConfirmContext
