'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import TaskPanel from '@/components/TaskPanel'
import RemindersPanel from '@/components/RemindersPanel'
import NotesPanel from '@/components/NotesPanel'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function FreedomLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#00C389" />
      <path d="M10 12h16v4H14v4h10v4H14v8h-4V12z" fill="white" />
      <rect x="22" y="20" width="8" height="4" rx="1" fill="white" />
    </svg>
  )
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
        setLoading(false)
      }
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-freedom-gray flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-[3px] border-freedom-green border-t-transparent rounded-full animate-spin" />
          <p className="text-freedom-text-light text-sm font-medium">Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User'

  const todayFormatted = new Date().toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-freedom-gray">
      {/* ── Header ── */}
      <header className="bg-freedom-black sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <FreedomLogo size={32} />
            <div className="leading-none">
              <span className="text-white font-bold text-lg tracking-tight">Freedom</span>
              <span className="text-freedom-green font-bold text-lg tracking-tight"> Dashboard</span>
            </div>
          </div>

          {/* User block */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-white text-sm font-semibold leading-tight">
                {getGreeting()}, <span className="capitalize">{displayName}</span>
              </p>
              <p className="text-white/45 text-xs mt-0.5">{todayFormatted}</p>
            </div>

            <div className="w-9 h-9 bg-freedom-green rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm uppercase">
                {displayName.charAt(0)}
              </span>
            </div>

            <button
              onClick={handleSignOut}
              className="text-white/60 hover:text-white text-xs font-medium transition-colors px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        <div className="h-0.5 bg-freedom-green" />
      </header>

      {/* ── Main panels ── */}
      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <TaskPanel userId={user!.id} />
          <RemindersPanel userId={user!.id} />
          <NotesPanel userId={user!.id} />
        </div>
      </main>
    </div>
  )
}
