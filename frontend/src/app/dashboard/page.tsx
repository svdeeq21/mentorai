// FILE: frontend/src/app/dashboard/page.tsx
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  uploadDocument, getDocuments, deleteDocument, getJobStatus,
  getCollections, createCollection, deleteCollection, addDocumentToCollection,
  removeDocumentFromCollection, Document, Collection
} from '@/lib/api'
import {
  FileText, Trash2, MessageSquare, Upload, Loader2, CheckCircle,
  AlertCircle, FolderOpen, FolderPlus, Plus, X, ChevronDown, ChevronRight
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

type Tab = 'documents' | 'collections'

interface UploadState {
  file: File
  status: 'uploading' | 'processing' | 'done' | 'error'
  progress: number
  message: string
  jobId?: string
}

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [tab, setTab]                     = useState<Tab>('documents')
  const [docs, setDocs]                   = useState<Document[]>([])
  const [collections, setCollections]     = useState<Collection[]>([])
  const [docsLoading, setDocsLoading]     = useState(true)
  const [colsLoading, setColsLoading]     = useState(true)
  const [uploads, setUploads]             = useState<UploadState[]>([])
  const [error, setError]                 = useState('')

  // collection creation
  const [showNewCol, setShowNewCol]       = useState(false)
  const [newColName, setNewColName]       = useState('')
  const [newColDesc, setNewColDesc]       = useState('')
  const [creatingCol, setCreatingCol]     = useState(false)

  // expanded collection (show its docs)
  const [expandedCol, setExpandedCol]     = useState<string | null>(null)
  // add-doc modal
  const [addDocModal, setAddDocModal]     = useState<string | null>(null) // collection_id
  // collection-targeted upload
  const [uploadToCol, setUploadToCol]     = useState<string | null>(null) // collection_id
  const colUploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading, router])

  const loadDocs = useCallback(async () => {
    if (!user) return
    try { setDocs(await getDocuments()) } catch { setError('Failed to load documents') }
    finally { setDocsLoading(false) }
  }, [user])

  const loadCollections = useCallback(async () => {
    if (!user) return
    try { setCollections(await getCollections()) } catch {}
    finally { setColsLoading(false) }
  }, [user])

  useEffect(() => { loadDocs(); loadCollections() }, [loadDocs, loadCollections])

  // Poll uploads — single stable interval using a ref to avoid re-creating on every state change
  const uploadsRef = useRef(uploads)
  uploadsRef.current = uploads

  useEffect(() => {
    const interval = setInterval(async () => {
      const processing = uploadsRef.current.filter(u => u.status === 'processing' && u.jobId)
      if (!processing.length) return
      for (const upload of processing) {
        if (!upload.jobId) continue
        try {
          const job = await getJobStatus(upload.jobId)
          setUploads(prev => prev.map(u => {
            if (u.jobId !== upload.jobId) return u
            if (job.status === 'complete') { loadDocs(); return { ...u, status: 'done', progress: 100, message: 'Ready!' } }
            if (job.status === 'failed')   return { ...u, status: 'error', message: job.error || 'Failed' }
            return { ...u, progress: job.progress || u.progress, message: job.message || u.message }
          }))
        } catch {}
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [loadDocs])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError('')
    for (const file of acceptedFiles) {
      const initial: UploadState = { file, status: 'uploading', progress: 10, message: 'Uploading...' }
      setUploads(prev => [...prev, initial])
      try {
        setUploads(prev => prev.map(u => u.file === file ? { ...u, progress: 35, message: 'Sending...' } : u))
        const { job_id } = await uploadDocument(file, uploadToCol || undefined)
        setUploads(prev => prev.map(u => u.file === file
          ? { ...u, status: 'processing', progress: 50, message: 'Processing...', jobId: job_id } : u))
      } catch (e: any) {
        setUploads(prev => prev.map(u => u.file === file
          ? { ...u, status: 'error', message: e.response?.data?.detail || 'Upload failed' } : u))
      }
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'], 'text/csv': ['.csv'],
      'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'],
    },
  })

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Delete this document?')) return
    try { await deleteDocument(id); setDocs(prev => prev.filter(d => d.id !== id)) }
    catch { setError('Failed to delete') }
  }

  const handleCreateCollection = async () => {
    if (!newColName.trim()) return
    setCreatingCol(true)
    try {
      const col = await createCollection(newColName.trim(), newColDesc.trim() || undefined)
      setCollections(prev => [col, ...prev])
      setNewColName(''); setNewColDesc(''); setShowNewCol(false)
    } catch { setError('Failed to create collection') }
    finally { setCreatingCol(false) }
  }

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('Delete this collection? Documents inside will not be deleted.')) return
    try { await deleteCollection(id); setCollections(prev => prev.filter(c => c.id !== id)) }
    catch { setError('Failed to delete collection') }
  }

  const handleAddDoc = async (collectionId: string, documentId: string) => {
    try {
      await addDocumentToCollection(collectionId, documentId)
      setCollections(prev => prev.map(c => {
        if (c.id !== collectionId) return c
        const existing = c.collection_documents || []
        if (existing.find(d => d.document_id === documentId)) return c
        return { ...c, collection_documents: [...existing, { document_id: documentId }] }
      }))
    } catch { setError('Failed to add document') }
  }

  const handleRemoveDoc = async (collectionId: string, documentId: string) => {
    try {
      await removeDocumentFromCollection(collectionId, documentId)
      setCollections(prev => prev.map(c => {
        if (c.id !== collectionId) return c
        return { ...c, collection_documents: (c.collection_documents || []).filter(d => d.document_id !== documentId) }
      }))
    } catch { setError('Failed to remove document') }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--orange)' }} />
    </div>
  )

  const readyDocs = docs.filter(d => d.status === 'ready')

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-syne font-black text-4xl mb-2" style={{ color: 'var(--text)' }}>
            Your <span style={{ color: 'var(--orange)' }}>library.</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text3)' }}>Upload documents and organise them into collections.</p>
        </div>

        {/* Upload zone */}
        <div {...getRootProps()} className="rounded-2xl p-10 text-center cursor-pointer transition-all mb-6"
          style={{
            border: `2px dashed ${isDragActive ? 'var(--orange)' : 'var(--border)'}`,
            background: isDragActive ? 'var(--orange-bg)' : 'var(--surface)',
          }}>
          <input {...getInputProps()} />
          <Upload className="w-7 h-7 mx-auto mb-3" style={{ color: 'var(--text3)' }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>
            {isDragActive ? 'Drop it here' : 'Drag & drop, or click to upload'}
          </p>
          <p className="text-sm" style={{ color: 'var(--text3)' }}>PDF, Word, PowerPoint, Excel, CSV, images</p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2 mb-6"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Active uploads */}
        {uploads.length > 0 && (
          <div className="mb-6 space-y-2">
            {uploads.map((u, i) => (
              <div key={i} className="rounded-xl px-4 py-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {u.status === 'done'  && <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#4ade80' }} />}
                    {u.status === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#f87171' }} />}
                    {(u.status === 'uploading' || u.status === 'processing') &&
                      <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: 'var(--orange)' }} />}
                    <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{u.file.name}</span>
                  </div>
                  <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--text3)' }}>{u.message}</span>
                </div>
                {u.status !== 'error' && (
                  <div className="w-full h-1 rounded-full" style={{ background: 'var(--border)' }}>
                    <div className="h-1 rounded-full transition-all duration-500"
                      style={{ width: `${u.progress}%`, background: u.status === 'done' ? '#4ade80' : 'var(--orange)' }} />
                  </div>
                )}
              </div>
            ))}
            {uploads.some(u => u.status === 'done' || u.status === 'error') && (
              <button onClick={() => setUploads(p => p.filter(u => u.status === 'uploading' || u.status === 'processing'))}
                className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text3)' }}>
                Clear finished
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'var(--surface)' }}>
          {(['documents', 'collections'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all"
              style={{
                background: tab === t ? 'var(--orange)' : 'transparent',
                color: tab === t ? '#000' : 'var(--text2)',
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* Documents tab */}
        {tab === 'documents' && (
          <div>
            {docsLoading ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text3)' }}>
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : docs.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text3)' }} />
                <p className="text-sm" style={{ color: 'var(--text3)' }}>No documents yet. Upload one above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {docs.map(doc => (
                  <div key={doc.id} className="rounded-xl px-4 py-3 flex items-center gap-4"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: doc.status === 'ready' ? 'var(--orange-bg)' : 'var(--surface2)' }}>
                      {doc.status === 'ready'
                        ? <FileText className="w-4 h-4" style={{ color: 'var(--orange)' }} />
                        : <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text3)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{doc.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text3)' }}>
                        {doc.file_type?.toUpperCase()} · {doc.chunk_count} chunks · {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {doc.status === 'ready' ? (
                        <Link href={`/study/document/${doc.id}`}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-85 text-black"
                          style={{ background: 'var(--orange)' }}>
                          <MessageSquare className="w-3 h-3" />Chat
                        </Link>
                      ) : (
                        <span className="text-xs px-3 py-1.5" style={{ color: 'var(--text3)' }}>Processing...</span>
                      )}
                      <button onClick={() => handleDeleteDoc(doc.id)}
                        className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                        style={{ color: 'var(--text3)' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collections tab */}
        {/* Hidden input for collection-targeted upload */}
        <input
          ref={colUploadRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.html,.csv,.png,.jpg,.jpeg"
          onChange={async e => {
            const file = e.target.files?.[0]
            if (!file) return
            e.target.value = ''
            // trigger the normal onDrop flow with the collection already set
            await onDrop([file])
            setUploadToCol(null)
          }}
        />
        {tab === 'collections' && (
          <div>
            {/* New collection button */}
            <div className="mb-4">
              {!showNewCol ? (
                <button onClick={() => setShowNewCol(true)}
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-opacity hover:opacity-85"
                  style={{ background: 'var(--orange)', color: '#000' }}>
                  <FolderPlus className="w-4 h-4" /> New collection
                </button>
              ) : (
                <div className="rounded-2xl p-5 space-y-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="font-syne font-bold text-sm" style={{ color: 'var(--text)' }}>New collection</p>
                  <input value={newColName} onChange={e => setNewColName(e.target.value)}
                    placeholder="e.g. 200L Operating Systems"
                    className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                  <input value={newColDesc} onChange={e => setNewColDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                  <div className="flex gap-2">
                    <button onClick={handleCreateCollection} disabled={!newColName.trim() || creatingCol}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 text-black"
                      style={{ background: 'var(--orange)' }}>
                      {creatingCol ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Create
                    </button>
                    <button onClick={() => { setShowNewCol(false); setNewColName(''); setNewColDesc('') }}
                      className="px-4 py-2 rounded-xl text-sm transition-opacity hover:opacity-70"
                      style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {colsLoading ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text3)' }}>
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : collections.length === 0 ? (
              <div className="text-center py-16">
                <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text3)' }} />
                <p className="text-sm" style={{ color: 'var(--text3)' }}>No collections yet. Create one to group related documents.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {collections.map(col => {
                  const colDocIds  = (col.collection_documents || []).map(d => d.document_id)
                  const colDocs    = docs.filter(d => colDocIds.includes(d.id))
                  const isExpanded = expandedCol === col.id
                  const docsInModal = docs.filter(d => d.status === 'ready' && !colDocIds.includes(d.id))

                  return (
                    <div key={col.id} className="rounded-2xl overflow-hidden"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

                      {/* Collection header */}
                      <div className="px-4 py-3 flex items-center gap-3">
                        <button onClick={() => setExpandedCol(isExpanded ? null : col.id)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text3)' }} />
                            : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text3)' }} />}
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--orange-bg)' }}>
                            <FolderOpen className="w-4 h-4" style={{ color: 'var(--orange)' }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{col.name}</p>
                            <p className="text-xs" style={{ color: 'var(--text3)' }}>{colDocIds.length} document{colDocIds.length !== 1 ? 's' : ''}</p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {colDocIds.length > 0 && (
                            <Link href={`/study/collection/${col.id}`}
                              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-85 text-black"
                              style={{ background: 'var(--orange)' }}>
                              <MessageSquare className="w-3 h-3" />Chat
                            </Link>
                          )}
                          <button
                            onClick={() => { setUploadToCol(col.id); setTimeout(() => colUploadRef.current?.click(), 50) }}
                            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-opacity hover:opacity-70"
                            style={{ color: 'var(--text3)', border: '1px solid var(--border)' }}
                            title="Upload new file directly to this collection">
                            <Upload className="w-3 h-3" />Upload
                          </button>
                          <button onClick={() => setAddDocModal(col.id)}
                            className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                            style={{ color: 'var(--text3)' }} title="Add existing document">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteCollection(col.id)}
                            className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                            style={{ color: 'var(--text3)' }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded docs */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border)' }}>
                          {colDocs.length === 0 ? (
                            <p className="px-6 py-4 text-sm" style={{ color: 'var(--text3)' }}>
                              No documents yet. Click + to add some.
                            </p>
                          ) : colDocs.map(doc => (
                            <div key={doc.id} className="px-6 py-3 flex items-center gap-3"
                              style={{ borderBottom: '1px solid var(--border)' }}>
                              <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--orange)' }} />
                              <span className="text-sm flex-1 truncate" style={{ color: 'var(--text)' }}>{doc.name}</span>
                              <button onClick={() => handleRemoveDoc(col.id, doc.id)}
                                className="p-1 rounded hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--text3)' }}>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add doc modal (inline) */}
                      {addDocModal === col.id && (
                        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}
                          className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Add documents to "{col.name}"</p>
                            <button onClick={() => setAddDocModal(null)}><X className="w-4 h-4" style={{ color: 'var(--text3)' }} /></button>
                          </div>
                          {docsInModal.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--text3)' }}>All ready documents are already in this collection.</p>
                          ) : (
                            <div className="space-y-2">
                              {docsInModal.map(doc => (
                                <div key={doc.id} className="flex items-center gap-3 rounded-xl px-3 py-2"
                                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                                  <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text3)' }} />
                                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--text)' }}>{doc.name}</span>
                                  <button onClick={() => { handleAddDoc(col.id, doc.id); setAddDocModal(null) }}
                                    className="text-xs px-3 py-1.5 rounded-lg font-medium text-black transition-opacity hover:opacity-85"
                                    style={{ background: 'var(--orange)' }}>Add</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}