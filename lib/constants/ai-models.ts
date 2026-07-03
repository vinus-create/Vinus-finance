// Single source of truth for selectable Gemini models.
// Both the admin UI (AdminSettingsClient) and the save-route whitelist read this,
// so adding a model here is the only change needed.
export const MODELS = [
  { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite 3.1', desc: 'Newest lite. Fastest & cheapest, best for text/PDF parsing.' },
  { id: 'gemini-flash-latest', label: 'Gemini Flash 3.1', desc: 'Newest Flash. Highest quality for voice audio & receipt images.' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', desc: 'Fastest & cheapest. Best for text/PDF parsing.' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'High quality. Best for voice audio & receipt images.' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', desc: 'Previous generation Flash model.' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', desc: 'Older, very fast. Limited multimodal support.' },
]

export const ALLOWED_MODEL_IDS = MODELS.map(m => m.id)
