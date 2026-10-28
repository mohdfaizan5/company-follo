import { defineAgent } from 'eve'

/**
 * A model string uses Vercel AI Gateway. Locally, set AI_GATEWAY_API_KEY.
 * Keep this file small: Eve discovers the rest of the agent from folders.
 */
export default defineAgent({
  // This starter exposes only the explicit company snapshot tool below.
  // Do not enable file, shell, or web tools until the product needs them.
  defaultTools: false,
  model: 'nvidia/nemotron-3.5-lightning-free',
})
