'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Reminder {
  id: string
  text: string
  date: string
  completed: boolean
  created_at: string
}

export default function RemindersPanel({ userId }: { userId: string }) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [newText, setNewText] = useState('')
  const [newDate, setNewDate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState('')
  const [loading, setLoading] = useState(true)
  const editRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchReminders()
    setNewDate(todayISO())
  }, [])

  useEffect(() => {
    if (editingId) editRef.current?.focus()
  }, [editingId])

  function todayISO() {
    return new Date().toISOString().split('T')[0]
  }

  async function fetchReminders() {
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })
    if (data) setReminders(data)
    setLoading(false)
  }

  async function addReminder(e: React.FormEvent) {
    e.preventDefault()
    if (!newText.trim() || !newDate) return
    const { data } = await supabase
      .from('reminders')
      .insert({ user_id: userId, text: newText.trim(), date: newDate, completed: false })
      .select()
      .single()
    if (data) {
      setReminders(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)))
      setNewText('')
      setNewDate(todayISO())
    }
  }

  async function toggleReminder(id: string, completed: boolean) {
    const { data } = await supabase
      .from('reminders')
      .update({ completed: !completed })
      .eq('id', id)
      .select()
      .single()
    if (data) setReminders(prev => prev.map(r => r.id === id ? data : r))
  }

  function startEdit(r: Reminder) {
    setEditingId(r.id)
    setEditText(r.text)
    setEditDate(r.date)
  }

  async function saveEdit(id: string) {
    if (!editText.trim() || !editDate) { setEditingId(null); return }
    const { data } = await supabase
      .from('reminders')
      .update({ text: editText.trim(), date: editDate })
      .eq('id', id)
      .select()
      .single()
    if (data) {
      setReminders(prev =>
        prev.map(r => r.id === id ? data : r).sort((a, b) => a.date.localeCompare(b.date))
      )
    }
    setEditingId(null)
  }

  async function deleteReminder(id: string) {
    await supabase.from('reminders').delete().eq('id', id)
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)

    if (date.getTime() === today.getTime()) return 'Today'
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow'
    return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function isOverdue(dateStr: string, completed: boolean) {
    if (completed) return false
    const date = new Date(dateStr + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return date < today
  }

  function isToday(dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return date.getTime() === today.getTime()
  }

  const upcomingCount = reminders.filter(r => !r.completed).length

  return (
    <div className="bg-white rounded-2xl shadow-card border border-freedom-border flex flex-col" style={{ minHeight: 520 }}>
      {/* Panel header */}
      <div className="p-5 border-b border-freedom-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 bg-freedom-green rounded-full" />
          <h2 className="text-base font-bold text-freedom-black tracking-tight">Future Reminders</h2>
        </div>
        <p className="text-xs text-freedom-text-light ml-4">
          {upcomingCount} upcoming reminder{upcomingCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Reminders list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: 380 }}>
        {loading ? (
          <Spinner />
        ) : reminders.length === 0 ? (
          <EmptyState />
        ) : (
          reminders.map(reminder => {
            const overdue = isOverdue(reminder.date, reminder.completed)
            const today = isToday(reminder.date)

            return (
              <div
                key={reminder.id}
                className={`group p-3 rounded-xl border transition-all ${
                  reminder.completed
                    ? 'bg-freedom-gray border-freedom-border'
                    : overdue
                      ? 'bg-red-50 border-red-200'
                      : 'bg-white border-freedom-border hover:border-freedom-green/40 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleReminder(reminder.id, reminder.completed)}
                    className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      reminder.completed
                        ? 'bg-freedom-green border-freedom-green'
                        : 'border-freedom-border hover:border-freedom-green'
                    }`}
                  >
                    {reminder.completed && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {editingId === reminder.id ? (
                      <div className="space-y-2">
                        <input
                          ref={editRef}
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          className="w-full text-sm bg-transparent border-b-2 border-freedom-green outline-none py-0.5 text-freedom-text"
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit(reminder.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                        />
                        <input
                          type="date"
                          value={editDate}
                          onChange={e => setEditDate(e.target.value)}
                          className="text-xs bg-transparent border-b border-freedom-border outline-none py-0.5 text-freedom-text-light focus:border-freedom-green transition-colors"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => saveEdit(reminder.id)}
                            className="text-xs text-freedom-green font-semibold hover:text-freedom-green-dark"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs text-freedom-text-light hover:text-freedom-text"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className={`text-sm font-medium leading-snug ${
                          reminder.completed ? 'line-through text-freedom-text-light' : 'text-freedom-text'
                        }`}>
                          {reminder.text}
                        </p>
                        <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
                          reminder.completed
                            ? 'bg-gray-100 text-gray-400'
                            : overdue
                              ? 'bg-red-100 text-red-600'
                              : today
                                ? 'bg-freedom-green-light text-freedom-green'
                                : 'bg-freedom-gray text-freedom-text-light'
                        }`}>
                          {overdue && !reminder.completed ? '⚠ ' : ''}{formatDate(reminder.date)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {editingId !== reminder.id && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => startEdit(reminder)}
                        className="p-1 text-freedom-text-light hover:text-freedom-green transition-colors"
                        title="Edit"
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => deleteReminder(reminder.id)}
                        className="p-1 text-freedom-text-light hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add reminder */}
      <div className="border-t border-freedom-border p-4">
        <form onSubmit={addReminder} className="space-y-2">
          <input
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Add a reminder…"
            className="w-full px-3 py-2.5 text-sm border-2 border-freedom-border rounded-xl focus:outline-none focus:border-freedom-green text-freedom-text placeholder-freedom-text-light transition-colors"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="flex-1 px-3 py-2.5 text-sm border-2 border-freedom-border rounded-xl focus:outline-none focus:border-freedom-green text-freedom-text transition-colors"
            />
            <button
              type="submit"
              disabled={!newText.trim() || !newDate}
              className="px-4 py-2.5 bg-freedom-green hover:bg-freedom-green-dark text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              title="Add reminder"
            >
              <PlusIcon />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-6 h-6 border-2 border-freedom-green border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 bg-freedom-green-light rounded-2xl flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-freedom-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-freedom-text-light text-sm">No reminders yet. Add one below!</p>
    </div>
  )
}

function EditIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
    </svg>
  )
}
