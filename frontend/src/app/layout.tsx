// FILE: frontend/src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter, Syne } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const syne  = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['400','500','700','800'] })

export const metadata: Metadata = {
  title: 'MentorAI — Study Smarter',
  description: 'Upload any document and chat with it using AI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${syne.variable}`}>
      <body className="antialiased" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}