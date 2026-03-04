import { combineReducers } from 'redux'

// reducer imports
import customizationReducer from './reducers/customizationReducer'
import notifierReducer from './reducers/notifierReducer'
import dialogReducer from './reducers/dialogReducer'

// ==============================|| COMBINE REDUCER ||============================== //

const reducer = combineReducers({
    customization: customizationReducer,
    notifier: notifierReducer,
    dialog: dialogReducer
})

export default reducer
