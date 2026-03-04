'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { sendMessage, getDocuments, getDocumentSummary, Document } from '@/lib/api'
import { ArrowLeft, Send, Loader2, FileText, Bot, User, BookOpen, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
  answer_type?: string
  model?: string
}

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return (
          <h2 key={i} className="font-syne font-bold text-base text-white mt-5 mb-2 first:mt-0">
            {line.slice(3)}
          </h2>
        )
        if (line.startsWith('- ') || line.startsWith('• ')) return (
          <div key={i} className="flex gap-2 mb-1">
            <span className="text-orange-500 flex-shrink-0 mt-0.5">•</span>
            <span className="text-neutral-300 text-sm leading-relaxed">{line.slice(2)}</span>
          </div>
        )
        if (line.trim() === '') return <div key={i} className="h-1" />
        return <p key={i} className="text-neutral-300 text-sm leading-relaxed">{line}</p>
      })}
    </div>
  )
}

export default function StudyPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const docId  = params.id as string

  const [doc, setDoc]                   = useState<Document | null>(null)
  const [messages, setMessages]         = useState<Message[]>([])
  const [query, setQuery]               = useState('')
  const [thinking, setThinking]         = useState(false)
  const [summary, setSummary]           = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const chatRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || !docId) return

    getDocuments().then(docs => {
      const found = docs.find(d => d.id === docId)
      if (!found) { router.replace('/dashboard'); return }
      setDoc(found)
    })

    setSummaryLoading(true)
    getDocumentSummary(docId)
      .then(({ summary }) => { setSummary(summary); setSummaryLoading(false) })
      .catch(e => { setSummaryError(e.response?.data?.detail || 'Failed to generate summary'); setSummaryLoading(false) })
  }, [user, docId, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const handleSend = async () => {
    if (!query.trim() || thinking) return
    const q = query.trim()
    setQuery('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setThinking(true)
    chatRef.current?.scrollIntoView({ behavior: 'smooth' })
    try {
      const result = await sendMessage('document', docId, q)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.answer,
        answer_type: result.answer_type,
        model: result.model,
      }])
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${e.response?.data?.detail || 'Something went wrong.'}`,
        answer_type: 'error',
      }])
    } finally {
      setThinking(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const regenSummary = () => {
    setSummary(null); setSummaryLoading(true); setSummaryError('')
    getDocumentSummary(docId)
      .then(({ summary }) => { setSummary(summary); setSummaryLoading(false) })
      .catch(e => { setSummaryError(e.response?.data?.detail || 'Failed'); setSummaryLoading(false) })
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-4 py-3 flex items-center gap-3 sticky top-0 bg-[#0f0f0f] z-10">
        <Link href="/dashboard" className="p-1.5 text-neutral-500 hover:text-white transition-colors rounded-lg">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <span className="text-sm font-medium text-white truncate">{doc?.name || 'Loading...'}</span>
        </div>
        <div className="ml-auto w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center font-syne font-black text-xs text-black">M</div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">

        {/* Summary */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-orange-500" />
              <h2 className="font-syne font-bold text-lg text-white">Document Summary</h2>
            </div>
            {summary && (
              <button onClick={regenSummary} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors">
                <RefreshCw className="w-3 h-3" />
                Regenerate
              </button>
            )}
          </div>

          {summaryLoading ? (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                <span className="text-sm text-neutral-400">Reading your document...</span>
              </div>
              <div className="space-y-2">
                {[80, 60, 90, 70, 50].map((w, i) => (
                  <div key={i} className="h-3 bg-[#2a2a2a] rounded animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
          ) : summaryError ? (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-5 text-sm text-red-300">
              {summaryError}
              <button onClick={regenSummary} className="block mt-2 text-orange-400 hover:text-orange-300 transition-colors underline text-xs">Try again</button>
            </div>
          ) : summary ? (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
              <Markdown text={summary} />
            </div>
          ) : null}
        </section>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#2a2a2a]" />
          <span className="text-xs text-neutral-600 font-medium px-2">ASK ANYTHING</span>
          <div className="flex-1 h-px bg-[#2a2a2a]" />
        </div>

        {/* Chat */}
        <section ref={chatRef}>
          <div className="flex items-center gap-2 mb-6">
            <Bot className="w-4 h-4 text-orange-500" />
            <h2 className="font-syne font-bold text-lg text-white">Chat with this document</h2>
          </div>

          {messages.length === 0 && (
            <div className="text-center py-8 text-neutral-600 text-sm">
              Ask a question about the document above ↓
            </div>
          )}

          <div className="space-y-5 mb-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                  ${msg.role === 'user' ? 'bg-[#2a2a2a]' : 'bg-orange-500/20 border border-orange-500/30'}`}>
                  {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-neutral-400" /> : <Bot className="w-3.5 h-3.5 text-orange-400" />}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-orange-500 text-black font-medium rounded-tr-sm'
                    : 'bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-100 rounded-tl-sm'}`}>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  {msg.role === 'assistant' && msg.model && (
                    <div className="text-xs text-neutral-600 mt-2 pt-2 border-t border-[#2a2a2a]">
                      {msg.answer_type === 'general' ? '⚠️ General knowledge · ' : '📄 From document · '}{msg.model}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-3">
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a question about this document..."
              rows={1}
              className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500 transition-colors resize-none"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!query.trim() || thinking}
              className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded-xl px-4 transition-colors flex-shrink-0"
            >
              {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-center text-xs text-neutral-700 mt-2">Enter to send · Shift+Enter for new line</p>
        </section>

        <div className="h-10" />
      </main>
    </div>
  )
}
