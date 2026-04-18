import { NextResponse } from 'next/server'
import { getSessionUser } from '@/utils/auth/session'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const [notesRes, ratingRes] = await Promise.all([
    admin.from('notes').select('content').eq('user_id', user.userId).maybeSingle(),
    admin.from('day_ratings').select('rating').eq('user_id', user.userId).eq('date', today).maybeSingle(),
  ])

  if (notesRes.error || ratingRes.error) {
    return NextResponse.json(
      { error: notesRes.error?.message ?? ratingRes.error?.message ?? 'Unable to load notes.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    notes: notesRes.data?.content ?? '',
    rating: ratingRes.data?.rating ?? null,
  })
}

export async function PUT(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { content } = await request.json()
  const admin = createAdminClient()
  const { error } = await admin.from('notes').upsert(
    {
      user_id: user.userId,
      content: typeof content === 'string' ? content : '',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
