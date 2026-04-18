import { NextResponse } from 'next/server'
import { getSessionUser } from '@/utils/auth/session'
import { createAdminClient } from '@/utils/supabase/admin'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (typeof body.text === 'string' && body.text.trim()) {
    updates.text = body.text.trim()
  }

  if (typeof body.date === 'string' && body.date) {
    updates.date = body.date
  }

  if (typeof body.completed === 'boolean') {
    updates.completed = body.completed
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('reminders')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.userId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reminder: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('reminders').delete().eq('id', id).eq('user_id', user.userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
