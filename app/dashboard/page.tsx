import { redirect } from 'next/navigation'
import TaskPanel from '@/components/TaskPanel'
import RemindersPanel from '@/components/RemindersPanel'
import NotesPanel from '@/components/NotesPanel'
import { getSessionUser } from '@/utils/auth/session'
import DashboardShell from '@/components/DashboardShell'

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

export default async function DashboardPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const displayName =
    user.email.split('@')[0] ||
    'User'

  const todayFormatted = new Date().toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <DashboardShell
      displayName={displayName}
      greeting={getGreeting()}
      todayFormatted={todayFormatted}
    >
      <TaskPanel />
      <RemindersPanel />
      <NotesPanel />
    </DashboardShell>
  )
}
