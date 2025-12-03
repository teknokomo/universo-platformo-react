import PropTypes from 'prop-types'
import { useContext, useMemo, useState } from 'react'
import { version as reactVersion } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from '@universo/i18n'

import { useTheme } from '@mui/material/styles'
import NodeCardWrapper from '@flowise/template-mui/ui-components/cards/NodeCardWrapper'
import NodeTooltip from '@flowise/template-mui/ui-components/tooltip/NodeTooltip'
import { IconButton, Box } from '@mui/material'
import { IconCopy, IconTrash } from '@tabler/icons-react'
import { Input } from '@flowise/template-mui/ui-components/input/Input'
import { flowContext } from '@flowise/store'

const StickyNote = ({ data }) => {
  useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[spaces-frontend][StickyNote] React version', reactVersion)
    }
  }, [])

  const theme = useTheme()
  const canvas = useSelector((state) => state.canvas)
  const { deleteNode, duplicateNode } = useContext(flowContext)
  const [inputParam] = data.inputParams
  const { t } = useTranslation('canvas')
  const [open, setOpen] = useState(false)

  const handleClose = () => setOpen(false)
  const handleOpen = () => setOpen(true)

  return (
    <>
      <NodeCardWrapper
        content={false}
        sx={{ padding: 0, borderColor: data.selected ? theme.palette.primary.main : theme.palette.text.secondary, backgroundColor: data.selected ? '#FFDC00' : '#FFE770' }}
        border={false}
      >
        <NodeTooltip
          open={!canvas.canvasDialogShow && open}
          onClose={handleClose}
          onOpen={handleOpen}
          disableFocusListener={true}
          title={
            <div style={{ background: 'transparent', display: 'flex', flexDirection: 'column' }}>
              <IconButton title={t('common:edit')} onClick={() => duplicateNode(data.id)} sx={{ height: '35px', width: '35px', '&:hover': { color: theme?.palette.primary.main } }} color={theme?.customization?.isDarkMode ? theme.colors?.paper : 'inherit'}>
                <IconCopy />
              </IconButton>
              <IconButton title={t('common:delete')} onClick={() => deleteNode(data.id)} sx={{ height: '35px', width: '35px', '&:hover': { color: 'red' } }} color={theme?.customization?.isDarkMode ? theme.colors?.paper : 'inherit'}>
                <IconTrash />
              </IconButton>
            </div>
          }
          placement='right-start'
        >
          <Box>
            <Input
              key={data.id}
              inputParam={inputParam}
              onChange={(newValue) => (data.inputs[inputParam.name] = newValue)}
              value={data.inputs[inputParam.name] ?? inputParam.default ?? ''}
              // reactFlowInstance is provided via Input props when acceptVariable is set
              nodes={[]}
              edges={[]}
              nodeId={data.id}
            />
          </Box>
        </NodeTooltip>
      </NodeCardWrapper>
    </>
  )
}

StickyNote.propTypes = { data: PropTypes.object }

export default StickyNote
