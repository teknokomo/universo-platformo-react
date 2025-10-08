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
  mockCreateGroupLink,
} = vi.hoisted(() => ({
  mockGetCurrentUrlIds: vi.fn(() => ({ flowId: 'flow-123' })),
  mockLoadSettings: vi.fn(async () => ({ data: { projectTitle: 'Demo Project', isPublic: false } })),
  mockSaveSettings: vi.fn(async () => ({ data: { success: true } })),
  mockPublish: vi.fn(async () => ({ publicationId: 'pub-123' })),
  mockGetGlobalSettings: vi.fn(async () => ({ data: { success: true, data: {} } })),
  mockCreateGroupLink: vi.fn(async () => ({ id: 'link-123', baseSlug: 'abc123def456' })),
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
  PublishLinksApi: {
    listLinks: vi.fn(async () => []),
    createGroupLink: mockCreateGroupLink,
    deleteLink: vi.fn(async () => ({ success: true })),
  },
}))

vi.mock('../../utils/base58Validator', () => ({
  isValidBase58: vi.fn(() => true),
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

    await waitFor(() => expect(mockCreateGroupLink).toHaveBeenCalledTimes(1))

    expect(mockSaveSettings).toHaveBeenCalledWith('flow-123', expect.objectContaining({ isPublic: true }))
    expect(mockCreateGroupLink).toHaveBeenCalledWith('flow-123', 'arjs')
  })
})
