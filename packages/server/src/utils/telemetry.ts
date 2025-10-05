import { PostHog } from 'posthog-node'
import { v4 as uuidv4 } from 'uuid'
import { getAppVersion } from '.'

export class Telemetry {
    private postHog?: PostHog
    private cachedVersion?: string

    constructor() {
        const disabled = process.env.DISABLE_FLOWISE_TELEMETRY === 'true'
        const apiKey = process.env.POSTHOG_PUBLIC_API_KEY

        if (!disabled && apiKey) {
            this.postHog = new PostHog(apiKey)
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

        this.postHog.capture({
            event,
            distinctId: orgId || uuidv4(),
            properties: payload
        })
    }

    async flush(): Promise<void> {
        await this.postHog?.shutdownAsync()
    }
}
