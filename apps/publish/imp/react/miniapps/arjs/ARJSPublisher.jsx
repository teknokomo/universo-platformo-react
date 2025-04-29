import React, { useState, useEffect } from 'react'
import { Button, Box, Typography, CircularProgress, TextField, MenuItem, Paper } from '@mui/material'
import { fetchUPDLScene, publishARJSProject } from '../../api/updlApi'
import { ARJSExporter } from './ARJSExporter'
import { message } from 'antd'
import { Tabs } from 'antd'
import { Spin } from 'antd'
import { Space } from 'antd'
import { Input } from 'antd'
import { Alert } from 'antd'
import { DownloadOutlined, CopyOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import QRCode from 'qrcode.react'

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { TabPane } = Tabs

// Styled components
const StyledCard = styled(Card)`
    margin-bottom: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`

const Preview = styled.div`
    border: 1px solid #d9d9d9;
    border-radius: 8px;
    padding: 16px;
    margin-top: 16px;
    background: #f0f2f5;
    min-height: 300px;
    overflow: auto;
    font-family: 'Courier New', monospace;
`

const QRContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 20px;
    padding: 20px;
    background: white;
    border-radius: 8px;
`

const MarkerPreview = styled.div`
    margin-top: 16px;
    padding: 16px;
    border: 1px dashed #d9d9d9;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    background: white;
`

/**
 * AR.js Publisher Component
 * This component allows users to:
 * 1. Select an UPDL scene
 * 2. Configure AR.js marker and settings
 * 3. Preview generated HTML
 * 4. Publish AR.js project
 */
const ARJSPublisher = () => {
    const [scenes, setScenes] = useState([])
    const [selectedScene, setSelectedScene] = useState(null)
    const [sceneData, setSceneData] = useState(null)
    const [projectTitle, setProjectTitle] = useState('')
    const [markerType, setMarkerType] = useState('preset')
    const [markerValue, setMarkerValue] = useState('hiro')
    const [loading, setLoading] = useState(false)
    const [htmlPreview, setHtmlPreview] = useState('')
    const [publishedUrl, setPublishedUrl] = useState('')
    const [activeTab, setActiveTab] = useState('1')

    // Fetch available scenes on component mount
    useEffect(() => {
        const loadScenes = async () => {
            setLoading(true)
            try {
                const data = await fetchScenes()
                setScenes(data)
            } catch (error) {
                message.error('Failed to load scenes: ' + error.message)
            } finally {
                setLoading(false)
            }
        }

        loadScenes()
    }, [])

    // Generate HTML preview when scene and settings change
    useEffect(() => {
        if (sceneData) {
            generateHtmlPreview()
        }
    }, [sceneData, markerType, markerValue, projectTitle])

    // Handle scene selection
    const handleSceneSelect = async (sceneId) => {
        if (!sceneId) {
            setSelectedScene(null)
            setSceneData(null)
            setHtmlPreview('')
            return
        }

        setLoading(true)
        try {
            // In a real app, this would fetch the scene data from API
            const selectedSceneData = scenes.find((scene) => scene.id === sceneId)
            setSelectedScene(selectedSceneData)

            // This would typically be an API call to fetch full scene data
            // For demo purposes, we're using mock data from the controller
            const response = await fetch(`/api/updl/scenes/${sceneId}`)
            const result = await response.json()

            if (result.status === 'success') {
                setSceneData(result.data)
                setProjectTitle(result.data.name)
            } else {
                throw new Error(result.message || 'Failed to load scene data')
            }
        } catch (error) {
            message.error('Error loading scene: ' + error.message)
            setSelectedScene(null)
            setSceneData(null)
        } finally {
            setLoading(false)
        }
    }

    // Generate HTML preview
    const generateHtmlPreview = () => {
        if (!sceneData || !sceneData.data) return

        let markerAttributes = ''

        // Set marker attributes based on type and value
        if (markerType === 'preset') {
            markerAttributes = `type="pattern" preset="${markerValue}"`
        } else if (markerType === 'pattern') {
            markerAttributes = `type="pattern" url="${markerValue}"`
        } else if (markerType === 'barcode') {
            markerAttributes = `type="barcode" value="${markerValue}"`
        }

        // Generate objects HTML
        let objectsHTML = ''
        const objects = sceneData.data.objects || []

        objects.forEach((obj) => {
            switch (obj.type) {
                case 'box':
                    objectsHTML += `  <a-box position="${obj.position}" rotation="${obj.rotation}" scale="${obj.scale}" color="${obj.color}"></a-box>\n`
                    break
                case 'sphere':
                    objectsHTML += `  <a-sphere position="${obj.position}" radius="${obj.radius}" color="${obj.color}"></a-sphere>\n`
                    break
                case 'cylinder':
                    objectsHTML += `  <a-cylinder position="${obj.position}" radius="${obj.radius}" height="${obj.height}" color="${obj.color}"></a-cylinder>\n`
                    break
                // Add more object types as needed
            }
        })

        // Generate lights HTML
        let lightsHTML = ''
        const lights = sceneData.data.lights || []

        lights.forEach((light) => {
            switch (light.type) {
                case 'ambient':
                    lightsHTML += `<a-entity light="type: ambient; color: ${light.color}; intensity: ${light.intensity}"></a-entity>\n`
                    break
                case 'directional':
                    lightsHTML += `<a-entity light="type: directional; color: ${light.color}; intensity: ${light.intensity}" position="${light.position}"></a-entity>\n`
                    break
                case 'point':
                    lightsHTML += `<a-entity light="type: point; color: ${light.color}; intensity: ${light.intensity}" position="${light.position}"></a-entity>\n`
                    break
                // Add more light types as needed
            }
        })

        // Simple HTML template for preview
        const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectTitle || 'AR.js Scene'}</title>
    <script src="https://cdn.jsdelivr.net/gh/aframevr/aframe@1.4.2/dist/aframe-master.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/ar.js@3.4.5/aframe/build/aframe-ar.js"></script>
    <style>
        body { margin: 0; overflow: hidden; }
        .arjs-loader {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            z-index: 999; background-color: rgba(0, 0, 0, 0.8);
            display: flex; justify-content: center; align-items: center; 
            flex-direction: column; color: white;
        }
        .instruction {
            position: fixed; bottom: 20px; width: 100%; text-align: center;
            color: white; background-color: rgba(0, 0, 0, 0.6);
            padding: 10px 0; font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="arjs-loader">
        <div>Loading AR Experience...</div>
    </div>

    <a-scene embedded arjs="sourceType: webcam; debugUIEnabled: false;" 
             renderer="logarithmicDepthBuffer: true;" vr-mode-ui="enabled: false">
        
        <a-marker ${markerAttributes}>
${objectsHTML}
        </a-marker>
        
        <a-entity camera></a-entity>
        
${lightsHTML}
    </a-scene>
    
    <div class="instruction" id="instruction">
        Point your camera at the marker
    </div>
    
    <script>
        // Hide loader when scene is loaded
        const scene = document.querySelector('a-scene')
        const loader = document.querySelector('.arjs-loader')
        scene.addEventListener('loaded', () => {
            loader.style.display = 'none'
        })
        
        // Show/hide instruction based on marker detection
        const marker = document.querySelector('a-marker')
        const instruction = document.querySelector('#instruction')
        marker.addEventListener('markerFound', () => {
            instruction.innerHTML = 'Marker detected!'
            setTimeout(() => { instruction.style.display = 'none' }, 3000)
        })
        marker.addEventListener('markerLost', () => {
            instruction.style.display = 'block'
            instruction.innerHTML = 'Point your camera at the marker'
        })
    </script>
</body>
</html>`

        setHtmlPreview(htmlTemplate)
    }

    // Download HTML file
    const handleDownload = () => {
        if (!htmlPreview) {
            message.error('No HTML content to download')
            return
        }

        const blob = new Blob([htmlPreview], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${projectTitle || 'ar-scene'}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        message.success('HTML file downloaded successfully')
    }

    // Copy HTML to clipboard
    const handleCopy = () => {
        if (!htmlPreview) {
            message.error('No HTML content to copy')
            return
        }

        navigator.clipboard
            .writeText(htmlPreview)
            .then(() => message.success('HTML copied to clipboard'))
            .catch((err) => message.error('Failed to copy: ' + err.message))
    }

    // Publish AR.js project
    const handlePublish = async () => {
        if (!sceneData) {
            message.error('Please select a scene first')
            return
        }

        if (!projectTitle) {
            message.error('Please enter a project title')
            return
        }

        setLoading(true)
        try {
            const data = await publishARJSProject({
                sceneId: sceneData.id,
                title: projectTitle,
                markerType,
                markerValue
            })

            setPublishedUrl(data.publicUrl)
            setActiveTab('3') // Switch to Published tab
            message.success('AR.js project published successfully')
        } catch (error) {
            message.error('Failed to publish project: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    // Get marker image for preview
    const getMarkerImage = () => {
        if (markerType === 'preset') {
            if (markerValue === 'hiro') {
                return 'https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/hiro.png'
            } else if (markerValue === 'kanji') {
                return 'https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/kanji.png'
            }
        }

        // For custom patterns or barcodes, you would need to have the images available
        return 'https://via.placeholder.com/200?text=Marker+Preview'
    }

    // Render
    return (
        <div>
            <Title level={2}>AR.js Publisher</Title>
            <Text type='secondary'>Create augmented reality experiences with AR.js</Text>

            <Tabs activeKey={activeTab} onChange={setActiveTab}>
                <TabPane tab='Configure' key='1'>
                    <StyledCard title='Scene Selection'>
                        <Spin spinning={loading && !scenes.length}>
                            <Select
                                placeholder='Select a UPDL scene'
                                style={{ width: '100%' }}
                                onChange={handleSceneSelect}
                                loading={loading}
                                disabled={loading}
                            >
                                <Option value=''>-- Select a scene --</Option>
                                {scenes.map((scene) => (
                                    <Option key={scene.id} value={scene.id}>
                                        {scene.name}
                                    </Option>
                                ))}
                            </Select>

                            {selectedScene && (
                                <div style={{ marginTop: '16px' }}>
                                    <Text strong>Description: </Text>
                                    <Text>{selectedScene.description}</Text>
                                </div>
                            )}
                        </Spin>
                    </StyledCard>

                    {selectedScene && (
                        <>
                            <StyledCard title='Project Settings'>
                                <Spin spinning={loading}>
                                    <Space direction='vertical' style={{ width: '100%' }}>
                                        <div>
                                            <Text strong>Project Title:</Text>
                                            <Input
                                                placeholder='Enter a title for your AR project'
                                                value={projectTitle}
                                                onChange={(e) => setProjectTitle(e.target.value)}
                                                style={{ marginTop: 8 }}
                                            />
                                        </div>

                                        <div>
                                            <Text strong>Marker Type:</Text>
                                            <Select style={{ width: '100%', marginTop: 8 }} value={markerType} onChange={setMarkerType}>
                                                <Option value='preset'>Preset Marker</Option>
                                                <Option value='pattern'>Custom Pattern</Option>
                                                <Option value='barcode'>Barcode</Option>
                                            </Select>
                                        </div>

                                        {markerType === 'preset' && (
                                            <div>
                                                <Text strong>Preset Marker:</Text>
                                                <Select
                                                    style={{ width: '100%', marginTop: 8 }}
                                                    value={markerValue}
                                                    onChange={setMarkerValue}
                                                >
                                                    <Option value='hiro'>Hiro</Option>
                                                    <Option value='kanji'>Kanji</Option>
                                                </Select>
                                            </div>
                                        )}

                                        {markerType === 'pattern' && (
                                            <div>
                                                <Text strong>Pattern URL:</Text>
                                                <Input
                                                    placeholder='Enter URL to pattern file'
                                                    value={markerValue}
                                                    onChange={(e) => setMarkerValue(e.target.value)}
                                                    style={{ marginTop: 8 }}
                                                />
                                                <Text type='secondary' style={{ fontSize: '12px', marginTop: 4 }}>
                                                    URL to a .patt file or image to use as marker
                                                </Text>
                                            </div>
                                        )}

                                        {markerType === 'barcode' && (
                                            <div>
                                                <Text strong>Barcode Value:</Text>
                                                <Input
                                                    placeholder='Enter barcode value (0-63)'
                                                    value={markerValue}
                                                    onChange={(e) => setMarkerValue(e.target.value)}
                                                    style={{ marginTop: 8 }}
                                                    type='number'
                                                    min={0}
                                                    max={63}
                                                />
                                            </div>
                                        )}

                                        <MarkerPreview>
                                            <img
                                                src={getMarkerImage()}
                                                alt='Marker Preview'
                                                style={{ maxWidth: '100%', maxHeight: '100%' }}
                                            />
                                        </MarkerPreview>
                                    </Space>
                                </Spin>
                            </StyledCard>

                            <Space style={{ marginTop: 16 }}>
                                <Button type='primary' onClick={() => setActiveTab('2')} disabled={!sceneData}>
                                    Next: Preview
                                </Button>
                            </Space>
                        </>
                    )}
                </TabPane>

                <TabPane tab='Preview' key='2'>
                    {sceneData ? (
                        <>
                            <StyledCard title='HTML Preview'>
                                <Space style={{ marginBottom: 16 }}>
                                    <Button icon={<DownloadOutlined />} onClick={handleDownload} disabled={!htmlPreview}>
                                        Download HTML
                                    </Button>
                                    <Button icon={<CopyOutlined />} onClick={handleCopy} disabled={!htmlPreview}>
                                        Copy HTML
                                    </Button>
                                </Space>
                                <Preview>
                                    <pre>{htmlPreview}</pre>
                                </Preview>
                            </StyledCard>

                            <Alert
                                message='How to test this AR experience'
                                description={
                                    <Paragraph>
                                        <ol>
                                            <li>Download the HTML file</li>
                                            <li>Host it on a web server with HTTPS</li>
                                            <li>Open the URL on a mobile device with a camera</li>
                                            <li>Point your camera at the marker shown in the preview above</li>
                                        </ol>
                                        <Text type='secondary'>For easier testing, you can publish the project and share the URL</Text>
                                    </Paragraph>
                                }
                                type='info'
                                showIcon
                                icon={<QuestionCircleOutlined />}
                                style={{ marginBottom: 16 }}
                            />

                            <Space>
                                <Button onClick={() => setActiveTab('1')}>Back to Configure</Button>
                                <Button type='primary' onClick={handlePublish} loading={loading}>
                                    Publish Project
                                </Button>
                            </Space>
                        </>
                    ) : (
                        <Alert
                            message='No Scene Selected'
                            description='Please select a scene in the Configure tab'
                            type='warning'
                            showIcon
                        />
                    )}
                </TabPane>

                <TabPane tab='Published' key='3'>
                    {publishedUrl ? (
                        <StyledCard title='Published Project'>
                            <Alert
                                message='AR.js Project Published Successfully'
                                description='Your project is now available online. Share the URL or QR code to access it.'
                                type='success'
                                showIcon
                                style={{ marginBottom: 16 }}
                            />

                            <div>
                                <Text strong>Project URL:</Text>
                                <Paragraph copyable={{ text: window.location.origin + publishedUrl }}>
                                    {window.location.origin + publishedUrl}
                                </Paragraph>
                            </div>

                            <QRContainer>
                                <Text strong style={{ marginBottom: 8 }}>
                                    Scan this QR code to open the AR experience
                                </Text>
                                <QRCode value={window.location.origin + publishedUrl} size={200} level='H' />
                            </QRContainer>

                            <div style={{ marginTop: 16 }}>
                                <Text strong>Required Marker:</Text>
                                <div style={{ marginTop: 8 }}>
                                    <img src={getMarkerImage()} alt='Marker' style={{ maxWidth: 200, border: '1px solid #d9d9d9' }} />
                                </div>
                            </div>

                            <Space style={{ marginTop: 16 }}>
                                <Button onClick={() => setActiveTab('1')}>Create Another</Button>
                                <Button type='primary' href={publishedUrl} target='_blank'>
                                    Open Published Project
                                </Button>
                            </Space>
                        </StyledCard>
                    ) : (
                        <Alert
                            message='No Published Projects'
                            description='Publish a project from the Preview tab to see it here'
                            type='info'
                            showIcon
                        />
                    )}
                </TabPane>
            </Tabs>
        </div>
    )
}

export default ARJSPublisher
