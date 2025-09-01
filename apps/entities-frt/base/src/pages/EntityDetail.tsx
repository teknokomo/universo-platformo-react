import React, { useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import ResourceConfigTree from '@apps/resources-frt/base/src/components/ResourceConfigTree'

const EntityDetail: React.FC = () => {
  const [tab, setTab] = useState(0)

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label='Info' />
        <Tab label='Owners' />
        <Tab label='Resources' />
      </Tabs>
      {tab === 0 && <Typography variant='body1'>Entity information</Typography>}
      {tab === 1 && <Typography variant='body1'>Owner list</Typography>}
      {tab === 2 && <ResourceConfigTree />}
    </Box>
  )
}

export default EntityDetail
