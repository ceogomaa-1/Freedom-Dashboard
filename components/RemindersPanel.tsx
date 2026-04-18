'use client'

import { useEffect, useState, useRef } from 'react'

interface Reminder {
  id: string
  text: string
  date: string
  completed: boolean
  created_at: string
}

export default function RemindersPanel() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [newText, setNewText] = useState('')
  const [newDate, setNewDate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState('')
  const [loading, setLoading] = useState(true)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchReminders(); setNewDate(todayISO()) }, [])
  useEffect(() => { if (editingId) editRef.current?.focus() }, [editingId])

  function todayISO() { return new Date().toISOString().split('T')[0] }

  async function fetchReminders() {
    const r = await fetch('/api/reminders', { cache: 'no-store' })
    const p = await r.json()
    if (r.ok) setReminders(p.reminders)
    setLoading(false)
  }

  async function addReminder(e: React.FormEvent) {
    e.preventDefault()
    if (!newText.trim() || !newDate) return
    const r = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newText.trim(), date: newDate }),
    })
    const p = await r.json()
    if (r.ok) {
      setReminders(prev => [...prev, p.reminder].sort((a, b) => a.date.localeCompare(b.date)))
      setNewText(''); setNewDate(todayISO())
    }
  }

  async function toggleReminder(id: string, completed: boolean) {
    const r = await fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed }),
    })
    const p = await r.json()
    if (r.ok) setReminders(prev => prev.map(x => x.id === id ? p.reminder : x))
  }

  async function saveEdit(id: string) {
    if (!editText.trim() || !editDate) { setEditingId(null); return }
    const r = await fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: editText.trim(), date: editDate }),
    })
    const p = await r.json()
    if (r.ok) {
      setReminders(prev =>
        prev.map(x => x.id === id ? p.reminder : x).sort((a, b) => a.date.localeCompare(b.date))
      )
    }
    setEditingId(null)
  }

  async function deleteReminder(id: string) {
    const r = await fetch(`/api/reminders/${id}`, { method: 'DELETE' })
    if (r.ok) setReminders(prev => prev.filter(x => x.id !== id))
  }

  function formatDate(d: string) {
    const date = new Date(d + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    if (date.getTime() === today.getTime()) return 'Today'
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow'
    return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function isOverdue(d: string, completed: boolean) {
    if (completed) return false
    const date = new Date(d + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return date < today
  }

  function isToday(d: string) {
    const date = new Date(d + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return date.getTime() === today.getTime()
  }

  const upcoming = reminders.filter(r => !r.completed).length

  return (
    <div className="bg-n-surface border border-n-border rounded-xl flex flex-col" style={{ minHeight: 520 }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-n-divider">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 bg-n-green rounded-full flex-shrink-0" />
          <h2 className="text-sm font-semibold text-n-text">Future Reminders</h2>
          <span className="ml-auto text-xs text-n-muted">{upcoming} upcoming</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1" style={{ maxHeight: 400 }}>
        {loading ? <Spinner /> : reminders.length === 0 ? (
          <Empty text="No reminders yet — add one below." />
        ) : reminders.map(r => {
          const overdue = isOverdue(r.date, r.completed)
          const today = isToday(r.date)
          return (
            <div
              key={r.id}
              className={`group px-2.5 py-2 rounded-lg border transition-colors ${
                r.completed
                  ? 'opacity-40 border-transparent'
                  : overdue
                    ? 'border-n-red/20 bg-n-red-x'
                    : 'border-transparent hover:bg-n-raised'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {/* Checkbox */}
                <button
                  onClick={() => toggleReminder(r.id, r.completed)}
                  className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    r.completed ? 'bg-n-green border-n-green' : 'border-n-border hover:border-n-green'
                  }`}
                >
                  {r.completed && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {editingId === r.id ? (
                    <div className="space-y-1.5">
                      <input
                        ref={editRef}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="w-full text-sm bg-transparent border-b border-n-green outline-none text-n-text"
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit(r.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        className="text-xs bg-transparent border-b border-n-border outline-none text-n-sub focus:border-n-green transition-colors"
                      />
                      <div className="flex gap-3 pt-0.5">
                        <button onClick={() => saveEdit(r.id)} className="text-xs text-n-green font-medium">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-n-muted">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={`text-sm leading-snug ${r.completed ? 'line-through text-n-muted' : 'text-n-text'}`}>
                        {r.text}
                      </p>
                      <span className={`inline-block mt-1 text-xs font-medium px-1.5 py-0.5 rounded-md ${
                        r.completed
                          ? 'bg-n-raised text-n-muted'
                          : overdue
                            ? 'bg-n-red-x text-n-red'
                            : today
                              ? 'bg-n-green-x text-n-green'
                              : 'bg-n-raised text-n-sub'
                      }`}>
                        {overdue && !r.completed ? '⚠ ' : ''}{formatDate(r.date)}
                      </span>
                    </>
                  )}
                </div>

                {/* Actions */}
                {editingId !== r.id && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <IconBtn onClick={() => { setEditingId(r.id); setEditText(r.text); setEditDate(r.date) }} label="Edit">
                      <EditIcon />
                    </IconBtn>
                    <IconBtn onClick={() => deleteReminder(r.id)} label="Delete" danger>
                      <TrashIcon />
                    </IconBtn>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add form */}
      <div className="px-3 pb-3 pt-2 border-t border-n-divider space-y-2">
        <input
          type="text"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          placeholder="Reminder text…"
          onKeyDown={e => { if (e.key === 'Enter') { const btn = document.getElementById('add-reminder-btn'); btn?.click() } }}
          className="w-full px-3 py-2 bg-n-bg border border-n-border rounded-lg text-sm text-n-text placeholder-n-muted focus:outline-none focus:border-n-green transition-colors"
        />
        <form onSubmit={addReminder} className="flex gap-2">
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="flex-1 px-3 py-2 bg-n-bg border border-n-border rounded-lg text-sm text-n-text focus:outline-none focus:border-n-green transition-colors"
          />
          <button
            id="add-reminder-btn"
            type="submit"
            disabled={!newText.trim() || !newDate}
            className="px-3 py-2 bg-n-green hover:bg-n-green-d text-white rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            <PlusIcon />
          </button>
        </form>
      </div>
    </div>
  )
}

function IconBtn({ onClick, label, danger, children }: { onClick: () => void; label: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} className={`p-1 rounded transition-colors ${danger ? 'text-n-muted hover:text-n-red' : 'text-n-muted hover:text-n-green'}`}>
      {children}
    </button>
  )
}

function Spinner() {
  return <div className="flex items-center justify-center py-10"><div className="w-5 h-5 border-2 border-n-green border-t-transparent rounded-full animate-spin" /></div>
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-n-muted text-center py-8">{text}</p>
}

function EditIcon() {
  return <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
}

function TrashIcon() {
  return <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
}

function PlusIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
}
