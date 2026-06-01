import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'

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

// gemini-2.5-flash-lite — fast, cheap, for text + PDF
export function getFlashModel(): GenerativeModel {
  return getGenAI().getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  })
}

// gemini-2.5-flash — higher quality, for voice audio + receipt images
// Better at handling accents, short clips, and noisy photos
export function getFlashModelHQ(): GenerativeModel {
  return getGenAI().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2, // Slightly higher for ambiguous speech/images
    },
  })
}
