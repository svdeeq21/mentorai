'use client'
// FILE: frontend/src/app/quiz/[type]/[id]/page.tsx
import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  generateQuiz, submitQuiz,
  QuizQuestion, QuizResult
} from '@/lib/api'
import {
  Brain, ChevronLeft, Loader2, CheckCircle2,
  XCircle, RotateCcw, Trophy, AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import ReactMarkdown from 'react-markdown'

type Phase = 'setup' | 'loading' | 'quiz' | 'results'

export default function QuizPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type: contextType, id: contextId } = use(params)
  const router  = useRouter()
  const { user } = useAuth()

  const [phase,        setPhase]        = useState<Phase>('setup')
  const [difficulty,   setDifficulty]   = useState('medium')
  const [numQuestions, setNumQuestions] = useState(5)
  const [questions,    setQuestions]    = useState<QuizQuestion[]>([])
  const [answers,      setAnswers]      = useState<Record<string, number>>({})
  const [current,      setCurrent]      = useState(0)
  const [result,       setResult]       = useState<QuizResult | null>(null)
  const [error,        setError]        = useState('')

  const backHref = `/study/${contextType}/${contextId}`

  async function handleGenerate() {
    setError('')
    setPhase('loading')
    try {
      const data = await generateQuiz(contextType, contextId, difficulty, numQuestions)
      setQuestions(data.questions)
      setAnswers({})
      setCurrent(0)
      setPhase('quiz')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to generate quiz')
      setPhase('setup')
    }
  }

  async function handleSubmit() {
    setPhase('loading')
    try {
      const data = await submitQuiz(contextType, contextId, difficulty, questions, answers)
      setResult(data)
      setPhase('results')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to submit quiz')
      setPhase('quiz')
    }
  }

  function handleAnswer(optionIdx: number) {
    setAnswers(prev => ({ ...prev, [String(current)]: optionIdx }))
  }

  const answered     = Object.keys(answers).length
  const allAnswered   = answered === questions.length
  const currentAnswer = answers[String(current)]

  const scoreColor = (pct: number) =>
    pct >= 80 ? 'var(--green, #22c55e)' : pct >= 60 ? 'var(--orange)' : '#ef4444'

  const difficultyOpts = [
    { value: 'easy',   label: 'Easy',   desc: 'Factual recall & definitions' },
    { value: 'medium', label: 'Medium', desc: 'Comprehension & application' },
    { value: 'hard',   label: 'Hard',   desc: 'Analysis & inference' },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar />
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">

        {/* Back link */}
        <Link href={backHref}
          className="inline-flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text3)' }}>
          <ChevronLeft className="w-4 h-4" /> Back to study
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--orange-bg)' }}>
            <Brain className="w-5 h-5" style={{ color: 'var(--orange)' }} />
          </div>
          <div>
            <h1 className="font-syne font-bold text-xl" style={{ color: 'var(--text)' }}>Quiz Mode</h1>
            <p className="text-sm" style={{ color: 'var(--text3)' }}>
              {contextType === 'collection' ? 'Collection' : 'Document'} quiz
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl mb-6 text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── SETUP ── */}
        {phase === 'setup' && (
          <div className="space-y-6">
            {/* Difficulty */}
            <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="font-medium mb-4" style={{ color: 'var(--text)' }}>Difficulty</p>
              <div className="grid grid-cols-3 gap-3">
                {difficultyOpts.map(opt => (
                  <button key={opt.value} onClick={() => setDifficulty(opt.value)}
                    className="rounded-xl p-3 text-left transition-all"
                    style={{
                      background: difficulty === opt.value ? 'var(--orange-bg)' : 'var(--surface2)',
                      border: `1px solid ${difficulty === opt.value ? 'var(--orange-border)' : 'var(--border)'}`,
                    }}>
                    <p className="text-sm font-medium" style={{ color: difficulty === opt.value ? 'var(--orange)' : 'var(--text)' }}>
                      {opt.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Num questions */}
            <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="font-medium mb-4" style={{ color: 'var(--text)' }}>
                Number of questions: <span style={{ color: 'var(--orange)' }}>{numQuestions}</span>
              </p>
              <input type="range" min={3} max={10} value={numQuestions}
                onChange={e => setNumQuestions(Number(e.target.value))}
                className="w-full accent-orange-500" style={{ accentColor: 'var(--orange)' }} />
              <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text3)' }}>
                <span>3</span><span>10</span>
              </div>
            </div>

            <button onClick={handleGenerate}
              className="w-full py-3.5 rounded-xl font-semibold text-black transition-opacity hover:opacity-85"
              style={{ background: 'var(--orange)' }}>
              Generate Quiz
            </button>
          </div>
        )}

        {/* ── LOADING ── */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--orange)' }} />
            <p className="text-sm" style={{ color: 'var(--text3)' }}>
              {result === null ? 'Generating quiz questions…' : 'Scoring your answers…'}
            </p>
          </div>
        )}

        {/* ── QUIZ ── */}
        {phase === 'quiz' && questions.length > 0 && (
          <div className="space-y-6">
            {/* Progress */}
            <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text3)' }}>
              <span>Question {current + 1} of {questions.length}</span>
              <span>{answered} answered</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${((current + 1) / questions.length) * 100}%`, background: 'var(--orange)' }} />
            </div>

            {/* Question card */}
            <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="font-medium text-base leading-relaxed mb-6" style={{ color: 'var(--text)' }}>
                {questions[current].question}
              </p>
              <div className="space-y-3">
                {questions[current].options.map((opt, oi) => (
                  <button key={oi} onClick={() => handleAnswer(oi)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
                    style={{
                      background: currentAnswer === oi ? 'var(--orange-bg)' : 'var(--surface2)',
                      border: `1px solid ${currentAnswer === oi ? 'var(--orange-border)' : 'var(--border)'}`,
                      color: currentAnswer === oi ? 'var(--orange)' : 'var(--text)',
                    }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => setCurrent(c => Math.max(0, c - 1))}
                disabled={current === 0}
                className="px-4 py-2.5 rounded-xl text-sm disabled:opacity-30 transition-opacity hover:opacity-70"
                style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                ← Previous
              </button>

              {/* Dot navigation */}
              <div className="flex gap-1.5">
                {questions.map((_, qi) => (
                  <button key={qi} onClick={() => setCurrent(qi)}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{
                      background: qi === current ? 'var(--orange)' :
                                  answers[String(qi)] !== undefined ? 'var(--orange-border)' : 'var(--border)',
                    }} />
                ))}
              </div>

              {current < questions.length - 1 ? (
                <button onClick={() => setCurrent(c => c + 1)}
                  className="px-4 py-2.5 rounded-xl text-sm transition-opacity hover:opacity-70"
                  style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                  Next →
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={!allAnswered}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-black disabled:opacity-40 transition-opacity hover:opacity-85"
                  style={{ background: 'var(--orange)' }}>
                  Submit Quiz
                </button>
              )}
            </div>

            {!allAnswered && (
              <p className="text-center text-xs" style={{ color: 'var(--text3)' }}>
                Answer all {questions.length} questions to submit
              </p>
            )}
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === 'results' && result && (
          <div className="space-y-6">
            {/* Score card */}
            <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Trophy className="w-10 h-10 mx-auto mb-4" style={{ color: scoreColor(result.score_pct) }} />
              <div className="text-5xl font-bold font-syne mb-1"
                style={{ color: scoreColor(result.score_pct) }}>
                {result.score_pct}%
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>
                {result.correct} of {result.total} correct · {difficulty} difficulty
              </p>
              <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text2)' }}>
                {result.score_pct >= 80 ? '🎉 Excellent work!' :
                 result.score_pct >= 60 ? '👍 Good effort — review the explanations below' :
                 '📚 Keep studying — check the explanations to improve'}
              </p>
            </div>

            {/* Per-question results */}
            <div className="space-y-4">
              {result.results.map((r, i) => (
                <div key={i} className="rounded-2xl p-5"
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${r.is_correct ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}>
                  <div className="flex items-start gap-3 mb-3">
                    {r.is_correct
                      ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#22c55e' }} />
                      : <XCircle     className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />}
                    <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text)' }}>
                      {r.question}
                    </p>
                  </div>

                  <div className="space-y-1.5 ml-8">
                    {r.options.map((opt, oi) => {
                      const isCorrect  = oi === r.correct
                      const isSelected = oi === r.user_answer
                      return (
                        <div key={oi} className="text-xs px-3 py-2 rounded-lg"
                          style={{
                            background: isCorrect ? 'rgba(34,197,94,0.1)' :
                                        isSelected && !isCorrect ? 'rgba(239,68,68,0.1)' : 'var(--surface2)',
                            color: isCorrect ? '#22c55e' :
                                   isSelected && !isCorrect ? '#ef4444' : 'var(--text3)',
                            border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.3)' :
                                                 isSelected && !isCorrect ? 'rgba(239,68,68,0.3)' : 'transparent'}`,
                          }}>
                          {opt} {isCorrect ? '✓' : isSelected && !isCorrect ? '✗' : ''}
                        </div>
                      )
                    })}
                  </div>

                  {r.explanation && (
                    <div className="mt-3 ml-8 text-xs px-3 py-2 rounded-lg italic"
                      style={{ background: 'var(--surface2)', color: 'var(--text3)' }}>
                      💡 {r.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => { setPhase('setup'); setResult(null) }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
                style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                <RotateCcw className="w-4 h-4" /> New Quiz
              </button>
              <Link href={backHref}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-black transition-opacity hover:opacity-85"
                style={{ background: 'var(--orange)' }}>
                Back to Study
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}