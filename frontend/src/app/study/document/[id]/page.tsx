// FILE: frontend/src/app/study/document/[id]/page.tsx
'use client'
import { use } from 'react'
import StudyPage from '@/components/StudyPage'
export default function DocumentStudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <StudyPage contextType="document" contextId={id} />
}