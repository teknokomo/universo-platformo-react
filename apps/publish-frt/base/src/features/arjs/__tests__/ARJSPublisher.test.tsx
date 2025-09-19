import React from 'react'
import { vi } from 'vitest'
import { act } from 'react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders, screen, waitFor } from '@testing/frontend'

import ARJSPublisher from '../ARJSPublisher.jsx'

const {
  mockGetCurrentUrlIds,
  mockLoadSettings,
  mockSaveSettings,
  mockPublish,
  mockGetGlobalSettings,
} = vi.hoisted(() => ({
  mockGetCurrentUrlIds: vi.fn(() => ({ flowId: 'flow-123' })),
  mockLoadSettings: vi.fn(async () => ({ data: { projectTitle: 'Demo Project', isPublic: false } })),
  mockSaveSettings: vi.fn(async () => ({ data: { success: true } })),
  mockPublish: vi.fn(async () => ({ publicationId: 'pub-123' })),
  mockGetGlobalSettings: vi.fn(async () => ({ data: { success: true, data: {} } })),
}))

vi.mock('../../../api', () => ({
  getCurrentUrlIds: mockGetCurrentUrlIds,
  ChatflowsApi: {
    loadSettings: mockLoadSettings,
    saveSettings: mockSaveSettings,
  },
  ARJSPublishApi: {
    publishARJS: mockPublish,
  },
  PublicationApi: {
    getGlobalSettings: mockGetGlobalSettings,
  },
}))

describe('ARJSPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('publishes the current flow when toggling the public switch', async () => {
    const onPublish = vi.fn()

    await act(async () => {
      await renderWithProviders(
        <ARJSPublisher
          flow={{ id: 'flow-123', name: 'Demo Flow' }}
          unikId='unik-42'
          onPublish={onPublish}
          onCancel={() => {}}
          initialConfig={{}}
        />,
        {
          withRedux: false,
          withRouter: false,
        },
      )
    })

    await waitFor(() => expect(mockLoadSettings).toHaveBeenCalledWith('flow-123'))

    const toggle = await screen.findByRole('checkbox', { name: /configuration\.makePublic/i })
    await userEvent.click(toggle)

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1))

    expect(mockSaveSettings).toHaveBeenCalledWith('flow-123', expect.objectContaining({ isPublic: true }))
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ chatflowId: 'flow-123', isPublic: true, projectName: 'Demo Flow' }),
    )
    expect(onPublish).toHaveBeenCalledWith(expect.objectContaining({ publicationId: 'pub-123' }))
    expect(onPublish.mock.calls[0][0].publishedUrl).toContain('/p/pub-123')
  })
})
