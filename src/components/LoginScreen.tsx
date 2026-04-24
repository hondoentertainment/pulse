import { useState } from 'react'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lightning, EnvelopeSimple } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export function LoginScreen() {
  const { signIn } = useSupabaseAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authMode, setAuthMode] = useState<'options' | 'email'>('options')

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Please enter email and password')
    
    setLoading(true)
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) toast.error(error.message)
      else toast.success('Check your email for the confirmation link!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) toast.error(error.message)
      // On success, the session listener in useSupabaseAuth will trigger re-render
    }
    setLoading(false)
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    })
    if (error) toast.error(error.message)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <motion.div
           initial={{ scale: 0 }}
           animate={{ scale: 1 }}
           className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center shadow-lg shadow-primary/30"
        >
          <Lightning size={40} weight="fill" className="text-white" />
        </motion.div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Pulse</h1>
          <p className="text-muted-foreground">Discover the city's live energy.</p>
        </div>

        <AnimatePresence mode="wait">
          {authMode === 'options' ? (
            <motion.div key="options" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4 pt-4">
              <Button size="lg" className="w-full bg-white text-black hover:bg-gray-100" onClick={() => handleOAuth('google')}>
                Continue with Google
              </Button>
              <Button size="lg" variant="outline" className="w-full" onClick={() => handleOAuth('apple')}>
                Continue with Apple
              </Button>
              <Button size="lg" variant="ghost" className="w-full" onClick={() => signIn()}>
                Continue as Guest
              </Button>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border"></span></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
              </div>
              <Button size="lg" variant="secondary" className="w-full" onClick={() => setAuthMode('email')}>
                <EnvelopeSimple size={20} className="mr-2" /> Continue with Email
              </Button>
            </motion.div>
          ) : (
            <motion.div key="email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 pt-4 text-left">
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
                </Button>
              </form>
              <div className="text-center text-sm pt-2">
                <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:underline">
                  {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
                </button>
              </div>
              <Button variant="ghost" className="w-full mt-2" onClick={() => setAuthMode('options')}>Back</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
