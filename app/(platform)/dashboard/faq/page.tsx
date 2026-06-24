import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import FaqQuestionsManager from '@/components/faq/FaqQuestionsManager'

export default async function FaqPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/setup')

  const db = createAdminClient()
  const { data: questions } = await db
    .from('faq_questions')
    .select('id, question, source, topic, status, used_in_post_id, created_at')
    .eq('tenant_id', workspace.tenantId)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">FAQ pages</h1>
      <p className="text-sm text-slate-500 mb-6">
        Collect real customer questions and Scout&apos;s People-Also-Ask data, then have Clem
        assemble them into an FAQ page (with FAQPage schema for rich results and AI citations).
        Generated pages flow through the normal review &amp; publish process.
      </p>
      <FaqQuestionsManager key={workspace.tenantId} initialQuestions={questions ?? []} />
    </div>
  )
}
