// FILE: frontend/src/app/reset/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ResetPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center
                          justify-center font-syne font-black text-xl text-black
                          mx-auto mb-3">
            M
          </div>
          <div className="font-syne font-black text-lg text-white">MentorAI</div>
        </div>

        <h1 className="font-syne font-black text-2xl text-center mb-1">
          Reset password
        </h1>
        <p className="text-sm text-neutral-400 text-center mb-6">
          We'll send you a reset link
        </p>

        {sent ? (
          <div className="bg-green-500/10 border border-green-500/25 rounded-xl
                          px-4 py-4 text-sm text-green-300 text-center">
            ✓ Check your email for the reset link.
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-lg
                              px-4 py-3 text-sm text-red-300 mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="text-sm text-neutral-400 block mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg
                             px-4 py-2.5 text-sm text-white placeholder-neutral-600
                             focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50
                           text-black font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {loading ? 'Sending...' : 'Send reset link →'}
              </button>
            </form>
          </>
        )}

        <Link
          href="/login"
          className="block text-center mt-4 bg-[#1a1a1a] border border-[#2a2a2a]
                     hover:border-neutral-500 text-neutral-400 hover:text-white
                     text-sm py-2.5 rounded-lg transition-colors"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  )
}