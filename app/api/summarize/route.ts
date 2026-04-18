import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSessionUser } from '@/utils/auth/session'

const SYSTEM_PROMPT = `You are a Freedom Mobile internal news assistant. Your job is to take raw \
internal news/bulletins from Freedom's connect portal and convert them into crystal-clear, \
dead-simple summaries for retail sales reps on the floor.

Rules:
- Use plain language. No corporate jargon.
- Format output as: 📌 [Bold headline] then 2-3 bullet points max per news item
- Focus on: what changed, who it affects, what the rep needs to DO or KNOW today
- If there are promo details (prices, data amounts, dates), highlight them clearly
- End every summary with one line: "💡 Rep Tip:" with a quick actionable insight
- Keep entire summary under 200 words
- Tone: clear, direct, helpful — like a smart coworker briefing you before a shift`

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let text: string
  try {
    const body = await request.json() as { text: string }
    text = body.text
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!text?.trim()) {
    return NextResponse.json({ error: 'News text is required.' }, { status: 400 })
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.trim() }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected AI response.' }, { status: 500 })
    }

    return NextResponse.json({ summary: content.text })
  } catch (err) {
    console.error('Summarize error:', err)
    return NextResponse.json(
      { error: 'Failed to summarize. Please try again.' },
      { status: 500 }
    )
  }
}
