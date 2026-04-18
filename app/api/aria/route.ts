import { NextResponse } from 'next/server'
import { getSessionUser } from '@/utils/auth/session'
import { createAdminClient } from '@/utils/supabase/admin'

interface AriaMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface UserProfile {
  name: string
  experience: string
  challenge: string
  confidence_score: string
  learning_focus: string
  monthly_goal: string
}

interface PutBody {
  messages: AriaMessage[]
  onboarding_complete: boolean
  user_profile: UserProfile
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('aria_conversations')
    .select('messages, onboarding_complete, user_profile, updated_at')
    .eq('user_id', user.userId)
    .maybeSingle()

  return NextResponse.json({ conversation: data ?? null })
}

export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PutBody
  try {
    body = await request.json() as PutBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('aria_conversations')
    .upsert(
      {
        user_id: user.userId,
        messages: body.messages,
        onboarding_complete: body.onboarding_complete,
        user_profile: body.user_profile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversation: data })
}

export async function DELETE() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('aria_conversations')
    .delete()
    .eq('user_id', user.userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
