import { createHash, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/utils/supabase/admin'
import { SESSION_COOKIE } from '@/utils/auth/constants'
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30

export interface SessionUser {
  email: string
  userId: string
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString()
  const cookieStore = await cookies()
  const admin = createAdminClient()

  const { error } = await admin.from('app_sessions').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  })

  if (error) {
    throw error
  }

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    expires: new Date(expiresAt),
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const admin = createAdminClient()

  if (token) {
    await admin.from('app_sessions').delete().eq('token_hash', hashToken(token))
  }

  cookieStore.delete(SESSION_COOKIE)
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) {
    return null
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: session } = await admin
    .from('app_sessions')
    .select('user_id')
    .eq('token_hash', hashToken(token))
    .gt('expires_at', now)
    .maybeSingle()

  if (!session) {
    return null
  }

  const { data: authUser } = await admin
    .from('app_auth_users')
    .select('email, user_id')
    .eq('user_id', session.user_id)
    .maybeSingle()

  if (!authUser) {
    return null
  }

  return {
    email: authUser.email,
    userId: authUser.user_id,
  }
}
