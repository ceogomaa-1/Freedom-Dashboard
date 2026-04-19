import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSessionUser } from '@/utils/auth/session'
import { createAdminClient } from '@/utils/supabase/admin'

// Freedom Mobile's shop is a fully client-side React app — server-side fetch()
// returns an empty HTML shell with zero plan data regardless of the URL.
// We use Claude's up-to-date knowledge of Freedom's plan lineup instead,
// cached in Supabase so we only call Claude once every 6 hours.

export const maxDuration = 60

const CACHE_KEY = 'global'
const SIX_HOURS_MS = 6 * 60 * 60 * 1000

interface FetchedPlan {
  id: string
  name: string
  price: string
  data: string
  network: string
  promoText: string
  is_promo: boolean
}

async function fetchPlansViaClaude(): Promise<FetchedPlan[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `List ALL current Freedom Mobile Canada phone plans available at shop.freedommobile.ca — including Canada-only plans, Canada + US + Mexico plans, and any active promotional offers.

For each plan return a JSON object with exactly these fields:
- "name": plan name as displayed on the website (e.g. "Total Freedom 15GB")
- "price": monthly price with dollar sign (e.g. "$45/mo")
- "data": data allotment (e.g. "15 GB" or "Unlimited")
- "network": coverage area (e.g. "Canada-Wide" or "Canada, US & Mexico")
- "promoText": current promotional offer text, or empty string if none

Return ONLY a valid JSON array with no markdown fencing, no explanation, no other text.`,
      },
    ],
  })

  const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''

  // Strip any accidental markdown fencing
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, string>>
  return parsed.map(p => ({
    id: crypto.randomUUID(),
    name: String(p.name ?? ''),
    price: String(p.price ?? ''),
    data: String(p.data ?? ''),
    network: String(p.network ?? ''),
    promoText: String(p.promoText ?? ''),
    is_promo: Boolean(p.promoText),
  }))
}

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  const admin = createAdminClient()

  // Serve from cache unless force-refreshed
  if (!force) {
    const { data: cached } = await admin
      .from('plan_cache')
      .select('plans, fetched_at')
      .eq('cache_key', CACHE_KEY)
      .maybeSingle()

    if (cached) {
      const ageMs = Date.now() - new Date(cached.fetched_at as string).getTime()
      if (ageMs < SIX_HOURS_MS) {
        return NextResponse.json({
          plans: cached.plans as FetchedPlan[],
          fetched_at: cached.fetched_at as string,
          from_cache: true,
        })
      }
    }
  }

  // Ask Claude for fresh plan data
  try {
    const plans = await fetchPlansViaClaude()
    const fetchedAt = new Date().toISOString()

    // Persist to Supabase cache
    await admin
      .from('plan_cache')
      .upsert(
        { cache_key: CACHE_KEY, plans, fetched_at: fetchedAt },
        { onConflict: 'cache_key' }
      )

    return NextResponse.json({ plans, fetched_at: fetchedAt, from_cache: false })
  } catch (err) {
    console.error('fetch-plans error:', err)

    // Return stale cache rather than a hard error if we have anything
    const { data: stale } = await admin
      .from('plan_cache')
      .select('plans, fetched_at')
      .eq('cache_key', CACHE_KEY)
      .maybeSingle()

    if (stale) {
      return NextResponse.json({
        plans: stale.plans as FetchedPlan[],
        fetched_at: stale.fetched_at as string,
        from_cache: true,
        stale: true,
      })
    }

    return NextResponse.json(
      { error: 'Could not load plans. Tap ↻ to retry.' },
      { status: 502 }
    )
  }
}
