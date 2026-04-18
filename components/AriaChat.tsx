'use client'

import { useState, useEffect, useRef } from 'react'

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

interface AriaConversation {
  messages: AriaMessage[]
  onboarding_complete: boolean
  user_profile: UserProfile
}

const ONBOARDING_QUESTIONS = [
  'How long have you been selling at Freedom? And what store are you at?',
  "What's your biggest challenge right now on the floor — objections, product knowledge, closing, or something else?",
  "On a scale of 1-10, how confident are you handling a customer who says 'I\u2019ll think about it'?",
  'What\u2019s the one thing you wish you knew WAY more about — plans, devices, promotions, or competitors?',
  "Last one — what\u2019s your sales goal this month? Let\u2019s make it real.",
]

function makeMsg(role: 'user' | 'assistant', content: string): AriaMessage {
  return { id: crypto.randomUUID(), role, content, timestamp: new Date().toISOString() }
}

function defaultProfile(name: string): UserProfile {
  return { name, experience: '', challenge: '', confidence_score: '', learning_focus: '', monthly_goal: '' }
}

function extractProfile(messages: AriaMessage[], name: string): UserProfile {
  const answers = messages.filter(m => m.role === 'user')
  return {
    name,
    experience: answers[0]?.content ?? '',
    challenge: answers[1]?.content ?? '',
    confidence_score: answers[2]?.content ?? '',
    learning_focus: answers[3]?.content ?? '',
    monthly_goal: answers[4]?.content ?? '',
  }
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
}

function renderFormatted(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 150, 300].map(delay => (
        <span
          key={delay}
          className="w-1.5 h-1.5 bg-n-muted rounded-full animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

export default function AriaChat({ displayName }: { displayName: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<AriaMessage[]>([])
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile(displayName))
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const didInitOnboarding = useRef(false)

  // Load conversation from Supabase on mount
  useEffect(() => {
    loadConversation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 150)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Trigger onboarding once loading is done and chat is open with no history
  useEffect(() => {
    if (!loading && isOpen && messages.length === 0 && !onboardingComplete && !didInitOnboarding.current) {
      didInitOnboarding.current = true
      initOnboarding()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isOpen])

  async function loadConversation() {
    try {
      const res = await fetch('/api/aria', { cache: 'no-store' })
      const data = await res.json() as { conversation: AriaConversation | null }
      if (res.ok && data.conversation) {
        setMessages(data.conversation.messages ?? [])
        setOnboardingComplete(data.conversation.onboarding_complete ?? false)
        setUserProfile(
          data.conversation.user_profile ?? defaultProfile(displayName)
        )
      }
    } catch {
      // network error — proceed with empty state
    }
    setLoading(false)
  }

  async function saveConversation(
    msgs: AriaMessage[],
    onboardingDone: boolean,
    profile: UserProfile
  ) {
    await fetch('/api/aria', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: msgs,
        onboarding_complete: onboardingDone,
        user_profile: profile,
      }),
    })
  }

  function initOnboarding() {
    const opening = makeMsg(
      'assistant',
      `Hey ${displayName}! I\u2019m Aria \u2014 your personal sales partner on the floor. Before we get started, I want to make sure I can actually HELP you, not just give you generic answers. Give me 60 seconds to get to know you.`
    )
    const q1 = makeMsg('assistant', ONBOARDING_QUESTIONS[0])
    const initial = [opening, q1]
    setMessages(initial)
    saveConversation(initial, false, defaultProfile(displayName))
  }

  function handleOpen() {
    setIsOpen(true)
    if (!loading && messages.length === 0 && !onboardingComplete && !didInitOnboarding.current) {
      didInitOnboarding.current = true
      initOnboarding()
    }
  }

  async function handleSend() {
    if (!input.trim() || streaming || loading) return

    const userMsg = makeMsg('user', input.trim())
    setInput('')
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)

    if (!onboardingComplete) {
      await handleOnboardingStep(updatedMessages)
    } else {
      await streamAriaResponse(updatedMessages)
    }
  }

  async function handleOnboardingStep(updatedMessages: AriaMessage[]) {
    const userAnswers = updatedMessages.filter(m => m.role === 'user')
    const answerCount = userAnswers.length

    if (answerCount < 5) {
      // Ask next pre-scripted question
      const nextQ = makeMsg('assistant', ONBOARDING_QUESTIONS[answerCount])
      const newMessages = [...updatedMessages, nextQ]
      setMessages(newMessages)
      await saveConversation(newMessages, false, userProfile)
    } else {
      // All 5 answers in — build profile, generate personalized completion
      const profile = extractProfile(updatedMessages, displayName)
      setUserProfile(profile)
      await streamOnboardingCompletion(updatedMessages, profile)
    }
  }

  async function streamOnboardingCompletion(
    updatedMessages: AriaMessage[],
    profile: UserProfile
  ) {
    setStreaming(true)
    const streamingId = crypto.randomUUID()

    // Prime the streaming placeholder
    setMessages(prev => [
      ...prev,
      { id: streamingId, role: 'assistant', content: '', timestamp: new Date().toISOString() },
    ])

    // Build a prompt that asks Aria to generate the completion message
    const completionMessages = [
      ...updatedMessages.map(m => ({ role: m.role, content: m.content })),
      {
        role: 'user' as const,
        content:
          `[INTERNAL ONBOARDING COMPLETE] Generate your personalized completion message. ` +
          `Start with "Perfect. I've got you." then reference: name = "${profile.name}", ` +
          `experience = "${profile.experience}", main challenge = "${profile.challenge}", ` +
          `monthly goal = "${profile.monthly_goal}". End with "Let's get to work. Ask me anything." ` +
          `Keep it under 80 words. Personal and motivating.`,
      },
    ]

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: completionMessages,
          userProfile: profile,
          displayName,
        }),
      })

      let fullText = ''

      if (res.ok && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
          setMessages(prev =>
            prev.map(m => (m.id === streamingId ? { ...m, content: fullText } : m))
          )
        }
      } else {
        // Fallback scripted completion
        fullText =
          `Perfect. I\u2019ve got you. From now on, every answer I give you is built around YOUR profile \u2014 ` +
          `${profile.name}, working on ${profile.challenge || 'your challenges'}. ` +
          `Goal noted. Let\u2019s get to work. Ask me anything.`
        setMessages(prev =>
          prev.map(m => (m.id === streamingId ? { ...m, content: fullText } : m))
        )
      }

      const completionMsg: AriaMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullText,
        timestamp: new Date().toISOString(),
      }

      const finalMessages = [
        ...updatedMessages,
        completionMsg,
      ]
      setMessages(finalMessages)
      setOnboardingComplete(true)
      await saveConversation(finalMessages, true, profile)
    } catch {
      const fallback = makeMsg(
        'assistant',
        `Perfect. I\u2019ve got you. From now on every answer is built around YOUR profile \u2014 ${profile.name}. Let\u2019s get to work. Ask me anything.`
      )
      const finalMessages = [...updatedMessages, fallback]
      setMessages(finalMessages)
      setOnboardingComplete(true)
      await saveConversation(finalMessages, true, profile)
    } finally {
      setStreaming(false)
    }
  }

  async function streamAriaResponse(currentMessages: AriaMessage[]) {
    setStreaming(true)
    const streamingId = crypto.randomUUID()

    setMessages(prev => [
      ...prev,
      { id: streamingId, role: 'assistant', content: '', timestamp: new Date().toISOString() },
    ])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
          userProfile,
          displayName,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error('Failed to get response.')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        setMessages(prev =>
          prev.map(m => (m.id === streamingId ? { ...m, content: fullText } : m))
        )
      }

      const finalMsg: AriaMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullText,
        timestamp: new Date().toISOString(),
      }

      const finalMessages = [...currentMessages, finalMsg]
      setMessages(finalMessages)
      await saveConversation(finalMessages, onboardingComplete, userProfile)
    } catch {
      const errMsg = makeMsg('assistant', 'Sorry, something went wrong. Please try again.')
      setMessages(prev => [
        ...prev.filter(m => m.id !== streamingId),
        errMsg,
      ])
    } finally {
      setStreaming(false)
    }
  }

  async function handleClearChat() {
    await fetch('/api/aria', { method: 'DELETE' })
    didInitOnboarding.current = false
    setMessages([])
    setOnboardingComplete(false)
    setUserProfile(defaultProfile(displayName))
    setShowClearConfirm(false)
    // Re-trigger onboarding
    didInitOnboarding.current = true
    const opening = makeMsg(
      'assistant',
      `Hey ${displayName}! I\u2019m Aria \u2014 your personal sales partner on the floor. Before we get started, I want to make sure I can actually HELP you, not just give you generic answers. Give me 60 seconds to get to know you.`
    )
    const q1 = makeMsg('assistant', ONBOARDING_QUESTIONS[0])
    const initial = [opening, q1]
    setMessages(initial)
    saveConversation(initial, false, defaultProfile(displayName))
  }

  return (
    <>
      {/* ── Floating chat button ── */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-n-green hover:bg-n-green-d rounded-full shadow-panel-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="Chat with Aria"
        aria-label="Open Aria chat"
      >
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>

      {/* ── Backdrop ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Chat drawer ── */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[380px] bg-n-surface border-l border-n-border flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-n-divider flex items-center gap-3 flex-shrink-0 bg-n-surface">
          <div className="w-8 h-8 rounded-full bg-n-green flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">A</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-n-text leading-tight">Aria</p>
            <p className="text-xs text-n-muted">Your Sales Partner</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearConfirm(true)}
              title="Reset Aria's memory"
              className="p-1.5 text-n-muted hover:text-n-sub transition-colors rounded"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-n-muted hover:text-n-sub transition-colors rounded"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-n-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-n-muted text-center py-10">
              Start chatting with Aria…
            </p>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-n-green flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-white">A</span>
                  </div>
                )}
                <div
                  className={`max-w-[78%] flex flex-col gap-0.5 ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-n-green text-white rounded-tr-sm'
                        : 'bg-n-raised border border-n-border text-n-text rounded-tl-sm'
                    }`}
                  >
                    {msg.content === '' ? (
                      <TypingDots />
                    ) : (
                      renderFormatted(msg.content)
                    )}
                  </div>
                  <span className="text-xs text-n-muted px-1">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="px-3 pb-4 pt-2.5 border-t border-n-divider flex-shrink-0 bg-n-surface">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask Aria anything…"
              disabled={streaming || loading}
              className="flex-1 px-3 py-2 bg-n-bg border border-n-border rounded-lg text-sm text-n-text placeholder-n-muted focus:outline-none focus:border-n-green transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming || loading}
              className="px-3 py-2 bg-n-green hover:bg-n-green-d text-white rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              aria-label="Send message"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Clear memory confirmation ── */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowClearConfirm(false)}
            aria-hidden
          />
          <div className="relative bg-n-surface border border-n-border rounded-xl p-5 max-w-sm w-full shadow-panel-lg">
            <h3 className="text-sm font-semibold text-n-text mb-2">Reset Aria&apos;s Memory?</h3>
            <p className="text-xs text-n-sub mb-4 leading-relaxed">
              This will reset Aria&apos;s memory of you. Are you sure?
              Your profile and all conversation history will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-1.5 text-xs text-n-muted hover:text-n-sub transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChat}
                className="px-4 py-1.5 text-xs bg-n-red text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Reset Memory
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
