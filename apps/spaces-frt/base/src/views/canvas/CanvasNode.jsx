import PropTypes from 'prop-types'
import { useContext, useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@mui/material/styles'
import { IconButton, Box, Typography, Divider, Button } from '@mui/material'
import Tooltip from '@mui/material/Tooltip'

import NodeCardWrapper from '@/ui-component/cards/NodeCardWrapper'
import NodeTooltip from '@/ui-component/tooltip/NodeTooltip'
import NodeInputHandler from './NodeInputHandler'
import NodeOutputHandler from './NodeOutputHandler'
import AdditionalParamsDialog from '@/ui-component/dialog/AdditionalParamsDialog'
import NodeInfoDialog from '@/ui-component/dialog/NodeInfoDialog'
import { shouldShowInputParam } from '@/utils/genericHelper'

import { baseURL } from '@/store/constant'
import { IconTrash, IconCopy, IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react'
import { flowContext } from '@/store/context/ReactFlowContext'
import LlamaindexPNG from '@/assets/images/llamaindex.png'

const CanvasNode = ({ data }) => {
  const theme = useTheme()
  const canvas = useSelector((state) => state.canvas)
  const { deleteNode, duplicateNode } = useContext(flowContext)
  const { t } = useTranslation('canvas')

  const [showDialog, setShowDialog] = useState(false)
  const [dialogProps, setDialogProps] = useState({})
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const [infoDialogProps, setInfoDialogProps] = useState({})
  const [warningMessage, setWarningMessage] = useState('')
  const [open, setOpen] = useState(false)
  const [isForceCloseNodeInfo, setIsForceCloseNodeInfo] = useState(null)

  const handleClose = () => setOpen(false)
  const handleOpen = () => setOpen(true)
  const getNodeInfoOpenStatus = () => (isForceCloseNodeInfo ? false : !canvas.canvasDialogShow && open)

  const nodeOutdatedMessage = (oldVersion, newVersion) => `Node version ${oldVersion} outdated\nUpdate to latest version ${newVersion}`
  const nodeVersionEmptyMessage = (newVersion) => `Node outdated\nUpdate to latest version ${newVersion}`

  const onDialogClicked = () => {
    const p = {
      data,
      inputParams: data.inputParams.filter((inputParam) => !inputParam.hidden).filter((param) => param.additionalParams),
      confirmButtonName: t('canvas.common.save'),
      cancelButtonName: t('canvas.common.cancel')
    }
    setDialogProps(p)
    setShowDialog(true)
  }

  useEffect(() => {
    const componentNode = canvas.componentNodes.find((nd) => nd.name === data.name)
    if (componentNode) {
      if (!data.version) setWarningMessage(nodeVersionEmptyMessage(componentNode.version))
      else if (componentNode.version > data.version) setWarningMessage(nodeOutdatedMessage(data.version, componentNode.version))
      else if (componentNode.badge === 'DEPRECATING')
        setWarningMessage(componentNode?.deprecateMessage ?? 'This node will be deprecated in the next release. Change to a new node tagged with NEW')
      else setWarningMessage('')
    }
  }, [canvas.componentNodes, data.name, data.version])

  return (
    <>
      <NodeCardWrapper
        content={false}
        sx={{ padding: 0, borderColor: data.selected ? theme.palette.primary.main : theme.palette.text.secondary }}
        border={false}
      >
        <NodeTooltip
          open={getNodeInfoOpenStatus()}
          onClose={handleClose}
          onOpen={handleOpen}
          disableFocusListener={true}
          title={
            <div style={{ background: 'transparent', display: 'flex', flexDirection: 'column' }}>
              <IconButton
                title={t('common.edit')}
                onClick={() => {
                  duplicateNode(data.id)
                }}
                sx={{ height: '35px', width: '35px', '&:hover': { color: theme?.palette.primary.main } }}
                color={theme?.customization?.isDarkMode ? theme.colors?.paper : 'inherit'}
              >
                <IconCopy />
              </IconButton>
              <IconButton
                title={t('common.delete')}
                onClick={() => {
                  deleteNode(data.id)
                }}
                sx={{ height: '35px', width: '35px', '&:hover': { color: 'red' } }}
                color={theme?.customization?.isDarkMode ? theme.colors?.paper : 'inherit'}
              >
                <IconTrash />
              </IconButton>
              <IconButton
                title={t('common.info')}
                onClick={() => {
                  setInfoDialogProps({ data })
                  setShowInfoDialog(true)
                }}
                sx={{ height: '35px', width: '35px', '&:hover': { color: theme?.palette.secondary.main } }}
                color={theme?.customization?.isDarkMode ? theme.colors?.paper : 'inherit'}
              >
                <IconInfoCircle />
              </IconButton>
            </div>
          }
          placement='right-start'
        >
          <Box>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Box style={{ width: 50, marginRight: 10, padding: 5 }}>
                <div
                  style={{
                    ...theme.typography.commonAvatar,
                    ...theme.typography.largeAvatar,
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    cursor: 'grab'
                  }}
                >
                  <img style={{ width: '100%', height: '100%', padding: 5, objectFit: 'contain' }} src={`${baseURL}/api/v1/node-icon/${data.name}`} alt='Notification' />
                </div>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 500, mr: 2 }}>{data.label}</Typography>
              </Box>
              <div style={{ flexGrow: 1 }}></div>
              {data.tags && data.tags.includes('LlamaIndex') && (
                <div style={{ borderRadius: '50%', padding: 15 }}>
                  <img style={{ width: '25px', height: '25px', borderRadius: '50%', objectFit: 'contain' }} src={LlamaindexPNG} alt='LlamaIndex' />
                </div>
              )}
              {warningMessage && (
                <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{warningMessage}</span>} placement='top'>
                  <IconButton sx={{ height: 35, width: 35 }}>
                    <IconAlertTriangle size={35} color='orange' />
                  </IconButton>
                </Tooltip>
              )}
            </div>
            {(data.inputAnchors.length > 0 || data.inputParams.length > 0) && (
              <>
                <Divider />
                <Box sx={{ background: theme.palette.asyncSelect.main, p: 1 }}>
                  <Typography sx={{ fontWeight: 500, textAlign: 'center' }}>{t('canvas.nodeConfig.inputs')}</Typography>
                </Box>
                <Divider />
              </>
            )}
            {data.inputAnchors.map((inputAnchor, index) => (
              <NodeInputHandler key={index} inputAnchor={inputAnchor} data={data} />
            ))}
            {data.inputParams
              .filter((inputParam) => !inputParam.hidden)
              .map((inputParam, index) => (
                <NodeInputHandler
                  key={index}
                  inputParam={inputParam}
                  data={data}
                  onHideNodeInfoDialog={(status) => {
                    if (status) setIsForceCloseNodeInfo(true)
                    else setIsForceCloseNodeInfo(null)
                  }}
                />
              ))}
            {data.inputParams.filter((param) => param.additionalParams).filter((param) => shouldShowInputParam(param, data)).length > 0 && (
              <div style={{ textAlign: 'center', marginTop: data.inputParams.filter((param) => param.additionalParams).filter((param) => shouldShowInputParam(param, data)).length === data.inputParams.length + data.inputAnchors.length ? 20 : 0 }}>
                <Button sx={{ borderRadius: 25, width: '90%', mb: 2 }} variant='outlined' onClick={onDialogClicked}>
                  {t('nodeConfig.flowControl')}
                </Button>
              </div>
            )}
            {data.outputAnchors.length > 0 && <Divider />}
            {data.outputAnchors.length > 0 && (
              <Box sx={{ background: theme.palette.asyncSelect.main, p: 1 }}>
                <Typography sx={{ fontWeight: 500, textAlign: 'center' }}>{t('canvas.nodeConfig.outputs')}</Typography>
              </Box>
            )}
            {data.outputAnchors.length > 0 && <Divider />}
            {data.outputAnchors.length > 0 && data.outputAnchors.map((outputAnchor) => <NodeOutputHandler key={JSON.stringify(data)} outputAnchor={outputAnchor} data={data} />)}
          </Box>
        </NodeTooltip>
      </NodeCardWrapper>
      <AdditionalParamsDialog show={showDialog} dialogProps={dialogProps} onCancel={() => setShowDialog(false)} />
      <NodeInfoDialog show={showInfoDialog} dialogProps={infoDialogProps} onCancel={() => setShowInfoDialog(false)} />
    </>
  )
}

CanvasNode.propTypes = { data: PropTypes.object }

export default CanvasNode
