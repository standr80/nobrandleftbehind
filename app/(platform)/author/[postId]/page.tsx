// Sprint 3 — Tiptap editor, image picker, approve/reject

interface Props {
  params: Promise<{ postId: string }>
}

export default async function PostReviewPage({ params }: Props) {
  const { postId } = await params

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Post review</h1>
      <p className="text-white/40 text-sm mb-8">Post ID: {postId}</p>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
        <p className="text-white/30 text-sm">Tiptap editor coming in Sprint 3.</p>
      </div>
    </div>
  )
}
