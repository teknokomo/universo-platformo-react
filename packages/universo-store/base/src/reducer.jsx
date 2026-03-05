import { combineReducers } from 'redux'

// reducer imports
import customizationReducer from './reducers/customizationReducer'
import notifierReducer from './reducers/notifierReducer'

// ==============================|| COMBINE REDUCER ||============================== //

const reducer = combineReducers({
    customization: customizationReducer,
    notifier: notifierReducer
})

export default reducer
