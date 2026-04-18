'use client'

import { useEffect, useState, useRef } from 'react'

export default function NotesPanel() {
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>()
  const todayISO = new Date().toISOString().split('T')[0]
  const todayLabel = new Date().toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const response = await fetch('/api/notes', { cache: 'no-store' })
    const payload = await response.json()

    if (response.ok) {
      setNotes(payload.notes ?? '')
      setRating(payload.rating ?? null)
    }
    setLoading(false)
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      setSaving(true)
      await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: value }),
      })
      setSaving(false)
      setLastSaved(new Date())
    }, 900)
  }

  async function handleRating(value: number) {
    const next = rating === value ? null : value
    setRating(next)
    await fetch('/api/day-rating', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: next }),
    })
  }

  function ratingBtnClass(value: number) {
    if (rating === value) {
      if (value <= 3) return 'bg-red-500 text-white border-red-500 scale-110 shadow-md'
      if (value <= 6) return 'bg-amber-400 text-white border-amber-400 scale-110 shadow-md'
      return 'bg-freedom-green text-white border-freedom-green scale-110 shadow-md'
    }
    return 'bg-freedom-gray text-freedom-text-light border-freedom-border hover:border-freedom-green hover:text-freedom-green hover:bg-freedom-green-light'
  }

  function ratingMood() {
    if (!rating) return null
    if (rating <= 2) return { label: 'Rough day', emoji: '😔', color: 'text-red-500' }
    if (rating <= 4) return { label: 'Could be better', emoji: '😕', color: 'text-orange-500' }
    if (rating <= 6) return { label: 'Decent day', emoji: '😐', color: 'text-amber-500' }
    if (rating <= 8) return { label: 'Good day', emoji: '😊', color: 'text-freedom-green' }
    return { label: 'Excellent day!', emoji: '🎉', color: 'text-freedom-green' }
  }

  function ratingBarColor() {
    if (!rating) return ''
    if (rating <= 3) return 'bg-red-500'
    if (rating <= 6) return 'bg-amber-400'
    return 'bg-freedom-green'
  }

  const mood = ratingMood()

  return (
    <div className="flex flex-col gap-4">
      {/* ── Side Notes ── */}
      <div className="bg-white rounded-2xl shadow-card border border-freedom-border flex flex-col" style={{ minHeight: 340 }}>
        <div className="p-5 border-b border-freedom-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-freedom-green rounded-full" />
              <h2 className="text-base font-bold text-freedom-black tracking-tight">Side Notes</h2>
            </div>
            <div className="flex items-center gap-1.5 min-h-[20px]">
              {saving && (
                <span className="text-xs text-freedom-text-light flex items-center gap-1.5">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Saving…
                </span>
              )}
              {!saving && lastSaved && (
                <span className="text-xs text-freedom-text-light flex items-center gap-1">
                  <svg className="w-3 h-3 text-freedom-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved {lastSaved.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-freedom-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <textarea
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="Write your thoughts, ideas, or quick notes here…&#10;&#10;Auto-saves as you type."
              className="w-full h-48 text-sm text-freedom-text placeholder-freedom-text-light resize-none outline-none leading-relaxed"
            />
          )}
        </div>
      </div>

      {/* ── Rate the Day ── */}
      <div className="bg-white rounded-2xl shadow-card border border-freedom-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-freedom-green rounded-full" />
          <h2 className="text-base font-bold text-freedom-black tracking-tight">Rate the Day</h2>
        </div>

        {/* 1–10 grid */}
        <div className="grid grid-cols-5 gap-1.5 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => (
            <button
              key={value}
              onClick={() => handleRating(value)}
              className={`h-9 rounded-xl text-sm font-semibold transition-all duration-150 border-2 ${ratingBtnClass(value)}`}
            >
              {value}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        {rating && (
          <div className="h-1.5 bg-freedom-gray rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${ratingBarColor()}`}
              style={{ width: `${rating * 10}%` }}
            />
          </div>
        )}

        {/* Footer labels */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-freedom-text-light">{todayLabel}</p>
          {mood ? (
            <p className={`text-xs font-semibold ${mood.color}`}>
              {mood.emoji} {mood.label}
            </p>
          ) : (
            <p className="text-xs text-freedom-text-light italic">Not rated yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
