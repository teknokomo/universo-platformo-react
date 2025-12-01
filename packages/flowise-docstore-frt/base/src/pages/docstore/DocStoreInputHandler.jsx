import PropTypes from 'prop-types'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from '@universo/i18n'

// material-ui
import { Box, Typography, IconButton, Button } from '@mui/material'
import { IconRefresh, IconArrowsMaximize, IconAlertTriangle } from '@tabler/icons-react'

// project import
import { Dropdown } from '@flowise/template-mui'
import { MultiDropdown } from '@flowise/template-mui'
import { AsyncDropdown } from '@flowise/template-mui'
import { Input } from '@flowise/template-mui'
import { DataGrid } from '@flowise/template-mui'
import { File } from '@flowise/template-mui'
import { SwitchInput, TooltipWithParser, CodeEditor, ExpandTextDialog, ManageScrapedLinksDialog } from '@flowise/template-mui'
import { JsonEditorInput } from '@flowise/template-mui/ui-components/json/JsonEditor'
import CredentialInputHandler from '@flowise/template-mui/ui-components/dialogs/CredentialInputHandler'
import { FLOWISE_CREDENTIAL_ID } from '@flowise/store'

// const
// ===========================|| DocStoreInputHandler ||=========================== //

const DocStoreInputHandler = ({ inputParam, data, disabled = false }) => {
    const customization = useSelector((state) => state.customization)
    const { t } = useTranslation(['document-store', 'vector-store'])

    const [showExpandDialog, setShowExpandDialog] = useState(false)
    const [expandDialogProps, setExpandDialogProps] = useState({})
    const [showManageScrapedLinksDialog, setShowManageScrapedLinksDialog] = useState(false)
    const [manageScrapedLinksDialogProps, setManageScrapedLinksDialogProps] = useState({})
    const [reloadTimestamp, setReloadTimestamp] = useState(Date.now().toString())

    const onExpandDialogClicked = (value, inputParam) => {
        const dialogProps = {
            value,
            inputParam,
            disabled,
            confirmButtonName: t('document-store:common.save'),
            cancelButtonName: t('document-store:common.cancel')
        }
        setExpandDialogProps(dialogProps)
        setShowExpandDialog(true)
    }

    const onManageLinksDialogClicked = (url, selectedLinks, relativeLinksMethod, limit) => {
        const dialogProps = {
            url,
            relativeLinksMethod,
            limit,
            selectedLinks,
            confirmButtonName: t('document-store:common.save'),
            cancelButtonName: t('document-store:common.cancel')
        }
        setManageScrapedLinksDialogProps(dialogProps)
        setShowManageScrapedLinksDialog(true)
    }

    const onManageLinksDialogSave = (url, links) => {
        setShowManageScrapedLinksDialog(false)
        data.inputs.url = url
        data.inputs.selectedLinks = links
    }

    const onExpandDialogSave = (newValue, inputParamName) => {
        setShowExpandDialog(false)
        data.inputs[inputParamName] = newValue
    }

    const getCredential = () => {
        const credential = data.inputs.credential || data.inputs[FLOWISE_CREDENTIAL_ID]
        if (credential) {
            return { credential }
        }
        return {}
    }

    // Form field translations
    const getTranslatedLabel = (label) => {
        // PDF-specific translations
        if (label === 'PDF File') return t('document-store:loaders.pdf.file')
        if (label === 'Usage') return t('document-store:loaders.pdf.usage')
        if (label === 'One document per page') return t('document-store:loaders.pdf.oneDocumentPerPage')
        if (label === 'Use Legacy Build') return t('document-store:loaders.pdf.useLegacyBuild')
        if (label === 'Additional Metadata') return t('document-store:loaders.pdf.additionalMetadata')
        if (label === 'Omit Metadata Keys') return t('document-store:loaders.pdf.omitMetadataKeys')

        // Vector Store fields
        if (label === 'Connect Credential') return t('vector-store:formFields.connectCredential')
        if (label === 'Model') return t('vector-store:formFields.model')
        if (label === 'Endpoint') return t('vector-store:formFields.endpoint')
        if (label === 'Table Name') return t('vector-store:formFields.tableName')
        if (label === 'Namespace') return t('vector-store:formFields.namespace')
        if (label === 'Cleanup') return t('vector-store:formFields.cleanup')
        if (label === 'None') return t('vector-store:formFields.none')
        if (label === 'SourceId Key') return t('vector-store:formFields.sourceIdKey')
        if (label === 'Additional Connection Configuration') return t('vector-store:formFields.additionalConnection')
        if (label === 'Project URL') return t('vector-store:formFields.projectUrl')
        if (label === 'Query Name') return t('vector-store:formFields.queryName')
        if (label === 'Metadata Filter') return t('vector-store:formFields.metadataFilter')
        if (label === 'RPC Filter') return t('vector-store:formFields.rpcFilter')

        return label
    }

    return (
        <div>
            {inputParam && (
                <>
                    <Box sx={{ p: 2 }}>
                        <div style={{ display: 'flex', flexDirection: 'row' }}>
                            <Typography>
                                {getTranslatedLabel(inputParam.label)}
                                {!inputParam.optional && <span style={{ color: 'red' }}>&nbsp;*</span>}
                                {inputParam.description && <TooltipWithParser style={{ marginLeft: 10 }} title={inputParam.description} />}
                            </Typography>
                            <div style={{ flexGrow: 1 }}></div>
                            {((inputParam.type === 'string' && inputParam.rows) || inputParam.type === 'code') && (
                                <IconButton
                                    size='small'
                                    sx={{
                                        height: 25,
                                        width: 25
                                    }}
                                    title={t('document-store:common.expand')}
                                    color='primary'
                                    onClick={() =>
                                        onExpandDialogClicked(data.inputs[inputParam.name] ?? inputParam.default ?? '', inputParam)
                                    }
                                >
                                    <IconArrowsMaximize />
                                </IconButton>
                            )}
                        </div>
                        {inputParam.warning && (
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    borderRadius: 10,
                                    background: 'rgb(254,252,191)',
                                    padding: 10,
                                    marginTop: 10,
                                    marginBottom: 10
                                }}
                            >
                                <IconAlertTriangle size={30} color='orange' />
                                <span style={{ color: 'rgb(116,66,16)', marginLeft: 10 }}>{inputParam.warning}</span>
                            </div>
                        )}
                        {inputParam.type === 'credential' && (
                            <CredentialInputHandler
                                key={JSON.stringify(inputParam)}
                                disabled={disabled}
                                data={getCredential()}
                                inputParam={inputParam}
                                onSelect={(newValue) => {
                                    data.credential = newValue
                                    data.inputs[FLOWISE_CREDENTIAL_ID] = newValue // in case data.credential is not updated
                                }}
                            />
                        )}

                        {inputParam.type === 'file' && (
                            <File
                                disabled={disabled}
                                fileType={inputParam.fileType || '*'}
                                onChange={(newValue) => (data.inputs[inputParam.name] = newValue)}
                                value={data.inputs[inputParam.name] ?? inputParam.default ?? t('document-store:loaders.common.chooseFile')}
                            />
                        )}
                        {inputParam.type === 'boolean' && (
                            <SwitchInput
                                disabled={disabled}
                                onChange={(newValue) => (data.inputs[inputParam.name] = newValue)}
                                value={data.inputs[inputParam.name] ?? inputParam.default ?? false}
                            />
                        )}
                        {inputParam.type === 'datagrid' && (
                            <DataGrid
                                disabled={disabled}
                                columns={inputParam.datagrid}
                                hideFooter={true}
                                rows={data.inputs[inputParam.name] ?? JSON.stringify(inputParam.default) ?? []}
                                onChange={(newValue) => (data.inputs[inputParam.name] = newValue)}
                            />
                        )}
                        {inputParam.type === 'code' && (
                            <>
                                <div style={{ height: '5px' }}></div>
                                <div style={{ height: inputParam.rows ? '100px' : '200px' }}>
                                    <CodeEditor
                                        disabled={disabled}
                                        value={data.inputs[inputParam.name] ?? inputParam.default ?? ''}
                                        height={inputParam.rows ? '100px' : '200px'}
                                        theme={customization.isDarkMode ? 'dark' : 'light'}
                                        lang={'js'}
                                        placeholder={inputParam.placeholder}
                                        onValueChange={(code) => (data.inputs[inputParam.name] = code)}
                                        basicSetup={{ highlightActiveLine: false, highlightActiveLineGutter: false }}
                                    />
                                </div>
                            </>
                        )}
                        {(inputParam.type === 'string' || inputParam.type === 'password' || inputParam.type === 'number') && (
                            <Input
                                key={data.inputs[inputParam.name]}
                                disabled={disabled}
                                inputParam={inputParam}
                                onChange={(newValue) => (data.inputs[inputParam.name] = newValue)}
                                value={data.inputs[inputParam.name] ?? inputParam.default ?? ''}
                                nodeId={data.id}
                            />
                        )}
                        {inputParam.type === 'json' && (
                            <JsonEditorInput
                                disabled={disabled}
                                onChange={(newValue) => (data.inputs[inputParam.name] = newValue)}
                                value={data.inputs[inputParam.name] ?? inputParam.default ?? ''}
                                isDarkMode={customization.isDarkMode}
                            />
                        )}
                        {inputParam.type === 'options' && (
                            <Dropdown
                                key={JSON.stringify(inputParam)}
                                disabled={disabled}
                                name={inputParam.name}
                                options={inputParam.options}
                                onSelect={(newValue) => (data.inputs[inputParam.name] = newValue)}
                                value={data.inputs[inputParam.name] ?? inputParam.default ?? 'choose an option'}
                            />
                        )}
                        {inputParam.type === 'multiOptions' && (
                            <MultiDropdown
                                key={JSON.stringify(inputParam)}
                                disabled={disabled}
                                name={inputParam.name}
                                options={inputParam.options}
                                onSelect={(newValue) => (data.inputs[inputParam.name] = newValue)}
                                value={data.inputs[inputParam.name] ?? inputParam.default ?? 'choose an option'}
                            />
                        )}
                        {(inputParam.type === 'asyncOptions' || inputParam.type === 'asyncMultiOptions') && (
                            <>
                                {data.inputParams?.length === 1 && <div style={{ marginTop: 10 }} />}
                                <div style={{ display: 'flex', flexDirection: 'row' }}>
                                    <div key={reloadTimestamp} style={{ flex: 1 }}>
                                        <AsyncDropdown
                                            key={JSON.stringify(inputParam)}
                                            disabled={disabled}
                                            name={inputParam.name}
                                            nodeData={data}
                                            freeSolo={inputParam.freeSolo}
                                            multiple={inputParam.type === 'asyncMultiOptions'}
                                            value={data.inputs[inputParam.name] ?? inputParam.default ?? 'choose an option'}
                                            onSelect={(newValue) => (data.inputs[inputParam.name] = newValue)}
                                            onCreateNew={() => addAsyncOption(inputParam.name)}
                                        />
                                    </div>
                                    {inputParam.refresh && (
                                        <IconButton
                                            title={t('document-store:common.refresh')}
                                            color='primary'
                                            size='small'
                                            onClick={() => setReloadTimestamp(Date.now().toString())}
                                        >
                                            <IconRefresh />
                                        </IconButton>
                                    )}
                                </div>
                            </>
                        )}
                        {(data.name === 'cheerioWebScraper' ||
                            data.name === 'puppeteerWebScraper' ||
                            data.name === 'playwrightWebScraper') &&
                            inputParam.name === 'url' && (
                                <>
                                    <Button
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'row',
                                            width: '100%'
                                        }}
                                        disabled={disabled}
                                        sx={{ borderRadius: '12px', width: '100%', mt: 1 }}
                                        variant='outlined'
                                        onClick={() =>
                                            onManageLinksDialogClicked(
                                                data.inputs[inputParam.name] ?? inputParam.default ?? '',
                                                data.inputs.selectedLinks,
                                                data.inputs['relativeLinksMethod'] ?? 'webCrawl',
                                                parseInt(data.inputs['limit']) ?? 0
                                            )
                                        }
                                    >
                                        {t('document-store:actions.manageLinks')}
                                    </Button>
                                    <ManageScrapedLinksDialog
                                        show={showManageScrapedLinksDialog}
                                        dialogProps={manageScrapedLinksDialogProps}
                                        onCancel={() => setShowManageScrapedLinksDialog(false)}
                                        onSave={onManageLinksDialogSave}
                                    />
                                </>
                            )}
                    </Box>
                </>
            )}
            <ExpandTextDialog
                show={showExpandDialog}
                dialogProps={expandDialogProps}
                onCancel={() => setShowExpandDialog(false)}
                onConfirm={onExpandDialogSave}
            ></ExpandTextDialog>
        </div>
    )
}

DocStoreInputHandler.propTypes = {
    inputParam: PropTypes.object,
    data: PropTypes.object,
    disabled: PropTypes.bool
}

export default DocStoreInputHandler
