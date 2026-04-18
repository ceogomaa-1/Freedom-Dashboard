'use client'

import { useState } from 'react'

function renderFormatted(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-n-text">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

export default function NewsSummaryPanel() {
  const [input, setInput] = useState('')
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSummarize() {
    if (!input.trim() || loading) return
    setLoading(true)
    setError('')
    setSummary('')

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.trim() }),
      })
      const data = await res.json() as { summary?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to summarize.')
      setSummary(data.summary ?? '')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setInput('')
    setSummary('')
    setError('')
  }

  return (
    <div className="bg-n-surface border border-n-border rounded-xl flex flex-col" style={{ minHeight: 400 }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-n-divider">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 bg-n-green rounded-full flex-shrink-0" />
          <h2 className="text-sm font-semibold text-n-text">Today's News</h2>
          {(input || summary || error) && (
            <button
              onClick={handleClear}
              className="ml-auto text-xs text-n-muted hover:text-n-sub transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-3 py-3 gap-3 min-h-0">
        {/* Input */}
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Paste Connect news here..."
          className="w-full px-3 py-2.5 bg-n-bg border border-n-border rounded-lg text-sm text-n-text placeholder-n-muted focus:outline-none focus:border-n-green transition-colors resize-none"
          style={{ minHeight: 110 }}
        />

        {/* Summarize button */}
        <button
          onClick={handleSummarize}
          disabled={!input.trim() || loading}
          className="w-full py-2 bg-n-green hover:bg-n-green-d text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 flex-shrink-0"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Summarizing…
            </>
          ) : (
            'Summarize'
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="px-3 py-2.5 bg-n-red-x border border-n-red/20 rounded-lg text-xs text-n-red flex-shrink-0">
            {error}
          </div>
        )}

        {/* Output */}
        {summary && (
          <div className="flex-1 overflow-y-auto px-3 py-3 bg-n-bg border border-n-border rounded-lg min-h-0">
            <p className="text-xs text-n-muted mb-2 font-medium uppercase tracking-wide">Summary</p>
            <div className="text-sm text-n-sub leading-relaxed whitespace-pre-wrap">
              {renderFormatted(summary)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
