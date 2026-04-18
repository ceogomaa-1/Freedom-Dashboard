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
  const { data: enrollment } = await admin
    .from('app_auth_users')
    .select('email, user_id, totp_secret')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json({ error: 'Start setup first to generate a QR code.' }, { status: 404 })
  }

  if (!verifyTotpToken(enrollment.totp_secret, code ?? '')) {
    return NextResponse.json({ error: 'That 6-digit code is invalid or expired.' }, { status: 401 })
  }

  let userId = enrollment.user_id

  if (!userId) {
    const { data: authUser } = await admin
      .schema('auth')
      .from('users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (authUser?.id) {
      userId = authUser.id
    } else {
      const { data: createdUser, error } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
      })

      if (error || !createdUser.user) {
        return NextResponse.json({ error: error?.message ?? 'Unable to create the user.' }, { status: 500 })
      }

      userId = createdUser.user.id
    }
  }

  const { error: updateError } = await admin
    .from('app_auth_users')
    .update({
      user_id: userId,
      enrolled_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    })
    .eq('email', normalizedEmail)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await createSession(userId)

  return NextResponse.json({
    ok: true,
    user: {
      email: normalizedEmail,
      userId,
    },
  })
}
