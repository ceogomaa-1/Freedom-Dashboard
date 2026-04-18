'use client'

import { useState, useEffect } from 'react'

// TODO: Replace manual input with automated fetch from Freedom website
// Requires: authenticated session forwarding from connect.freedommobile.ca
// or corporate API access credentials
// Endpoint target: Freedom public plans page + Connect internal pricing tools

interface Plan {
  id: string
  name: string
  data: string
  price: string
  is_promo: boolean
}

export default function PlansPanel() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [editing, setEditing] = useState(false)
  const [editPlans, setEditPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchPlans() }, [])

  async function fetchPlans() {
    const res = await fetch('/api/plans', { cache: 'no-store' })
    const data = await res.json() as { snapshot: { plans: Plan[] } | null }
    if (res.ok && data.snapshot) {
      setPlans(data.snapshot.plans ?? [])
    }
    setLoading(false)
  }

  function startEdit() {
    setEditPlans(plans.map(p => ({ ...p })))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setEditPlans([])
  }

  async function saveEdit() {
    setSaving(true)
    const res = await fetch('/api/plans', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plans: editPlans }),
    })
    const data = await res.json() as { snapshot: { plans: Plan[] } }
    if (res.ok) {
      setPlans(data.snapshot.plans ?? editPlans)
      setEditing(false)
    }
    setSaving(false)
  }

  function addPlan() {
    setEditPlans(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: '', data: '', price: '', is_promo: false },
    ])
  }

  function removePlan(id: string) {
    setEditPlans(prev => prev.filter(p => p.id !== id))
  }

  function updatePlan(id: string, field: keyof Plan, value: string | boolean) {
    setEditPlans(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  const displayPlans = editing ? editPlans : plans

  return (
    <div className="bg-n-surface border border-n-border rounded-xl flex flex-col" style={{ minHeight: 400 }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-n-divider">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 bg-n-green rounded-full flex-shrink-0" />
          <h2 className="text-sm font-semibold text-n-text">Today's Plans</h2>
          {!editing ? (
            <button
              onClick={startEdit}
              className="ml-auto text-xs text-n-muted hover:text-n-green transition-colors"
            >
              Edit Plans
            </button>
          ) : (
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={cancelEdit}
                className="text-xs text-n-muted hover:text-n-sub transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="text-xs text-n-green hover:text-n-green-d font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-n-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayPlans.length === 0 && !editing ? (
          <p className="text-xs text-n-muted text-center py-8">
            No plans yet — click &quot;Edit Plans&quot; to add the current lineup.
          </p>
        ) : (
          <>
            {displayPlans.map(plan =>
              editing ? (
                <div
                  key={plan.id}
                  className="bg-n-raised border border-n-border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={plan.name}
                      onChange={e => updatePlan(plan.id, 'name', e.target.value)}
                      placeholder="Plan name"
                      className="flex-1 px-2 py-1.5 bg-n-bg border border-n-border rounded text-xs text-n-text placeholder-n-muted focus:outline-none focus:border-n-green transition-colors"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-n-muted cursor-pointer select-none flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={plan.is_promo}
                        onChange={e => updatePlan(plan.id, 'is_promo', e.target.checked)}
                        className="accent-[#00C389] w-3 h-3"
                      />
                      Promo
                    </label>
                    <button
                      onClick={() => removePlan(plan.id)}
                      className="text-n-muted hover:text-n-red transition-colors flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={plan.data}
                      onChange={e => updatePlan(plan.id, 'data', e.target.value)}
                      placeholder="Data (e.g. 50GB)"
                      className="flex-1 px-2 py-1.5 bg-n-bg border border-n-border rounded text-xs text-n-text placeholder-n-muted focus:outline-none focus:border-n-green transition-colors"
                    />
                    <input
                      value={plan.price}
                      onChange={e => updatePlan(plan.id, 'price', e.target.value)}
                      placeholder="Price (e.g. $45/mo)"
                      className="flex-1 px-2 py-1.5 bg-n-bg border border-n-border rounded text-xs text-n-text placeholder-n-muted focus:outline-none focus:border-n-green transition-colors"
                    />
                  </div>
                </div>
              ) : (
                <div
                  key={plan.id}
                  className="flex items-center gap-3 bg-n-raised border border-n-border rounded-lg px-3 py-2.5 hover:border-n-border transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-n-text">{plan.name}</span>
                      {plan.is_promo && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-n-green-x text-n-green tracking-wide">
                          PROMO
                        </span>
                      )}
                    </div>
                    {plan.data && (
                      <span className="text-xs text-n-sub">{plan.data}</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-n-green flex-shrink-0">
                    {plan.price}
                  </span>
                </div>
              )
            )}

            {editing && (
              <button
                onClick={addPlan}
                className="w-full py-2 border border-dashed border-n-border rounded-lg text-xs text-n-muted hover:text-n-green hover:border-n-green transition-colors"
              >
                + Add Plan
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
