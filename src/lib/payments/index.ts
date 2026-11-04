import { easypaisaConfig } from './easypaisa'
import { jazzcashConfig } from './jazzcash'

export type Gateway = 'jazzcash' | 'easypaisa'

/** Gateways stay hidden at checkout until merchant credentials are set in the environment. */
export function isGatewayConfigured(gateway: Gateway): boolean {
  return gateway === 'jazzcash' ? jazzcashConfig() !== null : easypaisaConfig() !== null
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '')
