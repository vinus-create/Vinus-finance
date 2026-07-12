import { after } from 'next/server'

// Fire-and-forget usage reporting to the home-PC AI usage dashboard
// (https://usage.vinustore.com.my/log). No-op when env vars are absent (localhost dev).
export function logUsage(
  model: string,
  usage?: { promptTokenCount?: number; totalTokenCount?: number }
) {
  const url = process.env.USAGE_INGEST_URL
  const key = process.env.USAGE_INGEST_KEY
  if (!url || !key) return
  const input = usage?.promptTokenCount ?? 0
  // total - prompt so thinking tokens are billed as output (dashboard convention)
  const output = Math.max((usage?.totalTokenCount ?? 0) - input, 0)
  const send = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Usage-Key': key },
      body: JSON.stringify({
        project: 'vinus-finance',
        model,
        input_tokens: input,
        output_tokens: output,
      }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {})
  try {
    after(send) // runs post-response on Vercel; zero request latency
  } catch {
    void send() // outside a request scope — best effort
  }
}
