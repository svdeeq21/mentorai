'use client'
// FILE: frontend/src/app/profile/page.tsx

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getUsage, getBillingStatus, initPayment, cancelSubscription } from '@/lib/api'
import {
  User, CreditCard, Zap, Shield, CheckCircle, Loader2,
  Crown, ExternalLink, FileText, MessageSquare,
  Brain, FolderOpen, Trophy,
} from 'lucide-react'
import Navbar from '@/components/Navbar'

const PLANS = [
  {
    id: 'free', name: 'Free', price: '$0', period: 'forever',
    features: ['3 documents', '50 pages max per doc', '20 chats per day', 'Standard AI model'],
  },
  {
    id: 'pro', name: 'Pro', price: '$12', period: 'per month', badge: 'Most Popular',
    features: ['Unlimited documents', '300 pages per doc', 'Unlimited chats', 'Priority AI model'],
  },
  {
    id: 'team', name: 'Team', price: '$29', period: 'per month',
    features: ['Everything in Pro', '5 team seats', 'Shared collections', 'Dedicated support'],
  },
]

function UsageStat({ icon, label, value, limit }: {
  icon: React.ReactNode; label: string; value: number; limit: number | null
}) {
  const pct       = limit ? Math.min((value / limit) * 100, 100) : 0
  const nearLimit = limit ? value >= limit * 0.8 : false
  return (
    <div className="rounded-xl p-4 space-y-2"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--orange)' }}>{icon}</span>
          <span className="text-xs" style={{ color: 'var(--text3)' }}>{label}</span>
        </div>
        <span className="font-syne font-bold text-sm"
          style={{ color: nearLimit ? '#ef4444' : 'var(--text)' }}>
          {value}{limit ? ` / ${limit}` : ''}
        </span>
      </div>
      {limit ? (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct >= 80 ? '#ef4444' : 'var(--orange)' }} />
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--orange)' }}>Unlimited</p>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [usage,       setUsage]       = useState<any>(null)
  const [billing,     setBilling]     = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [upgrading,   setUpgrading]   = useState<string | null>(null)
  const [cancelling,  setCancelling]  = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    Promise.all([
      getUsage().catch(() => null),
      getBillingStatus().catch(() => ({ plan: 'free', status: 'none' })),
    ]).then(([u, b]) => { setUsage(u); setBilling(b) })
      .finally(() => setDataLoading(false))
  }, [user])

  const handleUpgrade = async (planId: string) => {
    if (planId === 'free') return
    setUpgrading(planId)
    try {
      const { payment_link } = await initPayment(planId)
      window.location.href = payment_link
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Payment failed. Please try again.')
    } finally { setUpgrading(null) }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to Pro features at the end of your billing period.')) return
    setCancelling(true)
    try {
      await cancelSubscription()
      setBilling({ plan: 'free', status: 'cancelled' })
      setUsage((prev: any) => prev ? { ...prev, plan: 'free' } : prev)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to cancel. Please contact support.')
    } finally { setCancelling(false) }
  }

  const plan     = usage?.plan || billing?.plan || 'free'
  const isActive = billing?.status === 'active'
  const limits   = usage?.limits || { documents: 3, chats_per_day: 20, pages_per_doc: 50 }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--orange)' }} />
    </div>
  )

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar backHref="/dashboard" title="Profile & Usage" />
      <main className="max-w-2xl mx-auto px-5 py-8 space-y-8">

        {/* Profile card */}
        <section className="rounded-2xl p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--orange-bg)', border: '1px solid var(--orange-border)' }}>
              <User className="w-6 h-6" style={{ color: 'var(--orange)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-syne font-bold text-lg truncate" style={{ color: 'var(--text)' }}>
                {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              </p>
              <p className="text-sm truncate" style={{ color: 'var(--text3)' }}>{user?.email}</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0"
              style={{ background: 'var(--orange-bg)', border: '1px solid var(--orange-border)' }}>
              {plan === 'free'
                ? <Zap className="w-3 h-3" style={{ color: 'var(--orange)' }} />
                : <Crown className="w-3 h-3" style={{ color: 'var(--orange)' }} />}
              <span className="text-xs font-bold capitalize" style={{ color: 'var(--orange)' }}>{plan}</span>
            </div>
          </div>
          {!dataLoading && plan !== 'free' && (
            <div className="mt-4 pt-4 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text2)' }}>
                {isActive ? '✅ Active subscription' : '⏳ Pending payment'}
              </p>
              <button onClick={handleCancel} disabled={cancelling}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: '#ef4444', border: '1px solid #ef444466', background: 'rgba(239,68,68,0.08)' }}
                onMouseEnter={e => { if (!cancelling) { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.18)' } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)' }}>
                {cancelling ? 'Cancelling...' : 'Cancel plan'}
              </button>
            </div>
          )}
        </section>

        {/* Usage stats */}
        <section>
          <h2 className="font-syne font-bold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Shield className="w-4 h-4" style={{ color: 'var(--orange)' }} /> Usage
          </h2>
          {dataLoading ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text3)' }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Loading stats...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <UsageStat icon={<FileText className="w-3.5 h-3.5" />} label="Documents"
                value={usage?.doc_count ?? 0} limit={limits.documents} />
              <UsageStat icon={<MessageSquare className="w-3.5 h-3.5" />} label="Chats today"
                value={usage?.chats_today ?? 0} limit={limits.chats_per_day} />
              <UsageStat icon={<FolderOpen className="w-3.5 h-3.5" />} label="Collections"
                value={usage?.col_count ?? 0} limit={null} />
              <UsageStat icon={<Brain className="w-3.5 h-3.5" />} label="Quizzes taken"
                value={usage?.quiz_count ?? 0} limit={null} />
            </div>
          )}
          {!dataLoading && usage?.avg_score != null && (
            <div className="mt-3 rounded-xl p-4 flex items-center justify-between"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5" style={{ color: 'var(--orange)' }} />
                <span className="text-xs" style={{ color: 'var(--text3)' }}>Average quiz score</span>
              </div>
              <span className="font-syne font-bold text-sm"
                style={{ color: usage.avg_score >= 70 ? '#22c55e' : usage.avg_score >= 50 ? 'var(--orange)' : '#ef4444' }}>
                {usage.avg_score}%
              </span>
            </div>
          )}
        </section>

        {/* Recent quiz history */}
        {!dataLoading && usage?.quiz_history?.length > 0 && (
          <section>
            <h2 className="font-syne font-bold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Brain className="w-4 h-4" style={{ color: 'var(--orange)' }} /> Recent Quizzes
            </h2>
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {usage.quiz_history.map((q: any, i: number) => (
                <div key={q.id} className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: i < usage.quiz_history.length - 1 ? '1px solid var(--border)' : undefined }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: q.score_pct >= 70 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${q.score_pct >= 70 ? '#22c55e44' : '#ef444444'}`,
                      }}>
                      <span className="text-xs font-bold"
                        style={{ color: q.score_pct >= 70 ? '#22c55e' : '#ef4444' }}>
                        {q.score_pct}%
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize" style={{ color: 'var(--text)' }}>
                        {q.difficulty} quiz
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text3)' }}>
                        {q.score}/{q.total} correct · {new Date(q.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Trophy className="w-3.5 h-3.5"
                    style={{ color: q.score_pct >= 70 ? '#22c55e' : 'var(--text3)' }} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Upgrade nudge for free users near limits */}
        {!dataLoading && plan === 'free' && (usage?.doc_count >= 2 || usage?.chats_today >= 15) && (
          <section className="rounded-2xl p-5"
            style={{ background: 'var(--orange-bg)', border: '1px solid var(--orange-border)' }}>
            <p className="font-syne font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>
              You're getting close to your limits
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--text2)' }}>
              Upgrade to Pro for unlimited documents, chats, and more.
            </p>
            <button onClick={() => handleUpgrade('pro')} disabled={upgrading === 'pro'}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-85 disabled:opacity-50"
              style={{ background: 'var(--orange)', color: '#000' }}>
              {upgrading === 'pro' ? 'Processing...' : 'Upgrade to Pro →'}
            </button>
          </section>
        )}

        {/* Plans */}
        <section>
          <h2 className="font-syne font-bold text-base mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <CreditCard className="w-4 h-4" style={{ color: 'var(--orange)' }} /> Plans
          </h2>
          <div className="space-y-3">
            {PLANS.map(p => {
              const isCurrent = plan === p.id && (p.id === 'free' || isActive)
              return (
                <div key={p.id} className="rounded-2xl p-5 relative"
                  style={{
                    background:    p.id === 'pro' ? 'var(--orange-bg)' : 'var(--surface)',
                    border:        `1px solid ${isCurrent ? 'var(--orange)' : p.id === 'pro' ? 'var(--orange-border)' : 'var(--border)'}`,
                    outline:       isCurrent ? '2px solid var(--orange)' : 'none',
                    outlineOffset: '2px',
                  }}>
                  {p.badge && (
                    <div className="absolute -top-3 left-5">
                      <span className="text-xs font-bold px-3 py-0.5 rounded-full text-black"
                        style={{ background: 'var(--orange)' }}>{p.badge}</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-syne font-bold text-lg" style={{ color: 'var(--text)' }}>{p.name}</h3>
                      <p className="text-xs" style={{ color: 'var(--text3)' }}>{p.period}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-syne font-black text-3xl" style={{ color: 'var(--text)' }}>{p.price}</span>
                      {p.id !== 'free' && <span className="text-sm ml-0.5" style={{ color: 'var(--text3)' }}>/mo</span>}
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-5">
                    {p.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0"
                          style={{ color: p.id === 'pro' ? 'var(--orange)' : 'var(--text3)' }} />
                        <span className="text-sm" style={{ color: 'var(--text2)' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl text-center text-sm"
                      style={{ border: '1px solid var(--border)', color: 'var(--text3)' }}>Current plan</div>
                  ) : p.id === 'free' ? (
                    <div className="w-full py-2.5 rounded-xl text-center text-sm"
                      style={{ border: '1px solid var(--border)', color: 'var(--text3)' }}>Downgrade</div>
                  ) : (
                    <button onClick={() => handleUpgrade(p.id)} disabled={upgrading === p.id}
                      className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-85 disabled:opacity-50"
                      style={{ background: p.id === 'pro' ? 'var(--orange)' : 'var(--surface2)', color: p.id === 'pro' ? '#000' : 'var(--text)' }}>
                      {upgrading === p.id
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                        : `Upgrade to ${p.name}`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Built by */}
        <section className="rounded-2xl p-5"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--text3)' }}>BUILT BY</p>
          <a href="https://YOUR_WEBSITE_HERE.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-70 transition-opacity w-fit">
            <span className="font-syne font-bold" style={{ color: 'var(--text)' }}>YOUR NAME</span>
            <ExternalLink className="w-3.5 h-3.5" style={{ color: 'var(--text3)' }} />
          </a>
        </section>

        <div className="h-8" />
      </main>
    </div>
  )
}