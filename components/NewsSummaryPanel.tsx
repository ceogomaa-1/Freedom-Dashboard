'use client'

import { useState, useRef, useCallback } from 'react'

interface Attachment {
  id: string
  file: File
  kind: 'image' | 'pdf' | 'text'
  preview?: string // object URL for image thumbnails
}

function renderFormatted(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-n-text">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

function fileKind(file: File): 'image' | 'pdf' | 'text' {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf') return 'pdf'
  return 'text'
}

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB
const MAX_ATTACHMENTS = 3

export default function NewsSummaryPanel() {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasContent = input.trim().length > 0 || attachments.length > 0

  function addFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) return `"${file.name}" is over 4 MB and was skipped.`
    const kind = fileKind(file)
    const accepted = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain']
    if (!accepted.includes(file.type) && !file.name.endsWith('.txt')) {
      return `"${file.name}" is not a supported file type.`
    }
    const preview = kind === 'image' ? URL.createObjectURL(file) : undefined
    setAttachments(prev => [
      ...prev,
      { id: crypto.randomUUID(), file, kind, preview },
    ])
    return null
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const warnings: string[] = []
    const available = MAX_ATTACHMENTS - attachments.length

    files.slice(0, available).forEach(f => {
      const warn = addFile(f)
      if (warn) warnings.push(warn)
    })
    if (files.length > available) {
      warnings.push(`Only ${MAX_ATTACHMENTS} attachments allowed — some files were skipped.`)
    }
    if (warnings.length) setError(warnings.join(' '))
    e.target.value = ''
  }

  function removeAttachment(id: string) {
    setAttachments(prev => {
      const att = prev.find(a => a.id === id)
      if (att?.preview) URL.revokeObjectURL(att.preview)
      return prev.filter(a => a.id !== id)
    })
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItems = items.filter(item => item.type.startsWith('image/'))
      if (imageItems.length === 0) return

      e.preventDefault()
      const warnings: string[] = []
      const available = MAX_ATTACHMENTS - attachments.length

      imageItems.slice(0, available).forEach(item => {
        const file = item.getAsFile()
        if (!file) return
        // Clipboard images have a generic name — give a useful one
        const ext = file.type.split('/')[1] ?? 'png'
        const named = new File([file], `screenshot.${ext}`, { type: file.type })
        const warn = addFile(named)
        if (warn) warnings.push(warn)
      })
      if (warnings.length) setError(warnings[0])
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attachments.length]
  )

  async function handleSummarize() {
    if (!hasContent || loading) return
    setLoading(true)
    setError('')
    setSummary('')

    try {
      const body = new FormData()
      body.append('text', input.trim())
      attachments.forEach(a => body.append('files', a.file))

      const res = await fetch('/api/summarize', { method: 'POST', body })
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
    attachments.forEach(a => { if (a.preview) URL.revokeObjectURL(a.preview) })
    setInput('')
    setAttachments([])
    setSummary('')
    setError('')
  }

  return (
    <div className="bg-n-surface border border-n-border rounded-xl flex flex-col" style={{ minHeight: 400 }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-n-divider">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 bg-n-green rounded-full flex-shrink-0" />
          <h2 className="text-sm font-semibold text-n-text">Today&apos;s News</h2>
          {(hasContent || summary || error) && (
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

        {/* Textarea */}
        <div className="relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onPaste={handlePaste}
            placeholder="Paste Connect news here..."
            className="w-full px-3 py-2.5 bg-n-bg border border-n-border rounded-lg text-sm text-n-text placeholder-n-muted focus:outline-none focus:border-n-green transition-colors resize-none"
            style={{ minHeight: 100 }}
          />
          {/* Hint */}
          <p className="mt-1 text-xs text-n-muted">
            You can also paste screenshots directly
          </p>
        </div>

        {/* Attachment strip */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map(att => (
              att.kind === 'image' && att.preview ? (
                <div key={att.id} className="relative flex-shrink-0 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.preview}
                    alt={att.file.name}
                    className="w-16 h-16 object-cover rounded-lg border border-n-border"
                  />
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-n-red text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-n-raised border border-n-border rounded-lg text-xs text-n-sub max-w-[160px]"
                >
                  {att.kind === 'pdf' ? (
                    <svg className="w-3.5 h-3.5 text-n-red flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-n-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  <span className="truncate">{att.file.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="flex-shrink-0 text-n-muted hover:text-n-red transition-colors"
                    aria-label="Remove"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            ))}
          </div>
        )}

        {/* Attach button row */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={attachments.length >= MAX_ATTACHMENTS}
            title="Attach files (PNG, JPG, WEBP, PDF, TXT)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-n-raised border border-n-border rounded-lg text-xs text-n-muted hover:text-n-green hover:border-n-green transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Attach
            {attachments.length > 0 && (
              <span className="text-n-green font-medium">{attachments.length}/{MAX_ATTACHMENTS}</span>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,image/png,image/jpeg,image/webp,application/pdf,text/plain"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Summarize button */}
          <button
            onClick={handleSummarize}
            disabled={!hasContent || loading}
            className="flex-1 py-1.5 bg-n-green hover:bg-n-green-d text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Summarizing…
              </>
            ) : (
              'Summarize'
            )}
          </button>
        </div>

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
