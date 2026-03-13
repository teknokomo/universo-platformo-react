// UI layout constants
export const gridSpacing = 3
export const drawerWidth = 260
export const appDrawerWidth = 320
export const headerHeight = 80
export const maxScroll = 100000

const getRuntimeEnvValue = (key) => {
	if (typeof globalThis !== 'undefined') {
		const publicEnvValue = globalThis.__UNIVERSO_PUBLIC_ENV__?.[key]
		if (typeof publicEnvValue === 'string' && publicEnvValue.length > 0) {
			return publicEnvValue
		}
	}

	const viteEnvValue = import.meta.env?.[key]
	if (typeof viteEnvValue === 'string' && viteEnvValue.length > 0) {
		return viteEnvValue
	}

	if (typeof process !== 'undefined' && typeof process.env?.[key] === 'string' && process.env[key].length > 0) {
		return process.env[key]
	}

	return undefined
}

const getBrowserOrigin = () => {
	if (typeof window === 'undefined') {
		return 'http://localhost:3000'
	}

	return window.location.origin || 'http://localhost:3000'
}

export const baseURL = getRuntimeEnvValue('VITE_API_BASE_URL') || getBrowserOrigin()
export const uiBaseURL = getRuntimeEnvValue('VITE_UI_BASE_URL') || getBrowserOrigin()
