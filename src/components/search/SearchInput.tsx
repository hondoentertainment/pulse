import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  query: string
  onQueryChange: (query: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onClose: () => void
  onClear: () => void
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ query, onQueryChange, onKeyDown, onClose, onClear }, ref) {
    return (
      <div className="flex-shrink-0 px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-4">
          <motion.div
            className="relative flex-1"
            initial={{ scaleX: 0.85, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'left center' }}
          >
            <MagnifyingGlass
              size={22}
              weight="bold"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              ref={ref}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search venues, cities, categories..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={cn(
                'w-full h-13 pl-12 pr-12 rounded-2xl',
                'bg-card/80 border border-border',
                'text-foreground placeholder:text-muted-foreground',
                'text-base font-medium',
                'outline-none transition-all duration-200',
                'focus:ring-2 focus:ring-accent/50 focus:border-accent/40',
                'backdrop-blur-sm',
              )}
            />
            {query && (
              <button
                onClick={onClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-muted/60 hover:bg-muted transition-colors"
              >
                <X size={14} weight="bold" className="text-muted-foreground" />
              </button>
            )}
          </motion.div>

          <motion.button
            onClick={onClose}
            className="flex-shrink-0 px-3 py-2 text-sm font-semibold text-accent hover:text-accent/80 transition-colors"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.2 }}
          >
            Cancel
          </motion.button>
        </div>
      </div>
    )
  },
)
