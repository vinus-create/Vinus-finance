import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import { getAppConfig } from '@/lib/admin/config'
import { createAdminClient } from '@/lib/supabase/admin'

// Singleton Gemini client
let _genAI: GoogleGenerativeAI | null = null

// ponytail: counts model fetches, which are ~1:1 with generateContent() in parser.ts.
// Fire-and-forget (no await) so it adds zero latency; a lost log on crash is fine for a usage gauge.
// Ceiling: over-counts if a model is fetched but never used; swap to wrapping generateContent if that matters.
function logApiCall(tier: 'standard' | 'hq') {
  try {
    createAdminClient().rpc('increment_api_usage', { p_tier: tier }).then(() => {}, () => {})
  } catch { /* no service key / table missing — ignore */ }
}

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('GEMINI_API_KEY is not set in environment variables')
    _genAI = new GoogleGenerativeAI(key)
  }
  return _genAI
}

// Dynamic standard model — reads from app_config (60s cache), fallback to gemini-2.5-flash-lite
export async function getFlashModel(): Promise<GenerativeModel> {
  const model = await getAppConfig('ai_model_standard')
  logApiCall('standard')
  return getGenAI().getGenerativeModel({
    model: model || 'gemini-2.5-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  })
}

// Plain-text variant — for prose features (daily tip). The JSON-forced models
// above ignore "不要 JSON" prompt instructions because responseMimeType wins.
export async function getFlashModelText(): Promise<GenerativeModel> {
  const model = await getAppConfig('ai_model_standard')
  logApiCall('standard')
  return getGenAI().getGenerativeModel({
    model: model || 'gemini-2.5-flash-lite',
    generationConfig: { temperature: 0.7 },
  })
}

// Dynamic HQ model — reads from app_config (60s cache), fallback to gemini-2.5-flash
export async function getFlashModelHQ(): Promise<GenerativeModel> {
  const model = await getAppConfig('ai_model_hq')
  logApiCall('hq')
  return getGenAI().getGenerativeModel({
    model: model || 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  })
}
