import { Heart, X } from 'lucide-react'
import type { Decision } from '../state/swipeSession'

interface SwipeButtonsProps {
  onDecide: (decision: Decision) => void
  disabled?: boolean
}

export function SwipeButtons({ onDecide, disabled = false }: SwipeButtonsProps) {
  return (
    <div className="flex items-center justify-center gap-10">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDecide('skip')}
        aria-label="Skip track"
        className="grid size-16 place-items-center rounded-full border border-cream/20 text-cream/80 transition-all duration-200 hover:border-cream/50 hover:text-cream active:scale-90 disabled:pointer-events-none disabled:opacity-30"
      >
        <X size={26} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDecide('keep')}
        aria-label="Keep track"
        className="grid size-16 place-items-center rounded-full bg-champagne text-ink shadow-[0_10px_40px_-10px_rgb(216_194_157/0.6)] transition-all duration-200 hover:bg-cream active:scale-90 disabled:pointer-events-none disabled:opacity-30"
      >
        <Heart size={24} strokeWidth={1.75} fill="currentColor" />
      </button>
    </div>
  )
}
