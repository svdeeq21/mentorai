// FILE: frontend/src/components/StudyPage.tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import {
  sendMessage, getChatHistory, clearChatHistory, getDocumentSummary,
  getCollection, ChatMessage, ChatSource
} from '@/lib/api'
import {
  Send, Loader2, BookOpen, MessageSquare, Trash2, FileText, Brain,
  FolderOpen, ChevronDown, ChevronUp, AlertCircle, RefreshCw
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import ReactMarkdown from 'react-markdown'

interface Props {
  contextType: 'document' | 'collection'
  contextId:   string
}

interface UIMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  answer_type?: string
  loading?: boolean
}

export default function StudyPage({ contextType, contextId }: Props) {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [title, setTitle]               = useState('')
  const [subtitle, setSubtitle]         = useState('')
  const [summary, setSummary]           = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [showSummary, setShowSummary]   = useState(true)
  const [messages, setMessages]         = useState<UIMessage[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [input, setInput]               = useState('')
  const [sending, setSending]           = useState(false)
  const [pageError, setPageError]       = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  // Load context info + history — runs once per contextId
  const didLoad = useRef(false)
  useEffect(() => {
    if (!user || !contextId || didLoad.current) return
    didLoad.current = true

    const loadContext = async () => {
      try {
        if (contextType === 'document') {
          const { getDocuments } = await import('@/lib/api')
          const docs = await getDocuments()
          const doc = docs.find((d: any) => d.id === contextId)
          setTitle(doc?.name || 'Document')
          setSubtitle(doc ? `${doc.file_type?.toUpperCase()} · ${doc.chunk_count} chunks` : '')
        } else {
          const col = await getCollection(contextId)
          setTitle(col.name)
          setSubtitle(`${col.documents?.length || 0} documents`)
        }
      } catch { setPageError('Failed to load context') }
    }

    const loadHistory = async () => {
      try {
        const history = await getChatHistory(contextType, contextId)
        setMessages(history.map(m => ({
          role:        m.role,
          content:     m.content,
          sources:     m.metadata?.sources || [],
          answer_type: m.metadata?.answer_type,
        })))
      } catch {} finally { setHistoryLoaded(true) }
    }

    const loadSummary = async () => {
      if (contextType !== 'document') return
      setSummaryLoading(true)
      try {
        const res = await getDocumentSummary(contextId)
        setSummary(res.summary)
      } catch (e: any) {
        setSummaryError(e.response?.data?.detail || 'Could not load summary')
      } finally { setSummaryLoading(false) }
    }

    loadContext()
    loadHistory()
    loadSummary()
  }, [user, contextId, contextType])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const question = input.trim()
    setInput('')
    setSending(true)
    setMessages(prev => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '', loading: true }])

    try {
      const res = await sendMessage(contextType, contextId, question)
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = {
          role:        'assistant',
          content:     res.answer,
          sources:     res.sources,
          answer_type: res.answer_type,
        }
        return next
      })
    } catch (e: any) {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: '❌ Something went wrong. Please try again.' }
        return next
      })
    } finally { setSending(false) }
  }

  const handleClear = async () => {
    if (!confirm('Clear all chat history?')) return
    try {
      await clearChatHistory(contextType, contextId)
      setMessages([])
    } catch {}
  }

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--orange)' }} />
    </div>
  )

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar backHref="/dashboard" title={title || '...'} />

      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Context badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: 'var(--orange-bg)', border: '1px solid var(--orange-border)', color: 'var(--orange)' }}>
            {contextType === 'document'
              ? <FileText className="w-3 h-3" />
              : <FolderOpen className="w-3 h-3" />}
            {contextType === 'document' ? 'Document' : 'Collection'}
          </div>
          {subtitle && <span className="text-xs" style={{ color: 'var(--text3)' }}>{subtitle}</span>}
          {/* Quiz button */}
          <Link href={`/quiz/${contextType}/${contextId}`}
            className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-opacity hover:opacity-85"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
            <Brain className="w-3 h-3" style={{ color: 'var(--orange)' }} />
            Take Quiz
          </Link>
        </div>

        {pageError && (
          <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            <AlertCircle className="w-4 h-4" />{pageError}
          </div>
        )}

        {/* Summary (documents only) */}
        {contextType === 'document' && (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <button onClick={() => setShowSummary(s => !s)}
              className="w-full px-5 py-4 flex items-center justify-between transition-opacity hover:opacity-70"
              style={{ background: 'var(--surface)' }}>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" style={{ color: 'var(--orange)' }} />
                <span className="font-syne font-bold text-sm" style={{ color: 'var(--text)' }}>Summary</span>
              </div>
              {showSummary ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text3)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text3)' }} />}
            </button>
            {showSummary && (
              <div className="px-5 py-4" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                {summaryLoading ? (
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text3)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating summary...
                  </div>
                ) : summaryError ? (
                  <div className="flex items-center gap-2">
                    <p className="text-sm" style={{ color: 'var(--text3)' }}>{summaryError}</p>
                    <button onClick={async () => { setSummaryError(''); setSummaryLoading(true); try { const r = await getDocumentSummary(contextId); setSummary(r.summary) } catch { setSummaryError('Failed') } finally { setSummaryLoading(false) } }}
                      className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--orange)' }}>
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
                    <ReactMarkdown>{summary}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Chat */}
        <div className="rounded-2xl flex flex-col overflow-hidden flex-1"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)', minHeight: '400px' }}>

          {/* Chat header */}
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" style={{ color: 'var(--orange)' }} />
              <span className="font-syne font-bold text-sm" style={{ color: 'var(--text)' }}>Chat</span>
              {messages.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--text3)' }}>
                  {Math.floor(messages.length / 2)} exchanges
                </span>
              )}
            </div>
            {messages.length > 0 && (
              <button onClick={handleClear} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text3)' }} title="Clear history">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ minHeight: 0 }}>
            {!historyLoaded ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text3)' }} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <MessageSquare className="w-8 h-8 opacity-20" style={{ color: 'var(--text3)' }} />
                <p className="text-sm" style={{ color: 'var(--text3)' }}>
                  Ask anything about {contextType === 'collection' ? 'these documents' : 'this document'}
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                    style={{
                      background: msg.role === 'user' ? 'var(--orange)' : 'var(--surface2)',
                      color:      msg.role === 'user' ? '#000' : 'var(--text)',
                    }}>
                    {msg.loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <div className="prose prose-sm max-w-none text-sm leading-relaxed"
                          style={{ color: msg.role === 'user' ? '#000' : 'var(--text)' }}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        {/* Sources */}
                        {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text3)' }}>Sources</p>
                            {msg.sources.map((s: any, si: number) => (
                              <div key={si} className="rounded-lg overflow-hidden"
                                style={{ background: 'var(--surface)' }}>
                                {/* Source label */}
                                <div className="flex items-center gap-2 text-xs px-2 py-1.5"
                                  style={{ color: 'var(--text2)' }}>
                                  <FileText className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--orange)' }} />
                                  <span className="truncate">{s.document_name}</span>
                                  <span className="flex-shrink-0 opacity-60">p.{s.page_number}</span>
                                </div>
                                {/* Embedded figures (diagrams, charts, images) */}
                                {s.figures && s.figures.length > 0 && (
                                  <div className="px-2 pb-2 flex flex-wrap gap-1.5">
                                    {s.figures.map((fig: string, fi: number) => (
                                      <img key={fi}
                                        src={`data:image/png;base64,${fig}`}
                                        alt={`Figure from p.${s.page_number}`}
                                        className="rounded max-h-48 max-w-full object-contain cursor-pointer"
                                        style={{ background: '#fff' }}
                                        onClick={() => window.open(`data:image/png;base64,${fig}`, '_blank')}
                                        title="Click to view full size"
                                      />
                                    ))}
                                  </div>
                                )}
                                {/* Page screenshot (shown only if no extracted figures) */}
                                {(!s.figures || s.figures.length === 0) && s.page_screenshot && (
                                  <div className="px-2 pb-2">
                                    <img
                                      src={`data:image/png;base64,${s.page_screenshot}`}
                                      alt={`Page ${s.page_number} screenshot`}
                                      className="rounded w-full object-contain cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                                      style={{ maxHeight: '200px', background: '#fff' }}
                                      onClick={() => window.open(`data:image/png;base64,${s.page_screenshot}`, '_blank')}
                                      title="Click to view full size"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {msg.role === 'assistant' && msg.answer_type === 'general' && (
                          <p className="text-xs mt-2 opacity-60">⚡ General knowledge — not from the document</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex gap-3">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Ask a question..."
                className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                disabled={sending}
              />
              <button onClick={handleSend} disabled={!input.trim() || sending}
                className="px-4 py-2.5 rounded-xl transition-opacity hover:opacity-85 disabled:opacity-40"
                style={{ background: 'var(--orange)' }}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Send className="w-4 h-4 text-black" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}