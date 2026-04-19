'use client'

import { useEffect, useState, useRef } from 'react'

export default function NotesPanel() {
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  const todayLabel = new Date().toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  useEffect(() => {
    fetch('/api/notes', { cache: 'no-store' })
      .then(r => r.json())
      .then(p => {
        if (p.notes !== undefined) setNotes(p.notes)
        if (p.rating !== undefined) setRating(p.rating)
        setLoading(false)
      })
  }, [])

  function handleNotesChange(value: string) {
    setNotes(value)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setSaving(true)
      await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: value }),
      })
      setSaving(false)
      setLastSaved(new Date())
    }, 800)
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

  function ratingStyle(v: number) {
    if (rating === v) {
      if (v <= 3) return 'bg-n-red text-white border-n-red'
      if (v <= 6) return 'bg-n-amber text-white border-n-amber'
      return 'bg-n-green text-white border-n-green'
    }
    return 'bg-n-raised text-n-sub border-n-border hover:border-n-green hover:text-n-green'
  }

  function ratingBarColor() {
    if (!rating) return ''
    if (rating <= 3) return 'bg-n-red'
    if (rating <= 6) return 'bg-n-amber'
    return 'bg-n-green'
  }

  function mood() {
    if (!rating) return null
    if (rating <= 2) return '😔 Rough day'
    if (rating <= 4) return '😕 Could be better'
    if (rating <= 6) return '😐 Decent day'
    if (rating <= 8) return '😊 Good day'
    return '🎉 Excellent day!'
  }

  function handlePrint() {
    window.print()
  }

  const printDate = new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Print styles — only active during window.print() */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-note-content,
          #print-note-content * { visibility: visible !important; }
          #print-note-content {
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            padding: 40px !important;
            font-family: Georgia, serif !important;
            color: #000 !important;
            background: #fff !important;
          }
        }
      `}</style>

      {/* Hidden print target */}
      <div id="print-note-content" style={{ display: 'none' }}>
        <div style={{ borderBottom: '1px solid #ccc', paddingBottom: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 'bold' }}>Freedom Dashboard — Note</div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{printDate}</div>
        </div>
        <pre style={{ fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
          {notes}
        </pre>
      </div>

      {/* ── Notes ── */}
      <div className="bg-n-surface border border-n-border rounded-xl flex flex-col" style={{ minHeight: 340 }}>
        <div className="px-4 pt-4 pb-3 border-b border-n-divider">
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-4 bg-n-green rounded-full flex-shrink-0" />
            <h2 className="text-sm font-semibold text-n-text">Side Notes</h2>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={handlePrint}
                title="Print note"
                className="p-1 text-n-muted hover:text-n-green transition-colors"
                aria-label="Print note"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
              </button>
              {saving && (
                <span className="text-xs text-n-muted flex items-center gap-1">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Saving
                </span>
              )}
              {!saving && lastSaved && (
                <span className="text-xs text-n-muted flex items-center gap-1">
                  <svg className="w-2.5 h-2.5 text-n-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  {lastSaved.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-n-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <textarea
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder={"Write freely…\n\nThis auto-saves as you type."}
              className="w-full h-52 text-sm text-n-text placeholder-n-muted resize-none outline-none leading-relaxed bg-transparent"
            />
          )}
        </div>
      </div>

      {/* ── Rate the Day ── */}
      <div className="bg-n-surface border border-n-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-0.5 h-4 bg-n-green rounded-full flex-shrink-0" />
          <h2 className="text-sm font-semibold text-n-text">Rate the Day</h2>
        </div>

        {/* 1-10 grid */}
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
            <button
              key={v}
              onClick={() => handleRating(v)}
              className={`h-8 rounded-lg text-xs font-semibold border transition-all duration-100 ${ratingStyle(v)} ${rating === v ? 'scale-105' : ''}`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        {rating !== null && (
          <div className="h-0.5 bg-n-raised rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${ratingBarColor()}`}
              style={{ width: `${(rating ?? 0) * 10}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-n-muted">{todayLabel}</p>
          <p className="text-xs text-n-sub">{mood() ?? <span className="italic text-n-muted">not rated</span>}</p>
        </div>
      </div>
    </div>
  )
}
