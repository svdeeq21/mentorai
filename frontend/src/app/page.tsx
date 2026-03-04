// FILE: frontend/src/app/page.tsx
'use client'

import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon, Upload, MessageSquare, Zap, BookOpen, ArrowRight, FileText, Brain, Shield } from 'lucide-react'

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)' }} className="min-h-screen">

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }} className="px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-syne font-black text-sm text-black"
            style={{ background: 'var(--orange)' }}>M</div>
          <span className="font-syne font-bold text-lg" style={{ color: 'var(--text)' }}>MentorAI</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme}
            style={{ color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)' }}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Link href="/login"
            style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}
            className="px-4 py-2 rounded-lg text-sm hover:opacity-70 transition-opacity">
            Sign in
          </Link>
          <Link href="/signup"
            className="px-4 py-2 rounded-lg text-sm font-medium text-black transition-opacity hover:opacity-85"
            style={{ background: 'var(--orange)' }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8"
          style={{ background: 'var(--orange-bg)', border: '1px solid var(--orange-border)', color: 'var(--orange)' }}>
          <Zap className="w-3 h-3" />
          AI-powered document learning
        </div>

        <h1 className="font-syne font-black text-5xl sm:text-7xl leading-tight mb-6">
          Stop reading.<br />
          <span style={{ color: 'var(--orange)' }}>Start asking.</span>
        </h1>

        <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: 'var(--text2)' }}>
          Upload any document — PDF, Word, slides, spreadsheets — and have a real conversation with it. Get summaries, answers, and insights in seconds.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/signup"
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-black transition-all hover:opacity-85 hover:scale-105"
            style={{ background: 'var(--orange)' }}>
            Start for free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/login"
            style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}
            className="px-6 py-3 rounded-xl text-sm hover:opacity-70 transition-opacity">
            Already have an account
          </Link>
        </div>

        <p className="text-xs mt-4" style={{ color: 'var(--text3)' }}>
          No credit card required · 3 documents free forever
        </p>
      </section>

      {/* Feature strip */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Upload, title: 'Upload anything', desc: 'PDF, Word, PowerPoint, Excel, CSV, images — we handle it all.' },
            { icon: Brain,  title: 'AI understands it', desc: 'Your document is indexed and ready to answer questions instantly.' },
            { icon: MessageSquare, title: 'Chat naturally', desc: 'Ask anything. Get precise answers with page references.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              className="rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'var(--orange-bg)' }}>
                <Icon className="w-5 h-5" style={{ color: 'var(--orange)' }} />
              </div>
              <h3 className="font-syne font-bold text-base mb-2" style={{ color: 'var(--text)' }}>{title}</h3>
              <p className="text-sm" style={{ color: 'var(--text2)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="font-syne font-black text-3xl text-center mb-12" style={{ color: 'var(--text)' }}>
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {[
            { n: '01', title: 'Create account', desc: 'Sign up free in 30 seconds.' },
            { n: '02', title: 'Upload document', desc: 'Drop any file up to 300 pages.' },
            { n: '03', title: 'Get summary', desc: 'AI reads and summarises it for you.' },
            { n: '04', title: 'Ask questions', desc: 'Chat and get instant cited answers.' },
          ].map(step => (
            <div key={step.n} className="text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-syne font-black text-lg mx-auto mb-4"
                style={{ background: 'var(--surface2)', color: 'var(--orange)', border: '1px solid var(--border)' }}>
                {step.n}
              </div>
              <h3 className="font-syne font-bold mb-1" style={{ color: 'var(--text)' }}>{step.title}</h3>
              <p className="text-sm" style={{ color: 'var(--text2)' }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported formats */}
      <section className="max-w-5xl mx-auto px-6 pb-24 text-center">
        <p className="text-sm mb-4" style={{ color: 'var(--text3)' }}>Works with</p>
        <div className="flex flex-wrap justify-center gap-3">
          {['PDF', 'Word', 'PowerPoint', 'Excel', 'CSV', 'TXT', 'Images'].map(f => (
            <span key={f} className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
              {f}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 pb-24 text-center">
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          className="rounded-3xl p-12">
          <h2 className="font-syne font-black text-4xl mb-4" style={{ color: 'var(--text)' }}>
            Ready to study smarter?
          </h2>
          <p className="mb-8 text-sm" style={{ color: 'var(--text2)' }}>
            Join students and professionals who read less and learn more.
          </p>
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-medium text-black hover:opacity-85 transition-all hover:scale-105"
            style={{ background: 'var(--orange)' }}>
            Start free today
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer with developer credit */}
      <footer style={{ borderTop: '1px solid var(--border)' }} className="px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center font-syne font-black text-xs text-black"
              style={{ background: 'var(--orange)' }}>M</div>
            <span className="text-sm font-syne font-bold" style={{ color: 'var(--text)' }}>MentorAI</span>
            <span className="text-xs ml-2" style={{ color: 'var(--text3)' }}>© {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Link href="/login"
              className="px-4 py-1.5 rounded-lg font-medium transition-all cursor-pointer"
              style={{ color: 'var(--text2)', border: '1px solid var(--border)', background: 'var(--surface)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--orange-border)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--orange)'
                ;(e.currentTarget as HTMLElement).style.background = 'var(--orange-bg)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--text2)'
                ;(e.currentTarget as HTMLElement).style.background = 'var(--surface)'
              }}>Sign in</Link>
            <Link href="/signup"
              className="px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
              style={{ color: '#000', background: 'var(--orange)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}>Sign up</Link>
            <a href="https://YOUR_WEBSITE_HERE.com" target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1"
              style={{ color: 'var(--text3)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text3)' }}>
              Built by <span className="font-medium ml-1" style={{ color: 'inherit' }}>Sadiq Shehu</span>
            </a>
          </div>
        </div>
      </footer>

    </div>
  )
}