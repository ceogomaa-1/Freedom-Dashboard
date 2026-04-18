'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'

function FreedomMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="7" fill="#00C389" />
      <path d="M10 12h16v4H14v4h10v4H14v8h-4V12z" fill="white" />
      <rect x="22" y="20" width="8" height="4" rx="1" fill="white" />
    </svg>
  )
}

export default function DashboardShell({
  children,
  displayName,
  greeting,
  todayFormatted,
}: {
  children: ReactNode
  displayName: string
  greeting: string
  todayFormatted: string
}) {
  const router = useRouter()

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem('fd_auth_email')
    router.push('/login')
    router.refresh()
  }

  const initials = displayName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-n-bg">
      {/* ── Header ── */}
      <header className="h-12 bg-n-surface border-b border-n-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-5 h-full flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <FreedomMark size={26} />
            <span className="text-sm font-semibold text-n-text tracking-tight leading-none">
              Freedom <span className="text-n-green">Dashboard</span>
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-n-text leading-tight">
                {greeting}, <span className="capitalize">{displayName}</span>
              </p>
              <p className="text-xs text-n-muted mt-0.5">{todayFormatted}</p>
            </div>

            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-n-green flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">{initials}</span>
            </div>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="flex items-center gap-1.5 text-n-muted hover:text-n-sub transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-xs hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-5 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {children}
        </div>
      </main>
    </div>
  )
}
