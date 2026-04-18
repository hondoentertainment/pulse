import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { Check, Warning, Info, X, Lightning } from '@phosphor-icons/react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'surge'

interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  action?: ToastAction
  duration?: number
}

type ToastInput = Omit<Toast, 'id'>

interface ToastContextValue {
  toast: (input: ToastInput) => string
  dismiss: (id: string) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 3
const DEFAULT_DURATION = 4000
const SWIPE_DISMISS_THRESHOLD = 120

const TOAST_CONFIG: Record<
  ToastType,
  {
    icon: typeof Check
    iconWeight: 'fill' | 'bold'
    containerClass: string
    iconClass: string
    glowClass?: string
  }
> = {
  success: {
    icon: Check,
    iconWeight: 'bold',
    containerClass: 'border-emerald-500/30 bg-emerald-950/80',
    iconClass: 'text-emerald-400 bg-emerald-500/20',
  },
  error: {
    icon: X,
    iconWeight: 'bold',
    containerClass: 'border-red-500/30 bg-red-950/80',
    iconClass: 'text-red-400 bg-red-500/20',
  },
  warning: {
    icon: Warning,
    iconWeight: 'fill',
    containerClass: 'border-amber-500/30 bg-amber-950/80',
    iconClass: 'text-amber-400 bg-amber-500/20',
  },
  info: {
    icon: Info,
    iconWeight: 'fill',
    containerClass: 'border-sky-500/30 bg-sky-950/80',
    iconClass: 'text-sky-400 bg-sky-500/20',
  },
  surge: {
    icon: Lightning,
    iconWeight: 'fill',
    containerClass: 'border-purple-500/40 bg-purple-950/80',
    iconClass: 'text-purple-400 bg-purple-500/20',
    glowClass: 'shadow-[0_0_20px_rgba(168,85,247,0.35)]',
  },
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type Action =
  | { type: 'ADD'; toast: Toast }
  | { type: 'DISMISS'; id: string }

function toastReducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'ADD':
      return [action.toast, ...state]
    case 'DISMISS':
      return state.filter((t) => t.id !== action.id)
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null)

// ---------------------------------------------------------------------------
// useToast hook
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>')
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Individual toast component
// ---------------------------------------------------------------------------

interface ToastItemProps {
  toast: Toast
  index: number
  onDismiss: (id: string) => void
}

function ToastItem({ toast, index, onDismiss }: ToastItemProps) {
  const config = TOAST_CONFIG[toast.type]
  const Icon = config.icon
  const x = useMotionValue(0)
  const opacity = useTransform(x, [0, SWIPE_DISMISS_THRESHOLD], [1, 0])
  const dismissedRef = useRef(false)

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number } }) => {
      if (info.offset.x > SWIPE_DISMISS_THRESHOLD && !dismissedRef.current) {
        dismissedRef.current = true
        onDismiss(toast.id)
      }
    },
    [onDismiss, toast.id],
  )

  return (
    <motion.div
      layout
      initial={{ y: -80, opacity: 0, scale: 0.95 }}
      animate={{
        y: 0,
        opacity: 1,
        scale: 1,
        transition: {
          type: 'spring',
          stiffness: 380,
          damping: 28,
          mass: 0.8,
          delay: index * 0.05,
        },
      }}
      exit={{
        opacity: 0,
        x: 80,
        scale: 0.95,
        transition: { duration: 0.2, ease: 'easeIn' },
      }}
      style={{ x, opacity, top: `${60 + index * 76}px` }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.5 }}
      onDragEnd={handleDragEnd}
      className={[
        'fixed left-4 right-4 z-50 mx-auto max-w-md cursor-grab active:cursor-grabbing',
        'flex items-start gap-3 rounded-xl border px-4 py-3 backdrop-blur-md',
        config.containerClass,
        config.glowClass,
        toast.type === 'surge' ? 'animate-[surge-pulse_2s_ease-in-out_infinite]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      {/* Icon */}
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.iconClass}`}
      >
        <Icon size={16} weight={config.iconWeight} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white leading-snug">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-white/60">{toast.description}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action!.onClick()
              onDismiss(toast.id)
            }}
            className="mt-1.5 text-xs font-semibold text-accent-9 hover:text-accent-11 transition-colors"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="mt-0.5 shrink-0 rounded-md p-1 text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} weight="bold" />
      </button>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, [])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    dispatch({ type: 'DISMISS', id })
  }, [])

  const addToast = useCallback(
    (input: ToastInput): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const newToast: Toast = { ...input, id }

      dispatch({ type: 'ADD', toast: newToast })

      const duration = input.duration ?? DEFAULT_DURATION
      const timer = setTimeout(() => {
        timersRef.current.delete(id)
        dispatch({ type: 'DISMISS', id })
      }, duration)
      timersRef.current.set(id, timer)

      return id
    },
    [],
  )

  const contextValue = useMemo<ToastContextValue>(
    () => ({ toast: addToast, dismiss }),
    [addToast, dismiss],
  )

  const visibleToasts = toasts.slice(0, MAX_VISIBLE)

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Surge pulse keyframe — injected once */}
      <style>{`
        @keyframes surge-pulse {
          0%, 100% { box-shadow: 0 0 15px rgba(168,85,247,0.3); }
          50% { box-shadow: 0 0 30px rgba(168,85,247,0.55), 0 0 60px rgba(168,85,247,0.2); }
        }
      `}</style>

      {/* Toast viewport */}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 top-0 z-50"
      >
        <div className="pointer-events-auto">
          <AnimatePresence mode="popLayout">
            {visibleToasts.map((t, i) => (
              <ToastItem key={t.id} toast={t} index={i} onDismiss={dismiss} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  )
}
