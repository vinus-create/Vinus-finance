import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import { getAppConfig } from '@/lib/admin/config'

// Singleton Gemini client
let _genAI: GoogleGenerativeAI | null = null

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
  return getGenAI().getGenerativeModel({
    model: model || 'gemini-2.5-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  })
}

// Dynamic HQ model — reads from app_config (60s cache), fallback to gemini-2.5-flash
export async function getFlashModelHQ(): Promise<GenerativeModel> {
  const model = await getAppConfig('ai_model_hq')
  return getGenAI().getGenerativeModel({
    model: model || 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  })
}
