import { PostHog } from 'posthog-node'
import { uuid } from '@universo/utils'
import { getAppVersion } from '.'

export class Telemetry {
    private postHog?: PostHog
    private cachedVersion?: string
    private anonymousId?: string

    constructor() {
        const disabled = process.env.DISABLE_FLOWISE_TELEMETRY === 'true'
        const apiKey = process.env.POSTHOG_PUBLIC_API_KEY

        if (!disabled && apiKey) {
            this.postHog = new PostHog(apiKey)
            this.anonymousId = uuid.generateUuidV7()
        }
    }

    private async getVersion(): Promise<string> {
        if (!this.cachedVersion) {
            this.cachedVersion = await getAppVersion()
        }

        return this.cachedVersion || ''
    }

    async sendTelemetry(
        event: string,
        properties: Record<string, unknown> = {},
        orgId?: string
    ): Promise<void> {
        if (!this.postHog) {
            return
        }

        const payload = {
            ...properties,
            version: await this.getVersion()
        }

        const distinctId =
            typeof orgId === 'string' && orgId.trim().length > 0
                ? orgId
                : this.anonymousId || (this.anonymousId = uuid.generateUuidV7())

        this.postHog.capture({
            event,
            distinctId,
            properties: payload
        })
    }

    async flush(): Promise<void> {
        await this.postHog?.shutdownAsync()
    }
}
