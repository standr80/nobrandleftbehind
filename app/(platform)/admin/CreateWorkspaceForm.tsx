'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateWorkspaceForm() {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [brandVoice, setBrandVoice] = useState('')
  const [cadence, setCadence] = useState('2pw')

  async function create() {
    if (!name.trim() || !domain.trim() || !adminEmail.trim()) {
      setError('Name, domain and admin email are required')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          domain: domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
          adminEmail: adminEmail.trim(),
          brand_voice: brandVoice.trim() || null,
          publish_cadence: cadence,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create workspace')

      if (data.invited) {
        setSuccess(`Workspace created. An invite has been sent to ${adminEmail}.`)
      } else {
        setSuccess(`Workspace created and ${adminEmail} added as admin.`)
      }
      setName(''); setDomain(''); setAdminEmail(''); setBrandVoice('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors'
  const labelClass = 'block text-xs text-white/50 mb-1.5'

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setSuccess('') }}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl transition-colors font-medium"
      >
        + Create workspace
      </button>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-white">Create new workspace</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-white/30 hover:text-white text-lg transition-colors leading-none"
        >
          ✕
        </button>
      </div>

      {success ? (
        <div className="text-center py-4">
          <p className="text-sm text-emerald-400 font-medium">✓ {success}</p>
          <button
            onClick={() => { setSuccess(''); setOpen(false) }}
            className="mt-4 text-xs text-white/40 hover:text-white transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Workspace name</label>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Designs on Print" />
            </div>
            <div>
              <label className={labelClass}>Domain</label>
              <input className={inputClass} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="designsonprint.com" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Admin email</label>
            <input
              type="email"
              className={inputClass}
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@designsonprint.com"
            />
            <p className="text-xs text-white/30 mt-1">
              If this user already has a Clem account they&apos;ll be added directly; otherwise an invite will be sent.
            </p>
          </div>

          <div>
            <label className={labelClass}>Publish cadence (optional)</label>
            <div className="flex flex-wrap gap-2">
              {['1pw', '2pw', '3pw', '5pw', 'daily'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setCadence(opt)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    cadence === opt
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  {opt === '1pw' ? '1×/wk' : opt === '2pw' ? '2×/wk' : opt === '3pw' ? '3×/wk' : opt === '5pw' ? '5×/wk' : 'Daily'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Brand voice (optional)</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              placeholder="Friendly expert tone, UK audience…"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={create}
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-xl transition-colors font-medium"
            >
              {saving ? 'Creating…' : 'Create workspace'}
            </button>
            <button
              onClick={() => { setOpen(false); setError('') }}
              className="px-5 py-2.5 text-sm text-white/40 hover:text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
