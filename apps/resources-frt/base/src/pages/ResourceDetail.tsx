import React, { useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import ResourceConfigTree from '../components/ResourceConfigTree'

const ResourceDetail: React.FC = () => {
    const [tab, setTab] = useState(0)

    return (
        <Box>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab label='Info' />
                <Tab label='Revisions' />
                <Tab label='Children' />
            </Tabs>
            {tab === 0 && <Typography variant='body1'>Resource information</Typography>}
            {tab === 1 && <Typography variant='body1'>Revision list</Typography>}
            {tab === 2 && <ResourceConfigTree />}
        </Box>
    )
}

export default ResourceDetail
