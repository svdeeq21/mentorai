// FILE: frontend/src/components/Navbar.tsx
'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon, User, LogOut, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface NavbarProps {
  backHref?: string
  title?: string
}

export default function Navbar({ backHref, title }: NavbarProps) {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      className="px-6 py-3 flex items-center justify-between sticky top-0 z-20">

      <div className="flex items-center gap-3">
        {backHref && (
          <Link href={backHref}
            className="p-2 rounded-lg cursor-pointer transition-all"
            style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--border)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text2)'
            }}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}
        {title ? (
          <span className="font-syne font-bold text-sm" style={{ color: 'var(--text)' }}>{title}</span>
        ) : (
          <Link href="/dashboard" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-7 h-7 rounded-full flex items-center justify-center font-syne font-black text-xs text-black transition-transform group-hover:scale-110"
              style={{ background: 'var(--orange)' }}>M</div>
            <span className="font-syne font-bold transition-opacity group-hover:opacity-80" style={{ color: 'var(--text)' }}>MentorAI</span>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2">

        {/* Theme toggle */}
        <button onClick={toggleTheme} cursor-pointer
          className="p-2 rounded-lg transition-all cursor-pointer"
          style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--orange)'
            ;(e.currentTarget as HTMLElement).style.color = '#000'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--orange)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--text2)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
          }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {user && (
          <>
            {/* Profile */}
            <Link href="/profile"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--orange-bg)'
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--orange-border)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--orange)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--text2)'
              }}>
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{user.email?.split('@')[0]}</span>
            </Link>

            {/* Sign out */}
            <button onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'
                ;(e.currentTarget as HTMLElement).style.borderColor = '#ef444466'
                ;(e.currentTarget as HTMLElement).style.color = '#ef4444'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--text2)'
              }}
              title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </>
        )}
      </div>
    </header>
  )
}