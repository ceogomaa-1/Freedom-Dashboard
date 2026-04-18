import { NextResponse } from 'next/server'
import { getSessionUser } from '@/utils/auth/session'
import { createAdminClient } from '@/utils/supabase/admin'

export async function PUT(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { rating } = await request.json()
  const today = new Date().toISOString().split('T')[0]
  const admin = createAdminClient()

  if (rating === null) {
    const { error } = await admin
      .from('day_ratings')
      .delete()
      .eq('user_id', user.userId)
      .eq('date', today)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, rating: null })
  }

  if (typeof rating !== 'number' || rating < 1 || rating > 10) {
    return NextResponse.json({ error: 'Rating must be between 1 and 10.' }, { status: 400 })
  }

  const { error } = await admin.from('day_ratings').upsert(
    {
      user_id: user.userId,
      rating,
      date: today,
    },
    { onConflict: 'user_id,date' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, rating })
}
