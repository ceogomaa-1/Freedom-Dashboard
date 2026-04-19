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
  fetched_at: string
  from_cache: boolean
  stale?: boolean
  error?: string
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
  const [error, setError] = useState('')

  const loadPlans = useCallback(async (force = false) => {
    if (force) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/fetch-plans${force ? '?force=true' : ''}`, {
        cache: 'no-store',
      })
      const data = await res.json() as PlansResponse

      if (!res.ok || data.error) {
        setError(data.error ?? 'Could not load plans — tap ↻ to retry.')
        setPlans([])
      } else {
        setPlans(data.plans ?? [])
        setFetchedAt(data.fetched_at)
        if (data.stale) {
          setError('Showing cached data — live fetch failed. Tap ↻ to retry.')
        }
      }
    } catch {
      setError('Could not load plans — tap ↻ to retry.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadPlans() }, [loadPlans])

  const isSpinning = loading || refreshing

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
            title="Refresh plans from Freedom website"
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
        ) : error && plans.length === 0 ? (
          <p className="text-xs text-n-muted text-center py-8 leading-relaxed px-2">{error}</p>
        ) : plans.length === 0 ? (
          <p className="text-xs text-n-muted text-center py-8">
            No plans found — tap ↻ to retry.
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
      <div className="px-4 pb-3 pt-2 border-t border-n-divider flex-shrink-0 space-y-0.5">
        {error && plans.length > 0 && (
          <p className="text-xs text-n-amber">{error}</p>
        )}
        {fetchedAt && (
          <p className="text-xs text-n-muted">
            Updated: {formatLastUpdated(fetchedAt)}
          </p>
        )}
        <p className="text-xs text-n-muted">
          Verify prices at{' '}
          <a
            href="https://shop.freedommobile.ca/en-CA/plans"
            target="_blank"
            rel="noopener noreferrer"
            className="text-n-green hover:underline"
          >
            shop.freedommobile.ca
          </a>
        </p>
      </div>
    </div>
  )
}
