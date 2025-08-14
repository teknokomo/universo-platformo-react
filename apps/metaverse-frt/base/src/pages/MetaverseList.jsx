import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Skeleton } from '@mui/material'
import MainCard from '../../../../../packages/ui/src/ui-component/cards/MainCard'
import ItemCard from '../../../../../packages/ui/src/ui-component/cards/ItemCard'
import ViewHeader from '../../../../../packages/ui/src/layout/MainLayout/ViewHeader'
import { StyledButton } from '../../../../../packages/ui/src/ui-component/button/StyledButton'
import { IconPlus } from '@tabler/icons-react'
import api from '../../../../../packages/ui/src/api'
import useApi from '../../../../../packages/ui/src/hooks/useApi'
import { useAuthError } from '../../../../../packages/ui/src/hooks/useAuthError'

const metaverseApi = {
	list: () => api.get('/metaverses'),
	create: (payload) => api.post('/metaverses', payload)
}

export default function MetaverseList() {
	const { t } = useTranslation('metaverse')
	const [items, setItems] = useState([])
	const [isLoading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [q, setQ] = useState('')
	const { handleAuthError } = useAuthError()
	const listReq = useApi(metaverseApi.list)

	useEffect(() => {
		listReq.request()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		setLoading(listReq.loading)
	}, [listReq.loading])

	useEffect(() => {
		if (listReq.error && !handleAuthError(listReq.error)) setError(listReq.error)
	}, [listReq.error, handleAuthError])

	useEffect(() => {
		if (listReq.data) setItems(listReq.data)
	}, [listReq.data])

	const onCreate = async () => {
		const name = prompt(t('list.newName') || 'New metaverse name')
		if (!name) return
		try {
			const { data } = await metaverseApi.create({ name })
			setItems((prev) => [...prev, data])
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error('[MetaverseList] create failed', e)
		}
	}

	const filtered = items.filter((x) => (x?.name || '').toLowerCase().includes(q.toLowerCase()))

	return (
		<MainCard>
			<ViewHeader
				search
				onSearchChange={(e) => setQ(e.target.value)}
				searchPlaceholder={t('list.searchPlaceholder') || 'Search metaverses'}
				title={t('list.title') || 'Metaverses'}
			>
				<StyledButton variant='contained' startIcon={<IconPlus />} onClick={onCreate}>
					{t('list.create') || 'Create'}
				</StyledButton>
			</ViewHeader>
			{isLoading ? (
				<Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={16}>
					<Skeleton variant='rounded' height={160} />
					<Skeleton variant='rounded' height={160} />
					<Skeleton variant='rounded' height={160} />
				</Box>
			) : (
				<Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={16}>
					{filtered.map((mv) => (
						<ItemCard key={mv.id} data={mv} images={[]} />
					))}
				</Box>
			)}
		</MainCard>
	)
}
