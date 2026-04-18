'use client'

import { useEffect, useState, useRef } from 'react'

interface Task {
  id: string
  text: string
  completed: boolean
  created_at: string
}

export default function TaskPanel() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState(true)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchTasks() }, [])
  useEffect(() => { if (editingId) editRef.current?.focus() }, [editingId])

  async function fetchTasks() {
    const r = await fetch('/api/tasks', { cache: 'no-store' })
    const p = await r.json()
    if (r.ok) setTasks(p.tasks)
    setLoading(false)
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTask.trim()) return
    const r = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newTask.trim() }),
    })
    const p = await r.json()
    if (r.ok) { setTasks(prev => [...prev, p.task]); setNewTask('') }
  }

  async function toggleTask(id: string, completed: boolean) {
    const r = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed }),
    })
    const p = await r.json()
    if (r.ok) setTasks(prev => prev.map(t => t.id === id ? p.task : t))
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) { setEditingId(null); return }
    const r = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: editText.trim() }),
    })
    const p = await r.json()
    if (r.ok) setTasks(prev => prev.map(t => t.id === id ? p.task : t))
    setEditingId(null)
  }

  async function deleteTask(id: string) {
    const r = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (r.ok) setTasks(prev => prev.filter(t => t.id !== id))
  }

  const done = tasks.filter(t => t.completed).length
  const pct = tasks.length > 0 ? (done / tasks.length) * 100 : 0

  return (
    <div className="bg-n-surface border border-n-border rounded-xl flex flex-col" style={{ minHeight: 520 }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-n-divider">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-0.5 h-4 bg-n-green rounded-full flex-shrink-0" />
          <h2 className="text-sm font-semibold text-n-text">Daily Operations</h2>
          <span className="ml-auto text-xs text-n-muted">{done}/{tasks.length}</span>
        </div>
        {tasks.length > 0 && (
          <div className="h-0.5 bg-n-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-n-green rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1" style={{ maxHeight: 400 }}>
        {loading ? <Spinner /> : tasks.length === 0 ? (
          <Empty text="No tasks yet — add one below." />
        ) : tasks.map(task => (
          <div
            key={task.id}
            className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${
              task.completed ? 'opacity-50' : 'hover:bg-n-raised'
            }`}
          >
            {/* Checkbox */}
            <button
              onClick={() => toggleTask(task.id, task.completed)}
              className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                task.completed
                  ? 'bg-n-green border-n-green'
                  : 'border-n-border hover:border-n-green'
              }`}
            >
              {task.completed && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* Text */}
            {editingId === task.id ? (
              <input
                ref={editRef}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onBlur={() => saveEdit(task.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEdit(task.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="flex-1 text-sm bg-transparent border-b border-n-green outline-none text-n-text py-0"
              />
            ) : (
              <span
                onClick={() => !task.completed && (setEditingId(task.id), setEditText(task.text))}
                className={`flex-1 text-sm leading-snug select-none ${
                  task.completed ? 'line-through text-n-muted' : 'text-n-text cursor-text'
                }`}
              >
                {task.text}
              </span>
            )}

            {/* Actions */}
            {editingId !== task.id && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {!task.completed && (
                  <IconBtn onClick={() => { setEditingId(task.id); setEditText(task.text) }} label="Edit">
                    <EditIcon />
                  </IconBtn>
                )}
                <IconBtn onClick={() => deleteTask(task.id)} label="Delete" danger>
                  <TrashIcon />
                </IconBtn>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add input */}
      <div className="px-3 pb-3 pt-2 border-t border-n-divider">
        <form onSubmit={addTask} className="flex gap-2">
          <input
            type="text"
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            placeholder="Add a task…"
            className="flex-1 px-3 py-2 bg-n-bg border border-n-border rounded-lg text-sm text-n-text placeholder-n-muted focus:outline-none focus:border-n-green transition-colors"
          />
          <button
            type="submit"
            disabled={!newTask.trim()}
            className="px-3 py-2 bg-n-green hover:bg-n-green-d text-white rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            <PlusIcon />
          </button>
        </form>
      </div>
    </div>
  )
}

function IconBtn({
  onClick,
  label,
  danger,
  children,
}: {
  onClick: () => void
  label: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-1 rounded transition-colors ${
        danger
          ? 'text-n-muted hover:text-n-red'
          : 'text-n-muted hover:text-n-green'
      }`}
    >
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-5 h-5 border-2 border-n-green border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-n-muted text-center py-8">{text}</p>
}

function EditIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
