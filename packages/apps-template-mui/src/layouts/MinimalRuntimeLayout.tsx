import type { ReactNode } from 'react'
import Box from '@mui/material/Box'

export interface MinimalRuntimeLayoutProps {
  children: ReactNode
}

const MinimalRuntimeLayout = ({ children }: MinimalRuntimeLayoutProps) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        p: { xs: 1, md: 2 },
      }}
    >
      {children}
    </Box>
  )
}

export default MinimalRuntimeLayout
