import { Heart, Undo2, X } from 'lucide-react'
import type { Decision } from '../state/swipeSession'

interface SwipeButtonsProps {
  onDecide: (decision: Decision) => void
  onUndo: () => void
  disabled?: boolean
  /** Undo stays usable on the done card, so it has its own flag. */
  undoDisabled?: boolean
}

export function SwipeButtons({ onDecide, onUndo, disabled = false, undoDisabled = false }: SwipeButtonsProps) {
  return (
    <div className="flex items-center justify-center gap-8">
      <button
        type="button"
        disabled={undoDisabled}
        onClick={onUndo}
        aria-label="Undo last swipe"
        title="Undo (Z)"
        className="grid size-11 place-items-center rounded-full text-cream/70 transition-all duration-200 hover:bg-raised hover:text-cream active:scale-90 disabled:pointer-events-none disabled:opacity-25"
      >
        <Undo2 size={19} strokeWidth={1.75} />
      </button>
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
      {/* Balances the undo button so skip/keep stay centred. */}
      <span aria-hidden className="size-11" />
    </div>
  )
}
