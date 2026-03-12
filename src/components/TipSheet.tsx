import { useState } from 'react'
import { PLATFORM_FEE_RATE } from '@/lib/creator-economy'
import {
  CurrencyDollar,
  X,
  PaperPlaneTilt,
  Heart,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface TipSheetProps {
  open: boolean
  onClose: () => void
  creatorUsername: string
  onSendTip: (amount: number, message?: string) => void
}

const PRESET_AMOUNTS = [1, 3, 5, 10]

export function TipSheet({
  open,
  onClose,
  creatorUsername,
  onSendTip,
}: TipSheetProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [message, setMessage] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const amount = isCustom ? parseFloat(customAmount) || 0 : selectedAmount ?? 0
  const platformFee = Math.round(amount * PLATFORM_FEE_RATE * 100) / 100
  const total = Math.round((amount + platformFee) * 100) / 100
  const isValid = amount >= 1

  const handleSend = () => {
    if (!isValid) return
    setConfirmed(true)
    onSendTip(amount, message || undefined)
    setTimeout(() => {
      setConfirmed(false)
      setSelectedAmount(null)
      setCustomAmount('')
      setMessage('')
      setIsCustom(false)
      onClose()
    }, 1500)
  }

  const handleSelectPreset = (amt: number) => {
    setIsCustom(false)
    setSelectedAmount(amt)
  }

  const handleCustom = () => {
    setIsCustom(true)
    setSelectedAmount(null)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl max-h-[85vh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {confirmed ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-6 py-12 text-center space-y-3"
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                  <Heart size={32} weight="fill" className="text-green-400" />
                </div>
                <p className="text-lg font-bold">Tip Sent!</p>
                <p className="text-sm text-muted-foreground">
                  ${amount.toFixed(2)} sent to {creatorUsername}
                </p>
              </motion.div>
            ) : (
              <div className="px-6 py-4 space-y-5 pb-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CurrencyDollar size={24} weight="fill" className="text-green-400" />
                    <div>
                      <h2 className="font-bold text-lg">Tip {creatorUsername}</h2>
                      <p className="text-xs text-muted-foreground">
                        Show your appreciation for great content
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-muted rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Preset Amounts */}
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AMOUNTS.map(amt => (
                    <motion.button
                      key={amt}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSelectPreset(amt)}
                      className={`py-3 rounded-xl text-center font-bold text-lg transition-colors ${
                        !isCustom && selectedAmount === amt
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                          : 'bg-muted hover:bg-muted/80 text-foreground'
                      }`}
                    >
                      ${amt}
                    </motion.button>
                  ))}
                </div>

                {/* Custom Amount */}
                <div>
                  <button
                    onClick={handleCustom}
                    className={`w-full text-left text-sm font-medium mb-2 ${
                      isCustom ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    Custom amount
                  </button>
                  {isCustom && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="relative"
                    >
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="0.50"
                        placeholder="Enter amount"
                        value={customAmount}
                        onChange={e => setCustomAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-3 bg-muted rounded-xl border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        autoFocus
                      />
                    </motion.div>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Add a message (optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Great pulse! Keep it up..."
                    maxLength={140}
                    rows={2}
                    className="w-full px-4 py-3 bg-muted rounded-xl border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none text-sm"
                  />
                </div>

                {/* Total */}
                {isValid && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-muted rounded-xl p-4 space-y-2 text-sm"
                  >
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tip amount</span>
                      <span>${amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Platform fee ({(PLATFORM_FEE_RATE * 100).toFixed(0)}%)
                      </span>
                      <span>${platformFee.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span className="text-green-400">${total.toFixed(2)}</span>
                    </div>
                  </motion.div>
                )}

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={!isValid}
                  className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
                    isValid
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  <PaperPlaneTilt size={20} weight="fill" />
                  {isValid
                    ? `Send $${total.toFixed(2)} Tip`
                    : 'Select an amount'}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
