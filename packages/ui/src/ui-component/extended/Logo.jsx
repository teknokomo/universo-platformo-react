import logo from '@/assets/images/flowise_logo.png'
import logoDark from '@/assets/images/flowise_logo_dark.png'

import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

// ==============================|| LOGO ||============================== //

const Logo = () => {
    const customization = useSelector((state) => state.customization)
    const { t } = useTranslation()

    return (
        <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'row', marginLeft: '10px' }}>
            <img
                style={{ objectFit: 'contain', height: 'auto', width: 150 }}
                src={customization.isDarkMode ? logoDark : logo}
                alt={t('common.flowise')}
            />
        </div>
    )
}

export default Logo
