'use client'

import { useState, useEffect, useCallback } from 'react'

interface FetchedPlan {
  id: string
  name: string
  price: string
  data: string
  network: string
  promoText: string
  is_promo: boolean
}

interface PlansResponse {
  plans: FetchedPlan[]
  fetched_at: string | null
  status: 'ok' | 'empty' | 'error'
}

function formatLastUpdated(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  const time = d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return time
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) + ', ' + time
}

function PlanSkeleton() {
  return (
    <div className="bg-n-raised border border-n-border rounded-lg px-3 py-2.5 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-n-hover rounded w-2/3" />
          <div className="h-2.5 bg-n-hover rounded w-1/3" />
        </div>
        <div className="h-4 bg-n-hover rounded w-14 flex-shrink-0" />
      </div>
    </div>
  )
}

export default function PlansPanel() {
  const [plans, setPlans] = useState<FetchedPlan[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [status, setStatus] = useState<'ok' | 'empty' | 'error' | null>(null)

  const loadPlans = useCallback(async (force = false) => {
    if (force) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/fetch-plans', { cache: 'no-store' })
      const data = await res.json() as PlansResponse

      setPlans(data.plans ?? [])
      setFetchedAt(data.fetched_at ?? null)
      setStatus(data.status ?? 'error')
    } catch {
      setPlans([])
      setFetchedAt(null)
      setStatus('error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadPlans() }, [loadPlans])

  const isSpinning = loading || refreshing

  function emptyMessage(): string {
    if (status === 'empty' && !fetchedAt) return 'Plans syncing — check back in a few minutes.'
    if (status === 'empty' && fetchedAt) return 'Could not parse plans — tap ↻ to retry.'
    if (status === 'error') return 'Could not load plans — tap ↻ to retry.'
    return 'No plans found — tap ↻ to retry.'
  }

  return (
    <div className="bg-n-surface border border-n-border rounded-xl flex flex-col" style={{ minHeight: 400 }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-n-divider">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 bg-n-green rounded-full flex-shrink-0" />
          <h2 className="text-sm font-semibold text-n-text">Today&apos;s Plans</h2>
          <button
            onClick={() => loadPlans(true)}
            disabled={isSpinning}
            title="Refresh plans"
            className="ml-auto p-1 text-n-muted hover:text-n-green transition-colors disabled:opacity-40"
            aria-label="Refresh plans"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <>
            <PlanSkeleton />
            <PlanSkeleton />
            <PlanSkeleton />
            <PlanSkeleton />
          </>
        ) : plans.length === 0 ? (
          <p className="text-xs text-n-muted text-center py-8 leading-relaxed px-2">
            {emptyMessage()}
          </p>
        ) : (
          plans.map(plan => (
            <div
              key={plan.id}
              className="bg-n-raised border border-n-border rounded-lg px-3 py-2.5"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-n-text leading-tight">
                      {plan.name}
                    </span>
                    {plan.is_promo && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-n-green-x text-n-green tracking-wide flex-shrink-0">
                        PROMO
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
                    {plan.data && (
                      <span className="text-xs text-n-sub">{plan.data}</span>
                    )}
                    {plan.data && plan.network && (
                      <span className="text-xs text-n-muted">·</span>
                    )}
                    {plan.network && (
                      <span className="text-xs text-n-muted">{plan.network}</span>
                    )}
                  </div>
                  {plan.promoText && (
                    <p className="text-xs text-n-green mt-0.5 leading-tight">{plan.promoText}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-n-green flex-shrink-0 mt-0.5">
                  {plan.price}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {fetchedAt && (
        <div className="px-4 pb-3 pt-2 border-t border-n-divider flex-shrink-0">
          <p className="text-xs text-n-muted">
            Updated: {formatLastUpdated(fetchedAt)}
          </p>
        </div>
      )}
    </div>
  )
}
