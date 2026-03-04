// FILE: frontend/src/app/auth/callback/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2 } from 'lucide-react'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Exchange the code/token in the URL for a session, then clean the URL
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard')
      } else {
        // Try exchanging hash fragment
        const hash = window.location.hash
        if (hash) {
          supabase.auth.refreshSession().then(() => {
            router.replace('/dashboard')
          }).catch(() => router.replace('/login'))
        } else {
          router.replace('/login')
        }
      }
    })
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
      <p className="text-sm text-neutral-500">Verifying your account...</p>
    </div>
  )
}