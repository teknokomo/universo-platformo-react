import PropTypes from 'prop-types'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// ==============================|| NAVIGATION SCROLL TO TOP ||============================== //

const NavigationScroll = ({ children }) => {
    // Track component lifecycle
    useEffect(() => {
        const timestamp = Date.now()
        // eslint-disable-next-line no-console
        console.info('[NavigationScroll] Component MOUNTED', { timestamp })
        return () => {
            // eslint-disable-next-line no-console
            console.warn('[NavigationScroll] Component UNMOUNTED', { timestamp, duration: Date.now() - timestamp })
        }
    }, [])
    
    // eslint-disable-next-line no-console
    console.info('[NavigationScroll] Component rendering', { hasChildren: !!children })
    
    let location, pathname
    try {
        location = useLocation()
        // eslint-disable-next-line no-console
        console.info('[NavigationScroll] useLocation() success', { location })
        pathname = location.pathname
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[NavigationScroll] useLocation() error:', error)
        throw error
    }

    useEffect(() => {
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: 'smooth'
        })
    }, [pathname])

    return children || null
}

NavigationScroll.propTypes = {
    children: PropTypes.node
}

export default NavigationScroll
