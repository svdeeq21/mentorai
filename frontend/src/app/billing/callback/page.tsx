'use client'
// FILE: frontend/src/app/billing/callback/page.tsx

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { verifyPayment } from '@/lib/api'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function BillingCallbackPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<'loading' | 'success' | 'failed'>('loading')
  const [plan,  setPlan]  = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const transaction_id = searchParams.get('transaction_id') || ''
    const tx_ref         = searchParams.get('tx_ref')         || ''
    const status         = searchParams.get('status')         || ''

    if (!transaction_id || !tx_ref) {
      setState('failed')
      setError('Missing payment details. Please contact support.')
      return
    }

    verifyPayment(transaction_id, tx_ref, status)
      .then(res => {
        if (res.status === 'active') {
          setPlan(res.plan)
          setState('success')
          // redirect to profile after 3 seconds
          setTimeout(() => router.replace('/profile'), 3000)
        } else {
          setState('failed')
          setError(`Payment status: ${res.status}`)
        }
      })
      .catch(e => {
        setState('failed')
        setError(e.response?.data?.detail || 'Payment verification failed.')
      })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}>
      <div className="max-w-sm w-full rounded-2xl p-8 text-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        {state === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4"
              style={{ color: 'var(--orange)' }} />
            <p className="font-syne font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>
              Verifying payment...
            </p>
            <p className="text-sm" style={{ color: 'var(--text3)' }}>
              Please wait, do not close this page.
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid #22c55e' }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: '#22c55e' }} />
            </div>
            <p className="font-syne font-bold text-xl mb-2" style={{ color: 'var(--text)' }}>
              You're on {plan.charAt(0).toUpperCase() + plan.slice(1)}! 🎉
            </p>
            <p className="text-sm mb-6" style={{ color: 'var(--text3)' }}>
              Your subscription is now active. Redirecting to your profile...
            </p>
            <Link href="/profile"
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'var(--orange)', color: '#000' }}>
              Go to Profile
            </Link>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid #ef4444' }}>
              <XCircle className="w-8 h-8" style={{ color: '#ef4444' }} />
            </div>
            <p className="font-syne font-bold text-xl mb-2" style={{ color: 'var(--text)' }}>
              Payment Failed
            </p>
            <p className="text-sm mb-6" style={{ color: 'var(--text3)' }}>
              {error || 'Something went wrong. Please try again or contact support.'}
            </p>
            <Link href="/profile"
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              Back to Profile
            </Link>
          </>
        )}

      </div>
    </div>
  )
}