import { NextResponse } from 'next/server'
import { getSessionUser } from '@/utils/auth/session'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

const CACHE_KEY = 'global'

interface FetchedPlan {
  id: string
  name: string
  price: string
  data: string
  network: string
  promoText: string
  is_promo: boolean
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('plan_cache')
    .select('plans, fetched_at')
    .eq('cache_key', CACHE_KEY)
    .maybeSingle()

  if (error) {
    console.error('fetch-plans DB error:', error)
    return NextResponse.json({ plans: [], fetched_at: null, status: 'error' }, { status: 502 })
  }

  if (!data) {
    return NextResponse.json({ plans: [], fetched_at: null, status: 'empty' })
  }

  return NextResponse.json({
    plans: data.plans as FetchedPlan[],
    fetched_at: data.fetched_at as string,
    status: 'ok',
  })
}
