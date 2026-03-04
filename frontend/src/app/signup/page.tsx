// FILE: frontend/src/app/signup/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AlertCircle, CheckCircle } from 'lucide-react'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) { setError(error.message) }
    else { setSuccess('Account created! Check your email to verify, then sign in.') }
    setLoading(false)
  }

  const inputStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    colorScheme: 'inherit' as const,
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
          Create your account
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: 'var(--text3)' }}>
          Free forever · No credit card needed
        </p>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2 mb-4"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}
        {success && (
          <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2 mb-4"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{success}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          {[
            { label: 'Full name',        type: 'text',     value: fullName,  set: setFullName,  ph: 'Your name' },
            { label: 'Email address',    type: 'email',    value: email,     set: setEmail,     ph: 'you@example.com' },
            { label: 'Password',         type: 'password', value: password,  set: setPassword,  ph: 'At least 6 characters' },
            { label: 'Confirm password', type: 'password', value: confirm,   set: setConfirm,   ph: 'Repeat your password' },
          ].map(({ label, type, value, set, ph }) => (
            <div key={label}>
              <label className="text-sm block mb-1" style={{ color: 'var(--text2)' }}>{label}</label>
              <input
                type={type}
                value={value}
                onChange={e => set(e.target.value)}
                placeholder={ph}
                required
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                style={inputStyle}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold py-2.5 rounded-xl transition-opacity hover:opacity-85 disabled:opacity-50 text-sm text-black"
            style={{ background: 'var(--orange)' }}>
            {loading ? 'Creating account...' : 'Create account →'}
          </button>
        </form>

        <Link href="/login"
          className="block text-center mt-4 text-sm py-2.5 rounded-xl transition-opacity hover:opacity-70"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
          ← Back to sign in
        </Link>

      </div>
    </div>
  )
}