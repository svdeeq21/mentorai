// FILE: frontend/src/app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AlertCircle, Info } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('credentials')) {
        setError('Incorrect email or password. If you used the old app, use "Forgot password" to reset.')
      } else if (error.message.toLowerCase().includes('confirm') || error.message.toLowerCase().includes('verified')) {
        setError('Please verify your email first — check your inbox for a confirmation link.')
      } else if (error.message.toLowerCase().includes('email not confirmed')) {
        setError('Your email is not confirmed. Check your inbox or use "Forgot password" to resend.')
      } else {
        setError(error.message)
      }
      setLoading(false)
    } else {
      router.replace('/dashboard')
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email address above first, then click Forgot password.')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full flex items-center justify-center font-syne font-black text-xl text-black mx-auto mb-3"
            style={{ background: 'var(--orange)' }}>M</div>
          <div className="font-syne font-black text-lg" style={{ color: 'var(--text)' }}>MentorAI</div>
        </div>

        <h1 className="font-syne font-black text-2xl text-center mb-1" style={{ color: 'var(--text)' }}>
          Welcome back
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: 'var(--text3)' }}>
          Sign in to your account
        </p>

        {/* Notice for old Streamlit users */}
        <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2 mb-5"
          style={{ background: 'var(--orange-bg)', border: '1px solid var(--orange-border)', color: 'var(--text2)' }}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--orange)' }} />
          <span>Used the old app? Enter your email and click <strong>Forgot password</strong> to set a new password.</span>
        </div>

        {/* Success state */}
        {resetSent && (
          <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2 mb-5"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Password reset email sent! Check your inbox.
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2 mb-5"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm block mb-1" style={{ color: 'var(--text2)' }}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                colorScheme: 'inherit',
              }}
            />
          </div>

          <div>
            <label className="text-sm block mb-1" style={{ color: 'var(--text2)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              required
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                colorScheme: 'inherit',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold py-2.5 rounded-xl transition-opacity hover:opacity-85 disabled:opacity-50 text-sm text-black"
            style={{ background: 'var(--orange)' }}>
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>
        </form>

        <div className="flex gap-3 mt-4">
          <Link href="/signup"
            className="flex-1 text-center text-sm py-2.5 rounded-xl transition-opacity hover:opacity-70"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
            Create account
          </Link>
          <button
            onClick={handleForgotPassword}
            disabled={loading}
            className="flex-1 text-center text-sm py-2.5 rounded-xl transition-opacity hover:opacity-70 disabled:opacity-50"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
            Forgot password
          </button>
        </div>

      </div>
    </div>
  )
}