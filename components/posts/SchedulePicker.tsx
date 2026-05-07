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
              ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
              : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30 hover:text-white'
          }`}
        >
          ✦ Let Clem decide
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, mode: 'manual' })}
          className={`flex-1 py-2.5 px-4 rounded-lg border text-sm transition-colors ${
            value.mode === 'manual'
              ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
              : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30 hover:text-white'
          }`}
        >
          📅 Pick a date
        </button>
      </div>

      {value.mode === 'auto' && (
        <p className="text-xs text-white/30">
          Clem will schedule this for the next available slot based on your publish cadence.
        </p>
      )}

      {value.mode === 'manual' && (
        <input
          type="datetime-local"
          value={value.datetime}
          onChange={(e) => onChange({ ...value, datetime: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
      )}
    </div>
  )
}
