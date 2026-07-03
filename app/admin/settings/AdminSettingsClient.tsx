'use client'

import { useState } from 'react'
import { Bot, Check, Info } from 'lucide-react'
import { toast } from 'sonner'

const MODELS = [
  { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite 3.1', desc: 'Newest lite. Fastest & cheapest, best for text/PDF parsing.' },
  { id: 'gemini-flash-latest', label: 'Gemini Flash 3.1', desc: 'Newest Flash. Highest quality for voice audio & receipt images.' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', desc: 'Fastest & cheapest. Best for text/PDF parsing.' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'High quality. Best for voice audio & receipt images.' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', desc: 'Previous generation Flash model.' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', desc: 'Older, very fast. Limited multimodal support.' },
]

interface Props { configs: Record<string, string> }

export default function AdminSettingsClient({ configs }: Props) {
  const [standard, setStandard] = useState(configs.ai_model_standard ?? 'gemini-2.5-flash-lite')
  const [hq, setHq] = useState(configs.ai_model_hq ?? 'gemini-2.5-flash')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/config/ai-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ standard, hq }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Failed to save config'); return }
    setSaved(true)
    toast.success('AI model configuration saved. Takes effect within ~60 seconds.')
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* AI Model Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">AI Model Configuration</h3>
            <p className="text-xs text-slate-400">Controls which Gemini model the app uses for transaction parsing</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Standard model */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
              Standard Model — text input &amp; PDF parsing
            </label>
            <div className="space-y-2">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setStandard(m.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                    standard === m.id
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 font-mono">{m.id}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
                  </div>
                  {standard === m.id && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* HQ model */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
              HQ Model — voice audio &amp; receipt images
            </label>
            <div className="space-y-2">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setHq(m.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                    hq === m.id
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 font-mono">{m.id}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
                  </div>
                  {hq === m.id && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Info notice */}
          <div className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2.5">
            <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-500">
              Changes take effect within ~60 seconds as the in-memory cache expires.
              All new AI parse requests after that will use the selected model.
            </p>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-white hover:bg-slate-700'
            } disabled:opacity-60`}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Credentials info */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Admin Credentials</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Username</span>
            <span className="font-mono text-slate-900">ADMIN</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Password</span>
            <span className="font-mono text-slate-400">••••••••••••</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Credentials are stored in server environment variables and cannot be changed from this UI.</p>
        </div>
      </div>
    </div>
  )
}
