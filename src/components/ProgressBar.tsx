interface ProgressBarProps {
  /** Number of tracks decided so far. */
  value: number
  total: number
}

export function ProgressBar({ value, total }: ProgressBarProps) {
  const position = Math.min(value + 1, total)
  const pct = total === 0 ? 0 : (value / total) * 100

  return (
    <div className="flex items-center gap-4">
      <div
        className="h-px flex-1 overflow-hidden bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
        aria-label="Playlist progress"
      >
        <div
          className="h-full bg-champagne transition-[width] duration-500 ease-editorial"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-sans text-xs tabular-nums text-muted">
        <span className="text-cream">{String(position).padStart(2, '0')}</span>
        <span className="mx-1 opacity-50">/</span>
        {String(total).padStart(2, '0')}
      </span>
    </div>
  )
}
