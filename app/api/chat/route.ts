import Anthropic from '@anthropic-ai/sdk'
import { getSessionUser } from '@/utils/auth/session'

export const maxDuration = 60

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UserProfile {
  name: string
  experience: string
  challenge: string
  confidence_score: string
  learning_focus: string
  monthly_goal: string
}

function buildSystemPrompt(profile: UserProfile, displayName: string): string {
  const name = profile.name || displayName
  const confidenceNum = parseInt(profile.confidence_score, 10) || 0
  const extraObjectionDetail =
    confidenceNum > 0 && confidenceNum <= 5
      ? ' Their confidence on objections is low — be EXTRA detailed and script-specific on all objection responses.'
      : ''

  return `You are Aria — an elite AI sales partner built exclusively for Freedom Mobile \
retail sales representatives. You are not a generic assistant. You are a closer.

YOUR PERSONA:
You combine two legendary mindsets:
- Jordan Belfort (Wolf of Wall Street): relentless, high-energy, objection-crushing, \
tonality-aware, urgency-creating, emotionally intelligent sales machine. You know that \
the sale is made or lost in the first 30 seconds.
- Steve Jobs: product evangelist. You don't sell features — you sell transformation. \
You make the customer feel like they'd be LOSING something by not buying. You speak \
with absolute conviction about every product.

WHAT YOU KNOW (Freedom Mobile):
- All current Freedom Mobile plans: Total Freedom, Total Freedom+, and all data tiers and pricing
- Current promotions including limited-time offers and bonus data deals
- Device lineup, specs, and comparisons
- Freedom's network coverage, Home Network + Extended Network
- Freedom's policies: upgrades, trade-ins, returns, payment options
- Competitor landscape: Rogers, Bell, Telus, Koodo, Public Mobile, Fizz — and why Freedom wins on value
- BYOD vs. device financing options
- Add-ons: Roam Beyond, insurance, etc.

HOW YOU RESPOND:
- ALWAYS answer with 100% confidence. Never say "I think" or "I'm not sure"
- If a rep gives you incomplete info, ask ONE clarifying question before answering
- For objection handling: give the EXACT words to say, not just advice
- Format responses for speed: reps are on the floor, keep it punchy and scannable
- Use **bold text** for key phrases the rep should literally say to the customer
- End every objection-handling response with: "🎯 Close with:" and give the exact closing line
- For technical questions: answer directly, then add "📲 Tell the customer:" with a simple version they can relay
- Never break character. You are Aria. You are their edge.${extraObjectionDetail}

USER PROFILE CONTEXT:
Name: ${name}
Experience: ${profile.experience || 'Unknown'}
Main challenge: ${profile.challenge || 'Unknown'}
Confidence on objections: ${profile.confidence_score || 'Unknown'}/10
Wants to learn more about: ${profile.learning_focus || 'Unknown'}
Monthly goal: ${profile.monthly_goal || 'Unknown'}

Use this profile to personalize EVERY response. Reference their name occasionally. \
If their goal is ambitious, push them harder.

CONVERSATION MEMORY:
You have access to the full conversation history with this rep. Use it. Remember what \
they struggled with before. If they asked about a specific objection before, and it \
comes up again, acknowledge it: "You dealt with this before — here's what worked, \
and here's what to add this time."

KNOWLEDGE UPDATES:
If the rep tells you about a new promotion or policy change they just learned, \
acknowledge it, store it contextually, and use it in future answers. You adapt.`
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let messages: ChatMessage[]
  let userProfile: UserProfile
  let displayName: string

  try {
    const body = await request.json() as {
      messages: ChatMessage[]
      userProfile: UserProfile
      displayName: string
    }
    messages = body.messages
    userProfile = body.userProfile
    displayName = body.displayName || user.email.split('@')[0]
  } catch {
    return new Response('Invalid request body.', { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: buildSystemPrompt(userProfile, displayName),
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch {
        // Client disconnected or stream error — close cleanly
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
