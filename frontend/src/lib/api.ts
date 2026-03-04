// FILE: frontend/src/lib/api.ts
import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api

// ── Documents ─────────────────────────────────────────────

export async function uploadDocument(file: File, collectionId?: string) {
  const form = new FormData()
  form.append('file', file)
  if (collectionId) form.append('collection_id', collectionId)
  const res = await api.post('/api/pipeline/upload', form)
  return res.data as { document_id: string; job_id: string }
}

export async function getJobStatus(jobId: string) {
  const res = await api.get(`/api/pipeline/status/${jobId}`)
  return res.data as { status: string; progress: number; message: string; error?: string }
}

export async function getDocuments() {
  const res = await api.get('/api/documents/')
  return res.data as Document[]
}

export async function deleteDocument(documentId: string) {
  await api.delete(`/api/documents/${documentId}`)
}

export async function getDocumentSummary(documentId: string) {
  const res = await api.get(`/api/summary/${documentId}`)
  return res.data as { summary: string; cached: boolean; model?: string }
}

// ── Collections ───────────────────────────────────────────

export async function getCollections() {
  const res = await api.get('/api/collections/')
  return res.data as Collection[]
}

export async function createCollection(name: string, description?: string) {
  const res = await api.post('/api/collections/', { name, description })
  return res.data as Collection
}

export async function deleteCollection(collectionId: string) {
  await api.delete(`/api/collections/${collectionId}`)
}

export async function getCollection(collectionId: string) {
  const res = await api.get(`/api/collections/${collectionId}`)
  return res.data as Collection & { documents: Document[] }
}

export async function addDocumentToCollection(collectionId: string, documentId: string) {
  await api.post(`/api/collections/${collectionId}/documents`, { document_id: documentId })
}

export async function removeDocumentFromCollection(collectionId: string, documentId: string) {
  await api.delete(`/api/collections/${collectionId}/documents/${documentId}`)
}

// ── Chat ──────────────────────────────────────────────────

export async function sendMessage(
  contextType: 'document' | 'collection',
  contextId: string,
  message: string,
) {
  const res = await api.post('/api/chat/', { context_type: contextType, context_id: contextId, message })
  return res.data as ChatResponse
}

export async function getChatHistory(contextType: 'document' | 'collection', contextId: string) {
  const res = await api.get('/api/chat/history', { params: { context_type: contextType, context_id: contextId } })
  return res.data as ChatMessage[]
}

export async function clearChatHistory(contextType: 'document' | 'collection', contextId: string) {
  await api.delete('/api/chat/history', { params: { context_type: contextType, context_id: contextId } })
}

// ── Profile & Usage ───────────────────────────────────────

export async function getUsage() {
  const res = await api.get('/api/profile/usage')
  return res.data as {
    plan: string
    doc_count: number
    chats_today: number
    col_count: number
    quiz_count: number
    avg_score: number | null
    quiz_history: { id: string; difficulty: string; score: number; total: number; score_pct: number; created_at: string }[]
    limits: { documents: number | null; chats_per_day: number | null; pages_per_doc: number | null }
  }
}

// ── Billing ───────────────────────────────────────────────

export async function getBillingStatus() {
  const res = await api.get('/api/billing/status')
  return res.data
}

export async function initPayment(plan: string) {
  // redirect_url is where Flutterwave sends the user back after payment
  const redirect_url = `${window.location.origin}/billing/callback`
  const res = await api.post('/api/billing/init', { plan, redirect_url })
  return res.data as { payment_link: string; tx_ref: string }
}

export async function cancelSubscription() {
  const res = await api.post('/api/billing/cancel')
  return res.data as { status: string }
}

export async function verifyPayment(
  transaction_id: string, tx_ref: string, status: string
) {
  const res = await api.get('/api/billing/verify', {
    params: { transaction_id, tx_ref, status }
  })
  return res.data as { status: string; plan: string }
}

// ── Types ─────────────────────────────────────────────────

export interface Document {
  id: string
  name: string
  file_type: string
  chunk_count: number
  page_count: number
  status: string
  created_at: string
  summary?: string
}

export interface Collection {
  id: string
  name: string
  description?: string
  created_at: string
  collection_documents?: { document_id: string }[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  metadata?: {
    answer_type?: string
    model?: string
    sources?: ChatSource[]
  }
  created_at: string
}

export interface ChatSource {
  document_id: string
  document_name: string
  page_number: string | number
  score: number
}

export interface ChatResponse {
  answer: string
  answer_type: string
  sources: ChatSource[]
  model: string
}

// ── Quiz ──────────────────────────────────────────────────

export async function generateQuiz(
  contextType: string, contextId: string,
  difficulty: string, numQuestions: number
) {
  const res = await api.post('/api/quiz/generate', {
    context_type: contextType, context_id: contextId,
    difficulty, num_questions: numQuestions,
  })
  return res.data as { questions: QuizQuestion[], difficulty: string }
}

export async function submitQuiz(
  contextType: string, contextId: string, difficulty: string,
  questions: QuizQuestion[], userAnswers: Record<string, number>
) {
  const res = await api.post('/api/quiz/submit', {
    context_type: contextType, context_id: contextId,
    difficulty, questions, user_answers: userAnswers,
  })
  return res.data as QuizResult
}

export async function getQuizHistory() {
  const res = await api.get('/api/quiz/history')
  return res.data as QuizAttempt[]
}

export interface QuizQuestion {
  question: string
  options: string[]
  correct: number
  explanation: string
}

export interface QuizResult {
  correct: number
  total: number
  score_pct: number
  results: {
    question: string
    options: string[]
    correct: number
    user_answer: number | undefined
    is_correct: boolean
    explanation: string
  }[]
}

export interface QuizAttempt {
  id: string
  context_type: string
  context_id: string
  difficulty: string
  score: number
  total: number
  score_pct: number
  created_at: string
}