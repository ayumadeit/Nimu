import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, Mail, ArrowRight, Sparkles } from 'lucide-react'
import { apiRequest, setAccessToken } from '../lib/api'
import { useStore } from '../store'

interface LoginProps {
  onSwitchToRegister: () => void
  onGuestContinue: () => void
}

export default function Login({ onSwitchToRegister, onGuestContinue }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { set, toast } = useStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      setAccessToken(data.accessToken)
      set({
        currentUser: data.user,
        welcomed: true,
      })
      toast('Welcome back to your little space!')
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please verify your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-8 text-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 14 }}
        className="card w-full max-w-md p-8 text-left shadow-lift"
      >
        <div className="text-center">
          <img src="/nimu-logo.png" alt="Nimu" className="mx-auto h-20 w-20 rounded-2xl shadow-soft" />
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Sign in to Nimu</h1>
          <p className="font-hand mt-1 text-xl opacity-75">Welcome back to your cozy space.</p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-accent/15 p-3 text-xs font-bold text-accent">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider opacity-60">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border bg-surface/50 py-2.5 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider opacity-60">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border bg-surface/50 py-2.5 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary mt-2 flex items-center justify-center gap-2 !py-3 text-sm font-bold"
          >
            {loading ? 'Opening the door...' : 'Sign In'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="mt-6 border-t pt-4 text-center text-xs">
          <p className="opacity-70">
            Don't have an account yet?{' '}
            <button onClick={onSwitchToRegister} className="font-bold text-primary hover:underline">
              Create an account
            </button>
          </p>

          <button
            onClick={onGuestContinue}
            className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold opacity-60 hover:opacity-100 mx-auto"
          >
            <Sparkles size={14} /> Continue offline / guest mode
          </button>
        </div>
      </motion.div>
    </div>
  )
}
