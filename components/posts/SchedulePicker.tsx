'use client'

interface Props {
  value: { mode: 'auto' | 'manual'; datetime: string }
  onChange: (value: { mode: 'auto' | 'manual'; datetime: string }) => void
}

export default function SchedulePicker({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange({ ...value, mode: 'auto' })}
          className={`flex-1 py-2.5 px-4 rounded-lg border text-sm transition-colors ${
            value.mode === 'auto'
              ? 'bg-indigo-50 border-indigo-300 text-indigo-600'
              : 'bg-white border-slate-200 text-slate-500 hover:border-white/30 hover:text-slate-900'
          }`}
        >
          ✦ Let Clem decide
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, mode: 'manual' })}
          className={`flex-1 py-2.5 px-4 rounded-lg border text-sm transition-colors ${
            value.mode === 'manual'
              ? 'bg-indigo-50 border-indigo-300 text-indigo-600'
              : 'bg-white border-slate-200 text-slate-500 hover:border-white/30 hover:text-slate-900'
          }`}
        >
          📅 Pick a date
        </button>
      </div>

      {value.mode === 'auto' && (
        <p className="text-xs text-slate-400">
          Clem will schedule this for the next available slot based on your publish cadence.
        </p>
      )}

      {value.mode === 'manual' && (
        <input
          type="datetime-local"
          value={value.datetime}
          onChange={(e) => onChange({ ...value, datetime: e.target.value })}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
        />
      )}
    </div>
  )
}
