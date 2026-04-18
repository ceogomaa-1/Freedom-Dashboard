import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSessionUser } from '@/utils/auth/session'
import { createAdminClient } from '@/utils/supabase/admin'

export const maxDuration = 60

const CACHE_KEY = 'global'
const SIX_HOURS_MS = 6 * 60 * 60 * 1000

const FREEDOM_PLANS_URL = 'https://www.freedommobile.ca/en/plans'

interface FetchedPlan {
  id: string
  name: string
  price: string
  data: string
  network: string
  promoText: string
  is_promo: boolean
}

// ── HTML fetch ─────────────────────────────────────────────────────────────

async function fetchFreedomHtml(): Promise<string> {
  const res = await fetch(FREEDOM_PLANS_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Freedom site returned ${res.status}`)
  return res.text()
}

// ── Option A: parse __NEXT_DATA__ JSON embedded in page ────────────────────

function tryParseNextData(html: string): FetchedPlan[] {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match) return []

  let json: unknown
  try {
    json = JSON.parse(match[1])
  } catch {
    return []
  }

  const plans: FetchedPlan[] = []
  extractPlansFromValue(json, plans)
  return plans
}

// Recursively walk any object/array looking for plan-like structures
function extractPlansFromValue(val: unknown, out: FetchedPlan[]): void {
  if (!val || typeof val !== 'object') return
  if (Array.isArray(val)) {
    val.forEach(item => extractPlansFromValue(item, out))
    return
  }
  const rec = val as Record<string, unknown>

  // Heuristic: objects that have a price-like value AND a data-like value look like plans
  const keys = Object.keys(rec).map(k => k.toLowerCase())
  const hasPrice = keys.some(k => k.includes('price') || k.includes('cost') || k.includes('rate'))
  const hasData = keys.some(k => k.includes('data') || k.includes('gb') || k.includes('bandwidth'))
  const hasName = keys.some(k => k.includes('name') || k.includes('title') || k.includes('plan'))

  if (hasPrice && (hasData || hasName)) {
    const plan = tryBuildPlan(rec)
    if (plan) { out.push(plan); return }
  }

  // Keep walking
  Object.values(rec).forEach(v => extractPlansFromValue(v, out))
}

function tryBuildPlan(rec: Record<string, unknown>): FetchedPlan | null {
  const find = (...keys: string[]): string => {
    for (const k of Object.keys(rec)) {
      if (keys.some(key => k.toLowerCase().includes(key))) {
        const v = rec[k]
        if (typeof v === 'string' || typeof v === 'number') return String(v)
      }
    }
    return ''
  }

  const name = find('name', 'title', 'planname', 'plan_name')
  const priceRaw = find('price', 'cost', 'rate', 'amount')
  const data = find('data', 'gb', 'bandwidth', 'included')

  if (!name && !priceRaw) return null

  const price = priceRaw.match(/\d/) ? (priceRaw.startsWith('$') ? priceRaw : `$${priceRaw}`) : priceRaw
  const promoText = find('promo', 'bonus', 'offer', 'discount', 'badge')

  return {
    id: crypto.randomUUID(),
    name,
    price,
    data,
    network: find('network', 'coverage', 'roam', 'region'),
    promoText,
    is_promo: Boolean(promoText),
  }
}

// ── Option B: regex-scan visible HTML text ─────────────────────────────────

function tryParseRegex(html: string): FetchedPlan[] {
  // Freedom's plan cards typically contain a plan name near a price like "$XX/mo"
  // and a data amount like "XX GB". We try to find co-located groups.
  const plans: FetchedPlan[] = []

  // Strip script/style tags, keeping only likely content areas
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')

  // Find all price occurrences: $XX or $XX.XX (possibly "per month" nearby)
  const priceRegex = /\$\s*(\d{1,3}(?:\.\d{2})?)\s*(?:\/\s*mo(?:nth)?)?/gi
  const priceMatches = [...cleaned.matchAll(priceRegex)]

  for (const pm of priceMatches) {
    const priceStr = `$${pm[1]}/mo`
    const idx = pm.index ?? 0

    // Look for plan name and data in a window around the price (±500 chars)
    const window = cleaned.slice(Math.max(0, idx - 500), idx + 500)
    const stripped = window.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    // Data amount
    const dataMatch = stripped.match(/(\d+)\s*GB/i)
    const unlimitedMatch = stripped.match(/unlimited/i)
    const data = dataMatch ? `${dataMatch[1]} GB` : unlimitedMatch ? 'Unlimited' : ''

    // Network type
    const networkMatch = stripped.match(/Canada[\s\-–]+US[\s\-–]+Mexico|Canada only|Nationwide/i)
    const network = networkMatch ? networkMatch[0] : ''

    // Plan name — look for common Freedom plan name patterns
    const nameMatch = stripped.match(
      /Total Freedom\+?|Freedom (?:Basic|Plus|Max|Ultra|\d+GB)|[\w\s]+ Plan/i
    )
    const name = nameMatch ? nameMatch[0].trim() : `Plan at ${priceStr}`

    // Promo text
    const promoMatch = stripped.match(/bonus\s+\d+\s*GB|limited[\s\-]time|promo|save \$\d+/i)
    const promoText = promoMatch ? promoMatch[0] : ''

    // Avoid duplicates on same price
    if (!plans.some(p => p.price === priceStr && p.name === name)) {
      plans.push({
        id: crypto.randomUUID(),
        name,
        price: priceStr,
        data,
        network,
        promoText,
        is_promo: Boolean(promoText),
      })
    }
  }

  return plans
}

// ── Option C: Claude extraction fallback ───────────────────────────────────

async function parseWithClaude(html: string): Promise<FetchedPlan[]> {
  // Strip tags, deduplicate whitespace, then truncate to ~60k chars
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60_000)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content:
          'Extract all Freedom Mobile plan data from this text. Return ONLY a JSON array ' +
          'with objects containing: name, price, data, network, promoText. ' +
          'No explanation, just the JSON array.\n\n' +
          text,
      },
    ],
  })

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  try {
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
  } catch {
    return []
  }
}

// ── Main fetch orchestrator ─────────────────────────────────────────────────

async function fetchFreshPlans(): Promise<FetchedPlan[]> {
  const html = await fetchFreedomHtml()

  // Option A
  const fromNextData = tryParseNextData(html)
  if (fromNextData.length >= 3) return fromNextData

  // Option B
  const fromRegex = tryParseRegex(html)
  if (fromRegex.length >= 3) return fromRegex

  // Option C — Claude fallback
  return parseWithClaude(html)
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  const admin = createAdminClient()

  // Check cache unless forced refresh
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

  // Fetch fresh data; fall back to stale cache on error
  try {
    const plans = await fetchFreshPlans()
    const fetchedAt = new Date().toISOString()

    await admin
      .from('plan_cache')
      .upsert(
        { cache_key: CACHE_KEY, plans, fetched_at: fetchedAt },
        { onConflict: 'cache_key' }
      )

    return NextResponse.json({ plans, fetched_at: fetchedAt, from_cache: false })
  } catch (err) {
    console.error('fetch-plans error:', err)

    // Return stale cache if we have it rather than a hard error
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
      { error: 'Could not load plans from Freedom website.' },
      { status: 502 }
    )
  }
}
