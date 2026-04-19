'use client'

import { useState, useEffect, useCallback } from 'react'

interface PricingOption {
  monthlyPrice: number
  fromPrice: number
  saveUpTo: number
  requiredPlan: string
  termMonths: number
}

interface Device {
  id: string
  brand: string
  name: string
  is5G: boolean
  tradeUp: PricingOption | null
  myTab: PricingOption | null
}

interface DevicesResponse {
  plans: Device[]
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

function PricingRow({
  label,
  option,
  accent,
}: {
  label: string
  option: PricingOption
  accent: 'green' | 'blue'
}) {
  const labelClass =
    accent === 'green' ? 'text-n-green' : 'text-blue-400'

  return (
    <div className="mt-2 pt-2 border-t border-n-divider first:mt-0 first:pt-0 first:border-t-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-xs font-semibold ${labelClass}`}>{label}</span>
        <span className="text-sm font-bold text-n-text">
          ${option.monthlyPrice % 1 === 0 ? option.monthlyPrice : option.monthlyPrice.toFixed(2)}/mo.
        </span>
      </div>
      <div className="mt-0.5 space-y-0.5">
        <p className="text-xs text-n-muted">
          From ${option.fromPrice} ·{' '}
          <span className="text-n-green">Save up to ${option.saveUpTo}</span>
        </p>
        {(option.requiredPlan || option.termMonths) && (
          <p className="text-xs text-n-muted">
            {option.requiredPlan && `With ${option.requiredPlan}`}
            {option.requiredPlan && option.termMonths ? ' · ' : ''}
            {option.termMonths ? `${option.termMonths}-month term` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

function DeviceSkeleton() {
  return (
    <div className="bg-n-raised border border-n-border rounded-lg px-3 py-3 animate-pulse">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="space-y-1.5 flex-1">
          <div className="h-2.5 bg-n-hover rounded w-1/4" />
          <div className="h-3.5 bg-n-hover rounded w-2/3" />
        </div>
        <div className="h-5 bg-n-hover rounded w-10" />
      </div>
      <div className="space-y-1 mt-3">
        <div className="h-3 bg-n-hover rounded w-full" />
        <div className="h-2.5 bg-n-hover rounded w-3/4" />
      </div>
    </div>
  )
}

export default function PlansPanel() {
  const [devices, setDevices] = useState<Device[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [status, setStatus] = useState<'ok' | 'empty' | 'error' | null>(null)

  const loadDevices = useCallback(async (force = false) => {
    if (force) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/fetch-plans', { cache: 'no-store' })
      const data = await res.json() as DevicesResponse

      setDevices(data.plans ?? [])
      setFetchedAt(data.fetched_at ?? null)
      setStatus(data.status ?? 'error')
    } catch {
      setDevices([])
      setFetchedAt(null)
      setStatus('error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadDevices() }, [loadDevices])

  const isSpinning = loading || refreshing

  function emptyMessage(): string {
    if (status === 'empty' && !fetchedAt) return 'Devices syncing — check back in a few minutes.'
    if (status === 'empty' && fetchedAt) return 'Could not parse devices — tap ↻ to retry.'
    if (status === 'error') return 'Could not load devices — tap ↻ to retry.'
    return 'No devices found — tap ↻ to retry.'
  }

  return (
    <div className="bg-n-surface border border-n-border rounded-xl flex flex-col" style={{ minHeight: 400 }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-n-divider">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 bg-n-green rounded-full flex-shrink-0" />
          <h2 className="text-sm font-semibold text-n-text">Today&apos;s Devices</h2>
          <button
            onClick={() => loadDevices(true)}
            disabled={isSpinning}
            title="Refresh devices"
            className="ml-auto p-1 text-n-muted hover:text-n-green transition-colors disabled:opacity-40"
            aria-label="Refresh devices"
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
            <DeviceSkeleton />
            <DeviceSkeleton />
            <DeviceSkeleton />
            <DeviceSkeleton />
          </>
        ) : devices.length === 0 ? (
          <p className="text-xs text-n-muted text-center py-8 leading-relaxed px-2">
            {emptyMessage()}
          </p>
        ) : (
          devices.filter(d => d.name && d.name.length > 2 && !/^\d+$/.test(d.name)).map(device => (
            <div
              key={device.id}
              className="bg-n-raised border border-n-border rounded-lg px-3 py-3"
            >
              {/* Device header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {device.brand && (
                    <p className="text-xs text-n-muted leading-tight">{device.brand}</p>
                  )}
                  <p className="text-sm font-bold text-n-text leading-tight">{device.name}</p>
                </div>
                {device.is5G && (
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #f97316, #ef4444)',
                      color: '#fff',
                      fontSize: '0.65rem',
                      letterSpacing: '0.05em',
                    }}
                  >
                    5G+
                  </span>
                )}
              </div>

              {/* Pricing options */}
              <div className="mt-2">
                {device.tradeUp && (
                  <PricingRow label="🔄 Trade-Up" option={device.tradeUp} accent="green" />
                )}
                {device.myTab && (
                  <PricingRow label="📱 MyTab" option={device.myTab} accent="blue" />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {fetchedAt && (
        <div className="px-4 pb-3 pt-2 border-t border-n-divider flex-shrink-0">
          <p className="text-xs text-n-muted">Updated: {formatLastUpdated(fetchedAt)}</p>
        </div>
      )}
    </div>
  )
}
