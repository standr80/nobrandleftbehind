'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CADENCE_OPTIONS = ['1pw', '2pw', '3pw', '5pw', 'daily']
const DAYS_OPTIONS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const CMS_OPTIONS = [
  { value: 'git', label: 'Git (GitHub PR)', description: 'Clem opens a PR on your repo' },
  { value: 'ghost', label: 'Ghost', description: 'Publish via Ghost Admin API' },
  { value: 'wordpress', label: 'WordPress', description: 'Publish via WordPress REST API' },
  { value: 'webhook', label: 'Custom webhook', description: 'POST to your own endpoint' },
  { value: 'download', label: 'Manual / Download', description: 'Export MDX files manually' },
]

interface FormData {
  name: string
  domain: string
  brand_voice: string
  target_audience: string
  forbidden_words: string
  publish_cadence: string
  publish_days: string[]
  publish_time: string
  cms_type: string
}

const STEPS = ['basics', 'brand', 'publishing'] as const
type Step = (typeof STEPS)[number]

export default function SetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('basics')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormData>({
    name: '',
    domain: '',
    brand_voice: '',
    target_audience: '',
    forbidden_words: '',
    publish_cadence: '2pw',
    publish_days: ['tuesday', 'thursday'],
    publish_time: '09:00',
    cms_type: 'download',
  })

  function set(key: keyof FormData, value: string | string[]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleDay(day: string) {
    set(
      'publish_days',
      form.publish_days.includes(day)
        ? form.publish_days.filter((d) => d !== day)
        : [...form.publish_days, day],
    )
  }

  const stepIndex = STEPS.indexOf(step)

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          forbidden_words: form.forbidden_words
            ? form.forbidden_words.split(',').map((w) => w.trim()).filter(Boolean)
            : [],
          domain: form.domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Setup failed')
      // Set the new workspace as the active one before navigating
      if (data.tenantId) {
        await fetch('/api/workspace/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: data.tenantId }),
        })
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors'
  const labelClass = 'block text-xs text-white/50 mb-1.5'

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Step indicator */}
      <div className="flex border-b border-white/10">
        {(['basics', 'brand', 'publishing'] as Step[]).map((s, i) => (
          <button
            key={s}
            onClick={() => stepIndex > i && setStep(s)}
            className={`flex-1 py-3 text-xs font-medium capitalize transition-colors ${
              step === s
                ? 'text-indigo-300 border-b-2 border-indigo-500'
                : stepIndex > i
                  ? 'text-white/50 hover:text-white cursor-pointer'
                  : 'text-white/20 cursor-default'
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div className="p-8 space-y-5">
        {/* Step 1: Basics */}
        {step === 'basics' && (
          <>
            <div>
              <label className={labelClass}>Company / site name</label>
              <input
                className={inputClass}
                placeholder="Designs on Print"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Domain</label>
              <input
                className={inputClass}
                placeholder="designsonprint.com"
                value={form.domain}
                onChange={(e) => set('domain', e.target.value)}
              />
              <p className="text-xs text-white/20 mt-1">Without https:// or trailing slash</p>
            </div>
          </>
        )}

        {/* Step 2: Brand */}
        {step === 'brand' && (
          <>
            <div>
              <label className={labelClass}>Brand voice</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Friendly, expert, approachable. UK-based. Speak to small business owners who want quality custom print without the jargon."
                value={form.brand_voice}
                onChange={(e) => set('brand_voice', e.target.value)}
              />
              <p className="text-xs text-white/20 mt-1">
                Describe the tone Clem should write in. Be specific.
              </p>
            </div>
            <div>
              <label className={labelClass}>Target audience</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={2}
                placeholder="UK small business owners, event organisers, marketers needing custom print"
                value={form.target_audience}
                onChange={(e) => set('target_audience', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Forbidden words (comma-separated)</label>
              <input
                className={inputClass}
                placeholder="synergy, leverage, utilize, game-changer"
                value={form.forbidden_words}
                onChange={(e) => set('forbidden_words', e.target.value)}
              />
              <p className="text-xs text-white/20 mt-1">Words or phrases Clem must never use</p>
            </div>
          </>
        )}

        {/* Step 3: Publishing */}
        {step === 'publishing' && (
          <>
            <div>
              <label className={labelClass}>Publish cadence</label>
              <div className="flex flex-wrap gap-2">
                {CADENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => set('publish_cadence', opt)}
                    className={`px-4 py-1.5 text-xs rounded-lg border transition-colors ${
                      form.publish_cadence === opt
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                    }`}
                  >
                    {opt === '1pw' ? '1× per week' :
                     opt === '2pw' ? '2× per week' :
                     opt === '3pw' ? '3× per week' :
                     opt === '5pw' ? '5× per week' : 'Daily'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Publish days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OPTIONS.map((day) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-colors ${
                      form.publish_days.includes(day)
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Preferred publish time (local)</label>
              <input
                type="time"
                className={`${inputClass} w-40`}
                value={form.publish_time}
                onChange={(e) => set('publish_time', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Publish / export method</label>
              <div className="space-y-2">
                {CMS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => set('cms_type', opt.value)}
                    className={`w-full flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${
                      form.cms_type === opt.value
                        ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0 ${form.cms_type === opt.value ? 'border-indigo-400 bg-indigo-400' : 'border-white/30'}`} />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-white/40 mt-0.5">{opt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Footer nav */}
      <div className="px-8 pb-8 flex justify-between">
        <button
          onClick={() => setStep(STEPS[stepIndex - 1])}
          disabled={stepIndex === 0}
          className="px-4 py-2 text-sm text-white/40 hover:text-white disabled:opacity-0 transition-colors"
        >
          ← Back
        </button>

        {step !== 'publishing' ? (
          <button
            onClick={() => setStep(STEPS[stepIndex + 1])}
            disabled={step === 'basics' && (!form.name || !form.domain)}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/30 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 text-white text-sm rounded-lg transition-colors"
          >
            {saving ? 'Creating workspace…' : 'Create workspace →'}
          </button>
        )}
      </div>
    </div>
  )
}
