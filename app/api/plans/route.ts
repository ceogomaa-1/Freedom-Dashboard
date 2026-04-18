import { NextResponse } from 'next/server'
import { getSessionUser } from '@/utils/auth/session'
import { createAdminClient } from '@/utils/supabase/admin'

// TODO: Replace manual input with automated fetch from Freedom website
// Requires: authenticated session forwarding from connect.freedommobile.ca
// or corporate API access credentials
// Endpoint target: Freedom public plans page + Connect internal pricing tools

interface Plan {
  id: string
  name: string
  data: string
  price: string
  is_promo: boolean
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('plan_snapshots')
    .select('plans, updated_at')
    .eq('user_id', user.userId)
    .maybeSingle()

  return NextResponse.json({ snapshot: data ?? null })
}

export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let plans: Plan[]
  try {
    const body = await request.json() as { plans: Plan[] }
    plans = body.plans
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('plan_snapshots')
    .upsert(
      {
        user_id: user.userId,
        plans,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ snapshot: data })
}
