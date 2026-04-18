import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createSession } from '@/utils/auth/session'
import { isValidEmail, normalizeEmail } from '@/utils/auth/email'
import { verifyTotpToken } from '@/utils/auth/totp'

export async function POST(request: Request) {
  const { email, code } = await request.json()
  const normalizedEmail = normalizeEmail(email ?? '')

  if (!isValidEmail(normalizedEmail)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: authUser } = await admin
    .from('app_auth_users')
    .select('email, user_id, totp_secret, enrolled_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (!authUser?.enrolled_at || !authUser.user_id) {
    return NextResponse.json(
      { error: 'This account has not finished Authenticator setup yet.' },
      { status: 404 }
    )
  }

  if (!verifyTotpToken(authUser.totp_secret, code ?? '')) {
    return NextResponse.json({ error: 'That 6-digit code is invalid or expired.' }, { status: 401 })
  }

  await admin
    .from('app_auth_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('email', normalizedEmail)

  await createSession(authUser.user_id)

  return NextResponse.json({
    ok: true,
    user: {
      email: normalizedEmail,
      userId: authUser.user_id,
    },
  })
}
