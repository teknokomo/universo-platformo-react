import React from 'react'

interface PlayCanvasViewPageProps {
    flowData: string
    config: any
}

const PlayCanvasViewPage: React.FC<PlayCanvasViewPageProps> = ({ config }) => {
    return (
        <div
            style={{
                padding: '20px',
                fontFamily: 'Arial, sans-serif',
                backgroundColor: '#f5f5f5',
                minHeight: '100vh'
            }}
        >
            <h1 style={{ color: '#333', marginBottom: '20px' }}>PlayCanvas Application Loaded</h1>
            <p style={{ color: '#666', fontSize: '16px', marginBottom: '20px' }}>
                This page will display the PlayCanvas application. Currently showing configuration:
            </p>
            <div
                style={{
                    backgroundColor: '#fff',
                    padding: '15px',
                    borderRadius: '5px',
                    border: '1px solid #ddd',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    overflow: 'auto'
                }}
            >
                <pre>{JSON.stringify(config, null, 2)}</pre>
            </div>
            <div
                style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: '#e8f4fd',
                    borderRadius: '5px',
                    border: '1px solid #bee5eb'
                }}
            >
                <h3 style={{ margin: '0 0 10px 0', color: '#0c5460' }}>Coming Soon: Universo MMOOMM Gameplay</h3>
                <p style={{ margin: 0, color: '#0c5460' }}>This will be replaced with the full PlayCanvas MMO game implementation.</p>
            </div>
        </div>
    )
}

export default PlayCanvasViewPage
