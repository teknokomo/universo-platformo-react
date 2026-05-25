import { Outlet } from 'react-router-dom'

/**
 * Minimal layout without navigation or sidebar
 * Used for full-screen views like Canvas editor
 */
const MinimalLayout = () => (
    <>
        <Outlet />
    </>
)

export default MinimalLayout
