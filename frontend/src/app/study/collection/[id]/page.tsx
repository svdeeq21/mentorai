// FILE: frontend/src/app/study/collection/[id]/page.tsx
'use client'
import { use } from 'react'
import StudyPage from '@/components/StudyPage'
export default function CollectionStudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <StudyPage contextType="collection" contextId={id} />
}