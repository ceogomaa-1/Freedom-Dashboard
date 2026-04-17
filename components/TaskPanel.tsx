'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Task {
  id: string
  text: string
  completed: boolean
  created_at: string
}

export default function TaskPanel({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState(true)
  const editRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchTasks()
  }, [])

  useEffect(() => {
    if (editingId) editRef.current?.focus()
  }, [editingId])

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (data) setTasks(data)
    setLoading(false)
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTask.trim()) return
    const { data } = await supabase
      .from('tasks')
      .insert({ user_id: userId, text: newTask.trim(), completed: false })
      .select()
      .single()
    if (data) {
      setTasks(prev => [...prev, data])
      setNewTask('')
    }
  }

  async function toggleTask(id: string, completed: boolean) {
    const { data } = await supabase
      .from('tasks')
      .update({ completed: !completed })
      .eq('id', id)
      .select()
      .single()
    if (data) setTasks(prev => prev.map(t => t.id === id ? data : t))
  }

  function startEdit(task: Task) {
    setEditingId(task.id)
    setEditText(task.text)
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) { setEditingId(null); return }
    const { data } = await supabase
      .from('tasks')
      .update({ text: editText.trim() })
      .eq('id', id)
      .select()
      .single()
    if (data) setTasks(prev => prev.map(t => t.id === id ? data : t))
    setEditingId(null)
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const completedCount = tasks.filter(t => t.completed).length
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0

  return (
    <div className="bg-white rounded-2xl shadow-card border border-freedom-border flex flex-col" style={{ minHeight: 520 }}>
      {/* Panel header */}
      <div className="p-5 border-b border-freedom-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 bg-freedom-green rounded-full" />
          <h2 className="text-base font-bold text-freedom-black tracking-tight">Daily Operations</h2>
        </div>
        <p className="text-xs text-freedom-text-light ml-4">
          {completedCount} of {tasks.length} completed
        </p>
        {tasks.length > 0 && (
          <div className="ml-4 mt-2.5 h-1.5 bg-freedom-gray rounded-full overflow-hidden">
            <div
              className="h-full bg-freedom-green rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: 380 }}>
        {loading ? (
          <Spinner />
        ) : tasks.length === 0 ? (
          <EmptyState icon="tasks" text="No tasks yet. Add your first one below!" />
        ) : (
          tasks.map(task => (
            <div
              key={task.id}
              className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${
                task.completed
                  ? 'bg-freedom-gray border-freedom-border'
                  : 'bg-white border-freedom-border hover:border-freedom-green/40 hover:shadow-sm'
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleTask(task.id, task.completed)}
                className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  task.completed
                    ? 'bg-freedom-green border-freedom-green'
                    : 'border-freedom-border hover:border-freedom-green'
                }`}
              >
                {task.completed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Text / inline edit */}
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
                  className="flex-1 text-sm bg-transparent border-b-2 border-freedom-green outline-none py-0.5 text-freedom-text"
                />
              ) : (
                <span
                  onClick={() => !task.completed && startEdit(task)}
                  className={`flex-1 text-sm leading-snug select-none ${
                    task.completed
                      ? 'line-through text-freedom-text-light'
                      : 'text-freedom-text cursor-pointer hover:text-freedom-black'
                  }`}
                >
                  {task.text}
                </span>
              )}

              {/* Actions */}
              {editingId !== task.id && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!task.completed && (
                    <button
                      onClick={() => startEdit(task)}
                      className="p-1 text-freedom-text-light hover:text-freedom-green transition-colors"
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                  )}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 text-freedom-text-light hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add task */}
      <div className="border-t border-freedom-border p-4">
        <form onSubmit={addTask} className="flex gap-2">
          <input
            type="text"
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            placeholder="Add a new task…"
            className="flex-1 px-3 py-2.5 text-sm border-2 border-freedom-border rounded-xl focus:outline-none focus:border-freedom-green text-freedom-text placeholder-freedom-text-light transition-colors"
          />
          <button
            type="submit"
            disabled={!newTask.trim()}
            className="px-4 py-2.5 bg-freedom-green hover:bg-freedom-green-dark text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            title="Add task"
          >
            <PlusIcon />
          </button>
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

function EmptyState({ icon, text }: { icon: 'tasks' | 'calendar'; text: string }) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 bg-freedom-green-light rounded-2xl flex items-center justify-center mx-auto mb-3">
        {icon === 'tasks' ? (
          <svg className="w-6 h-6 text-freedom-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-freedom-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <p className="text-freedom-text-light text-sm">{text}</p>
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
