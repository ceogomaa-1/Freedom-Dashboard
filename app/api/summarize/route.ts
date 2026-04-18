import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSessionUser } from '@/utils/auth/session'

const SYSTEM_PROMPT = `You are a Freedom Mobile internal news assistant. You receive content \
from retail reps — this may be pasted text, screenshots of internal bulletins, photos of \
printed notices, or PDF documents from the Connect portal.

Your job: analyze ALL provided content and convert it into a crystal-clear summary for \
retail sales reps on the floor.

Rules:
- If given an image/screenshot, read all visible text and extract all relevant information from it
- Use plain language. No corporate jargon.
- Format output as: 📌 [Bold headline] then 2-3 bullet points max per news item
- Focus on: what changed, who it affects, what the rep needs to DO or KNOW today
- If there are promo details (prices, data amounts, dates, eligibility), highlight them clearly
- End every summary with: "💡 Rep Tip:" with a quick actionable insight
- Keep entire summary under 250 words
- Tone: clear, direct, helpful — like a smart coworker briefing you before your shift`

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

const SUPPORTED_IMAGE_TYPES: Record<string, ImageMediaType> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
}

function bufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64')
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const text = (formData.get('text') as string | null) ?? ''
  const files = formData.getAll('files') as File[]

  if (!text.trim() && files.length === 0) {
    return NextResponse.json({ error: 'Provide text or at least one file.' }, { status: 400 })
  }

  try {
    // Build the multimodal content array for Claude
    type ContentBlock =
      | { type: 'text'; text: string }
      | { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }
      | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }

    const content: ContentBlock[] = []
    const extraText: string[] = []

    for (const file of files) {
      const imageType = SUPPORTED_IMAGE_TYPES[file.type]
      if (imageType) {
        const buffer = await file.arrayBuffer()
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: imageType, data: bufferToBase64(buffer) },
        })
      } else if (file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer()
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: bufferToBase64(buffer) },
        })
      } else {
        // Plain text file — read content and append to text block
        const fileText = await file.text()
        extraText.push(`--- ${file.name} ---\n${fileText}`)
      }
    }

    // Combine user text + extracted text file contents
    const fullText = [text.trim(), ...extraText].filter(Boolean).join('\n\n')
    const textBlock: ContentBlock = { type: 'text', text: fullText || 'Please summarize the content in the attached files.' }
    content.push(textBlock)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    const result = message.content[0]
    if (result.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected AI response.' }, { status: 500 })
    }

    return NextResponse.json({ summary: result.text })
  } catch (err) {
    console.error('Summarize error:', err)
    return NextResponse.json(
      { error: 'Failed to summarize. Please try again.' },
      { status: 500 }
    )
  }
}
